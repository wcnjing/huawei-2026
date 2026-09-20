// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

process.env.IDENTITY_LOOKUP_SECRET = 'houses-test-identity-lookup-secret-over-32-chars';
await setupTestDb();
after(teardownTestDb);

const { registerVerifiedUser, applyOutcome, getUser } = await import('./store.js');
const houses = await import('./houses.js');
const { query } = await import('./db.js');

const DAY = 24 * 60 * 60 * 1000;
let phoneSeq = 0;
async function player(name = 'Player') {
  phoneSeq += 1;
  return registerVerifiedUser({ phone: `+659200${String(phoneSeq).padStart(4, '0')}`, name });
}
async function codeOf(userId) {
  return (await houses.getHouseView(userId)).house.inviteCode;
}
// Joins are spaced one second apart, in the past, so join order (which decides the next
// owner) is deterministic and later real-time joins sort after them.
async function houseWith(count) {
  const t0 = Date.now() - 60_000;
  const owner = await player('Owner');
  await houses.createHouse(owner.id, 'The Tans', { now: new Date(t0) });
  const code = await codeOf(owner.id);
  const members = [owner];
  for (let i = 1; i < count; i += 1) {
    const p = await player(`M${i}`);
    await houses.joinHouse(p.id, code, { now: new Date(t0 + i * 1000) });
    members.push(p);
  }
  return { owner, members, code };
}
const rejectsWith = (fn, code) => assert.rejects(fn, (error) => error.code === code);

test('solo players have a self view and no house', async () => {
  await resetDb();
  const p = await player('Solo');
  const view = await houses.getHouseView(p.id);
  assert.equal(view.house, null);
  assert.equal(view.self.id, p.id);
  assert.equal(view.self.name, 'SOLO');
  assert.equal(view.self.activeThisWeek, false);
  assert.equal(view.self.safeThisWeek, true);
});

test('create makes the creator owner with a live 24h code', async () => {
  await resetDb();
  const p = await player('Owner');
  const now = new Date('2026-09-22T02:00:00Z');
  const created = await houses.createHouse(p.id, '  the   tans ', { now });
  const { house } = await houses.getHouseView(p.id, { now });
  assert.equal(house.id, created.houseId);
  assert.equal(house.name, 'THE TANS');
  assert.equal(house.ownerId, p.id);
  assert.match(house.inviteCode, /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/);
  assert.equal(house.inviteExpiresAt, new Date(now.getTime() + DAY).toISOString());
  assert.deepEqual(created.ring, [house.doorbell]);
  assert.deepEqual(house.members.map((m) => [m.id, m.isOwner]), [[p.id, true]]);
  await rejectsWith(() => houses.createHouse(p.id, 'Second'), 'ALREADY_IN_HOUSE');
});

test('house names are validated', async () => {
  await resetDb();
  const p = await player();
  await rejectsWith(() => houses.createHouse(p.id, '   '), 'INVALID_HOUSE_NAME');
  await rejectsWith(() => houses.createHouse(p.id, 'x'.repeat(31)), 'INVALID_HOUSE_NAME');
  await rejectsWith(() => houses.createHouse(p.id, '<b>hi</b>'), 'INVALID_HOUSE_NAME');
});

test('join accepts any case and dash, and caps the house at 6', async () => {
  await resetDb();
  const { code, members } = await houseWith(5);
  const sixth = await player('Sixth');
  await houses.joinHouse(sixth.id, code.toLowerCase().replace('-', ' '));
  const view = await houses.getHouseView(sixth.id);
  assert.equal(view.house.members.length, 6);
  assert.deepEqual(view.house.members.map((m) => m.id), [...members.map((m) => m.id), sixth.id]);
  const seventh = await player('Seventh');
  await rejectsWith(() => houses.joinHouse(seventh.id, code), 'HOUSE_FULL');
});

test('wrong, expired and replaced codes are all CODE_INVALID', async () => {
  await resetDb();
  const owner = await player('Owner');
  const now = new Date('2026-09-22T02:00:00Z');
  await houses.createHouse(owner.id, 'Tans', { now });
  const oldCode = (await houses.getHouseView(owner.id, { now })).house.inviteCode;
  const joiner = await player('Joiner');
  await rejectsWith(() => houses.joinHouse(joiner.id, 'ZZZ-ZZZ', { now }), 'CODE_INVALID');
  await rejectsWith(() => houses.joinHouse(joiner.id, 'nonsense', { now }), 'CODE_INVALID');
  const later = new Date(now.getTime() + DAY + 1000);
  await rejectsWith(() => houses.joinHouse(joiner.id, oldCode, { now: later }), 'CODE_INVALID');
  await houses.regenerateInviteCode(owner.id, { now });
  await rejectsWith(() => houses.joinHouse(joiner.id, oldCode, { now }), 'CODE_INVALID');
  const newCode = (await houses.getHouseView(owner.id, { now })).house.inviteCode;
  assert.notEqual(newCode, oldCode);
  await houses.joinHouse(joiner.id, newCode, { now });
});

