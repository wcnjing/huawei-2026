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
import os from 'os';
import path from 'path';

const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'safespace-routes-'));
const DATA_FILE = path.join(TEST_DIR, 'data.json');
const WEBHOOK_SECRET = 'route-test-vapi-secret-is-at-least-32-characters';
const LINK_SECRET = 'route-test-drill-link-secret-is-at-least-32-characters';
const RELAY_URL = 'https://mail-relay.test/exec';
const VAPI_URL = 'https://api.vapi.ai/call';

// Production-shaped env, set BEFORE importing the app.
delete process.env.ENABLE_DEMO_ROUTES;
delete process.env.ALLOW_DEV_VERIFY;
process.env.SAFESPACE_DATA_FILE = DATA_FILE;
process.env.VAPI_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.DRILL_LINK_SECRET = LINK_SECRET;
process.env.IDENTITY_LOOKUP_SECRET = 'route-test-identity-lookup-secret-over-32-characters';
process.env.PUBLIC_URL = 'https://safespace.test';
process.env.GOOGLE_SCRIPT_URL = RELAY_URL;
process.env.GOOGLE_SCRIPT_SECRET = 'route-test-relay-secret';

const { app } = await import('./index.js');
const {
  createDrillAttempt,
  createSession,
  getDrillAttempt,
  getUser,
  listPendingResults,
  markDrillAttemptSent,
  registerVerifiedUser,
} = await import('./store.js');
const {
  createDrillActionToken,
} = await import('./drill-links.js');

let server;
let base;
const nativeFetch = globalThis.fetch;
const relayRequests = [];
let vapiMode = null;
let vapiRequestCount = 0;

// Keep provider I/O hermetic while preserving real HTTP requests to the local server.
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (url === RELAY_URL) {
    const payload = JSON.parse(String(init?.body || '{}'));
    relayRequests.push(payload);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (url === VAPI_URL) {
    vapiRequestCount += 1;
    if (vapiMode === 'network-error') {
      throw new TypeError('simulated connection reset after request delivery');
    }
    throw new Error('unexpected Vapi request in route test');
  }
  return nativeFetch(input, init);
};

const freshStore = () => fs.rmSync(DATA_FILE, { force: true });

