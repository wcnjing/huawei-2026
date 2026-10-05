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
const continueAll = async (players, drillId, turn) => {
  for (const p of players) await drills.continueHouseDrill(p.id, drillId, turn);
};
/** Answer a turn, then have every listed player tap Continue so the game moves on. */
const play = async (players, userId, drillId, turn, outcome) => {
  await answer(userId, drillId, turn, outcome);
  await continueAll(players, drillId, turn);
};

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
  await continueAll([host, a], drillId, 0);
  await play([host, a], a.id, drillId, 1, 'wrong');
  await play([host, a], host.id, drillId, 2, 'cautious');
  const before = await getUser(a.id);
  await play([host, a], a.id, drillId, 3);
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
  await play([host, a, b], host.id, drillId, 0);
  await rejectsWith(() => drills.skipHouseDrillTurn(a.id, drillId, 1), 'NOT_DRILL_HOST');
  await drills.skipHouseDrillTurn(host.id, drillId, 1);
  let d = await view(b.id);
  assert.equal(d.currentTurn, 2);
  assert.equal(d.answers[1].skipped, true);
  await drills.leaveHouseDrill(b.id, drillId);
  d = await view(host.id);
  assert.equal(d.currentTurn, 3, "b's turn 2 was skipped when they left");
  await play([host, a], host.id, drillId, 3);
  await play([host, a], a.id, drillId, 4);
  d = await view(host.id);
  assert.equal(d.status, 'finished', "b's last turn is skipped too, ending the game");
  assert.deepEqual(d.answers.map((x) => x.skipped), [false, true, true, false, false, true]);
});

test('after an answer everyone must tap Continue before the next turn starts', async () => {
  await resetDb();
  const [host, a, b] = await houseWith(3);
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 2 });
  await drills.respondToHouseDrill(a.id, drillId, true);
  await drills.respondToHouseDrill(b.id, drillId, true);
  await drills.startHouseDrill(host.id, drillId, ids(6));
  assert.deepEqual((await drills.continueHouseDrill(host.id, drillId, 0)).ring, [],
    'continue before any answer changes nothing');

  await answer(host.id, drillId, 0);
  let d = await view(a.id);
  assert.equal(d.currentTurn, 0, 'the game waits on the answered turn');
  assert.equal(d.revealing, true);
  assert.deepEqual(d.ready, []);
  await rejectsWith(() => answer(a.id, drillId, 1), 'NOT_YOUR_TURN');
  await rejectsWith(() => answer(a.id, drillId, 0), 'NOT_YOUR_TURN');
  assert.deepEqual((await drills.skipHouseDrillTurn(host.id, drillId, 0)).ring, [],
    'an answered turn cannot be skipped');

  await drills.continueHouseDrill(host.id, drillId, 0);
  await drills.continueHouseDrill(a.id, drillId, 0);
  assert.deepEqual((await drills.continueHouseDrill(a.id, drillId, 0)).ring, [], 'tapping twice is harmless');
  d = await view(b.id);
  assert.equal(d.currentTurn, 0, 'still waiting for b');
  assert.deepEqual(d.ready.sort(), [host.id, a.id].sort());

  await drills.continueHouseDrill(b.id, drillId, 0);
  d = await view(host.id);
  assert.equal(d.currentTurn, 1);
  assert.equal(d.revealing, false);
  assert.deepEqual(d.ready, []);
  assert.deepEqual((await drills.continueHouseDrill(b.id, drillId, 0)).ring, [], 'a late tap for an old turn is ignored');

  // The host can move on without someone who wandered off.
  await answer(a.id, drillId, 1);
  await rejectsWith(() => drills.continueHouseDrill(a.id, drillId, 1, { force: true }), 'NOT_DRILL_HOST');
  await drills.continueHouseDrill(host.id, drillId, 1, { force: true });
  assert.equal((await view(a.id)).currentTurn, 2);

  // Someone leaving while the others are ready lets the game move on.
  await answer(b.id, drillId, 2);
  await continueAll([host, a], drillId, 2);
  await drills.leaveHouseDrill(b.id, drillId);
  d = await view(host.id);
  assert.equal(d.currentTurn, 3);
  assert.equal(d.answers[2].skipped, false, "b's answer still counts after they leave");

  // The last answer also waits for Continue before the game finishes.
  await play([host, a], host.id, drillId, 3);
  await answer(a.id, drillId, 4);
  assert.equal((await view(host.id)).status, 'playing');
  await continueAll([host, a], drillId, 4);
  assert.equal((await view(host.id)).status, 'finished', "b's last turn is skipped, ending the game");
});

