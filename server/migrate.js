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
