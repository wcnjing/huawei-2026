// Postgres access for the store, and the one place that decides which database backs
// the app:
//
//   DATABASE_URL set    a small `pg` pool. On Vercel this points at Supabase's
//                       transaction-mode pooler; elsewhere any Postgres works.
//   DATABASE_URL unset  PGlite, a real Postgres compiled to WebAssembly and run inside
//                       Node, so `npm start` and `npm test` need nothing installed.
//
// Postgres errors are replaced before they leave this module. Postgres puts the
// offending value in an error's `detail` (for a duplicate phone, the phone number), and
// route handlers log whatever reaches them.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PGLITE_DIR = path.join(__dirname, '.pglite');
const MEMORY = 'memory://';
const POOL_MAX = 3;
const RETRYABLE_CODES = new Set(['40P01', '40001']); // deadlock, serialization failure
const MAX_ATTEMPTS = 5;

export class DatabaseConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseConfigError';
    this.code = 'DATABASE_NOT_CONFIGURED';
  }
}

/**
 * A Postgres error reduced to its SQLSTATE code and constraint name. It deliberately
 * has no `cause`: util.inspect would print the original, detail and all.
 */
export class StoreDatabaseError extends Error {
  constructor(source, label) {
    const constraint = typeof source.constraint === 'string' ? source.constraint : null;
    super(`database error ${source.code}${constraint ? ` (${constraint})` : ''} in ${label}`);
    this.name = 'StoreDatabaseError';
    this.code = source.code;
    this.constraint = constraint;
  }
}

function isPostgresError(error) {
  return Boolean(error)
    && typeof error.code === 'string'
    && /^[0-9A-Z]{5}$/.test(error.code)
    && 'severity' in error;
}

export function sanitizeDbError(error, label) {
  return isPostgresError(error) ? new StoreDatabaseError(error, label) : error;
}

function productionRuntime(env) {
  return Boolean(env.VERCEL) || env.NODE_ENV === 'production';
}

/** Decide which database to use. Pure, so the rules are testable without connecting. */
export function databaseConfig(env = process.env) {
  const url = String(env.DATABASE_URL || '').trim();
  if (url) {
    const ca = String(env.DATABASE_CA_CERT || '').trim();
    if (productionRuntime(env) && !ca) {
      throw new DatabaseConfigError(
        'DATABASE_CA_CERT is required in production so the database connection uses verified TLS',
      );
    }
    if (!ca) return { kind: 'postgres', connectionString: url, ssl: undefined };
    // pg lets TLS settings in the URL override an explicit ssl object, so remove them and
    // verify against the supplied certificate instead.
    const parsed = new URL(url);
    for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) parsed.searchParams.delete(key);
    return {
      kind: 'postgres',
      connectionString: parsed.toString(),
      // Accept a PEM pasted with literal "\n" escapes as well as real newlines.
      ssl: { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true },
    };
  }
  if (productionRuntime(env)) {
    throw new DatabaseConfigError(
      'DATABASE_URL is not set. Production must use Postgres: PGlite would write to a throwaway disk',
    );
  }
  const configured = String(env.PGLITE_DIR || '').trim();
  if (configured) {
    return { kind: 'pglite', dataDir: configured === MEMORY ? MEMORY : path.resolve(configured) };
  }
  // `node --test` marks its child processes. Tests must never touch the dev database.
  return { kind: 'pglite', dataDir: env.NODE_TEST_CONTEXT ? MEMORY : DEFAULT_PGLITE_DIR };
}

function normalise(result) {
  return { rows: result.rows ?? [], rowCount: result.rowCount ?? result.affectedRows ?? 0 };
}

async function createPostgresBackend({ connectionString, ssl }) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    ssl,
    max: POOL_MAX,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  // A pooled connection can fail while idle, for example when the pooler restarts.
  // Without a listener that error would crash the process.
  pool.on('error', (error) => {
    console.error('[db] idle connection failed:', sanitizeDbError(error, 'pool').message);
  });
  const wrap = (client) => ({
    query: async (sql, params = []) => normalise(await client.query(sql, params)),
    exec: async (sql) => { await client.query(sql); },
  });
  return {
    kind: 'postgres',
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect();
      let broken = false;
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          broken = true;
        }
        throw error;
      } finally {
        // A connection that could not roll back is destroyed, not reused.
        client.release(broken);
      }
    },
    close: () => pool.end(),
  };
}

async function createPgliteBackend({ dataDir }) {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir !== MEMORY) fs.mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  const wrap = (handle) => ({
    query: async (sql, params = []) => normalise(await handle.query(sql, params)),
    exec: async (sql) => { await handle.exec(sql); },
  });
  const backend = {
    kind: 'pglite',
    ...wrap(db),
    // PGlite has one connection and queues transactions, so they never overlap.
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
  await applyMigrations(backend);
  return backend;
}

let backendPromise = null;

/** The live backend, created on first use. */
export function getBackend() {
  if (!backendPromise) {
    const pending = (async () => {
      const config = databaseConfig();
      return config.kind === 'postgres'
        ? createPostgresBackend(config)
        : createPgliteBackend(config);
    })();
    backendPromise = pending;
    // A failed start must not be cached forever: the next request tries again.
    pending.catch(() => {
      if (backendPromise === pending) backendPromise = null;
    });
  }
  return backendPromise;
}

export async function closeDb() {
  const pending = backendPromise;
  backendPromise = null;
  if (!pending) return;
  const backend = await pending.catch(() => null);
  if (backend) await backend.close();
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Re-run `run` when Postgres aborted it to break a deadlock or serialization conflict. */
export async function withRetry(run, { attempts = MAX_ATTEMPTS, sleep = defaultSleep } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!RETRYABLE_CODES.has(error?.code) || attempt >= attempts) throw error;
      // Writers that retry in lockstep collide again. Jitter spreads them out.
      await sleep(10 * attempt + Math.random() * 15);
    }
  }
}

export async function query(sql, params = [], label = 'query') {
  const backend = await getBackend();
  try {
    return await backend.query(sql, params);
  } catch (error) {
    throw sanitizeDbError(error, label);
  }
}

/**
 * Run `fn(tx)` in one transaction. `fn` may run more than once, so generate ids and
 * timestamps before calling this, never inside `fn`.
 */
export async function transaction(fn, label = 'transaction') {
  const backend = await getBackend();
  try {
    return await withRetry(() => backend.transaction(fn));
  } catch (error) {
    throw sanitizeDbError(error, label);
  }
}
