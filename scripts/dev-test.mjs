import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = new Set();
let stopping = false;

// The dev database lives in the user's local cache folder, not in the repo. Cloud-synced
// folders (OneDrive, iCloud Drive, Dropbox) turn its files into placeholders and mark its
// folders read-only, and PGlite then aborts on start ("PGlite failed to initialize
// properly"), so every sign-in fails. The hash keeps two clones on one machine apart.
// DEV_PGLITE_DIR overrides the location.
function devDatabaseDir() {
  if (process.env.DEV_PGLITE_DIR) return path.resolve(process.env.DEV_PGLITE_DIR);
  const cache = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || os.tmpdir()
    : process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Caches')
      : process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  const clone = createHash('sha256').update(root).digest('hex').slice(0, 8);
  return path.join(cache, 'safespace-drill-mode', `dev-mode-${clone}`);
}

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
  children.add(child);
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping && !child.restarting) {
      if (code !== 0) console.error(`[dev-mode] process stopped (${signal ?? code})`);
      stop(code || 0);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 100);
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

const apiPort = await freePort();
let uiPort = await freePort();
while (uiPort === apiPort) uiPort = await freePort();

const databaseDir = devDatabaseDir();
console.log(`[dev-mode] local database: ${databaseDir}`);

const backendEnv = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(apiPort),
  PGLITE_DIR: databaseDir,
  DATABASE_URL: '',
  SUPABASE_URL: '',
  VAPI_API_KEY: '',
  VAPI_PHONE_NUMBER_ID: '',
  TWILIO_ACCOUNT_SID: '',
  TWILIO_AUTH_TOKEN: '',
  TWILIO_MESSAGING_SERVICE_SID: '',
  GOOGLE_SCRIPT_URL: '',
  GOOGLE_SCRIPT_SECRET: '',
  INTEL_ENABLED: 'false',
  NODE_ENV: 'development',
  UNSAFE_FORCE_DEV_VERIFY: 'true',
};

const startBackend = () => start(
  process.execPath,
  ['--env-file-if-exists=.env', 'server/index.js'],
  backendEnv,
);
let backend = startBackend();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBackend() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && backend.exitCode == null) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`);
      if (response.ok) return;
    } catch {
      // The PGlite-backed server is still starting.
    }
    await sleep(250);
  }
  throw new Error('local backend did not become ready');
}

// /api/health answers before the database is opened, so ask the database separately.
// Sign-up and DEV: SKIP TO APP both need it.
async function databaseOpens() {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/health/db`, { signal: AbortSignal.timeout(60_000) });
    return response.ok;
  } catch {
    return false;
  }
}

// A database that will not open (a half-written one, or one a sync client has touched) is
// moved aside, not deleted, and dev mode starts with a fresh one. If it cannot even be
// moved, this run uses a fresh folder next to it.
async function replaceBrokenDatabase() {
  if (!fs.existsSync(databaseDir)) throw new Error('the local database would not open. See the backend log above.');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const aside = `${databaseDir}-broken-${stamp}`;
  console.warn(`[dev-mode] the local database would not open. Moving it to ${aside} and starting a fresh one.`);
  backend.restarting = true;
  const exited = new Promise((resolve) => backend.once('exit', resolve));
  backend.kill('SIGTERM');
  await exited;
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(databaseDir, aside);
      break;
    } catch (error) {
      // Windows can hold the files for a moment after the process exits.
      if (attempt < 12) {
        await sleep(250);
        continue;
      }
      backendEnv.PGLITE_DIR = `${databaseDir}-fresh-${stamp}`;
      console.warn(`[dev-mode] could not move it (${error.code}). Using ${backendEnv.PGLITE_DIR} for this run. Delete ${databaseDir} so the next run can use that name again.`);
      break;
    }
  }
  backend = startBackend();
  await waitForBackend();
  if (!(await databaseOpens())) throw new Error('a fresh local database would not open either. See the backend log above.');
}

try {
  await waitForBackend();
  if (!(await databaseOpens())) await replaceBrokenDatabase();
  console.log(`[dev-mode] opening http://127.0.0.1:${uiPort}/?dev-mode=1`);
  start(
    process.execPath,
    [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort', '--open', '/?dev-mode=1&reset=1'],
    { ...process.env, DEV_API_TARGET: `http://127.0.0.1:${apiPort}` },
  );
} catch (error) {
  console.error(`[dev-mode] ${error.message}`);
  stop(1);
}