async function startRace(players, perPlayer = 2, t0 = new Date()) {
  const [host, ...others] = players;
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer, mode: 'race' }, { now: t0 });
  for (const p of others) await drills.respondToHouseDrill(p.id, drillId, true, { now: t0 });
  await drills.startHouseDrill(host.id, drillId, ids(perPlayer, 21), { now: t0 });
  return drillId;
}
const raceAnswer = (userId, drillId, turn, outcome, now) =>
  drills.answerHouseDrill(userId, drillId, { turn, action: 'REPORT AS SCAM', outcome, foundClues: 0 }, { now });

test('a race gives everyone the same questions, and only that many', async () => {
  await resetDb();
  const [host, a] = await houseWith(2);
  await rejectsWith(() => drills.createHouseDrill(host.id, { perPlayer: 2, mode: 'battle' }), 'INVALID_DRILL_SETTINGS');
  const { drillId } = await drills.createHouseDrill(host.id, { perPlayer: 3, mode: 'race' });
  await drills.respondToHouseDrill(a.id, drillId, true);
  await rejectsWith(() => drills.startHouseDrill(host.id, drillId, ids(6)), 'INVALID_DRILL_SETTINGS');
  await drills.startHouseDrill(host.id, drillId, [7, 8, 9]);
  const d = await view(a.id);
  assert.equal(d.mode, 'race');
  assert.deepEqual(d.turns.map((x) => x.scenarioId), [7, 8, 9]);
});

test('race players go at their own pace, in order, and cannot see each other\'s answers', async () => {
  await resetDb();
  const [host, a] = await houseWith(2);
  const drillId = await startRace([host, a], 2);
  await raceAnswer(a.id, drillId, 0, 'correct');
  await rejectsWith(() => raceAnswer(a.id, drillId, 2, 'correct'), 'NOT_YOUR_TURN');
  assert.deepEqual((await raceAnswer(a.id, drillId, 0, 'wrong')).ring, [], 'a retry changes nothing');
  await raceAnswer(a.id, drillId, 1, 'correct');
  const seenByHost = await view(host.id);
  assert.equal(seenByHost.status, 'playing', 'still waiting for the host to finish');
  assert.deepEqual(seenByHost.answers.map((x) => [x.playerId, x.turn, x.outcome, x.action]),
    [[a.id, 0, null, null], [a.id, 1, null, null]], 'progress only, no answers to copy');
  assert.equal((await view(a.id)).answers[0].outcome, 'correct', 'players see their own answers');
  assert.equal(await drills.continueHouseDrill(host.id, drillId, 0).then((r) => r.ring.length), 0);
  assert.equal(await drills.skipHouseDrillTurn(host.id, drillId, 0).then((r) => r.ring.length), 0);
});

test('the highest score wins a race, and a faster finish breaks a tie', async () => {
  await resetDb();
  const [host, a, b] = await houseWith(3);
  const t0 = new Date(Date.now() - 60_000);
  const at = (s) => new Date(t0.getTime() + s * 1000);
  const drillId = await startRace([host, a, b], 2, t0);
  // a and b both score 150; b finishes first. The host scores 100.
  await raceAnswer(b.id, drillId, 0, 'correct', at(5));
  await raceAnswer(b.id, drillId, 1, 'cautious', at(10));
  await raceAnswer(a.id, drillId, 0, 'cautious', at(8));
  await raceAnswer(a.id, drillId, 1, 'correct', at(20));
  await raceAnswer(host.id, drillId, 0, 'correct', at(4));
  await raceAnswer(host.id, drillId, 1, 'wrong', at(6));
  const d = await view(host.id);
  assert.equal(d.status, 'finished', 'the race ends when everyone is done');
  assert.deepEqual(d.ranking.map((r) => [r.playerId, r.score, r.timeMs]),
    [[b.id, 150, 10_000], [a.id, 150, 20_000], [host.id, 100, 6_000]]);
  assert.equal(d.winnerId, b.id);
  assert.equal(d.answers.find((x) => x.playerId === a.id).outcome, 'cautious', 'answers are revealed at the end');
  assert.ok(d.xp[a.id] > 0 && d.xp[b.id] > 0);
});

test('the host can end a race early; unfinished players rank by score, then as slowest', async () => {
  await resetDb();
  const [host, a, b] = await houseWith(3);
  const drillId = await startRace([host, a, b], 3);
  await raceAnswer(a.id, drillId, 0, 'correct');
  await raceAnswer(b.id, drillId, 0, 'correct');
  await raceAnswer(b.id, drillId, 1, 'correct');
  await drills.leaveHouseDrill(a.id, drillId);
  assert.equal((await view(host.id)).status, 'playing', 'one player leaving does not end it');
  await drills.leaveHouseDrill(host.id, drillId);
  const d = await view(b.id);
  assert.equal(d.status, 'finished');
  assert.deepEqual(d.ranking.map((r) => [r.playerId, r.score, r.timeMs]),
    [[b.id, 200, null], [a.id, 100, null], [host.id, 0, null]]);
  assert.equal(d.winnerId, b.id);
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
