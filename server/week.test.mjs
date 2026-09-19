import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStart } from './week.js';

test('the week starts Monday 00:00 in Singapore', () => {
  // Sunday 20 Sep 2026, 23:59:59 SGT belongs to the week of Monday 14 Sep.
  assert.equal(weekStart(new Date('2026-09-20T15:59:59Z')).toISOString(), '2026-09-13T16:00:00.000Z');
  // Monday 21 Sep 2026, 00:00:00 SGT starts a new week.
  assert.equal(weekStart(new Date('2026-09-20T16:00:00Z')).toISOString(), '2026-09-20T16:00:00.000Z');
  // Wednesday afternoon.
  assert.equal(weekStart(new Date('2026-09-23T06:00:00Z')).toISOString(), '2026-09-20T16:00:00.000Z');
});
