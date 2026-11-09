import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { addXp } from './store.js';

const { code } = transformSync(readFileSync(new URL('../src/app/utils/progress.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' });
const { totalXp, rankTitle, achievementsFor, rankMembers, houseRank } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('totalXp undoes the server level-up rule', () => {
  for (const earned of [0, 499, 500, 1100, 2840, 9999]) {
    const user = addXp({ level: 1, xp: 0, xpMax: 500 }, earned);
    assert.equal(totalXp(user.level, user.xp), earned);
  }
});

test('a higher level outranks more XP inside a lower level', () => {
  const m = (id, level, xp, timesSafe = 0) => ({ id, level, xp, streak: 0, timesSafe, timesScammed: 0 });
  const board = rankMembers([m('shannon', 4, 755, 11), m('stef', 5, 216, 5), m('wen', 5, 766, 35)]);
  assert.deepEqual(board.map((x) => x.id), ['wen', 'stef', 'shannon']);
  assert.ok(totalXp(5, 216) > totalXp(4, 755));
  assert.equal(houseRank(board, 'shannon'), 3);
  assert.equal(houseRank(board, 'nobody'), null);
});

test('badges and titles follow real stats', () => {
  const fresh = achievementsFor({ level: 1, xp: 0, streak: 0, timesSafe: 0, timesScammed: 0 });
  assert.equal(fresh.length, 9);
  assert.equal(fresh.filter((a) => a.unlocked).length, 0);
  const vet = achievementsFor({ level: 5, xp: 0, streak: 6, timesSafe: 35, timesScammed: 2 });
  assert.deepEqual(vet.filter((a) => a.unlocked).map((a) => a.name),
    ['FIRST BLOCK', 'STREAK X5', 'SCAM SPOTTER', 'EAGLE EYE', 'RISING STAR', 'VETERAN']);
  assert.equal(rankTitle(1), 'WATCHER');
  assert.equal(rankTitle(5), 'LINK INSPECTOR');
  assert.equal(rankTitle(10), 'HOUSE GUARDIAN');
});
