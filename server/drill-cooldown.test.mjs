import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { realDrillCooldownMs } from './drill-cooldown.js';

const TOUCHED = [
  'ALLOW_DEV_VERIFY', 'UNSAFE_FORCE_DEV_VERIFY', 'REAL_DRILL_COOLDOWN_MS',
  'SMS_REVEAL_DELAY_MS', 'EMAIL_SAFETY_FOLLOWUP_DELAY_MS',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID',
];

beforeEach(() => {
  for (const key of TOUCHED) delete process.env[key];
});

test('the default cooldown is five minutes for a call', () => {
  assert.equal(realDrillCooldownMs('call'), 5 * 60 * 1000);
});

test('REAL_DRILL_COOLDOWN_MS overrides the baseline, but not below five seconds', () => {
  process.env.REAL_DRILL_COOLDOWN_MS = '60000';
  assert.equal(realDrillCooldownMs('call'), 60_000);
  process.env.REAL_DRILL_COOLDOWN_MS = '10';
  assert.equal(realDrillCooldownMs('call'), 5 * 60 * 1000, 'an absurdly short value falls back');
});

test('SMS and email never cool down faster than their safety follow-up', () => {
  process.env.REAL_DRILL_COOLDOWN_MS = '5000';
  assert.ok(realDrillCooldownMs('sms') > 5_000, 'the reveal must land before the next bait');
  assert.ok(realDrillCooldownMs('email') > 5_000, 'the follow-up must land before the next bait');
});

// The point of the dev bypass: a demo can fire the same channel again immediately.
test('dev mode removes the cooldown on every channel', () => {
  process.env.ALLOW_DEV_VERIFY = 'true';
  for (const channel of ['call', 'sms', 'email']) {
    assert.equal(realDrillCooldownMs(channel), 0, `${channel} should be free to re-fire`);
  }
});

test('the forced dev bypass also removes the cooldown', () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC-test';
  process.env.TWILIO_AUTH_TOKEN = 'token-test';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA-test';
  assert.ok(realDrillCooldownMs('call') > 0, 'configured Twilio alone is not dev mode');
  process.env.UNSAFE_FORCE_DEV_VERIFY = 'true';
  assert.equal(realDrillCooldownMs('call'), 0);
});

test('a production-shaped environment keeps every cooldown', () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC-test';
  process.env.TWILIO_AUTH_TOKEN = 'token-test';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VA-test';
  for (const channel of ['call', 'sms', 'email']) {
    assert.ok(realDrillCooldownMs(channel) > 0, `${channel} must stay rate limited`);
  }
});
