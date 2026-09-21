import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

process.env.DOTENV_CONFIG_PATH = '/dev/null';
for (const name of [
  'ALLOW_DEV_VERIFY',
  'ENABLE_DEMO_ROUTES',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID',
  'VAPI_API_KEY',
  'VAPI_PHONE_NUMBER_ID',
  'VAPI_WEBHOOK_SECRET',
  'GOOGLE_SCRIPT_URL',
  'GOOGLE_SCRIPT_SECRET',
]) delete process.env[name];
process.env.IDENTITY_LOOKUP_SECRET = 'chat-route-test-identity-secret-over-32-characters';
process.env.SUPABASE_URL = 'https://doorbell.test';
process.env.SUPABASE_SECRET_KEY = 'chat-route-test-doorbell-key';

await setupTestDb();
const { app } = await import('./index.js');
const { createSession, registerVerifiedUser } = await import('./store.js');
const houses = await import('./houses.js');
const { query } = await import('./db.js');

const nativeFetch = globalThis.fetch;
const broadcastUrl = 'https://doorbell.test/realtime/v1/api/broadcast';
const broadcasts = [];
let broadcastMode = 'ok';
let server;
let listenerBase;

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (url === broadcastUrl) {
    if (broadcastMode === 'reject') throw new TypeError('simulated broadcast rejection');
    broadcasts.push(JSON.parse(String(init?.body || '{}')));
    return new Response('{}', { status: 202 });
  }
  return nativeFetch(input, init);
};

before(async () => {
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  listenerBase = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())));
  }
  globalThis.fetch = nativeFetch;
  await teardownTestDb();
});

async function fixture() {
  await resetDb();
  broadcasts.length = 0;
  broadcastMode = 'ok';
  const alice = await registerVerifiedUser({ phone: '+6593220001', name: 'Alice' });
  const bob = await registerVerifiedUser({ phone: '+6593220002', name: 'Bob' });
  const ownerToken = await createSession(alice.id);
  const outsiderToken = await createSession(bob.id);
  const { houseId } = await houses.createHouse(alice.id, 'Chat Routes');
  const code = (await houses.getHouseView(alice.id)).house.inviteCode;
  await houses.joinHouse(bob.id, code);
  await houses.removeMember(alice.id, bob.id);
  return { base: listenerBase, owner: alice, outsider: bob, ownerToken, outsiderToken, houseId };
}

function assertNoStore(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store');
}

const MESSAGE_KEYS = [
  'clientKey', 'createdAt', 'houseId', 'id', 'senderAvatar', 'senderId', 'senderName', 'text',
];

function assertMessageEnvelope(body) {
  assert.deepEqual(Object.keys(body), ['message']);
  assert.deepEqual(Object.keys(body.message).sort(), MESSAGE_KEYS);
}

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

test('chat routes authenticate, authorize, and make sends idempotent', async () => {
  const { base, ownerToken, outsiderToken, houseId } = await fixture();
  const path = `${base}/api/houses/${houseId}/chat/messages`;
  const unauthenticated = await fetch(path);
  assert.equal(unauthenticated.status, 401);
  assertNoStore(unauthenticated);
  const forbidden = await fetch(path, {
    headers: { authorization: `Bearer ${outsiderToken}` },
  });
  assert.equal(forbidden.status, 403);
  assertNoStore(forbidden);
  const headers = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
  const input = { text: '<script>hello</script>', clientKey: crypto.randomUUID() };
  const first = await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) });
  assert.equal(first.status, 201);
  assertNoStore(first);
  const again = await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) });
  assert.equal(again.status, 200);
  assertNoStore(again);
  const firstBody = await first.json();
  const againBody = await again.json();
  assertMessageEnvelope(firstBody);
  assertMessageEnvelope(againBody);
  assert.deepEqual(firstBody, againBody);
  const extraField = await fetch(path, {
    method: 'POST', headers, body: JSON.stringify({ ...input, senderId: 'victim' }),
  });
  assert.equal(extraField.status, 400);
  assertNoStore(extraField);
});

