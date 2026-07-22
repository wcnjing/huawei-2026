// Run with: node --test
//
// HTTP-level tests for the drill API. These are the regression net for the security
// review findings — each one re-runs an exploit that used to work.
//
// NOTE: index.js reads some env at import time (demo-route registration), so this file
// deliberately imports it with a *production-shaped* environment: no demo routes, no
// dev-verify bypass. That is the configuration whose guarantees actually matter.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

// Production-shaped env, set BEFORE importing the app.
delete process.env.ENABLE_DEMO_ROUTES;
delete process.env.ALLOW_DEV_VERIFY;
delete process.env.VAPI_WEBHOOK_SECRET;
fs.rmSync(DATA_FILE, { force: true }); // start from the seed

const { app } = await import('./index.js');

let server;
let base;

before(async () => {
  server = app.listen(0); // ephemeral port
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  fs.rmSync(DATA_FILE, { force: true });
});

const post = (p, body, headers = {}) =>
  fetch(base + p, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });

// systemd restarts the service when this stops answering, so it must respond even when
// every provider is unconfigured — and must not describe the deployment to the internet.
test('GET /api/health is public, cheap, and leaks no configuration', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(typeof body.uptime, 'number');
  const asText = JSON.stringify(body).toLowerCase();
  for (const leak of ['twilio', 'vapi', 'openai', 'key', 'secret', 'token', 'mode']) {
    assert.ok(!asText.includes(leak), `health must not mention "${leak}"`);
  }
});

// ─── PII (review finding 1) ───────────────────────────────────────────────
test('GET /api/family never exposes phone or email', async () => {
  const res = await fetch(base + '/api/family');
  assert.equal(res.status, 200);
  const body = JSON.stringify(await res.json());
  assert.ok(!body.includes('"phone"'), 'phone must not be serialised');
  assert.ok(!body.includes('"email"'), 'email must not be serialised');
});

test('GET /api/me ignores a client-supplied ?user= (no reading other accounts)', async () => {
  const res = await fetch(base + '/api/me?user=usr_someone_else');
  assert.equal(res.status, 200);
  const me = await res.json();
  // Falls back to the demo account rather than honouring the param.
  assert.equal(me.id, 'you');
  assert.equal(me.phone, undefined);
});

// ─── Real calls require a session (review finding 2) ──────────────────────
test('POST /api/drills/fire is refused without a session token', async () => {
  assert.equal((await post('/api/drills/fire')).status, 401);
});

test('POST /api/drills/fire cannot be aimed at another user via the body', async () => {
  const res = await post('/api/drills/fire', { user: 'you' });
  assert.equal(res.status, 401, 'a body-supplied user must not authorise anything');
});

test('POST /api/drills/email is refused without a session token', async () => {
  assert.equal((await post('/api/drills/email')).status, 401);
});

test('POST /api/drills/email cannot be aimed at an arbitrary address', async () => {
  const res = await post('/api/drills/email', { email: 'victim@example.com' });
  assert.equal(res.status, 401, 'no session -> refused before any address is considered');
});

test('POST /api/drills/sms is refused without a session token', async () => {
  assert.equal((await post('/api/drills/sms')).status, 401);
});

test('POST /api/drills/sms cannot be aimed at another number via the body', async () => {
  const res = await post('/api/drills/sms', { phone: '+6590000000', user: 'you' });
  assert.equal(res.status, 401, 'no session -> refused before any number is considered');
});

// ─── Webhook authenticity (review finding 3) ──────────────────────────────
test('POST /api/webhooks/vapi fails closed when no secret is configured', async () => {
  const res = await post('/api/webhooks/vapi', {
    message: { type: 'end-of-call-report', transcript: 'User: the otp is 1234' },
  });
  assert.equal(res.status, 503, 'unconfigured webhook must not mutate state');
});

// ─── Demo backdoor (review finding 4) ─────────────────────────────────────
test('POST /api/drills/simulate does not exist without ENABLE_DEMO_ROUTES', async () => {
  const res = await post('/api/drills/simulate', { outcome: 'complied' });
  assert.notEqual(res.status, 200, 'demo route must not be registered by default');
});

// ─── Verification fails closed (earlier fix) ──────────────────────────────
test('POST /api/verify/check refuses the bypass code when verification is disabled', async () => {
  const res = await post('/api/verify/check', { phone: '+6591234567', code: '000000' });
  assert.equal(res.status, 503);
});

test('POST /api/verify/start rejects a non-E.164 phone', async () => {
  assert.equal((await post('/api/verify/start', { phone: 'not-a-number' })).status, 400);
});

// The email supplied at registration becomes a real send target, so it is validated
// before the OTP is even checked — junk must never reach the store.
test('POST /api/verify/check rejects a malformed email before anything else', async () => {
  for (const bad of ['not-an-email', 'missing@tld', 'two@@at.com', 'has space@x.com']) {
    const res = await post('/api/verify/check', { phone: '+6591234567', code: '000000', email: bad });
    assert.equal(res.status, 400, `"${bad}" should be rejected as malformed`);
  }
  // An omitted email is fine — it is optional. This one gets past validation and is
  // refused later for a different reason (verification disabled), never 400.
  const ok = await post('/api/verify/check', { phone: '+6591234567', code: '000000' });
  assert.notEqual(ok.status, 400, 'omitting email must not be a validation error');
});

// ─── Anonymous practice still works (no regression for the demo) ──────────
test('anonymous practice drills still score against the demo account', async () => {
  const res = await post('/api/drills/practice-result', { outcome: 'reported' });
  assert.equal(res.status, 200);
  const { record, user } = await res.json();
  assert.equal(record.userId, 'you');
  assert.equal(record.result, 'WON');
  assert.equal(record.practice, true);
  assert.equal(user.phone, undefined, 'even this response must not carry PII');
});
