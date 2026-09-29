// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

process.env.IDENTITY_LOOKUP_SECRET = 'house-drills-test-identity-lookup-secret-32';
await setupTestDb();
after(teardownTestDb);

const { registerVerifiedUser, getUser } = await import('./store.js');
const houses = await import('./houses.js');
const drills = await import('./house-drills.js');

let phoneSeq = 0;
async function player(name) {
  phoneSeq += 1;
  return registerVerifiedUser({ phone: `+659300${String(phoneSeq).padStart(4, '0')}`, name });
}
async function houseWith(count) {
  const t0 = Date.now() - 60_000;
  const owner = await player('Owner');
  await houses.createHouse(owner.id, 'The Lims', { now: new Date(t0) });
  const code = (await houses.getHouseView(owner.id)).house.inviteCode;
  const members = [owner];
  for (let i = 1; i < count; i += 1) {
    const p = await player(`Member${i}`);
    await houses.joinHouse(p.id, code, { now: new Date(t0 + i * 1000) });
    members.push(p);
  }
  return members;
}
const rejectsWith = (fn, code) => assert.rejects(fn, (error) => error.code === code);
const view = async (userId, opts) => (await drills.getHouseDrill(userId, opts)).drill;
const ids = (n, from = 1) => Array.from({ length: n }, (_, i) => from + i);
const answer = (userId, drillId, turn, outcome = 'correct') =>
  drills.answerHouseDrill(userId, drillId, { turn, action: 'REPORT AS SCAM', outcome, foundClues: 1 });

test('solo players cannot open a house drill and see none', async () => {
  await resetDb();
  const solo = await player('Solo');
  await rejectsWith(() => drills.createHouseDrill(solo.id, { perPlayer: 3 }), 'NOT_IN_HOUSE');
  assert.equal(await view(solo.id), null);
});

test('opening a lobby invites every other member; settings are validated', async () => {
  await resetDb();
  const [host, a, b] = await houseWith(3);
  for (const perPlayer of [1, 6, 2.5, '3', undefined]) {
    await rejectsWith(() => drills.createHouseDrill(host.id, { perPlayer }), 'INVALID_DRILL_SETTINGS');
  }
  const { drillId, ring } = await drills.createHouseDrill(host.id, { perPlayer: 3 });
  assert.equal(ring.length, 1);
  const d = await view(a.id);
  assert.equal(d.id, drillId);
  assert.equal(d.status, 'lobby');
  assert.equal(d.hostId, host.id);
  assert.deepEqual(d.players.map((p) => [p.id, p.status]),
    [[host.id, 'accepted'], [a.id, 'invited'], [b.id, 'invited']]);
  await rejectsWith(() => drills.createHouseDrill(a.id, { perPlayer: 2 }), 'DRILL_IN_PROGRESS');
});

test('invites can be accepted or declined until they expire', async () => {
  await resetDb();
  const [host, a, b, c] = await houseWith(4);
  const t0 = new Date();
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 2 }, { now: t0 });
  await drills.respondToHouseDrill(a.id, drillId, true, { now: t0 });
  await drills.respondToHouseDrill(b.id, drillId, false, { now: t0 });
  const late = new Date(t0.getTime() + drills.INVITE_WINDOW_MS + 1000);
  await rejectsWith(() => drills.respondToHouseDrill(c.id, drillId, true, { now: late }), 'INVITE_EXPIRED');
  const d = await view(host.id, { now: late });
  assert.deepEqual(d.players.map((p) => p.status), ['accepted', 'accepted', 'declined', 'expired']);
});

test('only the host starts, with exactly one scenario per turn, in rotating order', async () => {
  await resetDb();
  const [host, a, b] = await houseWith(3);
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  await drills.respondToHouseDrill(a.id, drillId, true);
  await rejectsWith(() => drills.startHouseDrill(a.id, drillId, ids(4)), 'NOT_DRILL_HOST');
  await rejectsWith(() => drills.startHouseDrill(host.id, drillId, ids(6)), 'INVALID_DRILL_SETTINGS');
  await rejectsWith(() => drills.startHouseDrill(host.id, drillId, [1, 1, 2, 3]), 'INVALID_DRILL_SETTINGS');
  await drills.startHouseDrill(host.id, drillId, [11, 12, 13, 14]);
  const d = await view(b.id);
  assert.equal(d, null, 'a player who never accepted is not part of the game');
  const seen = await view(a.id);
  assert.equal(seen.status, 'playing');
  assert.deepEqual(seen.turns, [
    { playerId: host.id, scenarioId: 11 }, { playerId: a.id, scenarioId: 12 },
    { playerId: host.id, scenarioId: 13 }, { playerId: a.id, scenarioId: 14 },
  ]);
  assert.equal(seen.players.find((p) => p.id === b.id).status, 'expired');
  await rejectsWith(() => drills.respondToHouseDrill(b.id, drillId, true), 'DRILL_ALREADY_STARTED');
});

