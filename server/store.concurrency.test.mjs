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

const houses = await import('./houses.js');
let racePhone = 0;
const racer = (name) => {
  racePhone += 1;
  return store.registerVerifiedUser({ phone: `+659300${String(racePhone).padStart(4, '0')}`, name });
};
async function raceHouse(size) {
  const owner = await racer('Owner');
  await houses.createHouse(owner.id, 'Race House');
  const code = (await houses.getHouseView(owner.id)).house.inviteCode;
  for (let i = 1; i < size; i += 1) await houses.joinHouse((await racer(`M${i}`)).id, code);
  return { owner, code };
}
async function houseInvariants() {
  const { rows } = await query(
    `select h.id, h.owner_id, count(m.user_id) as n, bool_or(m.user_id = h.owner_id) as owner_is_member
       from safespace.houses h left join safespace.house_members m on m.house_id = h.id
      group by h.id, h.owner_id`,
  );
  for (const row of rows) {
    assert.ok(Number(row.n) >= 1 && Number(row.n) <= houses.HOUSE_MAX_MEMBERS, `house size ${row.n}`);
    assert.equal(row.owner_is_member, true, 'the owner must be a member');
  }
  const perUser = await query(
    `select u.id, u.house_id, count(m.house_id) as n, bool_or(m.house_id = u.house_id) as active_is_member
       from safespace.users u left join safespace.house_members m on m.user_id = u.id
      group by u.id, u.house_id`,
  );
  for (const row of perUser.rows) {
    assert.ok(Number(row.n) <= houses.HOUSES_PER_USER, `${row.id} is in ${row.n} houses`);
    if (row.house_id) assert.equal(row.active_is_member, true, `${row.id}'s active house must be one of theirs`);
    else assert.equal(Number(row.n), 0, `${row.id} has houses but none active`);
  }
  return rows;
}

test('7 people joining a house of 5 at once: exactly one gets in', { skip }, async () => {
  await resetDb();
  const { owner, code } = await raceHouse(5);
  const joiners = await Promise.all(Array.from({ length: 7 }, (_, i) => racer(`J${i}`)));
  const results = await race(7, (i) => houses.joinHouse(joiners[i].id, code));
  assert.equal(fulfilled(results).length, 1);
  assert.ok(rejected(results).every((r) => r.reason?.code === 'HOUSE_FULL'));
  assert.equal((await houses.getHouseView(owner.id)).house.members.length, 6);
  await houseInvariants();
});

test('someone with 2 houses joining two more at once ends up in exactly 3', { skip }, async () => {
  await resetDb();
  const p = await racer('Double');
  await houses.createHouse(p.id, 'One');
  await houses.createHouse(p.id, 'Two');
  const a = await raceHouse(1);
  const b = await raceHouse(1);
  const results = await Promise.allSettled([houses.joinHouse(p.id, a.code), houses.joinHouse(p.id, b.code)]);
  assert.equal(fulfilled(results).length, 1);
  assert.equal(rejected(results)[0].reason?.code, 'HOUSE_LIMIT');
  assert.equal((await houses.getHouseView(p.id)).houses.length, 3);
  await houseInvariants();
});

test('the owner leaving while others join leaves a valid owner', { skip }, async () => {
  await resetDb();
  const { owner, code } = await raceHouse(2);
  const joiners = await Promise.all(Array.from({ length: 3 }, (_, i) => racer(`L${i}`)));
  const results = await Promise.allSettled([
    houses.leaveHouse(owner.id),
    ...joiners.map((j) => houses.joinHouse(j.id, code)),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  const rows = await houseInvariants();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].owner_id, owner.id);
});

test('the last member leaving while someone joins never strands the joiner', { skip }, async () => {
  await resetDb();
  const { owner, code } = await raceHouse(1);
  const joiner = await racer('Late');
  const [leave, join] = await Promise.allSettled([houses.leaveHouse(owner.id), houses.joinHouse(joiner.id, code)]);
  assert.equal(leave.status, 'fulfilled');
  const rows = await houseInvariants();
  if (join.status === 'fulfilled') {
    assert.equal(rows.length, 1);
    assert.equal(rows[0].owner_id, joiner.id);
  } else {
    assert.equal(join.reason?.code, 'CODE_INVALID');
    assert.equal(rows.length, 0);
  }
});

test('someone with 2 houses creating one while joining another ends up in exactly 3', { skip }, async () => {
  await resetDb();
  // createHouse takes no rate-limit advisory lock, so only the user row lock keeps this
  // race honest; run several rounds so the window actually gets hit.
  for (let round = 0; round < 10; round += 1) {
    const { code } = await raceHouse(1);
    const p = await racer('Creator');
    await houses.createHouse(p.id, 'One');
    await houses.createHouse(p.id, 'Two');
    const results = await Promise.allSettled([
      houses.createHouse(p.id, 'Mine'),
      houses.joinHouse(p.id, code),
    ]);
    assert.equal(fulfilled(results).length, 1, `round ${round}`);
    assert.equal(rejected(results)[0].reason?.code, 'HOUSE_LIMIT', `round ${round}`);
    const { rows } = await query('select count(*) as n from safespace.house_members where user_id = $1', [p.id]);
    assert.equal(Number(rows[0].n), 3, `round ${round}: p should end up with exactly 3 houses`);
  }
  await houseInvariants();
});