before(async () => {
  // Register the callback as part of listen(). Attaching a one-shot `listening`
  // handler afterwards races with fast Node versions: the event can fire between
  // app.listen() returning and server.once() being registered, leaving the suite
  // waiting forever.
  server = await new Promise((resolve, reject) => {
    const listeningServer = app.listen(
      0,
      '127.0.0.1',
      () => resolve(listeningServer),
    );
    listeningServer.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
  globalThis.fetch = nativeFetch;
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
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

test('GET /api/shame is not exposed as a public failure ranking', async () => {
  const res = await fetch(base + '/api/shame');
  assert.equal(res.status, 404);
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

test('uncertain call delivery is kept active and cannot be immediately retried', async () => {
  freshStore();
  const user = await registerVerifiedUser({ phone: '+6592223333', name: 'Call Owner' });
  const token = await createSession(user.id);
  const headers = { authorization: `Bearer ${token}` };
  const previousApiKey = process.env.VAPI_API_KEY;
  const previousPhoneId = process.env.VAPI_PHONE_NUMBER_ID;
  process.env.VAPI_API_KEY = 'route-test-vapi-key';
  process.env.VAPI_PHONE_NUMBER_ID = 'route-test-phone-id';
  vapiMode = 'network-error';
  vapiRequestCount = 0;

  try {
    const response = await post('/api/drills/fire', {}, headers);
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.status, 'delivery-unconfirmed');
    assert.equal(body.deliveryConfirmed, false);
    assert.ok(body.drillId);

    const attempt = await getDrillAttempt(body.drillId);
    assert.equal(attempt.status, 'sent');
    assert.equal(attempt.providerId, null);

    const retry = await post('/api/drills/fire', {}, headers);
    assert.equal(retry.status, 409, 'ambiguous delivery must remain under cooldown');
    assert.equal(vapiRequestCount, 1, 'the retry must not contact Vapi again');
  } finally {
    vapiMode = null;
    if (previousApiKey === undefined) delete process.env.VAPI_API_KEY;
    else process.env.VAPI_API_KEY = previousApiKey;
    if (previousPhoneId === undefined) delete process.env.VAPI_PHONE_NUMBER_ID;
    else process.env.VAPI_PHONE_NUMBER_ID = previousPhoneId;
    freshStore();
  }
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

// Setting an email is what feeds the email drill's send target, so it must be gated the
// same way — a body-supplied address must not attach to any account without a session.
test('POST /api/me/email is refused without a session token', async () => {
  const res = await post('/api/me/email', { email: 'someone@example.com' });
  assert.equal(res.status, 401, 'no session -> cannot set an address on any account');
});

test('POST /api/me/phone/detach is refused without a session token', async () => {
  assert.equal((await post('/api/me/phone/detach')).status, 401);
});

test('POST /api/me/phone/detach removes the phone and revokes the calling session', async () => {
  freshStore();
  const user = await registerVerifiedUser({ phone: '+6591234567', name: 'Detach' });
  const token = await createSession(user.id);
  const headers = { authorization: `Bearer ${token}` };

  const detached = await post('/api/me/phone/detach', {}, headers);
  assert.equal(detached.status, 200);
  assert.equal((await detached.json()).ok, true);
  assert.equal((await getUser(user.id)).phone, undefined);
  assert.equal((await getUser(user.id)).consentToDrills, false);
  assert.equal((await post('/api/me/phone/detach', {}, headers)).status, 401);
  freshStore();
});

test('POST /api/drills/sms cannot be aimed at another number via the body', async () => {
  const res = await post('/api/drills/sms', { phone: '+6590000000', user: 'you' });
  assert.equal(res.status, 401, 'no session -> refused before any number is considered');
});

// ─── Webhook authenticity (review finding 3) ──────────────────────────────
test('POST /api/webhooks/vapi fails closed when no secret is configured', async () => {
  const configured = process.env.VAPI_WEBHOOK_SECRET;
  delete process.env.VAPI_WEBHOOK_SECRET;
  try {
    const res = await post('/api/webhooks/vapi', {
      message: { type: 'end-of-call-report', transcript: 'User: the otp is 1234' },
    });
    assert.equal(res.status, 503, 'unconfigured webhook must not mutate state');
  } finally {
    process.env.VAPI_WEBHOOK_SECRET = configured;
  }
});

test('an authenticated webhook cannot attribute an unknown call to the demo user', async () => {
  freshStore();
  const before = await getUser('you');
  const res = await post(
    '/api/webhooks/vapi',
    {
      message: {
        type: 'end-of-call-report',
        call: {
          id: 'call_unknown',
          metadata: { attemptId: 'attempt_unknown' },
        },
        analysis: {
          structuredData: { outcome: 'shared_data', confidence: 'high' },
        },
      },
    },
    { 'x-vapi-secret': WEBHOOK_SECRET },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ignored: true, reason: 'unknown attempt' });
  assert.deepEqual(await getUser('you'), before);
  assert.deepEqual(await listPendingResults('you'), []);
  freshStore();
});

test('a no-answer webhook is unscored, durable until ACK, and exactly once', async () => {
  freshStore();
  const attempt = await createDrillAttempt({
    userId: 'you',
    channel: 'call',
    providerId: 'call_no_answer_route',
    status: 'sent',
  });
  const before = await getUser('you');
  const payload = {
    message: {
      type: 'end-of-call-report',
      endedReason: 'customer-did-not-answer',
      call: {
        id: 'call_no_answer_route',
        metadata: { attemptId: attempt.id },
      },
    },
  };
  const headers = { 'x-vapi-secret': WEBHOOK_SECRET };

  const first = await post('/api/webhooks/vapi', payload, headers);
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    ok: true,
    status: 'unscored',
    applied: false,
    outcome: null,
    unscoredReason: 'no_answer',
    result: 'UNSCORED',
  });
  const replay = await post('/api/webhooks/vapi', payload, headers);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).status, 'duplicate');
  assert.deepEqual(await getUser('you'), before, 'no-answer must not alter XP or streak');

  const firstRead = await fetch(base + '/api/drills/pending-result');
  const pending = (await firstRead.json()).pending;
  assert.equal(pending.result, 'UNSCORED');
  assert.equal(pending.unscoredReason, 'no_answer');
  assert.equal(
    (await (await fetch(base + '/api/drills/pending-result')).json()).pending.id,
    pending.id,
    'GET must not consume a result',
  );
  assert.equal(
    (await post(`/api/drills/pending-result/${encodeURIComponent(pending.id)}/ack`)).status,
    200,
  );
  assert.equal(
    (await (await fetch(base + '/api/drills/pending-result')).json()).pending,
    null,
  );
  freshStore();
});

// ─── Demo backdoor (review finding 4) ─────────────────────────────────────
test('POST /api/drills/simulate does not exist without ENABLE_DEMO_ROUTES', async () => {
  const res = await post('/api/drills/simulate', { outcome: 'complied' });
  assert.notEqual(res.status, 200, 'demo route must not be registered by default');
});

// ─── Verification fails closed (earlier fix) ──────────────────────────────
test('POST /api/verify/check refuses the bypass code when verification is disabled', async () => {
  const res = await post('/api/verify/check', { phone: '+6591234567', code: '000000', name: 'Judge' });
  assert.equal(res.status, 503);
});

test('POST /api/verify/start rejects a non-E.164 phone', async () => {
  assert.equal((await post('/api/verify/start', { phone: 'not-a-number' })).status, 400);
});

test('an unconfigured verification provider does not consume the durable send quota', async () => {
  freshStore();
  const payload = { phone: '+6598765432' };
  const first = await post('/api/verify/start', payload);
  const second = await post('/api/verify/start', payload);
  assert.equal(first.status, 503);
  assert.equal(second.status, 503, 'no provider send occurred, so no cooldown should be reserved');
  freshStore();
});

test('POST /api/verify/start caps one requester across different phone numbers', async () => {
  freshStore();
  const previousDev = process.env.ALLOW_DEV_VERIFY;
  const previousMax = process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR;
  process.env.ALLOW_DEV_VERIFY = 'true';
  process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR = '2';
  try {
    assert.equal((await post('/api/verify/start', { phone: '+6598000001' })).status, 200);
    assert.equal((await post('/api/verify/start', { phone: '+6598000002' })).status, 200);
    const limited = await post('/api/verify/start', { phone: '+6598000003' });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) >= 1);
  } finally {
    if (previousDev === undefined) delete process.env.ALLOW_DEV_VERIFY;
    else process.env.ALLOW_DEV_VERIFY = previousDev;
    if (previousMax === undefined) delete process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR;
    else process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR = previousMax;
    freshStore();
  }
});

