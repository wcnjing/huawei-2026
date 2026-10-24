// One command for a public, HTTPS copy of the app on this laptop:
//
//   npm run tunnel              build the frontend, then serve it + the API through a
//                               fresh Cloudflare quick tunnel
//   npm run tunnel -- --no-build   skip the frontend build (reuse the last one in dist/)
//
// It builds the frontend (the backend serves dist/, so one URL covers both), starts
// `cloudflared tunnel --url http://localhost:PORT`, reads the new trycloudflare.com URL,
// starts the backend with PUBLIC_URL set to it (your .env is not edited), waits until the
// link really answers, then prints it and copies it to the clipboard. Ctrl+C stops both.
//
// Quick-tunnel URLs change every run. Email drill links are pinned to PUBLIC_URL, so
// Apps Script's SAFESPACE_LINK_ORIGIN must be set to the printed URL each time (the
// script can't do that for you: it needs your Google login).
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || 3000;
const skipBuild = process.argv.includes('--no-build');
const children = new Set();
let stopping = false;

const log = (msg) => console.log(`\x1b[36m[tunnel]\x1b[0m ${msg}`);

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 300);
}
process.once('SIGINT', () => { log('stopping…'); stop(0); });
process.once('SIGTERM', () => stop(0));

function start(name, command, args, env = process.env) {
  const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  const prefix = name === 'server' ? '\x1b[32m[server]\x1b[0m ' : '\x1b[90m[cloudflared]\x1b[0m ';
  const forward = (stream, out) => stream.on('data', (chunk) => {
    for (const line of String(chunk).split('\n')) if (line.trim()) out.write(prefix + line + '\n');
  });
  // cloudflared is chatty; only its errors are worth showing once the URL is known.
  if (name === 'server') { forward(child.stdout, process.stdout); forward(child.stderr, process.stderr); }
  child.once('exit', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`\x1b[31m[tunnel]\x1b[0m ${name} stopped (${signal ?? code}); shutting down`);
      stop(code || 1);
    }
  });
  return child;
}

function portFree(p) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(p, () => server.close(() => resolve(true)));
  });
}

// ── 0. Preconditions ─────────────────────────────────────────────────────
if (spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).status !== 0) {
  console.error('cloudflared is not installed. Install it with: brew install cloudflared');
  process.exit(1);
}
if (!(await portFree(port))) {
  console.error(`Port ${port} is already in use. Stop the other server (or run with PORT=3001 npm run tunnel).`);
  process.exit(1);
}

// ── 1. Frontend build ────────────────────────────────────────────────────
if (!skipBuild) {
  log('building the frontend…');
  const build = spawnSync('npm', ['run', 'build', '--silent'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) { console.error('frontend build failed'); process.exit(1); }
}

// ── 2. Tunnel, and its new URL ───────────────────────────────────────────
log(`starting a Cloudflare tunnel to http://localhost:${port}…`);
const tunnel = start('cloudflared', 'cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`]);
const publicUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('cloudflared did not print a URL within 45s')), 45_000);
  let found = false;
  const scan = (chunk) => {
    const text = String(chunk);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !found) { found = true; clearTimeout(timer); resolve(match[0]); }
    // Errors while connecting are worth seeing; its shutdown chatter on Ctrl+C is not.
    if (!found && !stopping && /\bERR\b|error/i.test(text)) process.stderr.write(`\x1b[90m[cloudflared]\x1b[0m ${text}`);
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan);
}).catch((error) => { console.error(error.message); stop(1); });
if (!publicUrl) await new Promise(() => {});
log(`tunnel URL: ${publicUrl}`);

// ── 3. Backend with PUBLIC_URL = the tunnel ──────────────────────────────
// Variables set here win over .env (node --env-file never overrides existing ones).
start('server', process.execPath, ['--env-file-if-exists=.env', 'server/index.js'], {
  ...process.env,
  PORT: String(port),
  PUBLIC_URL: publicUrl,
});

// ── 4. Wait until the public link answers (DNS for a new tunnel takes a few seconds) ──
const deadline = Date.now() + 90_000;
let ready = false;
while (!ready && Date.now() < deadline && !stopping) {
  try {
    const response = await fetch(`${publicUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    ready = response.ok;
  } catch { /* not resolvable yet */ }
  if (!ready) await new Promise((resolve) => setTimeout(resolve, 2000));
}

const copied = spawnSync('pbcopy', { input: publicUrl }).status === 0;
const line = '─'.repeat(Math.max(60, publicUrl.length + 22));
console.log(`\n\x1b[1m${line}`);
console.log(`  SafeSpace is live at:  ${publicUrl}${copied ? '   (copied)' : ''}`);
console.log(line + '\x1b[0m');
if (!ready) console.log('  (the link did not answer yet — give it a few more seconds, then refresh)');
console.log(`
  Email drills: in Apps Script → Project Settings → Script Properties, set
     SAFESPACE_LINK_ORIGIN = ${publicUrl}
  (the URL changes every run, so update it each time you restart this).

  Press Ctrl+C to stop the server and the tunnel.
`);