test('chat routes reject malformed bodies and cursors with no-store responses', async () => {
  const { base, ownerToken, outsiderToken, houseId } = await fixture();
  const path = `${base}/api/houses/${houseId}/chat/messages`;
  const headers = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
  const validBody = JSON.stringify({ text: 'Private', clientKey: crypto.randomUUID() });
  const unauthenticatedSend = await fetch(path, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: validBody,
  });
  assert.equal(unauthenticatedSend.status, 401);
  assertNoStore(unauthenticatedSend);
  const forbiddenSend = await fetch(path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${outsiderToken}`,
      'content-type': 'application/json',
    },
    body: validBody,
  });
  assert.equal(forbiddenSend.status, 403);
  assertNoStore(forbiddenSend);
  const invalidRequests = [
    () => fetch(path, { method: 'POST', headers, body: JSON.stringify([]) }),
    () => fetch(path, { method: 'POST', headers, body: JSON.stringify({ text: 'Missing key' }) }),
    () => fetch(path, {
      method: 'POST', headers, body: JSON.stringify({ clientKey: crypto.randomUUID() }),
    }),
    () => fetch(`${path}?before=1&after=2`, { headers }),
    () => fetch(`${path}?before=1&before=2`, { headers }),
    () => fetch(`${path}?after=9223372036854775808`, { headers }),
  ];

  for (const request of invalidRequests) {
    const response = await request();
    assert.equal(response.status, 400);
    assertNoStore(response);
  }

  const forbidden = await fetch(path, {
    headers: { authorization: `Bearer ${outsiderToken}` },
  });
  assert.equal(forbidden.status, 403);
  assertNoStore(forbidden);
});

test('expired sessions return a no-store 401', async () => {
  const { base, owner, ownerToken, houseId } = await fixture();
  await query(
    'update safespace.sessions set expires_at = $2 where user_id = $1',
    [owner.id, '2000-01-01T00:00:00.000Z'],
  );
  const response = await fetch(`${base}/api/houses/${houseId}/chat/messages`, {
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(response.status, 401);
  assertNoStore(response);
});

test('chat responses expose only documented fields and broadcasts carry no content', async () => {
  const { base, ownerToken, houseId } = await fixture();
  const path = `${base}/api/houses/${houseId}/chat/messages`;
  const headers = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
  const input = { text: '<script>plain text</script>', clientKey: crypto.randomUUID() };

  const sent = await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) });
  assert.equal(sent.status, 201);
  assertNoStore(sent);
  const sentBody = await sent.json();
  assertMessageEnvelope(sentBody);
  assert.deepEqual(broadcasts.at(-1).messages[0].payload, {});

  const retry = await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) });
  assert.equal(retry.status, 200);
  assertNoStore(retry);
  const retryBody = await retry.json();
  assertMessageEnvelope(retryBody);
  assert.deepEqual(retryBody, sentBody);

  const changed = await fetch(path, {
    method: 'POST', headers, body: JSON.stringify({ ...input, text: 'Changed body' }),
  });
  assert.equal(changed.status, 409);
  assertNoStore(changed);

  const history = await fetch(path, { headers });
  assert.equal(history.status, 200);
  assertNoStore(history);
  const body = await history.json();
  assert.deepEqual(Object.keys(body).sort(), ['hasMore', 'houseId', 'messages']);
  assert.equal(body.houseId, houseId);
  assert.equal(body.messages.length, 1);
  assert.deepEqual(Object.keys(body.messages[0]).sort(), MESSAGE_KEYS);
  assert.equal(body.messages[0].text, input.text);
  const responseKeys = collectKeys(body);
  assert.equal(responseKeys.has('phone'), false);
  assert.equal(responseKeys.has('email'), false);
});

test('rate-limited sends return Retry-After and no-store', async () => {
  const { base, ownerToken, houseId } = await fixture();
  const path = `${base}/api/houses/${houseId}/chat/messages`;
  const headers = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
  for (let index = 0; index < 20; index += 1) {
    const response = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: `Message ${index + 1}`, clientKey: crypto.randomUUID() }),
    });
    assert.equal(response.status, 201);
    assertNoStore(response);
  }

  const blocked = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: 'Message 21', clientKey: crypto.randomUUID() }),
  });
  assert.equal(blocked.status, 429);
  assert.match(blocked.headers.get('retry-after') || '', /^[1-9][0-9]*$/);
  assertNoStore(blocked);
});

test('a rejected broadcast does not fail or lose a committed send', async () => {
  const { base, ownerToken, houseId } = await fixture();
  const path = `${base}/api/houses/${houseId}/chat/messages`;
  const headers = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
  broadcastMode = 'reject';
  const response = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: 'Committed first', clientKey: crypto.randomUUID() }),
  });
  assert.equal(response.status, 201);
  assertNoStore(response);

  const history = await fetch(path, { headers });
  assert.equal(history.status, 200);
  assertNoStore(history);
  assert.deepEqual((await history.json()).messages.map((message) => message.text), ['Committed first']);
});
