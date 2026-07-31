import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDrillActionToken,
  createEmailDrillLinks,
  createEmailVerificationToken,
  createEmailVerificationUrl,
  drillLinksConfigured,
  verifyEmailVerificationToken,
  verifyDrillActionToken,
} from './drill-links.js';

function configured() {
  process.env.DRILL_LINK_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  process.env.PUBLIC_URL = 'https://safe.example';
}

function clear() {
  delete process.env.DRILL_LINK_SECRET;
  delete process.env.PUBLIC_URL;
}

test('drill action links fail closed without a strong secret and public URL', () => {
  clear();
  assert.equal(drillLinksConfigured(), false);
  assert.throws(
    () => createDrillActionToken({ attemptId: 'attempt_1', action: 'reveal' }),
    /required/,
  );
});

test('signed drill action tokens are action-bound, tamper-resistant and expiring', () => {
  configured();
  const now = Date.parse('2026-07-30T00:00:00Z');
  const token = createDrillActionToken(
    { attemptId: 'attempt_1', action: 'reveal' },
    { now, ttlSeconds: 60 },
  );

  assert.deepEqual(
    verifyDrillActionToken(token, 'reveal', { now: now + 30_000 }),
    { attemptId: 'attempt_1', action: 'reveal' },
  );
  assert.equal(verifyDrillActionToken(token, 'report', { now }), null);
  assert.equal(verifyDrillActionToken(`${token}x`, 'reveal', { now }), null);
  assert.equal(verifyDrillActionToken(token, 'reveal', { now: now + 61_000 }), null);
  clear();
});

test('email drill links stay on the configured first-party origin', () => {
  configured();
  const links = createEmailDrillLinks('attempt_1');
  assert.match(links.revealUrl, /^https:\/\/safe\.example\/drill-reveal\?token=/);
  assert.match(links.reportUrl, /^https:\/\/safe\.example\/drill-report\?token=/);
  clear();
});

test('email verification tokens bind an opaque id without exposing an address', () => {
  configured();
  const now = Date.parse('2026-07-30T00:00:00Z');
  const email = 'judge@example.com';
  const verificationId = 'opaque-verification-id-that-is-longer-than-32-characters';
  const token = createEmailVerificationToken(
    { userId: 'usr_1', verificationId },
    { now, ttlSeconds: 60 },
  );
  assert.deepEqual(
    verifyEmailVerificationToken(token, { now: now + 30_000 }),
    { userId: 'usr_1', verificationId },
  );
  assert.equal(verifyEmailVerificationToken(token, { now: now + 61_000 }), null);

  const [encodedPayload] = token.split('.');
  const decodedPayload = JSON.parse(
    Buffer.from(encodedPayload, 'base64url').toString('utf8'),
  );
  assert.equal(decodedPayload.verificationId, verificationId);
  assert.ok(!('email' in decodedPayload));
  assert.ok(!JSON.stringify(decodedPayload).includes(email));

  const verificationUrl = createEmailVerificationUrl('usr_1', verificationId);
  assert.match(verificationUrl, /^https:\/\/safe\.example\/email-verify\?token=/);
  assert.ok(!verificationUrl.includes(email));
  assert.ok(!verificationUrl.includes(encodeURIComponent(email)));
  assert.throws(
    () => createEmailVerificationUrl('usr_1', 'too-short'),
    /opaque verificationId/,
  );
  clear();
});
