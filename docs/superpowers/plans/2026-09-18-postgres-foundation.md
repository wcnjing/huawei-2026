# Postgres Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every piece of server state from the whole-document store (Upstash Redis or `server/data.json`) to Postgres, with no change visible to users or to `server/index.js`'s use of the store.

**Architecture:** `server/db.js` owns the connection: a small `pg` pool when `DATABASE_URL` is set (Supabase's pooler in production), otherwise PGlite, an in-process Postgres for local dev and tests. `server/store.js` keeps every export's name, arguments, return shape and errors, but each write becomes one transaction that locks exactly what it reads. The schema is plain SQL in `supabase/migrations/`, applied by the Supabase CLI to Supabase and by `server/migrate.js` everywhere else.

**Tech Stack:** Node 22+ ESM, Express 4, `pg` 8, `@electric-sql/pglite` 0.5, Postgres 17, `node:test`.

**Spec:** [docs/superpowers/specs/2026-09-18-postgres-foundation-design.md](../specs/2026-09-18-postgres-foundation-design.md)

## Global Constraints

- All application tables live in schema `safespace`, never `public`. Row-level security is enabled on every table with no policies. The migration runs `revoke all on schema safespace from public`.
- Migrations use only plain Postgres (no Supabase roles such as `anon`), so they apply identically to Supabase, PGlite and test Postgres.
- Every `store.js` export keeps its name, arguments, return shape and error classes/`code` values. API JSON must not change.
- Row mappers: camelCase keys, ISO timestamp strings, `created_at` never exposed. Keys the old code always wrote stay present when null (`recentDrillResult`, an attempt's `providerId`, a result's `outcome` and `screen`). Keys it wrote conditionally are omitted when null.
- Postgres errors leave `db.js` only as `StoreDatabaseError` carrying `code` and `constraint`. Never `detail`, never `where`, and no `cause`.
- Ids and timestamps are generated **outside** `transaction()`, because a retried transaction re-runs its callback.
- Transactions retry only on `40P01` (deadlock) and `40001` (serialization failure), at most 5 attempts, with jittered backoff.
- `pg` pool: `max: 3`. With `DATABASE_CA_CERT` set, TLS is verified against it and never uses `rejectUnauthorized: false`. In production (`VERCEL` set or `NODE_ENV=production`), `DATABASE_URL` and `DATABASE_CA_CERT` are both required.
- No raw phone number, email address, requester address, session token or action token is ever stored in `rate_limit_hits`. No raw session or action token is stored anywhere.
- Run the suite with `node --test server/*.test.mjs`; the harness blocks `npm test`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260918000001_safespace_schema.sql` | Create | Schema, tables, indexes, RLS |
| `supabase/migrations/20260918000002_safespace_demo_family.sql` | Create | The four demo users |
| `server/migrate.js` | Create | Applies migration files to non-Supabase databases; `npm run db:migrate` CLI |
| `server/db.js` | Create | Backend selection, `query`, `transaction`, retries, error sanitising |
| `server/rows.js` | Create | Row ↔ object mapping |
| `server/testdb.mjs` | Create | Test database lifecycle: `setupTestDb`, `resetDb`, `dumpDb`, `teardownTestDb` |
| `server/db.test.mjs` | Create | Schema, migration, config and error tests |
| `server/rows.test.mjs` | Create | Mapper tests |
| `server/store.js` | Rewrite | Same exports, on Postgres; adds `pingDb` |
| `server/store.test.mjs`, `server/routes.test.mjs`, `server/intel.test.mjs` | Modify | Use `testdb.mjs` instead of temp JSON files |
| `server/store.redis.test.mjs`, `server/data.seed.json` | Delete | Replaced by the concurrency tests and the seed migration |
| `server/store.concurrency.test.mjs` | Create | Race tests against real Postgres |
| `scripts/test-pg.mjs` | Create | `npm run test:pg`: runs the suite against Postgres 17 in Docker |
| `server/index.js` | Modify | Add `GET /api/health/db` |
| `vercel.json`, `.github/workflows/ci.yml`, `package.json`, `.gitignore` | Modify | Region, keep-alive cron, CI Postgres, scripts, ignore `server/.pglite/` |
| `.env.example`, `README.md`, `server/README.md`, `DEPLOY.md`, `deploy/safespace.service`, `FIGMA_TO_REACT.md` | Modify | Document the new configuration |

---

### Task 1: Database layer and schema

**Files:**
- Create: `supabase/migrations/20260918000001_safespace_schema.sql`, `supabase/migrations/20260918000002_safespace_demo_family.sql`, `server/migrate.js`, `server/db.js`, `server/testdb.mjs`, `server/db.test.mjs`
- Modify: `package.json` (dependencies already installed: `pg ^8.23.0`, `@electric-sql/pglite ^0.5.8`; add the `db:migrate` script), `.gitignore`

**Interfaces:**
- Produces:
  - `db.js`:
    - `query(sql, params?, label?) → Promise<{ rows, rowCount }>`
    - `transaction(fn(tx), label?) → Promise<any>`, where `tx` is `{ query(sql, params?), exec(sql) }`
    - `getBackend() → Promise<{ kind, query, exec, transaction, close }>`
    - `closeDb()`
    - `databaseConfig(env) → { kind: 'postgres', connectionString, ssl } | { kind: 'pglite', dataDir }`
    - `withRetry(run, { attempts, sleep })`
    - `sanitizeDbError(error, label)`
    - classes `DatabaseConfigError` (code `DATABASE_NOT_CONFIGURED`) and `StoreDatabaseError`
  - `migrate.js`:
    - `MIGRATIONS_DIR`
    - `listMigrations(dir?) → [{ version, name, file, sql }]`
    - `applyMigrations(backend, { dir }?) → Promise<string[]>` (the versions applied)
    - `assertMigratableUrl(url)`
  - `testdb.mjs`: `setupTestDb()`, `resetDb()`, `dumpDb() → Promise<string>`, `teardownTestDb()`

- [ ] **Step 1: Write the migrations**

`supabase/migrations/20260918000001_safespace_schema.sql`:

```sql
-- SafeSpace application data.
--
-- Kept out of `public`, which Supabase publishes through its HTTP API. The browser will
-- hold that API's key once the Realtime doorbell ships. Row-level security is on with no
-- policies as a second lock. The server connects as the owner and is unaffected.
-- Plain Postgres only, so this file applies unchanged to Supabase, PGlite and CI.

create schema if not exists safespace;
revoke all on schema safespace from public;

create table safespace.users (
  id text primary key,
  name text not null,
  role text not null default 'ROOKIE',
  phone text unique,
  phone_lookup_hash text unique,
  consent_to_drills boolean not null default false,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  xp_max integer not null default 500 check (xp_max > 0),
  streak integer not null default 0 check (streak >= 0),
  times_safe integer not null default 0 check (times_safe >= 0),
  times_scammed integer not null default 0 check (times_scammed >= 0),
  safe_this_week boolean not null default true,
  recent_drill_result text check (recent_drill_result in ('WON', 'LOST')),
  primary_color text not null default '#4ecdc4',
  room_name text not null default 'GUEST ROOM',
  room_bg text not null default '#081420',
  badge_count integer not null default 0 check (badge_count >= 0),
  badge_total integer not null default 9 check (badge_total >= 0),
  email text,
  pending_email text,
  email_verified_at timestamptz,
  email_verification_requested_at timestamptz,
  email_verification_token_hash text,
  created_at timestamptz not null default now()
);

-- Only a digest of the bearer token is stored.
create table safespace.sessions (
  token_hash text primary key,
  user_id text not null references safespace.users (id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null
);
create index sessions_user_id_idx on safespace.sessions (user_id);

create table safespace.drill_attempts (
  id text primary key,
  user_id text not null references safespace.users (id),
  channel text not null check (channel in ('call', 'sms', 'email')),
  status text not null check (status in ('created', 'sent', 'completed', 'failed')),
  provider_id text unique,
  action_token_hash text unique,
  created_at timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  scored boolean,
  outcome text,
  failure_reason text,
  -- No foreign key: drill_results.attempt_id already points the other way.
  result_record_id text
);
create index drill_attempts_cooldown_idx
  on safespace.drill_attempts (user_id, channel, created_at desc);

-- One row per scored or unscored result. A real result stays pending until the client
-- acknowledges it; `seq` keeps the queue in insertion order.
create table safespace.drill_results (
  id text primary key,
  seq bigint generated always as identity,
  user_id text not null references safespace.users (id),
  channel text not null check (channel in ('call', 'sms', 'email')),
  outcome text,
  practice boolean not null,
  result text not null check (result in ('WON', 'LOST', 'SAFE', 'UNSCORED')),
  screen text,
  xp_gained integer not null,
  at timestamptz not null,
  attempt_id text references safespace.drill_attempts (id),
  provider_id text,
  unscored_reason text,
  practice_source_key text unique,
  acknowledged_at timestamptz
);
create unique index drill_results_attempt_idx
  on safespace.drill_results (attempt_id) where attempt_id is not null;
create index drill_results_pending_idx
  on safespace.drill_results (user_id, seq) where practice = false and acknowledged_at is null;

create table safespace.consent_events (
  id bigint generated always as identity primary key,
  user_id text not null references safespace.users (id),
  type text not null,
  channel text not null,
  at timestamptz not null
);
create index consent_events_user_id_idx on safespace.consent_events (user_id);

-- subject_key is a keyed digest, never a raw phone number, email or address.
create table safespace.rate_limit_hits (
  id bigint generated always as identity primary key,
  scope text not null,
  subject_key text not null,
  hit_at timestamptz not null
);
create index rate_limit_hits_lookup_idx
  on safespace.rate_limit_hits (scope, subject_key, hit_at);

create table safespace.tactic_cards (
  id text primary key,
  card jsonb not null,
  fetched_at timestamptz not null
);

alter table safespace.users enable row level security;
alter table safespace.sessions enable row level security;
alter table safespace.drill_attempts enable row level security;
alter table safespace.drill_results enable row level security;
alter table safespace.consent_events enable row level security;
alter table safespace.rate_limit_hits enable row level security;
alter table safespace.tactic_cards enable row level security;
```

`supabase/migrations/20260918000002_safespace_demo_family.sql`:

```sql
-- The demo family that visitors who are not logged in see. This is a migration rather
-- than supabase/seed.sql because the CLI applies seed.sql only to local databases, and
-- production needs these rows too. Re-runnable: the test helper replays it after
-- truncating. Explicit created_at values keep the family in this order.
insert into safespace.users (
  id, name, role, consent_to_drills, level, xp, xp_max, streak, times_safe,
  times_scammed, primary_color, badge_count, badge_total, room_name, room_bg,
  safe_this_week, recent_drill_result, created_at
) values
  ('you', 'YOU', 'ROOKIE', true, 4, 890, 1200, 3, 12, 2, '#00ff88', 2, 9,
   'YOUR ROOM', '#0c1a10', true, 'WON', '2026-01-01T00:00:00Z'),
  ('grandma', 'GRANDMA', 'ELDER GUARDIAN', true, 12, 3800, 4000, 24, 89, 1, '#c77dff', 7, 9,
   'GRANDMA''S ROOM', '#100c20', true, 'WON', '2026-01-01T00:00:01Z'),
  ('mum', 'MUM', 'SHIELD BEARER', true, 9, 2100, 2500, 16, 67, 2, '#00ff88', 5, 9,
   'MUM''S ROOM', '#0c1a10', true, 'WON', '2026-01-01T00:00:02Z'),
  ('dad', 'DAD', 'ROOKIE', true, 4, 890, 1200, 0, 23, 7, '#4ecdc4', 2, 9,
   'DAD''S ROOM', '#081420', false, 'LOST', '2026-01-01T00:00:03Z')
on conflict (id) do nothing;
```

- [ ] **Step 2: Write `server/migrate.js`**

```js
// Applies supabase/migrations/*.sql to databases the Supabase CLI does not manage: the
// in-process PGlite used for local dev and tests, CI's Postgres, or a future Huawei Cloud
// database. Supabase projects are migrated with `npx supabase db push`, which keeps its
// own history table. Running both tools against one database would apply files twice,
// so the CLI entry point refuses Supabase hosts.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');
const FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;

export function listMigrations(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir)
    .filter((file) => FILE_PATTERN.test(file))
    .sort()
    .map((file) => {
      const [, version, name] = file.match(FILE_PATTERN);
      return { version, name, file, sql: fs.readFileSync(path.join(dir, file), 'utf8') };
    });
}

const BOOTSTRAP = `
create schema if not exists safespace;
create table if not exists safespace.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);
alter table safespace.schema_migrations enable row level security;
`;

/** Apply every migration not yet recorded. Returns the versions applied now. */
export async function applyMigrations(backend, { dir = MIGRATIONS_DIR } = {}) {
  await backend.exec(BOOTSTRAP);
  const applied = [];
  for (const migration of listMigrations(dir)) {
    const ran = await backend.transaction(async (tx) => {
      // Two processes starting together must not both apply the same file.
      await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', ['safespace:migrations']);
      const { rows } = await tx.query(
        'select 1 from safespace.schema_migrations where version = $1',
        [migration.version],
      );
      if (rows.length) return false;
      await tx.exec(migration.sql);
      await tx.query(
        'insert into safespace.schema_migrations (version, name) values ($1, $2)',
        [migration.version, migration.name],
      );
      return true;
    });
    if (ran) applied.push(migration.version);
  }
  return applied;
}

export function assertMigratableUrl(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (/(^|\.)supabase\.(co|com)$/i.test(host)) {
    throw new Error(
      'DATABASE_URL points at Supabase. Migrate Supabase projects with `npx supabase db push`, '
      + 'which keeps its own migration history.',
    );
  }
}

async function main() {
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.error('DATABASE_URL is not set. Local PGlite migrates itself on startup.');
    process.exit(1);
  }
  assertMigratableUrl(url);
  const { closeDb, getBackend } = await import('./db.js');
  const applied = await applyMigrations(await getBackend());
  console.log(applied.length ? `Applied ${applied.join(', ')}` : 'Already up to date.');
  await closeDb();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[migrate] ${error.message}`);
    process.exit(1);
  });
}
```

- [ ] **Step 3: Write `server/db.js`**

```js
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
```

- [ ] **Step 4: Write `server/testdb.mjs`**

```js
// Test database lifecycle. By default each test file gets an in-memory PGlite, so
// nothing needs installing. With TEST_DATABASE_URL set, each file gets a throwaway
// database on that server, created here and dropped afterwards, so the whole suite also
// runs against real Postgres (npm run test:pg, and CI).
import crypto from 'node:crypto';
import pg from 'pg';
import { closeDb, getBackend, query } from './db.js';
import { applyMigrations, listMigrations } from './migrate.js';

// Child tables before parents, although `cascade` makes the order forgiving.
const TABLES = [
  'sessions', 'consent_events', 'rate_limit_hits', 'drill_results', 'drill_attempts',
  'tactic_cards', 'users',
];
let throwaway = null;

export async function setupTestDb() {
  const adminUrl = String(process.env.TEST_DATABASE_URL || '').trim();
  if (!adminUrl) {
    delete process.env.DATABASE_URL;
    process.env.PGLITE_DIR = 'memory://';
    await getBackend();
    return;
  }
  const name = `safespace_test_${crypto.randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
  throwaway = { adminUrl, name };
  await applyMigrations(await getBackend());
}

/** Empty every table and restore the demo family, which is what a fresh deploy holds. */
export async function resetDb() {
  await query(`truncate ${TABLES.map((table) => `safespace.${table}`).join(', ')} restart identity cascade`);
  const seed = listMigrations().find((migration) => migration.name === 'safespace_demo_family');
  await (await getBackend()).exec(seed.sql);
}

/** Every stored value as one string, for "this must never be persisted" assertions. */
export async function dumpDb() {
  const parts = [];
  for (const table of [...TABLES, 'schema_migrations']) {
    const { rows } = await query(`select * from safespace.${table}`);
    parts.push(JSON.stringify(rows));
  }
  return parts.join('\n');
}

export async function teardownTestDb() {
  await closeDb();
  if (!throwaway) return;
  const admin = new pg.Client({ connectionString: throwaway.adminUrl });
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${throwaway.name} with (force)`);
  } finally {
    await admin.end();
    throwaway = null;
  }
}
```

- [ ] **Step 5: Write the failing tests, `server/db.test.mjs`**

```js
// Run with: node --test
//
// The database layer: what the migrations create, which database gets picked, retries,
// and that Postgres error details never reach a log line.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import util from 'node:util';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

await setupTestDb();
after(teardownTestDb);

const { databaseConfig, getBackend, query, transaction, withRetry } = await import('./db.js');
const { applyMigrations, assertMigratableUrl, listMigrations } = await import('./migrate.js');

const APP_TABLES = [
  'consent_events', 'drill_attempts', 'drill_results', 'rate_limit_hits', 'sessions',
  'tactic_cards', 'users',
];

test('every table is in the safespace schema and none is in public', async () => {
  const { rows } = await query(
    'select table_schema, table_name from information_schema.tables where table_name = any($1::text[])',
    [APP_TABLES],
  );
  assert.deepEqual(
    rows.filter((row) => row.table_schema === 'safespace').map((row) => row.table_name).sort(),
    APP_TABLES,
  );
  assert.deepEqual(rows.filter((row) => row.table_schema === 'public'), []);
});

test('row-level security is enabled on every safespace table', async () => {
  const { rows } = await query(
    `select c.relname, c.relrowsecurity
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'safespace' and c.relkind = 'r'`,
  );
  assert.ok(rows.length >= APP_TABLES.length);
  assert.deepEqual(rows.filter((row) => !row.relrowsecurity).map((row) => row.relname), []);
});

test('the demo family is seeded in order', async () => {
  await resetDb();
  const { rows } = await query('select id from safespace.users order by created_at');
  assert.deepEqual(rows.map((row) => row.id), ['you', 'grandma', 'mum', 'dad']);
});

test('applying the migrations again changes nothing', async () => {
  const versions = async () =>
    (await query('select version from safespace.schema_migrations order by version')).rows
      .map((row) => row.version);
  assert.deepEqual(await versions(), listMigrations().map((migration) => migration.version));
  assert.deepEqual(await applyMigrations(await getBackend()), []);
  assert.deepEqual(await versions(), listMigrations().map((migration) => migration.version));
});

test('a Postgres error loses its detail before anything can log it', async () => {
  await resetDb();
  const phone = '+6591234567';
  const insert = 'insert into safespace.users (id, name, phone) values ($1, $2, $3)';
  await query(insert, ['usr_a', 'A', phone]);

  const direct = await query(insert, ['usr_b', 'B', phone]).then(() => null, (error) => error);
  const inTransaction = await transaction(
    (tx) => tx.query(insert, ['usr_c', 'C', phone]),
    'test',
  ).then(() => null, (error) => error);

  for (const error of [direct, inTransaction]) {
    assert.equal(error?.code, '23505');
    assert.equal(error.constraint, 'users_phone_key');
    assert.equal(error.name, 'StoreDatabaseError');
    for (const rendering of [error.message, String(error.stack), util.inspect(error), JSON.stringify(error)]) {
      assert.ok(!rendering.includes(phone), `the phone leaked into: ${rendering}`);
    }
  }
  await resetDb();
});

test('retries deadlocks and serialization failures only, and gives up after five tries', async () => {
  const noSleep = async () => {};
  const failing = (code, failures) => {
    const state = { calls: 0 };
    state.run = async () => {
      state.calls += 1;
      if (state.calls <= failures) throw Object.assign(new Error(code), { code });
      return 'ok';
    };
    return state;
  };

  const deadlock = failing('40P01', 2);
  assert.equal(await withRetry(deadlock.run, { sleep: noSleep }), 'ok');
  assert.equal(deadlock.calls, 3);

  const unique = failing('23505', 1);
  await assert.rejects(withRetry(unique.run, { sleep: noSleep }), { code: '23505' });
  assert.equal(unique.calls, 1, 'a constraint violation is not retried');

  const serialization = failing('40001', 99);
  await assert.rejects(withRetry(serialization.run, { sleep: noSleep }), { code: '40001' });
  assert.equal(serialization.calls, 5);
});

test('production refuses PGlite and unverified Postgres', () => {
  assert.throws(() => databaseConfig({ VERCEL: '1' }), { code: 'DATABASE_NOT_CONFIGURED' });
  assert.throws(() => databaseConfig({ NODE_ENV: 'production' }), { code: 'DATABASE_NOT_CONFIGURED' });
  assert.throws(
    () => databaseConfig({ VERCEL: '1', DATABASE_URL: 'postgres://u:p@db.example.com:6543/postgres' }),
    /DATABASE_CA_CERT/,
  );
});

test('a CA certificate means verified TLS, whatever the URL says', () => {
  const config = databaseConfig({
    VERCEL: '1',
    DATABASE_URL: 'postgres://u:p@db.example.com:6543/postgres?sslmode=require',
    DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----',
  });
  assert.equal(config.kind, 'postgres');
  assert.ok(!config.connectionString.includes('sslmode'));
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.ca, '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----');
});

test('local development uses PGlite on disk, and tests use memory', () => {
  assert.deepEqual(databaseConfig({ NODE_TEST_CONTEXT: 'child-v8' }), { kind: 'pglite', dataDir: 'memory://' });
  assert.deepEqual(databaseConfig({ PGLITE_DIR: 'memory://' }), { kind: 'pglite', dataDir: 'memory://' });
  const local = databaseConfig({});
  assert.equal(local.kind, 'pglite');
  assert.ok(local.dataDir.endsWith(path.join('server', '.pglite')));
  assert.equal(databaseConfig({ DATABASE_URL: 'postgres://localhost/safespace' }).kind, 'postgres');
});

test('db:migrate refuses Supabase hosts, which the Supabase CLI migrates', () => {
  assert.throws(
    () => assertMigratableUrl('postgres://postgres.abc:pw@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'),
    /supabase db push/,
  );
  assert.throws(
    () => assertMigratableUrl('postgres://postgres:pw@db.abcdefgh.supabase.co:5432/postgres'),
    /supabase db push/,
  );
  assert.doesNotThrow(() => assertMigratableUrl('postgres://postgres:pw@localhost:5432/postgres'));
});
```

- [ ] **Step 6: Run the new tests; expect them to pass once Steps 1–4 exist**

These tests exercise code written in Steps 1–4. Before running, confirm they would fail without it by temporarily renaming `supabase/migrations`:

Run: `mv supabase/migrations supabase/migrations.off && node --test server/db.test.mjs; mv supabase/migrations.off supabase/migrations`
Expected: FAIL (ENOENT reading the migrations directory).

Run: `node --test server/db.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 7: Add the script and the ignore rule**

In `package.json` `scripts`, add after `"test"`:

```json
    "db:migrate": "node --env-file-if-exists=.env server/migrate.js",
```

Append to `.gitignore`:

```
server/.pglite/
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations server/migrate.js server/db.js server/testdb.mjs server/db.test.mjs package.json package-lock.json .gitignore
git commit -m "feat(db): Postgres layer with PGlite fallback and safespace schema" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Row mappers

**Files:**
- Create: `server/rows.js`, `server/rows.test.mjs`

**Interfaces:**
- Produces from `rows.js`:
  - `iso(value) → string|null`
  - `USER_FIELDS: [column, property][]`
  - `userFromRow(row) → user|null`
  - `userValues(user) → any[]` (in `USER_FIELDS` order)
  - `INSERT_USER_SQL` (params: `$1` id, then `userValues`)
  - `UPDATE_USER_SQL` (same params)
  - `attemptFromRow(row) → attempt|null`
  - `resultFromRow(row) → record|null`

- [ ] **Step 1: Write the failing test `server/rows.test.mjs`**

```js
// Run with: node --test
//
// The API's JSON must not change with the storage move. These pin the object shapes the
// old whole-document store produced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_FIELDS, attemptFromRow, iso, resultFromRow, userFromRow, userValues,
} from './rows.js';

const at = new Date('2026-09-18T01:02:03.456Z');

const userRow = (overrides = {}) => ({
  id: 'usr_1', name: 'JUDGE', role: 'ROOKIE', phone: '+6591234567', phone_lookup_hash: null,
  consent_to_drills: true, level: 1, xp: 0, xp_max: 500, streak: 0, times_safe: 0,
  times_scammed: 0, safe_this_week: true, recent_drill_result: null, primary_color: '#4ecdc4',
  room_name: 'GUEST ROOM', room_bg: '#081420', badge_count: 0, badge_total: 9, email: null,
  pending_email: null, email_verified_at: null, email_verification_requested_at: null,
  email_verification_token_hash: null, created_at: at,
  ...overrides,
});

test('a user keeps always-written nulls and omits conditional ones', () => {
  const user = userFromRow(userRow());
  assert.equal(user.recentDrillResult, null);
  assert.ok('recentDrillResult' in user);
  for (const key of ['email', 'pendingEmail', 'emailVerifiedAt', 'phoneLookupHash']) {
    assert.ok(!(key in user), `${key} should be absent when null`);
  }
  assert.ok(!('createdAt' in user) && !('created_at' in user), 'created_at is never exposed');
  assert.equal(userFromRow(userRow({ phone: null })).phone, undefined);
  assert.equal(userFromRow(undefined), null);
});

test('user timestamps come back as ISO strings from a Date or a string', () => {
  assert.equal(userFromRow(userRow({ email_verified_at: at })).emailVerifiedAt, at.toISOString());
  assert.equal(iso('2026-09-18T01:02:03.456Z'), at.toISOString());
  assert.equal(iso(null), null);
});

test('userValues round-trips every written column and stores an empty phone as NULL', () => {
  const row = userRow({ email: 'judge@example.com', email_verified_at: at });
  const values = userValues(userFromRow(row));
  USER_FIELDS.forEach(([column], index) => {
    const expected = row[column] instanceof Date ? row[column].toISOString() : row[column];
    assert.deepEqual(values[index], expected, column);
  });
  const phoneIndex = USER_FIELDS.findIndex(([column]) => column === 'phone');
  assert.equal(userValues({ ...userFromRow(row), phone: '' })[phoneIndex], null);
  assert.equal(userValues({ ...userFromRow(row), phone: undefined })[phoneIndex], null);
});

test('an attempt always has providerId and omits unset lifecycle fields', () => {
  const attempt = attemptFromRow({
    id: 'attempt_1', user_id: 'you', channel: 'call', status: 'created', provider_id: null,
    action_token_hash: null, created_at: at, sent_at: null, completed_at: null, scored: null,
    outcome: null, failure_reason: null, result_record_id: null,
  });
  assert.deepEqual(attempt, {
    id: 'attempt_1', userId: 'you', channel: 'call', status: 'created', providerId: null,
    createdAt: at.toISOString(),
  });
  const failed = attemptFromRow({
    id: 'attempt_2', user_id: 'you', channel: 'sms', status: 'failed', provider_id: 'SM1',
    action_token_hash: null, created_at: at, sent_at: at, completed_at: at, scored: false,
    outcome: null, failure_reason: 'provider_error', result_record_id: 'drill_1',
  });
  assert.equal(failed.scored, false, 'false is a value, not an absence');
  assert.equal(failed.sentAt, at.toISOString());
  assert.equal(failed.resultRecordId, 'drill_1');
});

test('a result keeps outcome and screen even when null, and hides queue bookkeeping', () => {
  const record = resultFromRow({
    id: 'drill_1', seq: '7', user_id: 'you', channel: 'call', outcome: null, practice: false,
    result: 'UNSCORED', screen: null, xp_gained: 0, at, attempt_id: 'attempt_1',
    provider_id: null, unscored_reason: 'no_answer', practice_source_key: null,
    acknowledged_at: null,
  });
  assert.deepEqual(record, {
    id: 'drill_1', userId: 'you', channel: 'call', outcome: null, practice: false,
    result: 'UNSCORED', screen: null, xpGained: 0, at: at.toISOString(),
    attemptId: 'attempt_1', unscoredReason: 'no_answer',
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test server/rows.test.mjs`
Expected: FAIL with `Cannot find module '.../server/rows.js'`.

- [ ] **Step 3: Write `server/rows.js`**

```js
// Row <-> object mapping. The API's JSON must not change with the storage move, so each
// mapper rebuilds the object the old whole-document store held. That means camelCase
// keys and ISO timestamps. Keys the old code always wrote stay present when null; keys
// it wrote only sometimes are omitted when null.

export function iso(value) {
  if (value === null || value === undefined) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function setIfPresent(target, key, value) {
  if (value !== null && value !== undefined) target[key] = value;
}

// [column, property] for every users column the application writes.
export const USER_FIELDS = [
  ['name', 'name'],
  ['role', 'role'],
  ['phone', 'phone'],
  ['phone_lookup_hash', 'phoneLookupHash'],
  ['consent_to_drills', 'consentToDrills'],
  ['level', 'level'],
  ['xp', 'xp'],
  ['xp_max', 'xpMax'],
  ['streak', 'streak'],
  ['times_safe', 'timesSafe'],
  ['times_scammed', 'timesScammed'],
  ['safe_this_week', 'safeThisWeek'],
  ['recent_drill_result', 'recentDrillResult'],
  ['primary_color', 'primaryColor'],
  ['room_name', 'roomName'],
  ['room_bg', 'roomBg'],
  ['badge_count', 'badgeCount'],
  ['badge_total', 'badgeTotal'],
  ['email', 'email'],
  ['pending_email', 'pendingEmail'],
  ['email_verified_at', 'emailVerifiedAt'],
  ['email_verification_requested_at', 'emailVerificationRequestedAt'],
  ['email_verification_token_hash', 'emailVerificationTokenHash'],
];

// Identity columns are unique, so an empty string must become NULL: the demo family's
// old `phone: ""` would otherwise collide with itself.
const EMPTY_MEANS_NULL = new Set(['phone', 'phone_lookup_hash', 'email', 'pending_email']);

export function userFromRow(row) {
  if (!row) return null;
  const user = {
    id: row.id,
    name: row.name,
    role: row.role,
    consentToDrills: row.consent_to_drills,
    level: row.level,
    xp: row.xp,
    xpMax: row.xp_max,
    streak: row.streak,
    timesSafe: row.times_safe,
    timesScammed: row.times_scammed,
    primaryColor: row.primary_color,
    badgeCount: row.badge_count,
    badgeTotal: row.badge_total,
    roomName: row.room_name,
    roomBg: row.room_bg,
    safeThisWeek: row.safe_this_week,
    recentDrillResult: row.recent_drill_result ?? null,
  };
  setIfPresent(user, 'phone', row.phone);
  setIfPresent(user, 'phoneLookupHash', row.phone_lookup_hash);
  setIfPresent(user, 'email', row.email);
  setIfPresent(user, 'pendingEmail', row.pending_email);
  setIfPresent(user, 'emailVerifiedAt', iso(row.email_verified_at));
  setIfPresent(user, 'emailVerificationRequestedAt', iso(row.email_verification_requested_at));
  setIfPresent(user, 'emailVerificationTokenHash', row.email_verification_token_hash);
  return user;
}

/** Column values in USER_FIELDS order. A deleted property is written as NULL. */
export function userValues(user) {
  return USER_FIELDS.map(([column, key]) => {
    const value = user[key];
    if (value === undefined) return null;
    if (value === '' && EMPTY_MEANS_NULL.has(column)) return null;
    return value;
  });
}

const USER_COLUMNS = USER_FIELDS.map(([column]) => column);

export const INSERT_USER_SQL = `insert into safespace.users (id, ${USER_COLUMNS.join(', ')})
  values ($1, ${USER_COLUMNS.map((_, index) => `$${index + 2}`).join(', ')})
  returning *`;

export const UPDATE_USER_SQL = `update safespace.users
  set ${USER_COLUMNS.map((column, index) => `${column} = $${index + 2}`).join(', ')}
  where id = $1
  returning *`;

export function attemptFromRow(row) {
  if (!row) return null;
  const attempt = {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    status: row.status,
    providerId: row.provider_id ?? null,
    createdAt: iso(row.created_at),
  };
  setIfPresent(attempt, 'sentAt', iso(row.sent_at));
  setIfPresent(attempt, 'actionTokenHash', row.action_token_hash);
  setIfPresent(attempt, 'scored', row.scored);
  setIfPresent(attempt, 'outcome', row.outcome);
  setIfPresent(attempt, 'failureReason', row.failure_reason);
  setIfPresent(attempt, 'completedAt', iso(row.completed_at));
  setIfPresent(attempt, 'resultRecordId', row.result_record_id);
  return attempt;
}

export function resultFromRow(row) {
  if (!row) return null;
  const record = {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    outcome: row.outcome ?? null,
    practice: row.practice,
    result: row.result,
    screen: row.screen ?? null,
    xpGained: row.xp_gained,
    at: iso(row.at),
  };
  setIfPresent(record, 'attemptId', row.attempt_id);
  setIfPresent(record, 'providerId', row.provider_id);
  setIfPresent(record, 'unscoredReason', row.unscored_reason);
  return record;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test server/rows.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add server/rows.js server/rows.test.mjs
git commit -m "feat(db): row mappers that reproduce the old store's object shapes" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The store on Postgres

The whole store is swapped in one task. A half-moved store would keep users in one database and drills in the other, so there is no testable midpoint.

**Files:**
- Rewrite: `server/store.js`
- Modify: `server/store.test.mjs`, `server/routes.test.mjs`, `server/intel.test.mjs`
- Delete: `server/store.redis.test.mjs`, `server/data.seed.json`

**Interfaces:**
- Consumes:
  - `query` and `transaction` from `db.js` (Task 1)
  - everything listed for `rows.js` in Task 2
  - `setupTestDb`, `resetDb`, `dumpDb` and `teardownTestDb` from `testdb.mjs`
- Produces: every existing `store.js` export, unchanged, plus `pingDb() → Promise<void>`.

- [ ] **Step 1: Point the existing tests at Postgres (they become the failing tests)**

In `server/store.test.mjs`, replace lines 1–25 (the imports through `after(...)`) with:

```js
// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { dumpDb, resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

process.env.IDENTITY_LOOKUP_SECRET = 'store-test-identity-lookup-secret-over-32-characters';
await setupTestDb();
after(teardownTestDb);

const {
  publicUser, registerVerifiedUser, setUserEmail, detachVerifiedPhone, getUser,
  createSession, getUserIdByToken, createDrillAttempt, completeDrillAttempt,
  getDrillAttempt, markDrillAttemptSent, markDrillAttemptFailed,
  listPendingResults, peekPendingResult, ackPendingResult, applyOutcome,
  applyPracticeOutcomeOnce, DrillAttemptConflict, getDrillAttemptByActionToken,
  setUserName, beginEmailVerification, cancelEmailVerification,
  setVerifiedUserEmail, EmailVerificationConflict, reservePhoneVerificationSend,
  VerificationRateLimitConflict,
} = await import('./store.js');
const { query } = await import('./db.js');

const freshStore = resetDb;
```

Then, throughout the file, replace every `freshStore();` with `await freshStore();`. Every call site is inside an `async` test.

Replace the raw-file assertions test by test:

1. In `re-registering the same phone reuses the account and re-logs consent`, replace the `const db = JSON.parse(...)` line and the lines through the `events.every` assertion with:

```js
  const { rows: mine } = await query('select id from safespace.users where phone = $1', ['+6591234567']);
  assert.equal(mine.length, 1, 'must not create a duplicate user');

  const { rows: events } = await query(
    'select type, channel from safespace.consent_events where user_id = $1',
    [first.id],
  );
  assert.equal(events.length, 2, 'each grant is its own audit event, even a repeat');
  assert.ok(events.every((e) => e.type === 'granted' && e.channel === 'otp'));
```

2. In `new sessions persist only a digest, expire, and resolve only the bearer token`, replace everything from `const db = JSON.parse(` through the expired-session assertion with:

```js
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows: sessions } = await query(
    'select expires_at from safespace.sessions where token_hash = $1',
    [tokenHash],
  );
  assert.equal(sessions.length, 1, 'the keyed digest must resolve the session');
  assert.ok(!(await dumpDb()).includes(token), 'the raw bearer credential must never be stored');
  assert.ok(Number.isFinite(new Date(sessions[0].expires_at).getTime()));

  await query(
    'update safespace.sessions set expires_at = $2 where token_hash = $1',
    [tokenHash, new Date(0).toISOString()],
  );
  assert.equal(await getUserIdByToken(token), null, 'an expired session must not resolve');
```

3. Delete the whole `legacy raw-key sessions inherit the configured TTL instead of living forever` test. The raw-token path is gone.

4. In `detachVerifiedPhone removes the number, withdraws consent and revokes all sessions`, replace the `const db = JSON.parse(` line and its `assert.ok(db.consentEvents.some(...))` with:

```js
  const { rows: withdrawn } = await query(
    `select 1 from safespace.consent_events
      where user_id = $1 and type = 'withdrawn' and channel = 'account'`,
    [u.id],
  );
  assert.equal(withdrawn.length, 1);
```

5. In `re-verifying a detached phone reconnects the preserved account without storing the raw number`, replace the `detachedDb` lines (from `const detachedDb` through the `'the detached user record must not retain the raw number'` assertion) with:

```js
  const { rows: [detachedRow] } = await query('select * from safespace.users where id = $1', [original.id]);
  assert.equal(detachedRow.phone, null);
  assert.match(detachedRow.phone_lookup_hash, /^[a-f0-9]{64}$/);
  assert.ok(
    !JSON.stringify(detachedRow).includes('+6591234567'),
    'the detached user record must not retain the raw number',
  );
```

6. In `detach requires the current recovery secret and refreshes an attached legacy hash`, replace the two-line `const before = JSON.parse(...).users[user.id].phoneLookupHash;` with:

```js
    const before = (await query('select phone_lookup_hash from safespace.users where id = $1', [user.id]))
      .rows[0].phone_lookup_hash;
```

7. In `email verification changes ownership state only for the current pending address`, replace the `!fs.readFileSync(DATA_FILE, 'utf8').includes(firstVerificationId)` assertion with:

```js
  assert.ok(
    !(await dumpDb()).includes(firstVerificationId),
    'the opaque verification credential must be stored only as a digest',
  );
```

   and replace the closing `const db = JSON.parse(...)` / `db.consentEvents.some(...)` block with:

```js
  const { rows: verifiedEvents } = await query(
    `select 1 from safespace.consent_events
      where user_id = $1 and type = 'email-verified' and channel = 'email'`,
    [user.id],
  );
  assert.equal(verifiedEvents.length, 1);
```

8. In `email verification enforces durable per-account and per-destination limits`, replace the closing `const db = JSON.parse(...)` block (three assertions) with:

```js
  const { rows: hits } = await query('select scope, subject_key from safespace.rate_limit_hits');
  assert.ok(hits.some((hit) => hit.scope === 'email-account'));
  assert.ok(hits.some((hit) => hit.scope === 'email-destination'));
  assert.ok(!JSON.stringify(hits).includes('shared@example.com'));
```

9. In `phone verification send limits are durable and destination-scoped`, replace the closing block with:

```js
  const { rows: hits } = await query('select scope from safespace.rate_limit_hits');
  assert.ok(hits.some((hit) => hit.scope === 'phone-destination'));
  assert.ok(!(await dumpDb()).includes('+6591234567'));
```

10. In `phone verification also caps one requester across rotating destinations`, replace the closing block with:

```js
  const { rows: hits } = await query('select scope from safespace.rate_limit_hits');
  assert.ok(hits.some((hit) => hit.scope === 'phone-requester'));
  assert.ok(!(await dumpDb()).includes('203.0.113.10'));
```

11. In `attempt action tokens are stored hashed and can be used only once`, replace the two lines starting `const raw = fs.readFileSync` with:

```js
  assert.ok(!(await dumpDb()).includes(attempt.actionToken), 'raw action token must never be persisted');
```

12. Delete the whole `file writes are complete atomic replacements with no leftover temp file` test.

In `server/routes.test.mjs`:
- Delete `const TEST_DIR = …`, `const DATA_FILE = …` and `process.env.SAFESPACE_DATA_FILE = DATA_FILE;`.
- Remove the `fs`, `os` and `path` imports if nothing else in the file uses them (check with `grep -n "fs\.\|os\.\|path\." server/routes.test.mjs`).
- Add `import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';` after the `node:assert/strict` import.
- Directly before `const { app } = await import('./index.js');`, add `await setupTestDb();`.
- Replace `const freshStore = () => fs.rmSync(DATA_FILE, { force: true });` with `const freshStore = resetDb;`.
- Replace every `freshStore();` with `await freshStore();`.
- In the `after` hook, replace `fs.rmSync(TEST_DIR, { recursive: true, force: true });` with `await teardownTestDb();`.

In `server/intel.test.mjs`:
- Delete the `TEST_DIR` line, the `process.env.SAFESPACE_DATA_FILE = …` line, `delete process.env.UPSTASH_REDIS_REST_URL;` and the `after(() => fs.rmSync(TEST_DIR, …))` line.
- Add `import { dumpDb, resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';` and, before the first `await import(...)`, add `await setupTestDb();` and `after(teardownTestDb);`.
- Replace `const freshStore = () => fs.rmSync(process.env.SAFESPACE_DATA_FILE, { force: true });` with `const freshStore = resetDb;`, and every `freshStore();` with `await freshStore();`.
- Replace `const stored = fs.readFileSync(process.env.SAFESPACE_DATA_FILE, 'utf8');` with `const stored = await dumpDb();`.
- Remove the `fs`, `os` and `path` imports if nothing else in the file uses them.

Delete the obsolete files:

```bash
git rm server/store.redis.test.mjs server/data.seed.json
```

- [ ] **Step 2: Run the suite to verify it fails**

Run: `node --test server/*.test.mjs`
Expected: FAIL. The store still reads `data.seed.json`, which is deleted (`ENOENT`), and nothing it does reaches Postgres.

- [ ] **Step 3: Rewrite `server/store.js`**

Replace the entire file with:

```js
// SafeSpace data store, on Postgres: Supabase in production, PGlite locally and in tests
// (see db.js). Every export keeps the contract it had on the old whole-document store,
// so server/index.js did not change when the storage moved.
//
// Each write is one transaction that locks exactly what it reads: a user row, an attempt
// row, or, where the row may not exist yet, an advisory lock on a hashed key. Writes for
// different users no longer wait for each other.
import crypto from 'crypto';
import { computeResult, KNOWN_OUTCOMES } from './xp.js';
import { query, transaction } from './db.js';
import {
  INSERT_USER_SQL,
  UPDATE_USER_SQL,
  attemptFromRow,
  resultFromRow,
  userFromRow,
  userValues,
} from './rows.js';

// Fields that must NEVER leave the server in a list/leaderboard response.
// `phone` is PII; sessions are bearer credentials.
const PRIVATE_FIELDS = [
  'phone',
  'phoneLookupHash',
  'email',
  'pendingEmail',
  'emailVerifiedAt',
  'emailVerificationRequestedAt',
  'emailVerificationTokenHash',
];

/** Strip PII before sending a user record to any client. */
export function publicUser(u) {
  if (!u) return u;
  const safe = { ...u };
  for (const f of PRIVATE_FIELDS) delete safe[f];
  return safe;
}

const OUTCOME_SET = new Set(KNOWN_OUTCOMES);
const ACTIVE_ATTEMPT_STATUSES = new Set(['created', 'sent']);
const TERMINAL_ATTEMPT_STATUSES = new Set(['completed', 'failed']);
const ONE_HOUR_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_ACCOUNT_MAX = 5;
const EMAIL_VERIFICATION_DESTINATION_MAX = 3;
const PHONE_VERIFICATION_DESTINATION_MAX = 5;
const PHONE_VERIFICATION_REQUESTER_MAX = 20;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  return Math.max(1, Math.floor(positiveNumber(value, fallback)));
}

// --- Transaction helpers ------------------------------------------------------

async function lockUser(tx, userId) {
  const { rows } = await tx.query(
    'select * from safespace.users where id = $1 for update',
    [String(userId)],
  );
  return userFromRow(rows[0]);
}

async function requireLockedUser(tx, userId) {
  const user = await lockUser(tx, userId);
  if (!user) throw new Error(`unknown user ${userId}`);
  return user;
}

async function readUser(tx, userId) {
  const { rows } = await tx.query('select * from safespace.users where id = $1', [String(userId)]);
  return userFromRow(rows[0]);
}

async function saveUser(tx, user) {
  const { rows } = await tx.query(UPDATE_USER_SQL, [user.id, ...userValues(user)]);
  return userFromRow(rows[0]);
}

async function insertUser(tx, user) {
  const { rows } = await tx.query(INSERT_USER_SQL, [user.id, ...userValues(user)]);
  return userFromRow(rows[0]);
}

/** Serialise on a key that may have no row yet. Released when the transaction ends. */
async function advisoryLock(tx, key) {
  await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

async function logConsent(tx, { userId, type, channel, at }) {
  await tx.query(
    'insert into safespace.consent_events (user_id, type, channel, at) values ($1, $2, $3, $4)',
    [userId, type, channel, at],
  );
}

// --- Read models ---------------------------------------------------------------

export async function getUser(id) {
  if (!id) return null;
  const { rows } = await query('select * from safespace.users where id = $1', [String(id)], 'getUser');
  return userFromRow(rows[0]);
}

export async function listConsentedUsers() {
  const { rows } = await query(
    'select * from safespace.users where consent_to_drills order by created_at, id',
    [],
    'listConsentedUsers',
  );
  return rows.map(userFromRow);
}

// Leaderboard = users ranked by xp, shaped for the React LeaderboardScreen.
// Explicit field list — never spreads the raw user, so PII can't leak in.
export async function getLeaderboard() {
  const { rows } = await query(
    'select id, name, xp, level, times_safe from safespace.users order by xp desc, created_at, id',
    [],
    'getLeaderboard',
  );
  return rows.map((u, i) => ({
    rank: i + 1, id: u.id, name: u.name, score: u.xp, level: u.level, wins: u.times_safe,
  }));
}

// All family members, shaped for the React FamilyHomeScreen (dollhouse rooms).
// Projected — this endpoint is world-readable, so it must not carry phone numbers.
export async function getFamily() {
  const { rows } = await query('select * from safespace.users order by created_at, id', [], 'getFamily');
  return rows.map((row) => publicUser(userFromRow(row)));
}

/** The cheapest possible round trip, for the keep-alive cron. */
export async function pingDb() {
  await query('select 1', [], 'pingDb');
}

// --- Scoring ------------------------------------------------------------------

function scoreUser(user, outcome, practice) {
  const r = computeResult(outcome, { practice });
  user.xp += r.xp;
  while (user.xp >= user.xpMax) {
    user.xp -= user.xpMax;
    user.level += 1;
    user.xpMax = Math.round(user.xpMax * 1.2);
  }
  if (r.streak === 'inc') {
    user.streak += 1;
    user.timesSafe += 1;
    user.safeThisWeek = true;
  } else if (r.streak === 'reset') {
    user.streak = 0;
    user.timesScammed += 1;
    user.safeThisWeek = false;
  }
  if (r.result === 'WON' || r.result === 'LOST') user.recentDrillResult = r.result;
  return r;
}

async function insertResult(tx, record, practiceSourceKey = null) {
  await tx.query(
    `insert into safespace.drill_results
       (id, user_id, channel, outcome, practice, result, screen, xp_gained, at,
        attempt_id, provider_id, unscored_reason, practice_source_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      record.id, record.userId, record.channel, record.outcome, record.practice,
      record.result, record.screen, record.xpGained, record.at, record.attemptId ?? null,
      record.providerId ?? null, record.unscoredReason ?? null, practiceSourceKey,
    ],
  );
}

async function readResult(tx, id) {
  const { rows } = await tx.query('select * from safespace.drill_results where id = $1', [id]);
  return resultFromRow(rows[0]);
}

// Every real (non-practice) result stays pending until the client explicitly ACKs it,
// SAFE outcomes included: they have no result screen, but delivery still clears the
// client's "awaiting call" marker. The pending queue is `acknowledged_at is null`.
async function applyOutcomeInTx(tx, {
  userId,
  outcome,
  channel,
  practice,
  recordId,
  at,
  attemptId = null,
  providerId = null,
  practiceSourceKey = null,
}) {
  const user = await requireLockedUser(tx, userId);
  if (!OUTCOME_SET.has(outcome)) throw new Error(`unknown outcome ${outcome}`);

  const r = scoreUser(user, outcome, practice);
  const record = {
    id: recordId,
    userId,
    channel,
    outcome,
    practice,
    result: r.result,
    screen: r.screen,
    xpGained: r.xp,
    at,
    ...(attemptId ? { attemptId } : {}),
    ...(providerId ? { providerId } : {}),
  };
  await insertResult(tx, record, practiceSourceKey);
  return { record, user: await saveUser(tx, user) };
}

/**
 * Apply an outcome that does not belong to a provider attempt (practice and demo use).
 * Provider callbacks must use completeDrillAttempt so attribution and scoring are one
 * atomic, exactly-once mutation.
 */
export async function applyOutcome({ userId, outcome, channel = 'call', practice = false }) {
  const recordId = `drill_${crypto.randomUUID()}`;
  const at = new Date().toISOString();
  return transaction(
    (tx) => applyOutcomeInTx(tx, { userId, outcome, channel, practice, recordId, at }),
    'applyOutcome',
  );
}

/**
 * Idempotent practice scoring for retrying/double-clicking clients. The client id is
 * namespaced to the authenticated user and stored only as a digest.
 */
export async function applyPracticeOutcomeOnce({
  userId,
  clientAttemptId,
  outcome,
  channel = 'call',
} = {}) {
  const cleanId = String(clientAttemptId || '').trim();
  if (!cleanId) throw new Error('clientAttemptId is required');
  if (cleanId.length > 200) throw new Error('clientAttemptId is too long');
  const sourceKey = sha256(`practice\0${userId}\0${cleanId}`);
  const recordId = `drill_${crypto.randomUUID()}`;
  const at = new Date().toISOString();

  return transaction(async (tx) => {
    // Locking the user serialises a double-click; the unique key is the backstop.
    const user = await lockUser(tx, userId);
    const { rows } = await tx.query(
      'select * from safespace.drill_results where practice_source_key = $1',
      [sourceKey],
    );
    if (rows[0]) {
      return { status: 'duplicate', applied: false, record: resultFromRow(rows[0]), user };
    }
    const scored = await applyOutcomeInTx(tx, {
      userId,
      outcome,
      channel,
      practice: true,
      recordId,
      at,
      practiceSourceKey: sourceKey,
    });
    return { status: 'completed', applied: true, record: scored.record, user: scored.user };
  }, 'applyPracticeOutcomeOnce');
}

// --- Pending results ----------------------------------------------------------

/** Non-destructive result reads. The first item is the next result to display. */
export async function listPendingResults(userId) {
  if (!userId) return [];
  const { rows } = await query(
    `select * from safespace.drill_results
      where user_id = $1 and practice = false and acknowledged_at is null
      order by seq`,
    [String(userId)],
    'listPendingResults',
  );
  return rows.map(resultFromRow);
}

export async function peekPendingResult(userId) {
  const pending = await listPendingResults(userId);
  return pending[0] || null;
}

/** Remove exactly the result the client confirms it displayed. */
export async function ackPendingResult(userId, resultId) {
  if (!userId || !resultId) return null;
  const { rows } = await query(
    `update safespace.drill_results set acknowledged_at = now()
      where id = $1 and user_id = $2 and practice = false and acknowledged_at is null
      returning *`,
    [String(resultId), String(userId)],
    'ackPendingResult',
  );
  return resultFromRow(rows[0]);
}

/**
 * Compatibility for older routes: take only the first queued result. New routes should
 * use peekPendingResult + ackPendingResult so a failed response cannot lose a result.
 */
export async function takePendingResult(userId) {
  const pending = await peekPendingResult(userId);
  if (!pending) return null;
  return ackPendingResult(userId, pending.id);
}

// --- Provider attempts ----------------------------------------------------------

function publicAttempt(attempt) {
  if (!attempt) return null;
  const safe = { ...attempt };
  delete safe.actionTokenHash;
  return safe;
}

export class DrillAttemptConflict extends Error {
  constructor(message, { retryAfterMs = 0, attempt = null, reason = 'active' } = {}) {
    super(message);
    this.name = 'DrillAttemptConflict';
    this.code = 'DRILL_ATTEMPT_CONFLICT';
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
    this.attempt = publicAttempt(attempt);
  }
}

async function lockAttempt(tx, attemptId) {
  const { rows } = await tx.query(
    'select * from safespace.drill_attempts where id = $1 for update',
    [String(attemptId)],
  );
  return attemptFromRow(rows[0]);
}

async function attemptByProviderId(tx, providerId) {
  const { rows } = await tx.query('select * from safespace.drill_attempts where provider_id = $1', [providerId]);
  return attemptFromRow(rows[0]);
}

/**
 * Reserve an attempt before contacting a provider. When cooldownMs is supplied this
 * atomically enforces one active attempt and a per-user/channel cooldown, across every
 * server instance: the user row lock serialises them.
 */
export async function createDrillAttempt({
  userId,
  channel = 'call',
  providerId = null,
  status = 'created',
  mintActionToken = false,
  cooldownMs = 0,
} = {}) {
  if (!userId) throw new Error('userId is required');
  if (!['created', 'sent'].includes(status)) throw new Error(`invalid initial attempt status ${status}`);

  const attemptId = `attempt_${crypto.randomUUID()}`;
  const actionToken = mintActionToken ? crypto.randomBytes(32).toString('base64url') : null;
  const actionTokenHash = actionToken ? sha256(actionToken) : null;
  const createdAt = new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);
  const cleanProviderId = String(providerId || '').trim() || null;

  return transaction(async (tx) => {
    await requireLockedUser(tx, userId);

    if (cleanProviderId) {
      const existing = await attemptByProviderId(tx, cleanProviderId);
      if (existing) {
        if (existing.userId === userId && existing.channel === channel) return publicAttempt(existing);
        throw new DrillAttemptConflict('provider id already belongs to another attempt', {
          attempt: existing,
        });
      }
    }

    const minimumGap = Math.max(0, Number(cooldownMs) || 0);
    if (minimumGap > 0) {
      // Only attempts inside the window can conflict. An older attempt is past cooldown.
      const { rows } = await tx.query(
        `select * from safespace.drill_attempts
          where user_id = $1 and channel = $2 and created_at > $3
          order by created_at desc`,
        [userId, channel, new Date(createdAtMs - minimumGap).toISOString()],
      );
      const recent = rows.map(attemptFromRow);
      // A provider callback can be lost. Treat an active marker as a lock only for the
      // cooldown window; otherwise one missing webhook would block this channel forever.
      const active = recent.find((attempt) => ACTIVE_ATTEMPT_STATUSES.has(attempt.status));
      if (active) {
        throw new DrillAttemptConflict('a drill attempt is already active', {
          attempt: active,
          retryAfterMs: Math.max(0, minimumGap - (createdAtMs - Date.parse(active.createdAt))),
        });
      }
      const latest = recent[0];
      if (latest) {
        const elapsed = createdAtMs - Date.parse(latest.createdAt);
        if (elapsed < minimumGap) {
          throw new DrillAttemptConflict('drill attempt is on cooldown', {
            reason: 'cooldown',
            retryAfterMs: Math.ceil(minimumGap - elapsed),
            attempt: latest,
          });
        }
      }
    }

    const { rows } = await tx.query(
      `insert into safespace.drill_attempts
         (id, user_id, channel, status, provider_id, action_token_hash, created_at, sent_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        attemptId, userId, channel, status, cleanProviderId, actionTokenHash, createdAt,
        status === 'sent' ? createdAt : null,
      ],
    );
    return { ...publicAttempt(attemptFromRow(rows[0])), ...(actionToken ? { actionToken } : {}) };
  }, 'createDrillAttempt');
}

export async function getDrillAttempt(idOrProviderId) {
  if (!idOrProviderId) return null;
  const { rows } = await query(
    `select * from safespace.drill_attempts where id = $1 or provider_id = $1
      order by (id = $1) desc limit 1`,
    [String(idOrProviderId)],
    'getDrillAttempt',
  );
  return publicAttempt(attemptFromRow(rows[0]));
}

export async function getDrillAttemptByActionToken(actionToken) {
  if (!actionToken) return null;
  const { rows } = await query(
    'select * from safespace.drill_attempts where action_token_hash = $1',
    [sha256(actionToken)],
    'getDrillAttemptByActionToken',
  );
  return publicAttempt(attemptFromRow(rows[0]));
}

export async function getRecentDrillAttempt({ userId, channel = 'call', since = 0 } = {}) {
  if (!userId) return null;
  const sinceMs = since instanceof Date ? since.getTime() : Number(since) || Date.parse(since) || 0;
  const { rows } = await query(
    `select * from safespace.drill_attempts
      where user_id = $1 and channel = $2 and created_at >= $3
      order by created_at desc limit 1`,
    [String(userId), channel, new Date(sinceMs).toISOString()],
    'getRecentDrillAttempt',
  );
  return publicAttempt(attemptFromRow(rows[0]));
}

export async function markDrillAttemptSent(attemptId, { providerId = null } = {}) {
  if (!attemptId) throw new Error('attemptId is required');
  const cleanProviderId = String(providerId || '').trim() || null;
  const sentAt = new Date().toISOString();
  return transaction(async (tx) => {
    const attempt = await lockAttempt(tx, attemptId);
    if (!attempt) return null;
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) return publicAttempt(attempt);

    if (cleanProviderId) {
      const owner = await attemptByProviderId(tx, cleanProviderId);
      if (owner && owner.id !== attempt.id) {
        throw new DrillAttemptConflict('provider id already belongs to another attempt', {
          attempt: owner,
        });
      }
    }
    if (attempt.providerId && cleanProviderId && attempt.providerId !== cleanProviderId) {
      throw new DrillAttemptConflict('attempt already has a different provider id', { attempt });
    }
    const { rows } = await tx.query(
      `update safespace.drill_attempts
          set status = 'sent', provider_id = coalesce($2, provider_id), sent_at = coalesce(sent_at, $3)
        where id = $1
        returning *`,
      [attempt.id, cleanProviderId, sentAt],
    );
    return publicAttempt(attemptFromRow(rows[0]));
  }, 'markDrillAttemptSent');
}

export async function markDrillAttemptFailed(attemptId, { reason = 'provider_error' } = {}) {
  if (!attemptId) throw new Error('attemptId is required');
  const completedAt = new Date().toISOString();
  return transaction(async (tx) => {
    const attempt = await lockAttempt(tx, attemptId);
    if (!attempt) return null;
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) return publicAttempt(attempt);
    const { rows } = await tx.query(
      `update safespace.drill_attempts
          set status = 'failed', scored = false, failure_reason = $2, completed_at = $3,
              action_token_hash = null
        where id = $1
        returning *`,
      [attempt.id, String(reason || 'provider_error').slice(0, 80), completedAt],
    );
    return publicAttempt(attemptFromRow(rows[0]));
  }, 'markDrillAttemptFailed');
}

const FINISH_ATTEMPT_SQL = `update safespace.drill_attempts
    set status = $2, scored = $3, outcome = $4, failure_reason = $5, completed_at = $6,
        result_record_id = $7, provider_id = coalesce(provider_id, $8), action_token_hash = null
  where id = $1
  returning *`;

/**
 * Resolve and lock the attempt the identifiers name. If they name more than one attempt,
 * fail closed rather than let provider metadata complete somebody else's attempt.
 */
async function lockAttemptByIdentifiers(tx, { providerId, attemptId, actionTokenHash }) {
  const { rows } = await tx.query(
    `select * from safespace.drill_attempts
      where provider_id = $1 or id = $2 or action_token_hash = $3
      order by id
      for update`,
    [providerId, attemptId, actionTokenHash],
  );
  return rows.length === 1 ? attemptFromRow(rows[0]) : null;
}

/**
 * Resolve and complete a provider attempt in one transaction. Unknown identifiers and
 * terminal/replayed callbacks never touch XP. Supplying no outcome records an
 * operational, unscored failure rather than silently turning missing evidence into a win.
 */
export async function completeDrillAttempt({
  providerId = null,
  attemptId = null,
  actionToken = null,
  outcome = null,
  unscoredReason = null,
} = {}) {
  const cleanProviderId = String(providerId || '').trim() || null;
  const cleanAttemptId = attemptId ? String(attemptId) : null;
  const actionTokenHash = actionToken ? sha256(actionToken) : null;
  if (!cleanProviderId && !cleanAttemptId && !actionTokenHash) {
    throw new Error('providerId, attemptId or actionToken is required');
  }
  if (outcome && !OUTCOME_SET.has(outcome)) throw new Error(`unknown outcome ${outcome}`);

  const completedAt = new Date().toISOString();
  const recordId = `drill_${crypto.randomUUID()}`;
  return transaction(async (tx) => {
    const attempt = await lockAttemptByIdentifiers(tx, {
      providerId: cleanProviderId,
      attemptId: cleanAttemptId,
      actionTokenHash,
    });
    if (!attempt) {
      return { status: 'unknown', applied: false, attempt: null, record: null, user: null };
    }
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) {
      return {
        status: 'duplicate',
        applied: false,
        attempt: publicAttempt(attempt),
        record: attempt.resultRecordId ? await readResult(tx, attempt.resultRecordId) : null,
        user: await readUser(tx, attempt.userId),
      };
    }

    const recordProviderId = attempt.providerId || cleanProviderId;
    if (!outcome) {
      const record = {
        id: recordId,
        userId: attempt.userId,
        channel: attempt.channel,
        outcome: null,
        practice: false,
        result: 'UNSCORED',
        screen: null,
        xpGained: 0,
        at: completedAt,
        attemptId: attempt.id,
        ...(recordProviderId ? { providerId: recordProviderId } : {}),
        unscoredReason: String(unscoredReason || 'analysis_missing').slice(0, 80),
      };
      await insertResult(tx, record);
      const { rows } = await tx.query(FINISH_ATTEMPT_SQL, [
        attempt.id, 'failed', false, null, record.unscoredReason, completedAt, record.id, cleanProviderId,
      ]);
      return {
        status: 'unscored',
        applied: false,
        attempt: publicAttempt(attemptFromRow(rows[0])),
        record,
        user: await readUser(tx, attempt.userId),
      };
    }

    const { record, user } = await applyOutcomeInTx(tx, {
      userId: attempt.userId,
      outcome,
      channel: attempt.channel,
      practice: false,
      recordId,
      at: completedAt,
      attemptId: attempt.id,
      providerId: recordProviderId,
    });
    const { rows } = await tx.query(FINISH_ATTEMPT_SQL, [
      attempt.id, 'completed', true, outcome, null, completedAt, record.id, cleanProviderId,
    ]);
    return {
      status: 'completed',
      applied: true,
      attempt: publicAttempt(attemptFromRow(rows[0])),
      record,
      user,
    };
  }, 'completeDrillAttempt');
}

/** Backward-compatible post-send helper used by the existing call/email/SMS routes. */
export async function recordDrillFired({ userId, channel = 'call', callId = null }) {
  return createDrillAttempt({
    userId,
    channel,
    providerId: callId,
    status: 'sent',
  });
}

// --- Accounts -------------------------------------------------------------------

function normaliseUserName(name) {
  return String(name || '').trim().toUpperCase().slice(0, 30);
}

function identityLookupSecret({ required = false } = {}) {
  const secret = String(process.env.IDENTITY_LOOKUP_SECRET || '').trim();
  if (secret.length >= 32) return secret;
  if (!required) return null;
  const error = new Error('identity recovery is not configured');
  error.code = 'IDENTITY_RECOVERY_UNAVAILABLE';
  throw error;
}

// Keep a stable, non-reversible account lookup after a user removes the raw phone
// number. A keyed digest is important here: the space of valid phone numbers is small
// enough that an ordinary SHA-256 digest could be enumerated offline.
function phoneLookupHash(phone, { required = false } = {}) {
  const secret = identityLookupSecret({ required });
  if (!secret) return null;
  return crypto
    .createHmac('sha256', secret)
    .update(String(phone || '').trim())
    .digest('hex');
}

// Upsert a phone-verified user and log a 'granted' consent event (the audit trail).
// Called by /api/verify/check after OTP succeeds.
export async function registerVerifiedUser({ phone, name, email }) {
  const cleanName = normaliseUserName(name);
  if (!cleanName) throw new Error('name is required');
  const lookupHash = phoneLookupHash(phone);
  const newId = `usr_${crypto.randomUUID()}`;
  const at = new Date().toISOString();

  return transaction(async (tx) => {
    // Two OTP checks for the same new number must not create two accounts. There is no
    // row to lock yet, so serialise on a digest of the number. The unique index on
    // phone is the backstop.
    await advisoryLock(tx, `register:${sha256(`register\0${phone}`)}`);

    // Look up by phone, but key the record by an OPAQUE id. Using the phone number as the
    // primary key made it PII that leaked through every id-bearing response and URL.
    let { rows } = await tx.query('select * from safespace.users where phone = $1 for update', [phone]);
    if (!rows[0] && lookupHash) {
      ({ rows } = await tx.query(
        'select * from safespace.users where phone_lookup_hash = $1 for update',
        [lookupHash],
      ));
    }
    let user = userFromRow(rows[0]);
    const isNew = !user;
    if (isNew) {
      user = {
        id: newId,
        name: cleanName,
        role: 'ROOKIE',
        phone,
        consentToDrills: true,
        level: 1, xp: 0, xpMax: 500, streak: 0, timesSafe: 0, timesScammed: 0,
        primaryColor: '#4ecdc4', badgeCount: 0, badgeTotal: 9,
        roomName: 'GUEST ROOM', roomBg: '#081420', safeThisWeek: true, recentDrillResult: null,
      };
    }
    user.phone = phone;
    if (lookupHash) user.phoneLookupHash = lookupHash;
    user.name = cleanName;
    // A phone OTP proves control of the phone, not of an email address. Keep an
    // optional address as an unverified candidate until its signed ownership link is
    // opened. Real email drills require `emailVerifiedAt`.
    if (email) {
      const candidate = String(email).trim().toLowerCase();
      if (user.email !== candidate) {
        delete user.emailVerifiedAt;
        delete user.emailVerificationTokenHash;
        user.email = candidate;
        user.pendingEmail = candidate;
      } else if (!user.emailVerifiedAt) {
        user.pendingEmail = candidate;
      } else {
        delete user.pendingEmail;
        delete user.emailVerificationRequestedAt;
        delete user.emailVerificationTokenHash;
      }
    }
    user.consentToDrills = true;

    const saved = isNew ? await insertUser(tx, user) : await saveUser(tx, user);
    await logConsent(tx, { userId: saved.id, type: 'granted', channel: 'otp', at });
    return saved;
  }, 'registerVerifiedUser');
}

export async function setUserName(userId, name) {
  const cleanName = normaliseUserName(name);
  if (!cleanName) throw new Error('name is required');
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    user.name = cleanName;
    return saveUser(tx, user);
  }, 'setUserName');
}

// Backward-compatible storage helper. Setting an address never marks it verified:
// controlling the account's phone is not proof that the caller owns this inbox.
export async function setUserEmail(userId, email) {
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    user.email = String(email).trim().toLowerCase();
    user.pendingEmail = user.email;
    delete user.emailVerifiedAt;
    delete user.emailVerificationTokenHash;
    return saveUser(tx, user);
  }, 'setUserEmail');
}

export class EmailVerificationConflict extends Error {
  constructor(message, { retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'EmailVerificationConflict';
    this.code = 'EMAIL_VERIFICATION_CONFLICT';
    this.retryAfterMs = retryAfterMs;
  }
}

export class VerificationRateLimitConflict extends Error {
  constructor(message, { retryAfterMs = 0, reason = 'rate_limited' } = {}) {
    super(message);
    this.name = 'VerificationRateLimitConflict';
    this.code = 'VERIFICATION_RATE_LIMITED';
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
  }
}

// --- Rate limits ------------------------------------------------------------------

function rateLimitSubjectKey(scope, subject) {
  const material = `${scope}\0${String(subject)}`;
  const lookupSecret = String(process.env.IDENTITY_LOOKUP_SECRET || '').trim();
  // Production already requires this secret for detach-safe account recovery, so use
  // it to stop an exposed rate-limit table from becoming an enumerable phone/email
  // directory. Development still gets stable non-raw keys before that secret is set.
  return lookupSecret.length >= 32
    ? crypto.createHmac('sha256', lookupSecret).update(material).digest('hex')
    : crypto.createHash('sha256').update(material).digest('hex');
}

function retryAfterForWindow(hits, nowMs, windowMs) {
  const oldest = Math.min(...hits);
  return Math.max(1, Math.ceil(windowMs - (nowMs - oldest)));
}

/**
 * Lock each (scope, subject) and read its still-active hits, oldest first. Locks are
 * taken in sorted order so two requests touching the same keys cannot deadlock.
 */
async function lockRateLimits(tx, subjects, { nowMs, windowMs }) {
  const buckets = subjects.map(({ scope, subject }) => ({
    scope,
    key: rateLimitSubjectKey(scope, subject),
    hits: [],
  }));
  for (const lockKey of buckets.map(({ scope, key }) => `rate:${scope}:${key}`).sort()) {
    await advisoryLock(tx, lockKey);
  }
  const cutoff = new Date(nowMs - windowMs).toISOString();
  for (const bucket of buckets) {
    const { rows } = await tx.query(
      `select hit_at from safespace.rate_limit_hits
        where scope = $1 and subject_key = $2 and hit_at > $3
        order by hit_at`,
      [bucket.scope, bucket.key, cutoff],
    );
    bucket.hits = rows.map((row) => new Date(row.hit_at).getTime());
  }
  return buckets;
}

/** Record one send per bucket, and delete hits whose window has passed. */
async function recordRateLimitHits(tx, buckets, { nowMs, windowMs }) {
  const cutoff = new Date(nowMs - windowMs).toISOString();
  // Expired hits are deleted, not kept: the table must not become a record of every
  // number and inbox that was ever verified.
  for (const scope of new Set(buckets.map((bucket) => bucket.scope))) {
    await tx.query('delete from safespace.rate_limit_hits where scope = $1 and hit_at <= $2', [scope, cutoff]);
  }
  const at = new Date(nowMs).toISOString();
  for (const bucket of buckets) {
    await tx.query(
      'insert into safespace.rate_limit_hits (scope, subject_key, hit_at) values ($1, $2, $3)',
      [bucket.scope, bucket.key, at],
    );
  }
}

/**
 * Atomically reserve an ownership-verification send. This prevents a signed-in user
 * from turning the verification endpoint into a rapid mail relay, including when
 * several server instances receive requests at once.
 */
export async function beginEmailVerification({
  userId,
  email,
  verificationId,
  cooldownMs = 60_000,
  now = Date.now(),
  rateWindowMs = ONE_HOUR_MS,
  maxAccountSends = EMAIL_VERIFICATION_ACCOUNT_MAX,
  maxDestinationSends = EMAIL_VERIFICATION_DESTINATION_MAX,
} = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  const opaqueId = String(verificationId || '').trim();
  if (!userId || !normalized || opaqueId.length < 32) {
    throw new Error('userId, email and an opaque verificationId are required');
  }
  const tokenHash = sha256(opaqueId);
  const requestedAtMs = Number(now);
  if (!Number.isFinite(requestedAtMs)) throw new Error('now must be a finite timestamp');
  const requestedAt = new Date(requestedAtMs).toISOString();
  const windowMs = positiveNumber(rateWindowMs, ONE_HOUR_MS);
  const accountMax = positiveInteger(maxAccountSends, EMAIL_VERIFICATION_ACCOUNT_MAX);
  const destinationMax = positiveInteger(maxDestinationSends, EMAIL_VERIFICATION_DESTINATION_MAX);

  return transaction(async (tx) => {
    // Row lock first, advisory locks second: the lock order every writer follows.
    const user = await requireLockedUser(tx, userId);
    if (user.email === normalized && user.emailVerifiedAt) {
      // Explicitly choosing the verified address again cancels any abandoned change
      // request and invalidates its older link.
      delete user.pendingEmail;
      delete user.emailVerificationRequestedAt;
      delete user.emailVerificationTokenHash;
      return { alreadyVerified: true, user: await saveUser(tx, user) };
    }

    const previousMs = Date.parse(user.emailVerificationRequestedAt || '');
    const waitMs = Math.max(0, Number(cooldownMs) || 0);
    if (Number.isFinite(previousMs) && requestedAtMs - previousMs < waitMs) {
      throw new EmailVerificationConflict('email verification is on cooldown', {
        retryAfterMs: Math.ceil(waitMs - (requestedAtMs - previousMs)),
      });
    }

    const window = { nowMs: requestedAtMs, windowMs };
    const [account, destination] = await lockRateLimits(tx, [
      { scope: 'email-account', subject: userId },
      { scope: 'email-destination', subject: normalized },
    ], window);
    if (account.hits.length >= accountMax) {
      throw new EmailVerificationConflict('email verification account limit reached', {
        retryAfterMs: retryAfterForWindow(account.hits, requestedAtMs, windowMs),
      });
    }
    if (destination.hits.length >= destinationMax) {
      throw new EmailVerificationConflict('email verification destination limit reached', {
        retryAfterMs: retryAfterForWindow(destination.hits, requestedAtMs, windowMs),
      });
    }

    await recordRateLimitHits(tx, [account, destination], window);
    user.pendingEmail = normalized;
    user.emailVerificationRequestedAt = requestedAt;
    user.emailVerificationTokenHash = tokenHash;
    return { alreadyVerified: false, user: await saveUser(tx, user) };
  }, 'beginEmailVerification');
}

function tokenMatches(expectedHash, suppliedHash) {
  const expected = String(expectedHash || '');
  return expected.length === suppliedHash.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(suppliedHash));
}

/**
 * Release only the exact send reservation that failed. Comparing both the address and
 * opaque credential prevents a slow failure for request A from deleting a newer request
 * B made for the same inbox.
 */
export async function cancelEmailVerification(userId, email, verificationId) {
  const normalized = String(email || '').trim().toLowerCase();
  const opaqueId = String(verificationId || '').trim();
  if (!userId || !normalized || opaqueId.length < 32) {
    throw new Error('userId, email and an opaque verificationId are required');
  }
  const suppliedHash = sha256(opaqueId);
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    if (user.pendingEmail !== normalized) return user;
    if (!tokenMatches(user.emailVerificationTokenHash, suppliedHash)) return user;
    delete user.pendingEmail;
    delete user.emailVerificationRequestedAt;
    delete user.emailVerificationTokenHash;
    return saveUser(tx, user);
  }, 'cancelEmailVerification');
}

/**
 * Atomically reserve one public phone-OTP send, so every server instance enforces the
 * same 30-second gap, five-per-hour destination cap and requester-wide cap across
 * unique numbers.
 */
export async function reservePhoneVerificationSend({
  phone,
  requesterKey = null,
  now = Date.now(),
  cooldownMs = 30_000,
  rateWindowMs = ONE_HOUR_MS,
  maxSends = PHONE_VERIFICATION_DESTINATION_MAX,
  maxRequesterSends = PHONE_VERIFICATION_REQUESTER_MAX,
  // The destination caps exist to stop us texting a real phone repeatedly. When the
  // caller sends no SMS at all (dev bypass), they guard nothing and only block demos.
  // The requester cap still applies: it bounds writes to this store either way.
  skipDestinationLimit = false,
} = {}) {
  const destination = String(phone || '').trim();
  const requester = String(requesterKey || '').trim();
  if (!destination) throw new Error('phone is required');
  const requestedAtMs = Number(now);
  if (!Number.isFinite(requestedAtMs)) throw new Error('now must be a finite timestamp');
  const windowMs = positiveNumber(rateWindowMs, ONE_HOUR_MS);
  const boundedCooldownMs = Math.max(0, Number(cooldownMs) || 0);
  const destinationMax = positiveInteger(maxSends, PHONE_VERIFICATION_DESTINATION_MAX);
  const requesterMax = positiveInteger(maxRequesterSends, PHONE_VERIFICATION_REQUESTER_MAX);

  return transaction(async (tx) => {
    const subjects = [
      ...(skipDestinationLimit ? [] : [{ scope: 'phone-destination', subject: destination }]),
      ...(requester ? [{ scope: 'phone-requester', subject: requester }] : []),
    ];
    const window = { nowMs: requestedAtMs, windowMs };
    const buckets = await lockRateLimits(tx, subjects, window);
    const destinationBucket = buckets.find((bucket) => bucket.scope === 'phone-destination') || null;
    const requesterBucket = buckets.find((bucket) => bucket.scope === 'phone-requester') || null;

    const hits = destinationBucket?.hits ?? null;
    if (hits && hits.length >= destinationMax) {
      throw new VerificationRateLimitConflict('phone verification hourly limit reached', {
        reason: 'destination_hourly',
        retryAfterMs: retryAfterForWindow(hits, requestedAtMs, windowMs),
      });
    }
    const latest = hits?.length ? hits[hits.length - 1] : null;
    if (latest !== null && requestedAtMs - latest < boundedCooldownMs) {
      throw new VerificationRateLimitConflict('phone verification is on cooldown', {
        reason: 'destination_cooldown',
        retryAfterMs: Math.max(1, Math.ceil(boundedCooldownMs - (requestedAtMs - latest))),
      });
    }
    if (requesterBucket && requesterBucket.hits.length >= requesterMax) {
      throw new VerificationRateLimitConflict('phone verification requester limit reached', {
        reason: 'requester_hourly',
        retryAfterMs: retryAfterForWindow(requesterBucket.hits, requestedAtMs, windowMs),
      });
    }

    await recordRateLimitHits(tx, buckets, window);
    return {
      ok: true,
      remaining: hits ? Math.max(0, destinationMax - (hits.length + 1)) : null,
    };
  }, 'reservePhoneVerificationSend');
}

/**
 * Consume the current pending address after its signed link is opened. Requiring the
 * pending address to match also invalidates an older link when the user requests a
 * verification for a different inbox.
 */
export async function setVerifiedUserEmail(userId, verificationId) {
  const suppliedHash = sha256(String(verificationId || '').trim());
  const verifiedAt = new Date().toISOString();
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    if (!user.pendingEmail || !tokenMatches(user.emailVerificationTokenHash, suppliedHash)) {
      const error = new Error('email verification is no longer current');
      error.code = 'EMAIL_VERIFICATION_STALE';
      throw error;
    }
    user.email = user.pendingEmail;
    user.emailVerifiedAt = verifiedAt;
    delete user.pendingEmail;
    delete user.emailVerificationRequestedAt;
    delete user.emailVerificationTokenHash;
    const saved = await saveUser(tx, user);
    await logConsent(tx, { userId, type: 'email-verified', channel: 'email', at: verifiedAt });
    return saved;
  }, 'setVerifiedUserEmail');
}

// Remove the verified phone and every session whose authority came from that
// verification. Progress and optional email remain intact so the account can reconnect
// a number later without losing its training history.
export async function detachVerifiedPhone(userId) {
  const at = new Date().toISOString();
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    if (!user.phone) {
      const error = new Error('no verified phone on file');
      error.code = 'PHONE_NOT_ATTACHED';
      throw error;
    }

    // Preserve only a keyed lookup so a later OTP for the same number reconnects this
    // account and its progress. Never detach without it: doing so would silently orphan
    // the account that the UI promises to preserve. Recompute even when a hash exists,
    // which proves the deployed secret is available and migrates to a rotated key.
    user.phoneLookupHash = phoneLookupHash(user.phone, { required: true });
    delete user.phone;
    user.consentToDrills = false;
    const saved = await saveUser(tx, user);
    await tx.query('delete from safespace.sessions where user_id = $1', [user.id]);
    await logConsent(tx, { userId: user.id, type: 'withdrawn', channel: 'account', at });
    return saved;
  }, 'detachVerifiedPhone');
}

// --- Sessions -------------------------------------------------------------------
// A drill places a real phone call, so the caller must prove who they are with a
// server-issued bearer token. A client-supplied user id is an assertion, not proof.

function sessionTtlMs() {
  return Math.max(
    60_000,
    Number(process.env.SESSION_TTL_MS) || 30 * 24 * 60 * 60 * 1000,
  );
}

/** Issue a session token for a verified user. Returns the opaque token. */
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date();
  await query(
    `insert into safespace.sessions (token_hash, user_id, created_at, expires_at)
     values ($1, $2, $3, $4)`,
    [
      sha256(token),
      String(userId),
      createdAt.toISOString(),
      new Date(createdAt.getTime() + sessionTtlMs()).toISOString(),
    ],
    'createSession',
  );
  return token;
}

/** Look up a user by phone (server-internal only — never expose phone to clients). */
export async function getUserByPhone(phone) {
  if (!phone) return null;
  const { rows } = await query('select * from safespace.users where phone = $1', [phone], 'getUserByPhone');
  return userFromRow(rows[0]);
}

/** Resolve a bearer token to its user id, or null. */
export async function getUserIdByToken(token) {
  if (!token) return null;
  const { rows } = await query(
    'select user_id, expires_at from safespace.sessions where token_hash = $1',
    [sha256(token)],
    'getUserIdByToken',
  );
  const session = rows[0];
  if (!session) return null;
  return new Date(session.expires_at).getTime() > Date.now() ? session.user_id : null;
}

// --- Scam intel tactic cards ------------------------------------------------------
// A bounded rotating set, not an archive. Cards are written only by the refresh job
// after validation, and re-validated again before any call uses one, so nothing here is
// trusted for having been stored.

export const MAX_TACTIC_CARDS = 10;
export const DEFAULT_TACTIC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function tacticMaxAgeMs() {
  const configured = Number(process.env.INTEL_CARD_MAX_AGE_MS);
  return Number.isFinite(configured)
    && configured >= 60 * 60 * 1000
    && configured <= 180 * 24 * 60 * 60 * 1000
    ? configured
    : DEFAULT_TACTIC_MAX_AGE_MS;
}

function liveTacticCards(cards, nowMs, maxAgeMs) {
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    const fetchedAt = Date.parse(card?.fetchedAt);
    // A timestamp from the future is as suspect as a stale one.
    return Number.isFinite(fetchedAt) && fetchedAt <= nowMs + 5 * 60 * 1000 && nowMs - fetchedAt <= maxAgeMs;
  });
}

async function storedTacticCards(runner) {
  const { rows } = await runner('select card from safespace.tactic_cards order by fetched_at desc');
  return rows.map((row) => row.card);
}

export async function listLiveTacticCards({ now = Date.now(), maxAgeMs = tacticMaxAgeMs() } = {}) {
  const cards = await storedTacticCards((sql) => query(sql, [], 'listLiveTacticCards'));
  return liveTacticCards(cards, now, maxAgeMs);
}

/**
 * Merge freshly validated cards into the live set: newest first, one card per id, capped.
 * Re-running a refresh with the same results only refreshes timestamps, so a duplicated
 * cron invocation cannot grow the set.
 */
export async function mergeTacticCards(incoming, { now = Date.now(), maxAgeMs = tacticMaxAgeMs() } = {}) {
  return transaction(async (tx) => {
    await advisoryLock(tx, 'safespace:tactic-cards');
    const existing = await storedTacticCards((sql) => tx.query(sql));
    const byId = new Map();
    const candidates = liveTacticCards(
      [...(Array.isArray(incoming) ? incoming : []), ...existing],
      now,
      maxAgeMs,
    );
    for (const card of candidates) {
      if (typeof card?.id === 'string' && !byId.has(card.id)) byId.set(card.id, card);
    }
    const cards = [...byId.values()]
      .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))
      .slice(0, MAX_TACTIC_CARDS);

    await tx.query('delete from safespace.tactic_cards');
    for (const card of cards) {
      await tx.query(
        'insert into safespace.tactic_cards (id, card, fetched_at) values ($1, $2, $3)',
        [card.id, JSON.stringify(card), card.fetchedAt],
      );
    }
    return cards;
  }, 'mergeTacticCards');
}
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `node --test server/*.test.mjs`
Expected: PASS. Every test file runs on in-memory PGlite. The count changes from 162 by: +15 new tests (`db` and `rows`), −2 deleted `store` tests, and −7 `store.redis` tests (no longer present).

If a test fails, compare the failing assertion with the old code path in `git show HEAD:server/store.js`; the contract is the old behaviour.

- [ ] **Step 5: Run the build and typecheck**

Run: `npm run build && npm run typecheck`
Expected: both succeed. The frontend is untouched.

- [ ] **Step 6: Commit**

```bash
git add -A server/store.js server/store.test.mjs server/routes.test.mjs server/intel.test.mjs server/store.redis.test.mjs server/data.seed.json
git commit -m "feat(store): move every store function onto Postgres transactions" -m "Same exports and return shapes; each write now locks only what it reads. The Redis and file backends, their fake-Redis tests and the JSON seed are gone; the demo family is a migration." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Race tests on real Postgres, and CI

**Files:**
- Create: `server/store.concurrency.test.mjs`, `scripts/test-pg.mjs`
- Modify: `package.json` (add a `test:pg` script), `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `store.js` exports (Task 3); `setupTestDb`, `resetDb` and `teardownTestDb` from `testdb.mjs` (Task 1)

- [ ] **Step 1: Write the race tests `server/store.concurrency.test.mjs`**

```js
// Run with: npm run test:pg   (CI runs these on every push)
//
// Races that only a real Postgres server can run. PGlite has a single connection, so its
// transactions queue and never overlap. Without TEST_DATABASE_URL these report as
// skipped rather than passing.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { computeResult } from './xp.js';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

const skip = process.env.TEST_DATABASE_URL
  ? false
  : 'needs a real Postgres: run `npm run test:pg`';
process.env.IDENTITY_LOOKUP_SECRET = 'concurrency-test-identity-lookup-secret-32chars';

await setupTestDb();
after(teardownTestDb);
const store = await import('./store.js');
const { query } = await import('./db.js');

const race = (count, fn) => Promise.allSettled(Array.from({ length: count }, (_, i) => fn(i)));
const fulfilled = (results) => results.filter((result) => result.status === 'fulfilled');
const rejected = (results) => results.filter((result) => result.status === 'rejected');

test('20 concurrent outcomes for one user lose no XP', { skip }, async () => {
  await resetDb();
  const before = await store.getUser('you');
  const results = await race(20, () => store.applyOutcome({ userId: 'you', outcome: 'hung_up' }));
  assert.equal(fulfilled(results).length, 20);

  // The same 20 outcomes applied one at a time, with the store's level-up rule.
  const expected = { xp: before.xp, xpMax: before.xpMax, level: before.level };
  for (let i = 0; i < 20; i += 1) {
    expected.xp += computeResult('hung_up').xp;
    while (expected.xp >= expected.xpMax) {
      expected.xp -= expected.xpMax;
      expected.level += 1;
      expected.xpMax = Math.round(expected.xpMax * 1.2);
    }
  }
  const after = await store.getUser('you');
  assert.deepEqual(
    { xp: after.xp, xpMax: after.xpMax, level: after.level, timesSafe: after.timesSafe },
    { ...expected, timesSafe: before.timesSafe + 20 },
  );
  assert.equal((await store.listPendingResults('you')).length, 20);
});

test('concurrent drill starts inside the cooldown: exactly one wins', { skip }, async () => {
  await resetDb();
  const results = await race(10, () =>
    store.createDrillAttempt({ userId: 'you', channel: 'call', cooldownMs: 60_000 }));
  assert.equal(fulfilled(results).length, 1);
  assert.ok(rejected(results).every((result) => result.reason instanceof store.DrillAttemptConflict));
  const { rows } = await query('select count(*) as n from safespace.drill_attempts');
  assert.equal(Number(rows[0].n), 1);
});

test('concurrent OTP sends to one number never exceed the cap', { skip }, async () => {
  await resetDb();
  const results = await race(12, () =>
    store.reservePhoneVerificationSend({ phone: '+6591234567', cooldownMs: 0, maxSends: 3 }));
  assert.equal(fulfilled(results).length, 3);
  assert.ok(rejected(results).every((result) => result.reason?.code === 'VERIFICATION_RATE_LIMITED'));
});

test('one webhook delivered many times at once is scored exactly once', { skip }, async () => {
  await resetDb();
  await store.createDrillAttempt({ userId: 'you', channel: 'call', providerId: 'call_race', status: 'sent' });
  const before = await store.getUser('you');
  const results = await race(10, () =>
    store.completeDrillAttempt({ providerId: 'call_race', outcome: 'hung_up' }));
  const statuses = fulfilled(results).map((result) => result.value.status);
  assert.equal(statuses.length, 10);
  assert.equal(statuses.filter((status) => status === 'completed').length, 1);
  assert.equal(statuses.filter((status) => status === 'duplicate').length, 9);
  assert.equal((await store.getUser('you')).timesSafe, before.timesSafe + 1);
  assert.equal((await store.listPendingResults('you')).length, 1);
});

test('simultaneous OTP checks for one new number create one account', { skip }, async () => {
  await resetDb();
  const results = await race(10, () =>
    store.registerVerifiedUser({ phone: '+6590000099', name: 'Racer' }));
  assert.equal(fulfilled(results).length, 10);
  assert.equal(new Set(fulfilled(results).map((result) => result.value.id)).size, 1);
  const { rows } = await query('select count(*) as n from safespace.users where phone = $1', ['+6590000099']);
  assert.equal(Number(rows[0].n), 1);
});

test('a double-clicked practice result is scored once', { skip }, async () => {
  await resetDb();
  const before = await store.getUser('you');
  const results = await race(10, () => store.applyPracticeOutcomeOnce({
    userId: 'you', clientAttemptId: 'practice_race', outcome: 'hung_up',
  }));
  const statuses = fulfilled(results).map((result) => result.value.status);
  assert.equal(statuses.filter((status) => status === 'completed').length, 1);
  assert.equal(statuses.filter((status) => status === 'duplicate').length, 9);
  assert.equal((await store.getUser('you')).timesSafe, before.timesSafe + 1);
});
```

- [ ] **Step 2: Run it without Postgres; expect six visible skips**

Run: `node --test server/store.concurrency.test.mjs`
Expected: `skipped 6`, `fail 0`.

- [ ] **Step 3: Write `scripts/test-pg.mjs`**

```js
// npm run test:pg — the whole backend suite against a real Postgres 17 in Docker,
// including the race tests PGlite cannot run. CI does the same with a service container.
import { spawnSync } from 'node:child_process';

const name = `safespace-test-pg-${process.pid}`;
const port = process.env.TEST_PG_PORT || '55433';
const password = 'safespace-test';
const docker = (args, options = {}) => spawnSync('docker', args, { stdio: 'ignore', ...options });

const started = docker([
  'run', '-d', '--rm', '--name', name,
  '-e', `POSTGRES_PASSWORD=${password}`,
  '-p', `127.0.0.1:${port}:5432`,
  'postgres:17-alpine',
], { stdio: ['ignore', 'ignore', 'inherit'] });
if (started.status !== 0) {
  console.error('Could not start Postgres in Docker. Is Docker running?');
  process.exit(1);
}

let status = 1;
try {
  // -h 127.0.0.1 waits for the real server; the init-time server listens on a socket only.
  let ready = false;
  for (let i = 0; i < 60 && !ready; i += 1) {
    ready = docker(['exec', name, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1']).status === 0;
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Postgres did not become ready in 30 seconds');
  const env = {
    ...process.env,
    TEST_DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/postgres`,
  };
  status = spawnSync(process.execPath, ['--test', 'server/*.test.mjs'], { stdio: 'inherit', env }).status ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  docker(['rm', '-f', name]);
}
process.exit(status);
```

In `package.json` `scripts`, add after `"db:migrate"`:

```json
    "test:pg": "node scripts/test-pg.mjs",
```

- [ ] **Step 4: Run the whole suite on real Postgres**

Run: `node scripts/test-pg.mjs`
Expected: PASS, with `skipped 0`. All 6 race tests run.

- [ ] **Step 5: Run it in CI**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_PASSWORD: safespace-test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres -h 127.0.0.1"
          --health-interval 2s
          --health-timeout 5s
          --health-retries 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - name: Tests on PGlite
        run: npm test
      - name: Tests on Postgres 17, including the race tests
        run: npm test
        env:
          TEST_DATABASE_URL: postgres://postgres:safespace-test@localhost:5432/postgres
      - run: npm run build
```

- [ ] **Step 6: Commit**

```bash
git add server/store.concurrency.test.mjs scripts/test-pg.mjs package.json .github/workflows/ci.yml
git commit -m "test(db): race tests on real Postgres, locally and in CI" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Keep-alive route, region and cron

**Files:**
- Modify: `server/index.js` (store import list; a route after `/api/health`), `vercel.json`, `server/routes.test.mjs`

**Interfaces:**
- Consumes: `pingDb()` from `store.js` (Task 3)

- [ ] **Step 1: Write the failing route test**

Append to `server/routes.test.mjs`:

```js
test('the database keep-alive answers without a session', async () => {
  const response = await fetch(`${base}/api/health/db`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test server/routes.test.mjs`
Expected: FAIL. The new test gets a status other than 200, because no such route exists.

- [ ] **Step 3: Add the route**

In `server/index.js`, add `pingDb,` to the alphabetical `import { … } from './store.js'` list (between `peekPendingResult,` and `publicUser,`). After the `api.get('/api/health', …)` handler, add:

```js
// Called daily by a Vercel cron (vercel.json): a free-tier Supabase project pauses after
// a week without activity. It reveals nothing beyond reachability, so it needs no session.
api.get('/api/health/db', async (_req, res) => {
  try {
    await pingDb();
    return res.json({ ok: true });
  } catch (error) {
    return fail(res, 503, 'database unreachable', error);
  }
});
```

- [ ] **Step 4: Pin the region and add the cron**

In `vercel.json`, add after `"outputDirectory": "dist",`:

```json
  "regions": ["sin1"],
```

and replace the `crons` array with:

```json
  "crons": [
    { "path": "/api/intel/refresh", "schedule": "0 19 * * *" },
    { "path": "/api/health/db", "schedule": "0 3 * * *" }
  ],
```

- [ ] **Step 5: Run the suite to verify it passes**

Run: `node --test server/*.test.mjs && node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`
Expected: PASS, and the JSON parses.

- [ ] **Step 6: Commit**

```bash
git add server/index.js server/routes.test.mjs vercel.json
git commit -m "feat(ops): database keep-alive cron and Singapore function region" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Configuration and deployment docs

**Files:**
- Modify: `.env.example`, `README.md`, `server/README.md`, `DEPLOY.md`, `deploy/safespace.service`, `FIGMA_TO_REACT.md`

- [ ] **Step 1: `.env.example`**

Replace the `# ── Storage backend …` section (the header, its comments, `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`, and the `SAFESPACE_DATA_FILE` comment and line) with:

```ini
# ── Database ─────────────────────────────────────────────────────────────
# Blank = PGlite, an in-process Postgres stored in server/.pglite/. Local development
# only: with VERCEL or NODE_ENV=production set, the server refuses to start without this.
# On Vercel use Supabase's transaction-pooler URI (port 6543) from the project's Connect
# panel. Change the schema only through supabase/migrations/ + `npx supabase db push`.
DATABASE_URL=

# Supabase's CA certificate (PEM), from Database settings → SSL configuration. Required
# in production: the connection is verified against it. Newlines may be written as \n.
DATABASE_CA_CERT=

# Optional PGlite directory for local development. Default server/.pglite.
PGLITE_DIR=

# Tests only: an admin Postgres URL. Each test file creates and drops its own database
# there. `npm run test:pg` sets this for you using Docker.
TEST_DATABASE_URL=

# ── Supabase API (scam-bulletin scripts in server/scam-intelligence/) ────
# Used by the manual bulletin scripts, not by the server.
SUPABASE_URL=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
```

- [ ] **Step 2: `README.md`**

- Replace the configuration row `| Persistent serverless storage | \`UPSTASH_REDIS_REST_URL\`, \`UPSTASH_REDIS_REST_TOKEN\` |` with `| Database | \`DATABASE_URL\` (Supabase in production), plus \`DATABASE_CA_CERT\` in production |`.
- In Quick start, after the `npm test` line, add `npm run test:pg           # same suite on real Postgres (needs Docker)`.
- Replace the operational-limits bullet that starts `- The file store is safe for one Node process` with:

```markdown
- Data lives in Postgres: Supabase in production. Without `DATABASE_URL`, the server
  uses PGlite in `server/.pglite/`, for local development only.
```

- [ ] **Step 3: `server/README.md`**

- Replace the paragraph under `## Tests` with:

```markdown
`npm test` uses Node's built-in `node:test` runner. Provider calls are mocked, and each
test file gets its own in-memory PGlite database, so no account, network or install is
needed. `npm run test:pg` runs the same suite against Postgres 17 in Docker, including
the race tests PGlite cannot run; CI runs both.
```

- In the tests table, replace the `store.test.mjs` row's description with `PII projection, sessions, attempts, exactly-once completion and pending ACK`, and replace the `store.redis.test.mjs` row with these three rows:

```markdown
| `store.concurrency.test.mjs` | Races on real Postgres: lost updates, cooldowns, OTP caps, duplicate webhooks, duplicate registration |
| `db.test.mjs` | Schema placement and row-level security, migrations, database selection, retries, error redaction |
| `rows.test.mjs` | Row ↔ object mapping that keeps the API's JSON unchanged |
```

- Replace the first paragraph under `## Persistence` with:

```markdown
Data lives in Postgres, in the `safespace` schema: Supabase in production, PGlite
(`server/.pglite/`) locally. Each write is one transaction that locks only the rows it
reads, so different users never wait for each other. Schema changes are SQL files in
`supabase/migrations/`, applied with `npx supabase db push` on Supabase and
automatically on PGlite.
```

- [ ] **Step 4: `DEPLOY.md`**

- In the top table, change the three Storage cells to `PGlite on your disk, or a Supabase dev project`, `Supabase Postgres` and `Supabase Postgres`, and rename the third row's link text and anchor to `[**Vercel + Supabase**](#deploying-to-vercel--supabase)`.
- Replace the **Pick storage before you pick a host** paragraph with:

```markdown
**Every hosted deploy uses Postgres on Supabase.** See [Database](#database). The
server refuses to start in production without `DATABASE_URL`.
```

- In the tunnel section, replace the final paragraph (about `npm test` and `server/data.json`) with `` `npm test` uses in-memory databases and never touches `server/.pglite/`, so it is safe to run before or after registering the demo phone.``
- Replace the ECS **Why ECS suits this app** paragraph with `**Why ECS:** a normal long-running VM in Huawei Cloud. Data lives in Supabase Postgres, so the VM holds no state and can be rebuilt freely.`
- In the ECS `ini` block under **Production values**, add after `NODE_ENV=production`:

```ini
DATABASE_URL=postgres://...          # Supabase session pooler URI, port 5432
DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
```

- Replace ``The `server/data.json` is untouched by this — users, XP and consent records persist.`` with `Data lives in Supabase, so redeploys never touch it. Apply new migrations first with \`npx supabase db push\`.`
- In **Known limits**, replace the `Single instance only, on the file backend.` bullet with `- Run as many instances as you like: every write is a Postgres transaction.`, and replace the last bullet (backing up `server/data.json`) with `- Supabase takes daily backups on paid plans. On the free plan, export with \`npx supabase db dump --data-only\` before risky changes.`
- Replace the whole `# Deploying to Vercel + Upstash` section, through the end of its `## Notes` list, with:

````markdown
# Deploying to Vercel + Supabase

A permanent URL with no server to keep alive.

## 1. Create the database

In the team's Supabase organisation create a project in **Singapore** (Vercel functions
are pinned to `sin1` in `vercel.json`). Then, from the repo root:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push          # creates the safespace schema and the demo family
```

From **Connect** copy the **transaction pooler** URI (port 6543) as `DATABASE_URL`. From
**Database settings → SSL configuration** download the CA certificate for
`DATABASE_CA_CERT`.

## 2. Import the repo

[vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo.
`vercel.json` already sets the build command, output directory, region and API routing,
so leave the framework settings alone.

## 3. Set environment variables

In **Settings → Environment Variables**, add the same values as `.env`. Use a separate
dev project's values for the **Preview** environment and the prod project's for
**Production**. Two must be left **empty**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the transaction pooler URI from step 1 |
| `DATABASE_CA_CERT` | the CA certificate PEM from step 1 |
| `PUBLIC_URL` | `https://your-project.vercel.app` — no trailing slash |
| `VAPI_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `DRILL_LINK_SECRET` | a different `openssl rand -hex 32` |
| `IDENTITY_LOOKUP_SECRET` | another stable, random 32+ character secret |
| `TRUST_PROXY_HOPS` | exact trusted proxy hop count; `0` when directly exposed |
| `PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR` | optional; defaults to `20` |
| `SESSION_TTL_MS` | optional; defaults to 30 days |
| `REAL_DRILL_COOLDOWN_MS` | optional; defaults to 5 minutes |
| `ALLOW_DEV_VERIFY` | **empty** — it enables a fixed bypass code |
| `ENABLE_DEMO_ROUTES` | **empty** — it exposes an unauthenticated write route |

Then **Deploy**, and run the [post-deploy checklist](#post-deploy-checklist) against the
Vercel URL, adding `curl https://YOUR_DOMAIN/api/health/db` (expect `{"ok":true}`).

## Notes

- Signed messaging links are top-level paths (`/drill-reveal`, `/drill-report` and
  `/email-verify`) and must route to the Express function, not the SPA fallback. The
  post-deploy checklist above catches an incorrect rewrite immediately.
- A daily cron calls `/api/health/db` because a free-tier Supabase project pauses after
  a week without activity. For anything important, such as the final, use a paid plan.
- Vercel protects preview deployments with a login, so Vapi's end-of-call webhook
  cannot reach one. Test the full call loop locally through a tunnel instead, with
  `DATABASE_URL` pointed at the dev project.
````

- Replace the whole `# Storage backends` section with:

````markdown
# Database

| `DATABASE_URL` | Database | Used by |
|---|---|---|
| unset | PGlite in `server/.pglite/` | `npm start` and the tunnel demo on a laptop |
| set | Postgres (Supabase) | Vercel, ECS, and anyone testing against the dev project |

Schema changes are SQL files in `supabase/migrations/`. Apply them to Supabase with
`npx supabase db push`. PGlite applies them on startup, and `npm run db:migrate`
applies them to any other Postgres, such as a future Huawei Cloud database. It refuses
Supabase hosts, which the CLI manages.

Every write is a transaction that locks only what it reads, so any number of server
instances can run at once. `server/store.concurrency.test.mjs` proves that against a
real Postgres (`npm run test:pg`, and CI).
````

- [ ] **Step 5: `deploy/safespace.service` and `FIGMA_TO_REACT.md`**

In `deploy/safespace.service`, replace `# Hardening. The app only ever writes server/data.json.` with `# Hardening. With DATABASE_URL set the app writes nothing to disk; the write path below`, followed on the next line by `# only matters for a PGlite fallback, which production refuses.`.

In `FIGMA_TO_REACT.md`, replace `` `server/data.json` is runtime state, also ignored.`` with `` `server/.pglite/` is local database state, also ignored.``

- [ ] **Step 6: Check nothing still points at the removed backends**

Run: `grep -rn -E 'UPSTASH|SAFESPACE_DATA_FILE|data\.seed\.json|server/data\.json' --include='*.md' --include='*.js' --include='*.mjs' --include='*.json' --include='*.yml' --include='*.service' . | grep -v -E 'node_modules|package-lock|^\./dist|^\./docs/superpowers'`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add .env.example README.md server/README.md DEPLOY.md deploy/safespace.service FIGMA_TO_REACT.md
git commit -m "docs: configure and deploy on Supabase Postgres" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Verify and hand over the rollout

**Files:** none changed; this is verification and a handover.

- [ ] **Step 1: Final full verification**

Run: `node --test server/*.test.mjs && node scripts/test-pg.mjs && npm run typecheck && npm run build`
Expected: all pass. PGlite reports 6 skipped race tests; the Postgres run reports 0 skipped.

- [ ] **Step 2: Local smoke test on PGlite**

Start the server with `npm run server` using an empty `PGLITE_DIR` in the scratchpad. Then check that:
- `/api/health/db` returns `{"ok":true}`
- `/api/family` returns the four demo users with no `phone` or `email` keys
- `/api/leaderboard` ranks Grandma first

- [ ] **Step 3: Push the branch**

```bash
git push origin feat/postgres
```

- [ ] **Step 4: Hand the rollout to the user.** These need the user's Supabase and Vercel accounts, from spec §Rollout steps 1, 3, 4 and 5:
  1. **Projects:** two Supabase projects in the team organisation, in Singapore: dev and prod. Agree with Shannon which existing project, if any, becomes which.
  2. **Migrate:** `npx supabase link` and `npx supabase db push` for each project.
  3. **Env vars:** put `DATABASE_URL` and `DATABASE_CA_CERT` in Vercel, dev for Preview and prod for Production.
  4. **Check dev:** work through `TESTPLAN.md` on the `feat/postgres` preview deployment, then run the full call loop locally through a tunnel against dev.
  5. **Go live:** merge to `main`. Keep the Upstash variables in Vercel until after the final, for rollback.
