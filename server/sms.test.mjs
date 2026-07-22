// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smsConfigured, sendDrillSms, SCENARIOS, REVEAL_TEXT, pickScenario } from './sms.js';

function clearSmsEnv() {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_SMS_FROM;
}

test('smsConfigured requires account, token AND a from-number', () => {
  clearSmsEnv();
  assert.equal(smsConfigured(), false);
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'tok';
  assert.equal(smsConfigured(), false, 'no from-number means nothing can be sent');
  process.env.TWILIO_SMS_FROM = '+15550000000';
  assert.equal(smsConfigured(), true);
  clearSmsEnv();
});

test('FAILS CLOSED: sendDrillSms refuses when unconfigured', async () => {
  clearSmsEnv();
  await assert.rejects(() => sendDrillSms({ to: '+6591234567' }), { code: 'SMS_UNAVAILABLE' });
});

// ─── The rule that smsdrill/ broke ────────────────────────────────────────
// smsdrill/ impersonates "Chase", a real bank. Simulated phishing must only ever use
// invented institutions — this test makes that a build failure rather than a code review.
test('no scenario impersonates a real bank, brand or agency', () => {
  const REAL_BRANDS = [
    'dbs', 'ocbc', 'uob', 'posb', 'maybank', 'citibank', 'hsbc', 'standard chartered',
    'chase', 'paypal', 'amazon', 'apple', 'google', 'microsoft', 'netflix', 'singpost',
    'iras', 'cpf', 'singtel', 'starhub', 'shopee', 'lazada', 'fedex', 'dhl',
  ];
  for (const s of SCENARIOS) {
    const text = s.text.toLowerCase();
    for (const brand of REAL_BRANDS) {
      assert.ok(
        !text.includes(brand),
        `scenario "${s.id}" mentions the real brand "${brand}": ${s.text}`,
      );
    }
  }
});

test('every scenario is well-formed and SMS-sized', () => {
  assert.ok(SCENARIOS.length >= 3, 'need a few scenarios so drills are not repetitive');
  const ids = new Set();
  for (const s of SCENARIOS) {
    assert.ok(s.id && !ids.has(s.id), `scenario ids must be unique (${s.id})`);
    ids.add(s.id);
    assert.ok(s.text?.length > 20, `${s.id} has no meaningful text`);
    assert.ok(s.text.length <= 320, `${s.id} is ${s.text.length} chars — too long for 2 SMS segments`);
    assert.ok(Array.isArray(s.redFlags) && s.redFlags.length >= 2, `${s.id} needs red flags for the debrief`);
  }
});

// ─── The safeguard ────────────────────────────────────────────────────────
test('the reveal text is unambiguous and never sounds like part of the scam', () => {
  assert.match(REVEAL_TEXT, /SafeSpace drill/i, 'must name the drill explicitly');
  assert.match(REVEAL_TEXT, /safe/i, 'must reassure');
  assert.ok(!/click|verify|http|www\./i.test(REVEAL_TEXT), 'the reveal must contain no link or call to action');
});

test('pickScenario returns a known scenario, and falls back safely on a bad id', () => {
  assert.equal(pickScenario('bank').id, 'bank');
  assert.ok(SCENARIOS.includes(pickScenario('does-not-exist')), 'unknown id must not return undefined');
  assert.ok(SCENARIOS.includes(pickScenario()), 'no id -> random valid scenario');
});