test('only the current player may answer; retries are harmless; the last answer credits everyone', async () => {
  await resetDb();
  const [host, a] = await houseWith(2);
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  await drills.respondToHouseDrill(a.id, drillId, true);
  await drills.startHouseDrill(host.id, drillId, ids(4));
  await rejectsWith(() => answer(a.id, drillId, 0), 'NOT_YOUR_TURN');
  await rejectsWith(() => drills.answerHouseDrill(host.id, drillId, { turn: 0, action: '', outcome: 'correct', foundClues: 0 }),
    'INVALID_DRILL_ANSWER');
  await rejectsWith(() => drills.answerHouseDrill(host.id, drillId, { turn: 0, action: 'X', outcome: 'great', foundClues: 0 }),
    'INVALID_DRILL_ANSWER');
  await answer(host.id, drillId, 0);
  const retry = await answer(host.id, drillId, 0);
  assert.deepEqual(retry.ring, [], 'a repeated answer changes nothing');
  await answer(a.id, drillId, 1, 'wrong');
  await answer(host.id, drillId, 2, 'cautious');
  const before = await getUser(a.id);
  await answer(a.id, drillId, 3);
  const d = await view(host.id);
  assert.equal(d.status, 'finished');
  assert.equal(d.answers.length, 4);
  assert.deepEqual(d.xp, { [host.id]: 150, [a.id]: 125 });
  const after = await getUser(a.id);
  assert.ok(after.xp !== before.xp || after.level !== before.level, 'XP reached the player account');
  const week = (await houses.getHouseView(host.id)).house.members.find((m) => m.id === a.id).weekRun;
  assert.deepEqual(week, { correct: 1, cautious: 0, wrong: 1 });
  await rejectsWith(() => answer(a.id, drillId, 3), 'DRILL_OVER');
});

test('the host can skip an absent player, and a player who leaves loses their turns', async () => {
  await resetDb();
  const [host, a, b] = await houseWith(3);
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  await drills.respondToHouseDrill(a.id, drillId, true);
  await drills.respondToHouseDrill(b.id, drillId, true);
  await drills.startHouseDrill(host.id, drillId, ids(6));
  await answer(host.id, drillId, 0);
  await rejectsWith(() => drills.skipHouseDrillTurn(a.id, drillId, 1), 'NOT_DRILL_HOST');
  await drills.skipHouseDrillTurn(host.id, drillId, 1);
  let d = await view(b.id);
  assert.equal(d.currentTurn, 2);
  assert.equal(d.answers[1].skipped, true);
  await drills.leaveHouseDrill(b.id, drillId);
  d = await view(host.id);
  assert.equal(d.currentTurn, 3, "b's turn 2 was skipped when they left");
  await answer(host.id, drillId, 3);
  await answer(a.id, drillId, 4);
  d = await view(host.id);
  assert.equal(d.status, 'finished', "b's last turn is skipped too, ending the game");
  assert.deepEqual(d.answers.map((x) => x.skipped), [false, true, true, false, false, true]);
});

test('the host leaving cancels a lobby and ends a game in play', async () => {
  await resetDb();
  const [host, a] = await houseWith(2);
  const first = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  await drills.leaveHouseDrill(host.id, first.drillId);
  assert.equal((await view(a.id)).status, 'cancelled');
  const second = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  await drills.respondToHouseDrill(a.id, second.drillId, true);
  await drills.startHouseDrill(host.id, second.drillId, ids(4));
  await answer(host.id, second.drillId, 0);
  await drills.leaveHouseDrill(host.id, second.drillId);
  const d = await view(a.id);
  assert.equal(d.status, 'finished');
  assert.deepEqual(Object.keys(d.xp), [host.id]);
});

test('a forgotten lobby lapses, so the house can start a new one', async () => {
  await resetDb();
  const [host] = await houseWith(2);
  const t0 = new Date();
  await drills.createHouseDrill(host.id, { perPlayer: 2 }, { now: t0 });
  const later = new Date(t0.getTime() + drills.LOBBY_TTL_MS + 1000);
  assert.equal((await view(host.id, { now: later })), null);
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 3 }, { now: later });
  assert.equal((await view(host.id, { now: later })).id, drillId);
});

test('other houses cannot touch a drill', async () => {
  await resetDb();
  const [host] = await houseWith(2);
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  const outsider = await player('Outsider');
  await houses.createHouse(outsider.id, 'Other House');
  await rejectsWith(() => drills.respondToHouseDrill(outsider.id, drillId, true), 'DRILL_NOT_FOUND');
  assert.equal(await view(outsider.id), null);
});