// The dev bypass texts nobody, so the per-destination caps guard nothing and would
// only stop a demo from running the same number repeatedly. The requester cap still
// applies (covered above) — that one bounds writes to the store, not SMS to a phone.
test('POST /api/verify/start does not burn the destination cap in dev mode', async () => {
  freshStore();
  const previousDev = process.env.ALLOW_DEV_VERIFY;
  const previousMax = process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR;
  process.env.ALLOW_DEV_VERIFY = 'true';
  process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR = '100';
  try {
    // Well past both the 5/hour destination cap and the 30s cooldown, same number.
    for (let i = 0; i < 8; i += 1) {
      const res = await post('/api/verify/start', { phone: '+6598000009' });
      assert.equal(res.status, 200, `send ${i + 1} to one number should not be capped in dev`);
    }
  } finally {
    if (previousDev === undefined) delete process.env.ALLOW_DEV_VERIFY;
    else process.env.ALLOW_DEV_VERIFY = previousDev;
    if (previousMax === undefined) delete process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR;
    else process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR = previousMax;
    freshStore();
  }
});

// The email supplied at registration becomes a real send target, so it is validated
// before the OTP is even checked — junk must never reach the store.
test('POST /api/verify/check rejects a malformed email before anything else', async () => {
  for (const bad of ['not-an-email', 'missing@tld', 'two@@at.com', 'has space@x.com']) {
    const res = await post('/api/verify/check', { phone: '+6591234567', code: '000000', name: 'Judge', email: bad });
    assert.equal(res.status, 400, `"${bad}" should be rejected as malformed`);
  }
  // An omitted email is fine — it is optional. This one gets past validation and is
  // refused later for a different reason (verification disabled), never 400.
  const ok = await post('/api/verify/check', { phone: '+6591234567', code: '000000', name: 'Judge' });
  assert.notEqual(ok.status, 400, 'omitting email must not be a validation error');
});

