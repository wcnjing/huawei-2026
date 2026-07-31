// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'safespace-store-'));
const DATA_FILE = path.join(TEST_DIR, 'data.json');
process.env.SAFESPACE_DATA_FILE = DATA_FILE;
process.env.IDENTITY_LOOKUP_SECRET = 'store-test-identity-lookup-secret-over-32-characters';

const {
  publicUser, registerVerifiedUser, setUserEmail, detachVerifiedPhone, getUser,
  createSession, getUserIdByToken, createDrillAttempt, completeDrillAttempt,
  getDrillAttempt, markDrillAttemptSent, markDrillAttemptFailed,
  listPendingResults, peekPendingResult, ackPendingResult, applyOutcome,
  applyPracticeOutcomeOnce, DrillAttemptConflict, getDrillAttemptByActionToken,
  setUserName, beginEmailVerification, cancelEmailVerification,
  setVerifiedUserEmail, EmailVerificationConflict, reservePhoneVerificationSend,
  VerificationRateLimitConflict,
} = await import('./store.js');

const freshStore = () => fs.rmSync(DATA_FILE, { force: true });
after(() => fs.rmSync(TEST_DIR, { recursive: true, force: true }));

// Regression: user ids used to BE the phone number, which made every id-bearing
// response and URL carry PII. Ids must now be opaque and the phone kept separate.
test('registerVerifiedUser gives an opaque id, never the phone number', async () => {
  freshStore();
  const u = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  assert.ok(u.id.startsWith('usr_'), `id should be opaque, got ${u.id}`);
  assert.ok(!u.id.includes('6591234567'), 'the id must not embed the phone number');
  assert.equal(u.phone, '+6591234567', 'the phone is still stored server-side for dialling');
  freshStore();
});

test('registerVerifiedUser requires a name', async () => {
  freshStore();
  await assert.rejects(
    () => registerVerifiedUser({ phone: '+6591234567', name: '   ' }),
    /name is required/,
  );
  freshStore();
});

// Guards the PII invariant: /api/family and /api/me are world-readable, so a user
// record must never carry a phone number off the server. Regression test — these
// endpoints previously returned the raw record, leaking every registered mobile.

// Someone re-verifying (new device, cleared storage, lost session) must land back in
// the SAME account — otherwise they silently lose their XP, streak and history, and the
// leaderboard fills with duplicates of one person.
test('re-registering the same phone reuses the account and re-logs consent', async () => {
  freshStore();
  const first = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  const again = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });

  assert.equal(again.id, first.id, 'same number must map to the same account');

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const mine = Object.values(db.users).filter((u) => u.phone === '+6591234567');
  assert.equal(mine.length, 1, 'must not create a duplicate user');

  const events = db.consentEvents.filter((e) => e.userId === first.id);
  assert.equal(events.length, 2, 'each grant is its own audit event, even a repeat');
  assert.ok(events.every((e) => e.type === 'granted' && e.channel === 'otp'));
  freshStore();
});

// Everything that places a real call or sends a real message trusts this lookup. A token
// that resolves when it shouldn't is an account takeover; one that is guessable is worse.
test('new sessions persist only a digest, expire, and resolve only the bearer token', async () => {
  freshStore();
  const u = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  const token = await createSession(u.id);

  assert.equal(await getUserIdByToken(token), u.id);
  assert.equal(await getUserIdByToken('not-a-real-token'), null, 'unknown token must not resolve');
  assert.equal(await getUserIdByToken(''), null, 'empty token must not resolve');
  assert.equal(await getUserIdByToken(undefined), null, 'missing token must not resolve');

  assert.ok(token.length >= 32, `token too short to be unguessable: ${token.length} chars`);
  assert.notEqual(token, u.id, 'the token must not be derivable from the user id');
  const secondToken = await createSession(u.id);
  assert.notEqual(secondToken, token, 'each session gets a distinct token');

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  assert.ok(db.sessions[tokenHash], 'the keyed digest must resolve the session');
  assert.equal(db.sessions[token], undefined, 'the raw bearer credential must not be a key');
  assert.ok(!fs.readFileSync(DATA_FILE, 'utf-8').includes(token));
  assert.ok(Number.isFinite(Date.parse(db.sessions[tokenHash].expiresAt)));

  db.sessions[tokenHash].expiresAt = new Date(0).toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(db));
  assert.equal(await getUserIdByToken(token), null, 'an expired session must not resolve');
  freshStore();
});

