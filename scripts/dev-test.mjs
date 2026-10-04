import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = new Set();
let stopping = false;

function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
  children.add(child);
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
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

const backendEnv = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: String(apiPort),
  PGLITE_DIR: 'server/.pglite-dev-mode',
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

const backend = start(
  process.execPath,
  ['--env-file-if-exists=.env', 'server/index.js'],
  backendEnv,
);

async function waitForBackend() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && backend.exitCode == null) {
    try {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/health`);
      if (response.ok) return;
    } catch {
      // The PGlite-backed server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('local backend did not become ready');
}

try {
  await waitForBackend();
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