test('POST /api/verify/check requires a valid name before verification', async () => {
  for (const name of ['', '   ', '<script>', '12345']) {
    const res = await post('/api/verify/check', { phone: '+6591234567', code: '000000', name });
    assert.equal(res.status, 400, `"${name}" should be rejected as a name`);
  }
});

// ─── Anonymous practice still works (no regression for the demo) ──────────
test('anonymous practice drills still score against the demo account', async () => {
  freshStore();
  const payload = {
    outcome: 'reported',
    channel: 'email',
    attemptId: 'practice-route-stable-attempt-1',
  };
  const res = await post('/api/drills/practice-result', payload);
  assert.equal(res.status, 200);
  const { status, applied, record, user } = await res.json();
  assert.equal(status, 'completed');
  assert.equal(applied, true);
  assert.equal(record.userId, 'you');
  assert.equal(record.result, 'WON');
  assert.equal(record.practice, true);
  assert.equal(user.phone, undefined, 'even this response must not carry PII');

  const duplicate = await post('/api/drills/practice-result', payload);
  assert.equal(duplicate.status, 200);
  const duplicateBody = await duplicate.json();
  assert.equal(duplicateBody.status, 'duplicate');
  assert.equal(duplicateBody.applied, false);
  assert.equal(duplicateBody.record.id, record.id);
  freshStore();
});

test('practice scoring rejects missing ids, unknown channels and unknown outcomes', async () => {
  assert.equal(
    (await post('/api/drills/practice-result', { outcome: 'reported' })).status,
    400,
  );
  assert.equal(
    (await post('/api/drills/practice-result', {
      outcome: 'reported',
      channel: 'carrier-pigeon',
      attemptId: 'practice-invalid-channel',
    })).status,
    400,
  );
  assert.equal(
    (await post('/api/drills/practice-result', {
      outcome: 'made_up_win',
      channel: 'call',
      attemptId: 'practice-invalid-outcome',
    })).status,
    400,
  );
});

