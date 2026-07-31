// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  smsConfigured,
  sendDrillSms,
  SCENARIOS,
  REVEAL_TEXT,
  pickScenario,
  personalizeSmsText,
  scenarioText,
  validateSmsRevealUrl,
  resolveRevealDelay,
  DEFAULT_REVEAL_DELAY_MS,
  TWILIO_MIN_SCHEDULE_MS,
} from './sms.js';

function clearSmsEnv() {
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_SMS_FROM;
  delete process.env.TWILIO_MESSAGING_SERVICE_SID;
  delete process.env.SMS_REVEAL_DELAY_MS;
  delete process.env.PUBLIC_URL;
  delete process.env.EMAIL_ACTION_ORIGIN;
}

function configureSms() {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'tok';
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_test';
}

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test('smsConfigured requires a Messaging Service that supports durable scheduling', () => {
  clearSmsEnv();
  process.env.TWILIO_ACCOUNT_SID = 'AC_test';
  process.env.TWILIO_AUTH_TOKEN = 'tok';
  process.env.TWILIO_SMS_FROM = '+15550000000';
  assert.equal(smsConfigured(), false, 'a From number cannot schedule the safety reveal');
  process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG_test';
  assert.equal(smsConfigured(), true);
  process.env.SMS_REVEAL_DELAY_MS = '120000';
  assert.equal(smsConfigured(), false, 'Twilio cannot durably schedule only two minutes ahead');
  clearSmsEnv();
});

test('FAILS CLOSED: sendDrillSms refuses when unconfigured', async () => {
  clearSmsEnv();
  await assert.rejects(() => sendDrillSms({ to: '+6591234567' }), { code: 'SMS_UNAVAILABLE' });
});

test('reveal delay respects Twilio scheduling limits and has a safe default buffer', () => {
  clearSmsEnv();
  assert.equal(resolveRevealDelay(), DEFAULT_REVEAL_DELAY_MS);
  assert.ok(DEFAULT_REVEAL_DELAY_MS > TWILIO_MIN_SCHEDULE_MS);
  assert.throws(() => resolveRevealDelay(120_000), { code: 'SMS_UNAVAILABLE' });
});

// Simulated phishing must only ever use invented institutions.
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

test('every built-in bait URL uses the reserved .example namespace', () => {
  for (const scenario of SCENARIOS) {
    const match = scenario.text.match(/https:\/\/\S+$/);
    assert.ok(match, `${scenario.id} needs one absolute URL`);
    assert.match(new URL(match[0]).hostname, /\.example$/);
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

test('the reveal text is unambiguous and contains no link or call to action', () => {
  assert.match(REVEAL_TEXT, /SafeSpace drill/i, 'must name the drill explicitly');
  assert.match(REVEAL_TEXT, /safe/i, 'must reassure');
  assert.ok(!/click|verify|http|www\./i.test(REVEAL_TEXT));
});

test('pickScenario returns a known scenario, and falls back safely on a bad id', () => {
  assert.equal(pickScenario('bank').id, 'bank');
  assert.ok(SCENARIOS.includes(pickScenario('does-not-exist')));
  assert.ok(SCENARIOS.includes(pickScenario()));
});

test('SMS drills address the verified user by name', () => {
  assert.equal(personalizeSmsText('Your parcel is held.', 'JUDGE'), 'JUDGE, Your parcel is held.');
  assert.equal(personalizeSmsText('Your parcel is held.', ''), 'Your parcel is held.');
});

test('a caller-supplied reveal link must be signed, HTTPS and first-party', () => {
  clearSmsEnv();
  process.env.PUBLIC_URL = 'https://safe.example.test';
  const token = `payload.${'s'.repeat(43)}`;
  const good = `https://safe.example.test/drill-reveal?token=${token}`;
  assert.equal(validateSmsRevealUrl(good), good);
  assert.match(scenarioText(pickScenario('parcel'), good), /safe\.example\.test\/drill-reveal/);
  assert.doesNotMatch(scenarioText(pickScenario('parcel'), good), /parcellink\.example/);
  for (const bad of [
    `http://safe.example.test/drill-reveal?token=${token}`,
    `https://evil.example/drill-reveal?token=${token}`,
    `https://safe.example.test/drill-report?token=${token}`,
    'https://safe.example.test/drill-reveal',
    `${good}#fragment`,
  ]) {
    assert.throws(() => validateSmsRevealUrl(bad), { code: 'SMS_UNAVAILABLE' });
  }
  clearSmsEnv();
});

test('sendDrillSms schedules the reveal before sending bait', async (t) => {
  clearSmsEnv();
  configureSms();
  process.env.PUBLIC_URL = 'https://safe.example.test';
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearSmsEnv();
  });
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options, form: new URLSearchParams(options.body) });
    if (calls.length === 1) return response(201, { sid: 'SM_reveal', status: 'scheduled' });
    return response(201, { sid: 'SM_bait', status: 'accepted' });
  };
  const token = `payload.${'s'.repeat(43)}`;
  const revealUrl = `https://safe.example.test/drill-reveal?token=${token}`;

  const result = await sendDrillSms({
    to: '+6591234567',
    name: 'JUDGE',
    scenarioId: 'parcel',
    revealUrl,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].form.get('Body'), REVEAL_TEXT);
  assert.equal(calls[0].form.get('ScheduleType'), 'fixed');
  assert.ok(calls[0].form.get('SendAt'));
  assert.equal(calls[0].form.get('MessagingServiceSid'), 'MG_test');
  assert.equal(calls[1].form.get('ScheduleType'), null);
  assert.match(calls[1].form.get('Body'), /^JUDGE, /);
  assert.match(calls[1].form.get('Body'), /safe\.example\.test\/drill-reveal/);
  assert.equal(result.revealSid, 'SM_reveal');
  assert.equal(result.sid, 'SM_bait');
});

test('FAILS CLOSED: bait is not sent unless Twilio confirms reveal status scheduled', async (t) => {
  clearSmsEnv();
  configureSms();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearSmsEnv();
  });
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return response(201, { sid: 'SM_reveal', status: 'queued' });
  };
  await assert.rejects(
    () => sendDrillSms({ to: '+6591234567', scenarioId: 'parcel' }),
    { code: 'SMS_UNAVAILABLE' },
  );
  assert.equal(calls, 1);
});

test('a bait-send failure cancels the previously scheduled standalone reveal', async (t) => {
  clearSmsEnv();
  configureSms();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearSmsEnv();
  });
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, form: new URLSearchParams(options.body) });
    if (calls.length === 1) return response(201, { sid: 'SM_reveal', status: 'scheduled' });
    if (calls.length === 2) return response(500, { message: 'send failed' });
    return response(200, { sid: 'SM_reveal', status: 'canceled' });
  };

  await assert.rejects(() => sendDrillSms({ to: '+6591234567', scenarioId: 'parcel' }));
  assert.equal(calls.length, 3);
  assert.match(calls[2].url, /Messages\/SM_reveal\.json$/);
  assert.equal(calls[2].form.get('Status'), 'canceled');
});
