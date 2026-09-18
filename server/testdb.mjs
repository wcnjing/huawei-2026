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