test('an expired code is hidden from the house view', async () => {
  await resetDb();
  const owner = await player('Owner');
  const now = new Date('2026-09-22T02:00:00Z');
  await houses.createHouse(owner.id, 'Tans', { now });
  const later = new Date(now.getTime() + DAY + 1000);
  const { house } = await houses.getHouseView(owner.id, { now: later });
  assert.equal(house.inviteCode, null);
  assert.equal(house.inviteExpiresAt, null);
});

test('10 wrong codes per account per hour, then JOIN_RATE_LIMITED', async () => {
  await resetDb();
  const { code } = await houseWith(1);
  const guesser = await player('Guesser');
  for (let i = 0; i < 10; i += 1) {
    await rejectsWith(() => houses.joinHouse(guesser.id, 'ZZZ-ZZZ'), 'CODE_INVALID');
  }
  await assert.rejects(
    () => houses.joinHouse(guesser.id, code),
    (error) => error.code === 'JOIN_RATE_LIMITED' && error.retryAfterMs > 0,
  );
});

test('30 wrong codes per network address per hour', async () => {
  await resetDb();
  const requesterKey = '203.0.113.9';
  for (let i = 0; i < 30; i += 1) {
    const p = await player(`G${i}`);
    await rejectsWith(() => houses.joinHouse(p.id, 'ZZZ-ZZZ', { requesterKey }), 'CODE_INVALID');
  }
  const last = await player('Last');
  await rejectsWith(() => houses.joinHouse(last.id, 'ZZZ-ZZZ', { requesterKey }), 'JOIN_RATE_LIMITED');
});

test('only the owner regenerates, renames and removes', async () => {
  await resetDb();
  const { owner, members } = await houseWith(2);
  const member = members[1];
  await rejectsWith(() => houses.regenerateInviteCode(member.id), 'NOT_OWNER');
  await rejectsWith(() => houses.renameHouse(member.id, 'Mine'), 'NOT_OWNER');
  await rejectsWith(() => houses.removeMember(member.id, owner.id), 'NOT_OWNER');
  await houses.renameHouse(owner.id, 'New Name');
  assert.equal((await houses.getHouseView(member.id)).house.name, 'NEW NAME');
  await rejectsWith(() => houses.removeMember(owner.id, owner.id), 'CANNOT_REMOVE_SELF');
  const stranger = await player('Stranger');
  await rejectsWith(() => houses.removeMember(owner.id, stranger.id), 'NOT_A_MEMBER');
});

test('removing a member rotates the doorbell and rings the old one', async () => {
  await resetDb();
  const { owner, members } = await houseWith(3);
  const before = (await houses.getHouseView(owner.id)).house.doorbell;
  const result = await houses.removeMember(owner.id, members[1].id);
  assert.deepEqual(result.ring, [before]);
  const after = (await houses.getHouseView(owner.id)).house;
  assert.notEqual(after.doorbell, before);
  assert.equal(after.members.length, 2);
  assert.equal((await houses.getHouseView(members[1].id)).house, null);
  assert.equal(await houses.doorbellForUser(members[1].id), null);
});

test('leaving rotates the doorbell and rings the old one', async () => {
  await resetDb();
  const { owner, members } = await houseWith(3);
  const before = (await houses.getHouseView(owner.id)).house.doorbell;
  const result = await houses.leaveHouse(members[1].id);
  assert.deepEqual(result.ring, [before]);
  const after = (await houses.getHouseView(owner.id)).house;
  assert.notEqual(after.doorbell, before, 'a voluntary leaver must stop hearing this house');
  assert.equal(after.members.length, 2);
  assert.equal(await houses.doorbellForUser(members[1].id), null);
});

test('an owner leaving hands the house to the earliest joiner', async () => {
  await resetDb();
  const { owner, members } = await houseWith(3);
  await houses.leaveHouse(owner.id);
  const { house } = await houses.getHouseView(members[1].id);
  assert.equal(house.ownerId, members[1].id);
  assert.deepEqual(house.members.map((m) => m.id), [members[1].id, members[2].id]);
  assert.equal((await houses.getHouseView(owner.id)).house, null);
});

