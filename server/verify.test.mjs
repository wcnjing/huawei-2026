// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVerification, startVerification, rateLimited, verifyMode, DEV_CODE } from './verify.js';

function clearVerifyEnv() {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_VERIFY_SERVICE_SID;
  delete process.env.ALLOW_DEV_VERIFY;
}

// --- Regression tests for the fail-closed fix -------------------------------
// Previously an unconfigured (or partially configured) deploy silently accepted the
// bypass code from anyone, which would let a caller register a number they don't own.

test('FAILS CLOSED: with no config at all, the bypass code is refused', async () => {
  clearVerifyEnv();
  assert.equal(verifyMode(), 'disabled');
  await assert.rejects(() => checkVerification('+6590000001', DEV_CODE), { code: 'VERIFY_UNAVAILABLE' });
  await assert.rejects(() => startVerification('+6590000001'), { code: 'VERIFY_UNAVAILABLE' });
  clearVerifyEnv();
});

test('FAILS CLOSED: a partial/typo Twilio config does NOT enable the bypass', async () => {
  clearVerifyEnv();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  // TWILIO_VERIFY_SERVICE_SID deliberately missing — the real-world typo case.
  assert.equal(verifyMode(), 'disabled');
  await assert.rejects(() => checkVerification('+6590000001', DEV_CODE), { code: 'VERIFY_UNAVAILABLE' });
  clearVerifyEnv();
});

test('dev bypass works ONLY when explicitly opted into', async () => {
  clearVerifyEnv();
  process.env.ALLOW_DEV_VERIFY = 'true';
  assert.equal(verifyMode(), 'dev');
  assert.equal(await checkVerification('+6590000001', DEV_CODE), true);
  assert.equal(await checkVerification('+6590000001', '123456'), false);
  clearVerifyEnv();
});

// --- Rate limiting ----------------------------------------------------------

test('rate limit: a second send within 30s is blocked', () => {
  const p = '+6590000002';
  assert.equal(rateLimited(p), false); // first send allowed
  assert.equal(rateLimited(p), true); // immediate resend blocked
});

test('rate limit is per-number (independent counters)', () => {
  assert.equal(rateLimited('+6590000003'), false);
  assert.equal(rateLimited('+6590000004'), false);
});
