// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailConfigured, sendDrillEmail } from './email.js';

function clearEmailEnv() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_SCRIPT_URL;
  delete process.env.GOOGLE_SCRIPT_SECRET;
}

// The Apps Script web app is deployed with access "Anyone", so the shared secret is the
// only thing between that public URL and an open mail relay. Sending without it must be
// impossible — not merely discouraged.
test('a URL and generator without the shared secret is NOT configured', () => {
  clearEmailEnv();
  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.GOOGLE_SCRIPT_URL = 'https://script.google.com/exec';
  assert.equal(emailConfigured(), false, 'no secret -> must refuse to send');
  process.env.GOOGLE_SCRIPT_SECRET = 's3cret';
  assert.equal(emailConfigured(), true);
  clearEmailEnv();
});

test('emailConfigured requires ALL THREE of generator, sender and secret', () => {
  clearEmailEnv();
  assert.equal(emailConfigured(), false);

  process.env.OPENAI_API_KEY = 'sk-test';
  assert.equal(emailConfigured(), false, 'a generator with no sender is not configured');

  clearEmailEnv();
  process.env.GOOGLE_SCRIPT_URL = 'https://example.com/send';
  assert.equal(emailConfigured(), false, 'a sender with no generator is not configured');

  process.env.OPENAI_API_KEY = 'sk-test';
  process.env.GOOGLE_SCRIPT_SECRET = 's3cret';
  assert.equal(emailConfigured(), true);
  clearEmailEnv();
});

// The security control: an unconfigured deploy must never silently send anything.
test('FAILS CLOSED: sendDrillEmail refuses when unconfigured', async () => {
  clearEmailEnv();
  await assert.rejects(() => sendDrillEmail({ to: 'someone@example.com' }), {
    code: 'EMAIL_UNAVAILABLE',
  });
});

test('FAILS CLOSED: a partial config still refuses (no half-send)', async () => {
  clearEmailEnv();
  process.env.OPENAI_API_KEY = 'sk-test'; // sender missing
  await assert.rejects(() => sendDrillEmail({ to: 'someone@example.com' }), {
    code: 'EMAIL_UNAVAILABLE',
  });
  clearEmailEnv();
});