test('the last member leaving deletes the house', async () => {
  await resetDb();
  const { owner, code } = await houseWith(1);
  await houses.leaveHouse(owner.id);
  const { rows } = await query('select count(*) as n from safespace.houses');
  assert.equal(Number(rows[0].n), 0);
  const p = await player();
  await rejectsWith(() => houses.joinHouse(p.id, code), 'CODE_INVALID');
  await rejectsWith(() => houses.leaveHouse(owner.id), 'NOT_IN_HOUSE');
});

test('personal progress travels with a member who joins mid-way', async () => {
  await resetDb();
  const veteran = await player('Veteran');
  await applyOutcome({ userId: veteran.id, outcome: 'hung_up', practice: true });
  const stats = await getUser(veteran.id);
  const { code } = await houseWith(2);
  await houses.joinHouse(veteran.id, code);
  const me = (await houses.getHouseView(veteran.id)).house.members.find((m) => m.id === veteran.id);
  assert.equal(me.xp, stats.xp);
  assert.equal(me.timesSafe, stats.timesSafe);
});

test('a house that vanishes mid-read falls back to the solo view', async () => {
  await resetDb();
  const { owner } = await houseWith(2);
  // getHouseView reads the user and the house in separate statements, so the house can
  // be deleted in between. Reproduce that state: drop the house row while the user row
  // still points at it, with the foreign key's ON DELETE SET NULL suspended.
  await query('alter table safespace.houses disable trigger all');
  try {
    await query('delete from safespace.houses');
  } finally {
    await query('alter table safespace.houses enable trigger all');
  }
  const view = await houses.getHouseView(owner.id);
  assert.equal(view.house, null);
  assert.equal(view.self.id, owner.id);
  assert.equal(view.self.isOwner, false);
});

test('weekly flags: a LOST result makes you unsafe until Monday', async () => {
  await resetDb();
  const p = await player('Weekly');
  await applyOutcome({ userId: p.id, outcome: 'shared_data' });
  let { self } = await houses.getHouseView(p.id);
  assert.equal(self.activeThisWeek, true);
  assert.equal(self.safeThisWeek, false);
  ({ self } = await houses.getHouseView(p.id, { now: new Date(Date.now() + 8 * DAY) }));
  assert.equal(self.activeThisWeek, false);
  assert.equal(self.safeThisWeek, true);
});

test('only the first house drill run of the week earns XP; keys are idempotent', async () => {
  await resetDb();
  const p = await player('Runner');
  const before = await getUser(p.id);
  const first = await houses.recordHouseRun(p.id, { clientKey: 'run-1', correct: 4, cautious: 1, wrong: 1 });
  assert.equal(first.status, 'completed');
  assert.equal(first.run.xpGained, 4 * 100 + 50 + 25);
  const replay = await houses.recordHouseRun(p.id, { clientKey: 'run-1', correct: 6, cautious: 0, wrong: 0 });
  assert.equal(replay.status, 'duplicate');
  assert.equal(replay.run.xpGained, first.run.xpGained);
  const second = await houses.recordHouseRun(p.id, { clientKey: 'run-2', correct: 6, cautious: 0, wrong: 0 });
  assert.equal(second.run.xpGained, 0);
  const after = await getUser(p.id);
  assert.equal(after.level * 100000 + after.xp > before.level * 100000 + before.xp, true);
  const { self } = await houses.getHouseView(p.id);
  assert.deepEqual(self.weekRun, { correct: 10, cautious: 1, wrong: 1 });
  assert.equal(self.activeThisWeek, true);
  const nextWeek = await houses.recordHouseRun(
    p.id, { clientKey: 'run-3', correct: 1, cautious: 0, wrong: 0 }, { now: new Date(Date.now() + 8 * DAY) },
  );
  assert.equal(nextWeek.run.xpGained, 100);
});

test('house drill runs are validated', async () => {
  await resetDb();
  const p = await player();
  const bad = [
    { clientKey: '', correct: 1, cautious: 0, wrong: 0 },
    { clientKey: 'k', correct: 0, cautious: 0, wrong: 0 },
    { clientKey: 'k', correct: -1, cautious: 2, wrong: 0 },
    { clientKey: 'k', correct: 1.5, cautious: 0, wrong: 0 },
    { clientKey: 'k', correct: 21, cautious: 0, wrong: 0 },
    { clientKey: 'k'.repeat(201), correct: 1, cautious: 0, wrong: 0 },
  ];
  for (const run of bad) await rejectsWith(() => houses.recordHouseRun(p.id, run), 'INVALID_DRILL_RUN');
});

test('the house view never carries phone, email or lookup hashes', async () => {
  await resetDb();
  const { owner } = await houseWith(3);
  const text = JSON.stringify(await houses.getHouseView(owner.id));
  for (const leak of ['phone', 'email', 'Hash', '+659']) assert.ok(!text.includes(leak), leak);
});