test('email ownership uses an opaque token and changes only after explicit POST', async () => {
  freshStore();
  relayRequests.length = 0;
  const user = await registerVerifiedUser({ phone: '+6591112222', name: 'Inbox Owner' });
  const token = await createSession(user.id);
  const headers = { authorization: `Bearer ${token}` };

  const started = await post(
    '/api/me/email/verification/start',
    { email: ' Owner@Example.COM ' },
    headers,
  );
  assert.equal(started.status, 200);
  assert.deepEqual(await started.json(), { ok: true, verified: false });
  assert.equal(relayRequests.length, 1);
  assert.equal(relayRequests[0].kind, 'email-verification');
  assert.equal(relayRequests[0].email, 'owner@example.com');

  const pendingUser = await getUser(user.id);
  assert.equal(pendingUser.pendingEmail, 'owner@example.com');
  assert.equal(pendingUser.emailVerifiedAt, undefined);
  assert.equal(
    (await post('/api/drills/email', {}, headers)).status,
    400,
    'a pending address is not yet a drill target',
  );

  const pendingStatus = await fetch(base + '/api/me/email/status', { headers });
  assert.deepEqual(await pendingStatus.json(), {
    verified: false,
    emailHint: null,
    pending: true,
  });

  const verification = new URL(relayRequests[0].verificationUrl);
  assert.ok(!verification.toString().toLowerCase().includes('owner@example.com'));
  assert.ok(!verification.toString().toLowerCase().includes('owner%40example.com'));
  const verificationToken = verification.searchParams.get('token');
  const [encodedPayload] = verificationToken.split('.');
  const tokenPayload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  );
  assert.equal(tokenPayload.userId, user.id);
  assert.equal(typeof tokenPayload.verificationId, 'string');
  assert.ok(tokenPayload.verificationId.length >= 32);
  assert.ok(!('email' in tokenPayload), 'the reversible token payload must not contain email');
  assert.ok(!JSON.stringify(tokenPayload).toLowerCase().includes('owner@example.com'));

  const opened = await fetch(base + verification.pathname + verification.search);
  assert.equal(opened.status, 200);
  assert.match(await opened.text(), /Confirm this inbox/i);
  const afterPreview = await getUser(user.id);
  assert.equal(afterPreview.emailVerifiedAt, undefined);
  assert.equal(afterPreview.pendingEmail, 'owner@example.com');

  const confirmed = await post(verification.pathname + verification.search);
  assert.equal(confirmed.status, 200);
  assert.match(await confirmed.text(), /Email verified/i);

  const verifiedUser = await getUser(user.id);
  assert.equal(verifiedUser.email, 'owner@example.com');
  assert.ok(verifiedUser.emailVerifiedAt);
  assert.equal(verifiedUser.pendingEmail, undefined);

  const verifiedStatus = await fetch(base + '/api/me/email/status', { headers });
  assert.deepEqual(await verifiedStatus.json(), {
    verified: true,
    emailHint: 'o***@example.com',
    pending: false,
  });
  freshStore();
});

test('signed drill action links reject the wrong action and score only once', async () => {
  freshStore();
  const before = await getUser('you');
  const attempt = await createDrillAttempt({ userId: 'you', channel: 'email' });
  await markDrillAttemptSent(attempt.id);
  const revealToken = createDrillActionToken({
    attemptId: attempt.id,
    action: 'reveal',
  });

  const wrongAction = await fetch(
    `${base}/drill-report?token=${encodeURIComponent(revealToken)}`,
  );
  assert.equal(wrongAction.status, 400);
  assert.deepEqual(await getUser('you'), before);

  const revealPath = `/drill-reveal?token=${encodeURIComponent(revealToken)}`;
  const preview = await fetch(base + revealPath);
  assert.equal(preview.status, 200);
  assert.match(await preview.text(), /Continue to the drill reveal/i);
  assert.deepEqual(await getUser('you'), before, 'automatic GET previews must not score');
  assert.equal((await getDrillAttempt(attempt.id)).status, 'sent');
  assert.deepEqual(await listPendingResults('you'), []);

  const first = await post(revealPath);
  assert.equal(first.status, 200);
  assert.match(await first.text(), /SafeSpace drill/i);
  const afterFirst = await getUser('you');
  assert.equal(afterFirst.timesScammed, before.timesScammed + 1);

  const replay = await post(revealPath);
  assert.equal(replay.status, 200);
  assert.equal((await getUser('you')).timesScammed, afterFirst.timesScammed);
  assert.equal((await listPendingResults('you')).length, 1);
  freshStore();
});
