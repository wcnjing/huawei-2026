// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { inboundWebhookConfigured, signTwilioRequest, verifyTwilioSignature } from './twilio-signature.js';

const TOKEN = 'twilio-auth-token-for-tests';
const URL_ = 'https://safespace.test/api/webhooks/twilio/sms';
const PARAMS = { From: '+6591234567', To: '+6598887777', Body: 'what transfer?' };

test('signTwilioRequest reproduces Twilio\'s documented scheme', () => {
  // URL, then every parameter appended as name+value in alphabetical order, HMAC-SHA1.
  const expected = crypto.createHmac('sha1', TOKEN)
    .update(`${URL_}Body${PARAMS.Body}From${PARAMS.From}To${PARAMS.To}`)
    .digest('base64');
  assert.equal(signTwilioRequest(URL_, PARAMS, TOKEN), expected);
});

test('a correctly signed request is accepted whatever order the params arrive in', () => {
  const signature = signTwilioRequest(URL_, PARAMS, TOKEN);
  const shuffled = { To: PARAMS.To, Body: PARAMS.Body, From: PARAMS.From };
  assert.equal(verifyTwilioSignature({ url: URL_, params: shuffled, signature, authToken: TOKEN }), true);
});

test('FAILS CLOSED: a tampered body, url, token or signature is refused', () => {
  const signature = signTwilioRequest(URL_, PARAMS, TOKEN);
  const bad = [
    { url: URL_, params: { ...PARAMS, Body: 'the code is 418922' }, signature, authToken: TOKEN },
    { url: 'https://evil.test/api/webhooks/twilio/sms', params: PARAMS, signature, authToken: TOKEN },
    { url: URL_, params: PARAMS, signature, authToken: 'another-token' },
    { url: URL_, params: PARAMS, signature: 'nonsense', authToken: TOKEN },
    { url: URL_, params: PARAMS, signature: '', authToken: TOKEN },
    { url: URL_, params: PARAMS, signature, authToken: '' },
  ];
  for (const input of bad) {
    assert.equal(verifyTwilioSignature(input), false, JSON.stringify(input.signature).slice(0, 20));
  }
});

test('an added parameter invalidates the signature', () => {
  const signature = signTwilioRequest(URL_, PARAMS, TOKEN);
  const params = { ...PARAMS, MediaUrl0: 'https://evil.test/x.jpg' };
  assert.equal(verifyTwilioSignature({ url: URL_, params, signature, authToken: TOKEN }), false);
});

test('the webhook stays closed until both the token and the public URL are set', () => {
  assert.equal(inboundWebhookConfigured({}), false);
  assert.equal(inboundWebhookConfigured({ TWILIO_AUTH_TOKEN: TOKEN }), false);
  assert.equal(inboundWebhookConfigured({ TWILIO_AUTH_TOKEN: TOKEN, PUBLIC_URL: 'http://safespace.test' }), false);
  assert.equal(inboundWebhookConfigured({ TWILIO_AUTH_TOKEN: TOKEN, PUBLIC_URL: 'https://safespace.test' }), true);
});
