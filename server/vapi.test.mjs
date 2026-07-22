// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeFromVapiWebhook, fireDrillCall } from './vapi.js';

const report = (transcript, extra = {}) => ({
  message: { type: 'end-of-call-report', transcript, ...extra },
});

test('ignores events that are not an end-of-call report', () => {
  assert.equal(outcomeFromVapiWebhook({ message: { type: 'status-update' } }), null);
});

test('prefers an explicit structured outcome over the heuristic', () => {
  const body = report('the otp is 1234', { analysis: { structuredData: { outcome: 'hung_up' } } });
  assert.equal(outcomeFromVapiWebhook(body), 'hung_up');
});

test('detects shared data when the target reads out an OTP', () => {
  assert.equal(outcomeFromVapiWebhook(report('User: okay the otp is 4 4 9 1')), 'shared_data');
});

test('detects the distress off-ramp when the target asks if it is a drill', () => {
  assert.equal(outcomeFromVapiWebhook(report('User: wait, is this a drill?')), 'distress_offramp');
});

test('no transcript defaults to a benign win (never punish on missing signal)', () => {
  assert.equal(outcomeFromVapiWebhook(report('')), 'disengaged');
});

// --- Regression: the assistant's OWN words must not be scored -----------------
// The scripted reveal says "Stop right there. This was a SafeSpace drill." Scanning the
// whole transcript matched "stop" in the ASSISTANT's line, so a clean win where the
// caller simply hung up got mis-scored as a distress off-ramp (0 XP, no streak).
test('a clean hang-up is NOT mis-scored as distress just because the AI said "stop"', () => {
  const transcript = [
    'AI: Good afternoon, this is Officer Tan from the Office of Public Trust.',
    'User: No thanks, I will call my bank directly.',
    'AI: Stop right there. This was a SafeSpace drill. You are safe.',
  ].join('\n');
  assert.equal(outcomeFromVapiWebhook(report(transcript)), 'disengaged');
});

test('the AI merely SAYING "otp" does not count as the user sharing data', () => {
  const transcript = [
    'AI: Read me the OTP when it appears on your screen.',
    'User: No. I am hanging up.',
  ].join('\n');
  assert.equal(outcomeFromVapiWebhook(report(transcript)), 'disengaged');
});

test('user distress is still caught when the user is the one who says it', () => {
  const transcript = [
    'AI: Failure to verify will be treated as non-cooperation.',
    "User: stop, I'm scared.",
  ].join('\n');
  assert.equal(outcomeFromVapiWebhook(report(transcript)), 'distress_offramp');
});

// --- Guard clauses on the outbound call --------------------------------------
test('fireDrillCall refuses without Vapi credentials', async () => {
  const { VAPI_API_KEY, VAPI_PHONE_NUMBER_ID } = process.env;
  delete process.env.VAPI_API_KEY;
  delete process.env.VAPI_PHONE_NUMBER_ID;
  await assert.rejects(() => fireDrillCall({ toNumber: '+6591234567' }), /must be set/);
  if (VAPI_API_KEY) process.env.VAPI_API_KEY = VAPI_API_KEY;
  if (VAPI_PHONE_NUMBER_ID) process.env.VAPI_PHONE_NUMBER_ID = VAPI_PHONE_NUMBER_ID;
});

test('fireDrillCall refuses a non-E.164 number', async () => {
  process.env.VAPI_API_KEY = 'k';
  process.env.VAPI_PHONE_NUMBER_ID = 'p';
  await assert.rejects(() => fireDrillCall({ toNumber: '91234567' }), /E\.164/);
  delete process.env.VAPI_API_KEY;
  delete process.env.VAPI_PHONE_NUMBER_ID;
});
