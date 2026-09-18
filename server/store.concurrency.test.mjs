// Run with: npm run test:pg   (CI runs these on every push)
//
// Races that only a real Postgres server can run. PGlite has a single connection, so its
// transactions queue and never overlap. Without TEST_DATABASE_URL these report as
// skipped rather than passing.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { computeResult } from './xp.js';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

const skip = process.env.TEST_DATABASE_URL
  ? false
  : 'needs a real Postgres: run `npm run test:pg`';
process.env.IDENTITY_LOOKUP_SECRET = 'concurrency-test-identity-lookup-secret-32chars';

await setupTestDb();
after(teardownTestDb);
const store = await import('./store.js');
const { query } = await import('./db.js');

const race = (count, fn) => Promise.allSettled(Array.from({ length: count }, (_, i) => fn(i)));
const fulfilled = (results) => results.filter((result) => result.status === 'fulfilled');
const rejected = (results) => results.filter((result) => result.status === 'rejected');

test('20 concurrent outcomes for one user lose no XP', { skip }, async () => {
  await resetDb();
  const before = await store.getUser('you');
  const results = await race(20, () => store.applyOutcome({ userId: 'you', outcome: 'hung_up' }));
  assert.equal(fulfilled(results).length, 20);

  // The same 20 outcomes applied one at a time, with the store's level-up rule.
  const expected = { xp: before.xp, xpMax: before.xpMax, level: before.level };
  for (let i = 0; i < 20; i += 1) {
    expected.xp += computeResult('hung_up').xp;
    while (expected.xp >= expected.xpMax) {
      expected.xp -= expected.xpMax;
      expected.level += 1;
      expected.xpMax = Math.round(expected.xpMax * 1.2);
    }
  }
  const after = await store.getUser('you');
  assert.deepEqual(
    { xp: after.xp, xpMax: after.xpMax, level: after.level, timesSafe: after.timesSafe },
    { ...expected, timesSafe: before.timesSafe + 20 },
  );
  assert.equal((await store.listPendingResults('you')).length, 20);
});

test('concurrent drill starts inside the cooldown: exactly one wins', { skip }, async () => {
  await resetDb();
  const results = await race(10, () =>
    store.createDrillAttempt({ userId: 'you', channel: 'call', cooldownMs: 60_000 }));
  assert.equal(fulfilled(results).length, 1);
  assert.ok(rejected(results).every((result) => result.reason instanceof store.DrillAttemptConflict));
  const { rows } = await query('select count(*) as n from safespace.drill_attempts');
  assert.equal(Number(rows[0].n), 1);
});

test('concurrent OTP sends to one number never exceed the cap', { skip }, async () => {
  await resetDb();
  const results = await race(12, () =>
    store.reservePhoneVerificationSend({ phone: '+6591234567', cooldownMs: 0, maxSends: 3 }));
  assert.equal(fulfilled(results).length, 3);
  assert.ok(rejected(results).every((result) => result.reason?.code === 'VERIFICATION_RATE_LIMITED'));
});

test('one webhook delivered many times at once is scored exactly once', { skip }, async () => {
  await resetDb();
  await store.createDrillAttempt({ userId: 'you', channel: 'call', providerId: 'call_race', status: 'sent' });
  const before = await store.getUser('you');
  const results = await race(10, () =>
    store.completeDrillAttempt({ providerId: 'call_race', outcome: 'hung_up' }));
  const statuses = fulfilled(results).map((result) => result.value.status);
  assert.equal(statuses.length, 10);
  assert.equal(statuses.filter((status) => status === 'completed').length, 1);
  assert.equal(statuses.filter((status) => status === 'duplicate').length, 9);
  assert.equal((await store.getUser('you')).timesSafe, before.timesSafe + 1);
  assert.equal((await store.listPendingResults('you')).length, 1);
});

test('simultaneous OTP checks for one new number create one account', { skip }, async () => {
  await resetDb();
  const results = await race(10, () =>
    store.registerVerifiedUser({ phone: '+6590000099', name: 'Racer' }));
  assert.equal(fulfilled(results).length, 10);
  assert.equal(new Set(fulfilled(results).map((result) => result.value.id)).size, 1);
  const { rows } = await query('select count(*) as n from safespace.users where phone = $1', ['+6590000099']);
  assert.equal(Number(rows[0].n), 1);
});

test('a double-clicked practice result is scored once', { skip }, async () => {
  await resetDb();
  const before = await store.getUser('you');
  const results = await race(10, () => store.applyPracticeOutcomeOnce({
    userId: 'you', clientAttemptId: 'practice_race', outcome: 'hung_up',
  }));
  const statuses = fulfilled(results).map((result) => result.value.status);
  assert.equal(statuses.filter((status) => status === 'completed').length, 1);
  assert.equal(statuses.filter((status) => status === 'duplicate').length, 9);
  assert.equal((await store.getUser('you')).timesSafe, before.timesSafe + 1);
});
