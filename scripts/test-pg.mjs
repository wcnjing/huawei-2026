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
