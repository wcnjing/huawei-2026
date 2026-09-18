// Run with: node --test
//
// The API's JSON must not change with the storage move. These pin the object shapes the
// old whole-document store produced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_FIELDS, attemptFromRow, iso, resultFromRow, userFromRow, userValues,
} from './rows.js';

const at = new Date('2026-09-18T01:02:03.456Z');

const userRow = (overrides = {}) => ({
  id: 'usr_1', name: 'JUDGE', role: 'ROOKIE', phone: '+6591234567', phone_lookup_hash: null,
  consent_to_drills: true, level: 1, xp: 0, xp_max: 500, streak: 0, times_safe: 0,
  times_scammed: 0, safe_this_week: true, recent_drill_result: null, primary_color: '#4ecdc4',
  room_name: 'GUEST ROOM', room_bg: '#081420', badge_count: 0, badge_total: 9, email: null,
  pending_email: null, email_verified_at: null, email_verification_requested_at: null,
  email_verification_token_hash: null, created_at: at,
  ...overrides,
});

test('a user keeps always-written nulls and omits conditional ones', () => {
  const user = userFromRow(userRow());
  assert.equal(user.recentDrillResult, null);
  assert.ok('recentDrillResult' in user);
  for (const key of ['email', 'pendingEmail', 'emailVerifiedAt', 'phoneLookupHash']) {
    assert.ok(!(key in user), `${key} should be absent when null`);
  }
  assert.ok(!('createdAt' in user) && !('created_at' in user), 'created_at is never exposed');
  assert.equal(userFromRow(userRow({ phone: null })).phone, undefined);
  assert.equal(userFromRow(undefined), null);
});

test('user timestamps come back as ISO strings from a Date or a string', () => {
  assert.equal(userFromRow(userRow({ email_verified_at: at })).emailVerifiedAt, at.toISOString());
  assert.equal(iso('2026-09-18T01:02:03.456Z'), at.toISOString());
  assert.equal(iso(null), null);
});

test('userValues round-trips every written column and stores an empty phone as NULL', () => {
  const row = userRow({ email: 'judge@example.com', email_verified_at: at });
  const values = userValues(userFromRow(row));
  USER_FIELDS.forEach(([column], index) => {
    const expected = row[column] instanceof Date ? row[column].toISOString() : row[column];
    assert.deepEqual(values[index], expected, column);
  });
  const phoneIndex = USER_FIELDS.findIndex(([column]) => column === 'phone');
  assert.equal(userValues({ ...userFromRow(row), phone: '' })[phoneIndex], null);
  assert.equal(userValues({ ...userFromRow(row), phone: undefined })[phoneIndex], null);
});

test('an attempt always has providerId and omits unset lifecycle fields', () => {
  const attempt = attemptFromRow({
    id: 'attempt_1', user_id: 'you', channel: 'call', status: 'created', provider_id: null,
    action_token_hash: null, created_at: at, sent_at: null, completed_at: null, scored: null,
    outcome: null, failure_reason: null, result_record_id: null,
  });
  assert.deepEqual(attempt, {
    id: 'attempt_1', userId: 'you', channel: 'call', status: 'created', providerId: null,
    createdAt: at.toISOString(),
  });
  const failed = attemptFromRow({
    id: 'attempt_2', user_id: 'you', channel: 'sms', status: 'failed', provider_id: 'SM1',
    action_token_hash: null, created_at: at, sent_at: at, completed_at: at, scored: false,
    outcome: null, failure_reason: 'provider_error', result_record_id: 'drill_1',
  });
  assert.equal(failed.scored, false, 'false is a value, not an absence');
  assert.equal(failed.sentAt, at.toISOString());
  assert.equal(failed.resultRecordId, 'drill_1');
});

test('a result keeps outcome and screen even when null, and hides queue bookkeeping', () => {
  const record = resultFromRow({
    id: 'drill_1', seq: '7', user_id: 'you', channel: 'call', outcome: null, practice: false,
    result: 'UNSCORED', screen: null, xp_gained: 0, at, attempt_id: 'attempt_1',
    provider_id: null, unscored_reason: 'no_answer', practice_source_key: null,
    acknowledged_at: null,
  });
  assert.deepEqual(record, {
    id: 'drill_1', userId: 'you', channel: 'call', outcome: null, practice: false,
    result: 'UNSCORED', screen: null, xpGained: 0, at: at.toISOString(),
    attemptId: 'attempt_1', unscoredReason: 'no_answer',
  });
});