test('legacy raw-key sessions inherit the configured TTL instead of living forever', async () => {
  freshStore();
  const previousTtl = process.env.SESSION_TTL_MS;
  process.env.SESSION_TTL_MS = '60000';
  try {
    const user = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    db.sessions = {
      legacy_recent: {
        userId: user.id,
        createdAt: new Date().toISOString(),
      },
      legacy_expired: {
        userId: user.id,
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
      legacy_malformed: {
        userId: user.id,
      },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(db));

    assert.equal(await getUserIdByToken('legacy_recent'), user.id);
    assert.equal(await getUserIdByToken('legacy_expired'), null);
    assert.equal(await getUserIdByToken('legacy_malformed'), null);
  } finally {
    if (previousTtl === undefined) delete process.env.SESSION_TTL_MS;
    else process.env.SESSION_TTL_MS = previousTtl;
    freshStore();
  }
});

// A registered user who skipped the optional email at sign-up can add one later, so the
// email drill has a target. Stored normalised (trimmed, lowercased) like registration does.
test('setUserEmail attaches an email to an existing user, normalised', async () => {
  freshStore();
  const u = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  assert.equal(u.email, undefined, 'starts with no email');

  const updated = await setUserEmail(u.id, '  Judge@Example.COM ');
  assert.equal(updated.email, 'judge@example.com', 'trimmed and lowercased');
  assert.equal(updated.pendingEmail, 'judge@example.com');
  assert.equal(updated.emailVerifiedAt, undefined, 'setting an address does not prove ownership');
  assert.equal((await getUser(u.id)).email, 'judge@example.com', 'persisted');

  await assert.rejects(() => setUserEmail('usr_nope', 'x@y.com'), /unknown user/);
  freshStore();
});

test('detachVerifiedPhone removes the number, withdraws consent and revokes all sessions', async () => {
  freshStore();
  const u = await registerVerifiedUser({
    phone: '+6591234567',
    name: 'Judge',
    email: 'judge@example.com',
  });
  const firstToken = await createSession(u.id);
  const secondToken = await createSession(u.id);

  const detached = await detachVerifiedPhone(u.id);
  assert.equal(detached.phone, undefined);
  assert.equal(detached.consentToDrills, false);
  assert.equal(detached.email, 'judge@example.com', 'other account data must be retained');
  assert.equal(await getUserIdByToken(firstToken), null);
  assert.equal(await getUserIdByToken(secondToken), null);

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert.ok(db.consentEvents.some(
    (event) => event.userId === u.id && event.type === 'withdrawn' && event.channel === 'account',
  ));
  await assert.rejects(() => detachVerifiedPhone('usr_nope'), /unknown user/);
  freshStore();
});

test('re-verifying a detached phone reconnects the preserved account without storing the raw number', async () => {
  freshStore();
  const original = await registerVerifiedUser({
    phone: '+6591234567',
    name: 'Judge',
    email: 'judge@example.com',
  });
  await applyPracticeOutcomeOnce({
    userId: original.id,
    clientAttemptId: 'practice-before-detach',
    outcome: 'reported',
    channel: 'sms',
  });
  const xpBeforeDetach = (await getUser(original.id)).xp;

  await detachVerifiedPhone(original.id);
  const detachedDb = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert.equal(detachedDb.users[original.id].phone, undefined);
  assert.match(detachedDb.users[original.id].phoneLookupHash, /^[a-f0-9]{64}$/);
  assert.ok(
    !JSON.stringify(detachedDb.users[original.id]).includes('+6591234567'),
    'the detached user record must not retain the raw number',
  );

  const reattached = await registerVerifiedUser({
    phone: '+6591234567',
    name: 'Judge Rejoined',
  });
  assert.equal(reattached.id, original.id, 'the OTP-proved number must reconnect its account');
  assert.equal(reattached.xp, xpBeforeDetach, 'progress must survive detachment');
  assert.equal(reattached.email, 'judge@example.com', 'email ownership state must survive detachment');
  assert.equal(reattached.consentToDrills, true);
  freshStore();
});

test('detach requires the current recovery secret and refreshes an attached legacy hash', async () => {
  freshStore();
  const configuredSecret = process.env.IDENTITY_LOOKUP_SECRET;
  try {
    const user = await registerVerifiedUser({
      phone: '+6591234567',
      name: 'Judge',
    });
    const token = await createSession(user.id);
    const before = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      .users[user.id].phoneLookupHash;

    delete process.env.IDENTITY_LOOKUP_SECRET;
    await assert.rejects(
      () => detachVerifiedPhone(user.id),
      (error) => error?.code === 'IDENTITY_RECOVERY_UNAVAILABLE',
    );
    assert.equal((await getUser(user.id)).phone, '+6591234567');
    assert.equal(await getUserIdByToken(token), user.id, 'failed detach must not revoke sessions');

    process.env.IDENTITY_LOOKUP_SECRET = `${configuredSecret}-rotated`;
    await detachVerifiedPhone(user.id);
    const detached = await getUser(user.id);
    assert.equal(detached.phone, undefined);
    assert.notEqual(detached.phoneLookupHash, before, 'attached account should migrate to the current key');

    const reattached = await registerVerifiedUser({
      phone: '+6591234567',
      name: 'Judge',
    });
    assert.equal(reattached.id, user.id);
  } finally {
    process.env.IDENTITY_LOOKUP_SECRET = configuredSecret;
    freshStore();
  }
});

test('publicUser strips phone and all email ownership state', () => {
  const safe = publicUser({
    id: 'usr_1',
    name: 'GUEST',
    phone: '+6591234567',
    phoneLookupHash: 'server-only-keyed-digest',
    email: 'guest@example.com',
    pendingEmail: 'new@example.com',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    emailVerificationRequestedAt: '2026-01-01T00:00:00.000Z',
    emailVerificationTokenHash: 'server-only-digest',
    xp: 10,
  });
  assert.equal(safe.phone, undefined);
  for (const privateField of [
    'phone',
    'phoneLookupHash',
    'email',
    'pendingEmail',
    'emailVerifiedAt',
    'emailVerificationRequestedAt',
    'emailVerificationTokenHash',
  ]) {
    assert.ok(!(privateField in safe), `${privateField} must stay server-side`);
  }
});

test('publicUser keeps everything the UI needs', () => {
  const safe = publicUser({
    id: 'usr_1', name: 'GUEST', phone: '+6591234567',
    level: 3, xp: 10, xpMax: 500, streak: 2, timesSafe: 4, timesScammed: 1,
  });
  assert.deepEqual(safe, {
    id: 'usr_1', name: 'GUEST',
    level: 3, xp: 10, xpMax: 500, streak: 2, timesSafe: 4, timesScammed: 1,
  });
});

test('publicUser does not mutate the stored record', () => {
  const stored = { id: 'usr_1', phone: '+6591234567' };
  publicUser(stored);
  assert.equal(stored.phone, '+6591234567', 'the server still needs the phone to place calls');
});

test('publicUser tolerates null/undefined', () => {
  assert.equal(publicUser(null), null);
  assert.equal(publicUser(undefined), undefined);
});

test('setUserName uses the same mandatory normalisation as registration', async () => {
  freshStore();
  const updated = await setUserName('you', '  Alice Tan  ');
  assert.equal(updated.name, 'ALICE TAN');
  assert.equal((await getUser('you')).name, 'ALICE TAN');
  await assert.rejects(() => setUserName('you', '   '), /name is required/);
  freshStore();
});

test('email verification changes ownership state only for the current pending address', async () => {
  freshStore();
  const user = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  const firstVerificationId = 'a'.repeat(43);
  const secondVerificationId = 'b'.repeat(43);
  const abandonedVerificationId = 'c'.repeat(43);
  const reselectedVerificationId = 'd'.repeat(43);

  const first = await beginEmailVerification({
    userId: user.id,
    email: ' First@Example.COM ',
    verificationId: firstVerificationId,
  });
  assert.equal(first.alreadyVerified, false);
  assert.equal(first.user.pendingEmail, 'first@example.com');
  assert.equal(first.user.emailVerifiedAt, undefined);
  assert.equal(first.user.emailVerificationTokenHash, crypto
    .createHash('sha256')
    .update(firstVerificationId)
    .digest('hex'));
  assert.ok(
    !fs.readFileSync(DATA_FILE, 'utf8').includes(firstVerificationId),
    'the opaque verification credential must be stored only as a digest',
  );

  await assert.rejects(
    () => beginEmailVerification({
      userId: user.id,
      email: 'first@example.com',
      verificationId: 'e'.repeat(43),
    }),
    (error) => error instanceof EmailVerificationConflict
      && error.code === 'EMAIL_VERIFICATION_CONFLICT'
      && error.retryAfterMs > 0,
  );

  await beginEmailVerification({
    userId: user.id,
    email: 'second@example.com',
    verificationId: secondVerificationId,
    cooldownMs: 0,
  });
  await assert.rejects(
    () => setVerifiedUserEmail(user.id, firstVerificationId),
    (error) => error.code === 'EMAIL_VERIFICATION_STALE',
  );

  const verified = await setVerifiedUserEmail(user.id, secondVerificationId);
  assert.equal(verified.email, 'second@example.com');
  assert.ok(Number.isFinite(Date.parse(verified.emailVerifiedAt)));
  assert.equal(verified.pendingEmail, undefined);
  assert.equal(verified.emailVerificationRequestedAt, undefined);
  assert.equal(verified.emailVerificationTokenHash, undefined);

  await beginEmailVerification({
    userId: user.id,
    email: 'abandoned@example.com',
    verificationId: abandonedVerificationId,
    cooldownMs: 0,
  });
  assert.equal((await getUser(user.id)).pendingEmail, 'abandoned@example.com');

  const alreadyVerified = await beginEmailVerification({
    userId: user.id,
    email: 'second@example.com',
    verificationId: reselectedVerificationId,
  });
  assert.equal(alreadyVerified.alreadyVerified, true);
  assert.equal(alreadyVerified.user.pendingEmail, undefined);
  assert.equal(alreadyVerified.user.emailVerificationRequestedAt, undefined);
  assert.equal(alreadyVerified.user.emailVerificationTokenHash, undefined);
  await assert.rejects(
    () => setVerifiedUserEmail(user.id, abandonedVerificationId),
    (error) => error.code === 'EMAIL_VERIFICATION_STALE',
  );

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert.ok(db.consentEvents.some(
    (event) => event.userId === user.id
      && event.type === 'email-verified'
      && event.channel === 'email',
  ));
  freshStore();
});

test('a failed verification send can release only its matching pending reservation', async () => {
  freshStore();
  const user = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  const firstVerificationId = 'f'.repeat(43);
  const newerVerificationId = 'g'.repeat(43);
  await beginEmailVerification({
    userId: user.id,
    email: 'current@example.com',
    verificationId: firstVerificationId,
  });

  await cancelEmailVerification(
    user.id,
    'different@example.com',
    firstVerificationId,
  );
  assert.equal((await getUser(user.id)).pendingEmail, 'current@example.com');

  // A newer request for the same address must survive request A failing late.
  await beginEmailVerification({
    userId: user.id,
    email: 'current@example.com',
    verificationId: newerVerificationId,
    cooldownMs: 0,
  });
  await cancelEmailVerification(
    user.id,
    'CURRENT@example.com',
    firstVerificationId,
  );
  assert.equal((await getUser(user.id)).pendingEmail, 'current@example.com');
  assert.equal(
    (await getUser(user.id)).emailVerificationTokenHash,
    crypto.createHash('sha256').update(newerVerificationId).digest('hex'),
  );

  await cancelEmailVerification(
    user.id,
    'CURRENT@example.com',
    newerVerificationId,
  );
  assert.equal((await getUser(user.id)).pendingEmail, undefined);
  assert.equal((await getUser(user.id)).emailVerificationRequestedAt, undefined);
  freshStore();
});

test('email verification enforces durable per-account and per-destination limits', async () => {
  freshStore();
  const now = Date.parse('2026-07-30T00:00:00.000Z');
  const first = await registerVerifiedUser({ phone: '+6591234567', name: 'First' });

  for (let i = 0; i < 2; i += 1) {
    await beginEmailVerification({
      userId: first.id,
      email: `account-${i}@example.com`,
      verificationId: String(i).repeat(43),
      cooldownMs: 0,
      now: now + i,
      maxAccountSends: 2,
      maxDestinationSends: 3,
    });
  }
  await assert.rejects(
    () => beginEmailVerification({
      userId: first.id,
      email: 'account-limit@example.com',
      verificationId: 'z'.repeat(43),
      cooldownMs: 0,
      now: now + 2,
      maxAccountSends: 2,
      maxDestinationSends: 3,
    }),
    (error) => error instanceof EmailVerificationConflict
      && error.retryAfterMs > 0,
  );

  freshStore();
  const users = await Promise.all([
    registerVerifiedUser({ phone: '+6590000001', name: 'One' }),
    registerVerifiedUser({ phone: '+6590000002', name: 'Two' }),
    registerVerifiedUser({ phone: '+6590000003', name: 'Three' }),
  ]);
  for (let i = 0; i < 2; i += 1) {
    await beginEmailVerification({
      userId: users[i].id,
      email: 'shared@example.com',
      verificationId: String(i + 3).repeat(43),
      cooldownMs: 0,
      now: now + i,
      maxAccountSends: 5,
      maxDestinationSends: 2,
    });
  }
  await assert.rejects(
    () => beginEmailVerification({
      userId: users[2].id,
      email: 'shared@example.com',
      verificationId: 'y'.repeat(43),
      cooldownMs: 0,
      now: now + 2,
      maxAccountSends: 5,
      maxDestinationSends: 2,
    }),
    (error) => error instanceof EmailVerificationConflict
      && error.retryAfterMs > 0,
  );

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert.ok(db.verificationRateLimits['email-account']);
  assert.ok(db.verificationRateLimits['email-destination']);
  assert.ok(!Object.keys(db.verificationRateLimits['email-destination'])
    .some((key) => key.includes('shared@example.com')));
  freshStore();
});

test('phone verification send limits are durable and destination-scoped', async () => {
  freshStore();
  const now = Date.parse('2026-07-30T00:00:00.000Z');
  await reservePhoneVerificationSend({
    phone: '+6591234567',
    now,
    cooldownMs: 0,
    maxSends: 2,
  });
  await reservePhoneVerificationSend({
    phone: '+6591234567',
    now: now + 1,
    cooldownMs: 0,
    maxSends: 2,
  });
  await assert.rejects(
    () => reservePhoneVerificationSend({
      phone: '+6591234567',
      now: now + 2,
      cooldownMs: 0,
      maxSends: 2,
    }),
    (error) => error instanceof VerificationRateLimitConflict
      && error.code === 'VERIFICATION_RATE_LIMITED'
      && error.retryAfterMs > 0,
  );
  await reservePhoneVerificationSend({
    phone: '+6597654321',
    now: now + 2,
    cooldownMs: 0,
    maxSends: 2,
  });

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert.ok(db.verificationRateLimits['phone-destination']);
  assert.ok(!JSON.stringify(db.verificationRateLimits).includes('+6591234567'));
  freshStore();
});

test('phone verification also caps one requester across rotating destinations', async () => {
  freshStore();
  const now = Date.parse('2026-07-30T00:00:00.000Z');
  for (let i = 0; i < 2; i += 1) {
    await reservePhoneVerificationSend({
      phone: `+659000001${i}`,
      requesterKey: '203.0.113.10',
      now: now + i,
      cooldownMs: 0,
      maxRequesterSends: 2,
    });
  }
  await assert.rejects(
    () => reservePhoneVerificationSend({
      phone: '+6590000012',
      requesterKey: '203.0.113.10',
      now: now + 2,
      cooldownMs: 0,
      maxRequesterSends: 2,
    }),
    (error) => error instanceof VerificationRateLimitConflict
      && error.code === 'VERIFICATION_RATE_LIMITED'
      && error.retryAfterMs > 0,
  );
  await reservePhoneVerificationSend({
    phone: '+6590000013',
    requesterKey: '203.0.113.11',
    now: now + 2,
    cooldownMs: 0,
    maxRequesterSends: 2,
  });

  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  assert.ok(db.verificationRateLimits['phone-requester']);
  assert.ok(!JSON.stringify(db.verificationRateLimits).includes('203.0.113.10'));
  freshStore();
});

test('email ownership reservation rejects missing or short opaque verification ids', async () => {
  freshStore();
  const user = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  await assert.rejects(
    () => beginEmailVerification({
      userId: user.id,
      email: 'judge@example.com',
    }),
    /opaque verificationId/,
  );
  await assert.rejects(
    () => beginEmailVerification({
      userId: user.id,
      email: 'judge@example.com',
      verificationId: 'too-short',
    }),
    /opaque verificationId/,
  );
  freshStore();
});

test('a provider attempt is reserved, sent and looked up by either id', async () => {
  freshStore();
  const created = await createDrillAttempt({ userId: 'you', channel: 'call' });
  assert.equal(created.status, 'created');
  assert.equal(created.providerId, null);

  const sent = await markDrillAttemptSent(created.id, { providerId: 'call_123' });
  assert.equal(sent.status, 'sent');
  assert.equal(sent.providerId, 'call_123');
  assert.equal((await getDrillAttempt(created.id)).id, created.id);
  assert.equal((await getDrillAttempt('call_123')).id, created.id);
  freshStore();
});

test('completing a provider attempt applies its outcome exactly once', async () => {
  freshStore();
  const attempt = await createDrillAttempt({
    userId: 'you',
    channel: 'call',
    providerId: 'call_once',
    status: 'sent',
  });
  const before = await getUser('you');

  const [first, replay] = await Promise.all([
    completeDrillAttempt({ providerId: 'call_once', outcome: 'hung_up' }),
    completeDrillAttempt({ providerId: 'call_once', outcome: 'hung_up' }),
  ]);
  assert.deepEqual(
    [first.status, replay.status].sort(),
    ['completed', 'duplicate'],
  );
  assert.equal([first.applied, replay.applied].filter(Boolean).length, 1);

  const afterUser = await getUser('you');
  assert.equal(afterUser.timesSafe, before.timesSafe + 1);
  assert.equal(afterUser.timesScammed, before.timesScammed);
  assert.equal((await getDrillAttempt(attempt.id)).status, 'completed');
  assert.equal((await listPendingResults('you')).length, 1);
  freshStore();
});

test('unknown provider calls cannot mutate any user or queue a result', async () => {
  freshStore();
  const before = await getUser('you');
  const result = await completeDrillAttempt({
    providerId: 'call_not_ours',
    outcome: 'shared_data',
  });
  const afterUser = await getUser('you');

  assert.equal(result.status, 'unknown');
  assert.equal(result.applied, false);
  assert.deepEqual(afterUser, before);
  assert.deepEqual(await listPendingResults('you'), []);
  freshStore();
});

test('an operational call failure is unscored and remains pending until ACK', async () => {
  freshStore();
  const attempt = await createDrillAttempt({
    userId: 'you',
    channel: 'call',
    providerId: 'call_no_answer',
    status: 'sent',
  });
  const before = await getUser('you');
  const result = await completeDrillAttempt({
    providerId: 'call_no_answer',
    outcome: null,
    unscoredReason: 'no_answer',
  });

  assert.equal(result.status, 'unscored');
  assert.equal(result.applied, false);
  assert.equal(result.attempt.status, 'failed');
  assert.equal(result.attempt.failureReason, 'no_answer');
  assert.deepEqual(await getUser('you'), before);
  const pending = await peekPendingResult('you');
  assert.equal(pending.id, result.record.id);
  assert.equal(pending.result, 'UNSCORED');
  assert.equal(pending.screen, null);
  assert.equal(pending.xpGained, 0);
  assert.equal(pending.unscoredReason, 'no_answer');
  assert.equal((await peekPendingResult('you')).id, pending.id, 'reads do not consume it');
  assert.equal((await ackPendingResult('you', pending.id)).id, pending.id);
  assert.deepEqual(await listPendingResults('you'), []);
  assert.equal((await getDrillAttempt(attempt.id)).scored, false);
  freshStore();
});

test('a distress safety exit remains neutral but is visible until the client ACKs it', async () => {
  freshStore();
  const attempt = await createDrillAttempt({
    userId: 'you',
    channel: 'call',
    providerId: 'call_distress',
    status: 'sent',
  });
  const before = await getUser('you');
  const result = await completeDrillAttempt({
    providerId: 'call_distress',
    outcome: 'distress_offramp',
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.applied, true);
  assert.equal(result.record.result, 'SAFE');
  assert.equal(result.record.screen, null);
  assert.equal(result.record.xpGained, 0);
  assert.deepEqual(await getUser('you'), before, 'distress must not alter XP or streak');
  assert.equal((await getDrillAttempt(attempt.id)).status, 'completed');

  const pending = await peekPendingResult('you');
  assert.equal(pending.id, result.record.id);
  assert.equal(pending.result, 'SAFE');
  assert.equal((await peekPendingResult('you')).id, pending.id);
  assert.equal((await ackPendingResult('you', pending.id)).id, pending.id);
  assert.equal(await peekPendingResult('you'), null);
  freshStore();
});

test('pending results survive reads and disappear only after an explicit matching ACK', async () => {
  freshStore();
  await applyOutcome({ userId: 'you', outcome: 'hung_up', practice: false });
  await applyOutcome({ userId: 'you', outcome: 'caught_flag', practice: false });

  const firstRead = await peekPendingResult('you');
  const secondRead = await peekPendingResult('you');
  assert.equal(secondRead.id, firstRead.id, 'peeking must not consume the result');
  assert.equal((await listPendingResults('you')).length, 2);
  assert.equal(await ackPendingResult('you', 'not-the-result'), null);
  assert.equal((await listPendingResults('you')).length, 2);

  const acknowledged = await ackPendingResult('you', firstRead.id);
  assert.equal(acknowledged.id, firstRead.id);
  assert.equal((await listPendingResults('you')).length, 1);
  assert.notEqual((await peekPendingResult('you')).id, firstRead.id);
  freshStore();
});

test('practice client attempt ids prevent double-click XP farming', async () => {
  freshStore();
  const before = await getUser('you');
  const results = await Promise.all([
    applyPracticeOutcomeOnce({
      userId: 'you',
      clientAttemptId: 'practice_123',
      outcome: 'hung_up',
    }),
    applyPracticeOutcomeOnce({
      userId: 'you',
      clientAttemptId: 'practice_123',
      outcome: 'hung_up',
    }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['completed', 'duplicate']);
  assert.equal(results[0].record.id, results[1].record.id);
  assert.equal(results[0].record.outcome, 'hung_up');
  assert.equal((await getUser('you')).timesSafe, before.timesSafe + 1);
  freshStore();
});

test('attempt action tokens are stored hashed and can be used only once', async () => {
  freshStore();
  const attempt = await createDrillAttempt({
    userId: 'you',
    channel: 'email',
    mintActionToken: true,
  });
  assert.ok(attempt.actionToken);
  assert.equal((await getDrillAttemptByActionToken(attempt.actionToken)).id, attempt.id);

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  assert.ok(!raw.includes(attempt.actionToken), 'raw action token must never be persisted');
  const completed = await completeDrillAttempt({
    actionToken: attempt.actionToken,
    outcome: 'reported',
  });
  assert.equal(completed.status, 'completed');
  assert.equal(await getDrillAttemptByActionToken(attempt.actionToken), null);
  assert.equal(
    (await completeDrillAttempt({ actionToken: attempt.actionToken, outcome: 'reported' })).status,
    'unknown',
  );
  freshStore();
});

test('cooldown and one-active-attempt checks are atomic and recognizable', async () => {
  freshStore();
  const first = await createDrillAttempt({
    userId: 'you',
    channel: 'sms',
    cooldownMs: 60_000,
  });
  await assert.rejects(
    () => createDrillAttempt({ userId: 'you', channel: 'sms', cooldownMs: 60_000 }),
    (error) => error instanceof DrillAttemptConflict
      && error.code === 'DRILL_ATTEMPT_CONFLICT'
      && error.attempt.id === first.id,
  );
  await markDrillAttemptFailed(first.id, { reason: 'provider_error' });
  await assert.rejects(
    () => createDrillAttempt({ userId: 'you', channel: 'sms', cooldownMs: 60_000 }),
    (error) => error.code === 'DRILL_ATTEMPT_CONFLICT' && error.retryAfterMs > 0,
  );
  freshStore();
});

test('file writes are complete atomic replacements with no leftover temp file', async () => {
  freshStore();
  await setUserName('you', 'Atomic');
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')));
  assert.deepEqual(
    fs.readdirSync(TEST_DIR).filter((name) => name.endsWith('.tmp')),
    [],
  );
  freshStore();
});
