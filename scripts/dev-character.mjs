import { spawn } from 'node:child_process';
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
      if (code !== 0) console.error(`[character-dev] process stopped (${signal ?? code})`);
      stop(code || 0);
    }
  });
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 100).unref();
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));

const backendEnv = {
  ...process.env,
  HOST: '127.0.0.1',
  PORT: '3000',
  PGLITE_DIR: 'server/.pglite-character',
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
      const response = await fetch('http://127.0.0.1:3000/api/health');
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
  start(
    process.execPath,
    [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--open', '/?character-dev=1'],
    process.env,
  );
} catch (error) {
  console.error(`[character-dev] ${error.message}`);
  stop(1);
}
