// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVerification, startVerification, verifyMode, DEV_CODE } from './verify.js';

function clearVerifyEnv() {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_VERIFY_SERVICE_SID;
  delete process.env.ALLOW_DEV_VERIFY;
  delete process.env.UNSAFE_FORCE_DEV_VERIFY;
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

// The demo escape hatch. Unlike ALLOW_DEV_VERIFY this outranks a complete Twilio
// config, so it must still refuse anything other than the exact string 'true' —
// otherwise a stray value would disable ownership checks by accident.
test('UNSAFE_FORCE_DEV_VERIFY outranks a full Twilio config', async () => {
  clearVerifyEnv();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test';
  assert.equal(verifyMode(), 'twilio');
  process.env.UNSAFE_FORCE_DEV_VERIFY = 'true';
  assert.equal(verifyMode(), 'dev');
  assert.equal(await checkVerification('+6590000001', DEV_CODE), true);
  clearVerifyEnv();
});

test('UNSAFE_FORCE_DEV_VERIFY is ignored unless it is exactly "true"', async () => {
  clearVerifyEnv();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'token';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA_test';
  for (const sloppy of ['1', 'TRUE', 'yes', 'true ', '']) {
    process.env.UNSAFE_FORCE_DEV_VERIFY = sloppy;
    assert.equal(verifyMode(), 'twilio', `"${sloppy}" must not force the bypass`);
  }
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
