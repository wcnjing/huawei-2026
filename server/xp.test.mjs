// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeResult, FULL_XP, PARTIAL_XP } from './xp.js';

test('clean resistance is a full-XP win with streak++', () => {
  for (const o of ['hung_up', 'disengaged', 'verified', 'reported']) {
    const r = computeResult(o);
    assert.equal(r.result, 'WON');
    assert.equal(r.screen, 'result-win');
    assert.equal(r.xp, FULL_XP);
    assert.equal(r.streak, 'inc');
  }
});

test('caught a red flag but engaged = partial win', () => {
  const r = computeResult('caught_flag');
  assert.equal(r.result, 'WON');
  assert.equal(r.xp, PARTIAL_XP);
});

test('complying / sharing data is a loss that resets the streak', () => {
  for (const o of ['complied', 'shared_data', 'clicked_link', 'submitted_details', 'opened_attachment']) {
    const r = computeResult(o);
    assert.equal(r.result, 'LOST');
    assert.equal(r.screen, 'result-lose');
    assert.equal(r.xp, 0);
    assert.equal(r.streak, 'reset');
  }
});

test('distress off-ramp is never punished (no XP, streak untouched, no result screen)', () => {
  const r = computeResult('distress_offramp');
  assert.equal(r.result, 'SAFE');
  assert.equal(r.screen, null);
  assert.equal(r.xp, 0);
  assert.equal(r.streak, 'none');
});

test('practice drills award half XP', () => {
  assert.equal(computeResult('hung_up', { practice: true }).xp, FULL_XP / 2);
  assert.equal(computeResult('caught_flag', { practice: true }).xp, PARTIAL_XP / 2);
});

test('unknown outcome defaults to a benign win (never punish)', () => {
  const r = computeResult('some_unmapped_thing');
  assert.equal(r.result, 'WON');
  assert.equal(r.streak, 'inc');
});
