// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SMS_CONTENT_LIMITS, buildDrillSmsInput, parseDrillSms, smsWriterConfigured, writeDrillSms,
} from './sms-writer.js';

const LESSON = {
  variantId: 'v-1',
  scamName: 'Phishing scam',
  variantName: 'Fake bank security alert',
  description: 'Victims receive a text claiming suspicious activity on their account.',
  modusOperandi: 'Scammers send a text with a link to a fake login page.',
  impersonatedEntity: 'Lion City Bank',
  redFlags: ['Urgent request to verify', 'A link to an unfamiliar domain'],
  tactics: ['Urgency'],
  requestedAction: 'Click a link and log in',
  verificationMethod: 'Call the number on the back of your card',
  preventionAdvice: 'Never log in through a link in a message',
};

const GOOD = {
  text: 'Harbourline Bank: a transfer of S$480 to a new payee was approved under ref SG7K2Q. If this was not you, cancel it within 2 hours.',
  lesson: {
    scamName: 'Phishing scam',
    redFlags: ['An unexpected transfer warning', 'A two-hour deadline'],
    advice: 'Open your bank app yourself instead of tapping a link.',
  },
};

test('a drill text is short enough to stay affordable once a link is appended', () => {
  assert.ok(SMS_CONTENT_LIMITS.maxText <= 200, 'a signed reveal link still has to fit');
  assert.ok(GOOD.text.length <= SMS_CONTENT_LIMITS.maxText);
});

test('parseDrillSms accepts a plain scam text and returns its lesson', () => {
  const parsed = parseDrillSms(JSON.stringify(GOOD), LESSON);
  assert.equal(parsed.text, GOOD.text);
  assert.deepEqual(parsed.lesson, GOOD.lesson);
});

test('FAILS CLOSED: the writer never supplies its own link or contact details', () => {
  const broken = [
    { ...GOOD, text: 'Verify now at https://evil.example/login' },
    { ...GOOD, text: 'Verify now at evil.example/login' },
    { ...GOOD, text: 'Call us on +65 9123 4567 to confirm this transfer right away.' },
    { ...GOOD, text: 'Email fraud@bank.example to confirm this transfer right away.' },
  ];
  for (const sms of broken) {
    assert.equal(parseDrillSms(JSON.stringify(sms), LESSON), null, sms.text);
  }
});

test('FAILS CLOSED: a text naming the impersonated organisation or a real brand is refused', () => {
  const real = { ...GOOD, text: 'Lion City Bank: a transfer of S$480 was approved. Cancel within 2 hours.' };
  assert.equal(parseDrillSms(JSON.stringify(real), LESSON), null, 'the impersonated entity');
  const dbs = { ...GOOD, text: 'DBS alert: a transfer of S$480 was approved. Cancel it within 2 hours please.' };
  assert.equal(parseDrillSms(JSON.stringify(dbs), LESSON), null, 'a real bank');
  const us = { ...GOOD, text: 'SafeSpace: a transfer of S$480 was approved. Cancel it within 2 hours please.' };
  assert.equal(parseDrillSms(JSON.stringify(us), LESSON), null, 'our own name');
});

test('FAILS CLOSED: an over-long, empty or unparseable reply is refused', () => {
  assert.equal(parseDrillSms('not json', LESSON), null);
  assert.equal(parseDrillSms(JSON.stringify({ ...GOOD, text: '' }), LESSON), null);
  assert.equal(parseDrillSms(JSON.stringify({ ...GOOD, text: 'Hi' }), LESSON), null, 'too short to teach anything');
  const long = { ...GOOD, text: 'A'.repeat(SMS_CONTENT_LIMITS.maxText + 1) };
  assert.equal(parseDrillSms(JSON.stringify(long), LESSON), null);
});

test('an unusable lesson does not throw away a usable text', () => {
  const parsed = parseDrillSms(JSON.stringify({ text: GOOD.text, lesson: null }), LESSON);
  assert.equal(parsed.text, GOOD.text);
  assert.equal(parsed.lesson, null);
});

test('the model is told the scam, the language and the player, never their identity', () => {
  const input = buildDrillSmsInput(LESSON, 'zh', { interests: ['investment'], activities: ['shop'] });
  assert.equal(input.language, 'zh');
  assert.equal(input.languageName, 'Simplified Chinese');
  assert.equal(input.scam.impersonatedEntity, 'Lion City Bank');
  assert.ok(input.recipient, 'the pre-survey brief steers the scenario');
  assert.ok(!JSON.stringify(input).includes('+65'), 'no phone number reaches the model');
});

test('smsWriterConfigured needs a key and respects the SMS_AI=off switch', () => {
  assert.equal(smsWriterConfigured({}), false);
  assert.equal(smsWriterConfigured({ OPENAI_API_KEY: 'sk-test' }), true);
  assert.equal(smsWriterConfigured({ OPENAI_API_KEY: 'sk-test', SMS_AI: 'off' }), false);
});

test('writeDrillSms returns null rather than throwing when the model misbehaves', async () => {
  assert.equal(await writeDrillSms(null, { create: async () => ({ output_text: JSON.stringify(GOOD) }) }), null);
  assert.equal(await writeDrillSms(LESSON, { create: async () => { throw new Error('timeout'); } }), null);
  assert.equal(await writeDrillSms(LESSON, { create: async () => ({ output_text: 'nonsense' }) }), null);
});

test('writeDrillSms returns the parsed text for a good reply', async () => {
  const written = await writeDrillSms(LESSON, {
    language: 'en',
    create: async () => ({ output_text: JSON.stringify(GOOD) }),
  });
  assert.equal(written.text, GOOD.text);
  assert.deepEqual(written.lesson, GOOD.lesson);
});
