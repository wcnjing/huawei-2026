import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { doorbellConfig, ring } from './doorbell.js';

const env = { SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_test' };
const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });

test('unconfigured or empty rings do nothing', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response('{}'); };
  assert.equal(doorbellConfig({}), null);
  assert.equal(await ring(['house-a'], { env: {} }), false);
  assert.equal(await ring([], { env }), false);
  assert.equal(called, false);
});

test('a ring is one empty broadcast per topic, with the secret only in apikey', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 202 }); };
  assert.equal(await ring(['house-a', 'house-a', 'house-b'], { env }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://proj.supabase.co/realtime/v1/api/broadcast');
  assert.equal(calls[0].init.headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].init.headers.authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    messages: [
      { topic: 'house-a', event: 'changed', payload: {}, private: false },
      { topic: 'house-b', event: 'changed', payload: {}, private: false },
    ],
  });
});

test('failures and timeouts are swallowed', async () => {
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  assert.equal(await ring(['house-a'], { env }), false);
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  assert.equal(await ring(['house-a'], { env }), false);
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  const started = Date.now();
  assert.equal(await ring(['house-a'], { env, timeoutMs: 50 }), false);
  assert.ok(Date.now() - started < 1000);
});
