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

test('houses migration: tables exist with row-level security', async () => {
  const { rows } = await query(
    `select c.relname, c.relrowsecurity from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'safespace' and c.relname in ('houses', 'drill_runs')
      order by c.relname`,
  );
  assert.deepEqual(rows.map((r) => [r.relname, r.relrowsecurity]), [
    ['drill_runs', true], ['houses', true],
  ]);
  const cols = await query(
    `select column_name from information_schema.columns
      where table_schema = 'safespace' and table_name = 'users'
        and column_name in ('house_id', 'joined_house_at', 'avatar') order by column_name`,
  );
  assert.deepEqual(cols.rows.map((r) => r.column_name), ['avatar', 'house_id', 'joined_house_at']);
});
