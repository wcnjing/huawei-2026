// Row <-> object mapping. The API's JSON must not change with the storage move, so each
// mapper rebuilds the object the old whole-document store held. That means camelCase
// keys and ISO timestamps. Keys the old code always wrote stay present when null; keys
// it wrote only sometimes are omitted when null.

export function iso(value) {
  if (value === null || value === undefined) return null;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function setIfPresent(target, key, value) {
  if (value !== null && value !== undefined) target[key] = value;
}

// [column, property] for every users column the application writes.
export const USER_FIELDS = [
  ['name', 'name'],
  ['role', 'role'],
  ['phone', 'phone'],
  ['phone_lookup_hash', 'phoneLookupHash'],
  ['consent_to_drills', 'consentToDrills'],
  ['level', 'level'],
  ['xp', 'xp'],
  ['xp_max', 'xpMax'],
  ['streak', 'streak'],
  ['times_safe', 'timesSafe'],
  ['times_scammed', 'timesScammed'],
  ['safe_this_week', 'safeThisWeek'],
  ['recent_drill_result', 'recentDrillResult'],
  ['primary_color', 'primaryColor'],
  ['room_name', 'roomName'],
  ['room_bg', 'roomBg'],
  ['badge_count', 'badgeCount'],
  ['badge_total', 'badgeTotal'],
  ['email', 'email'],
  ['pending_email', 'pendingEmail'],
  ['email_verified_at', 'emailVerifiedAt'],
  ['email_verification_requested_at', 'emailVerificationRequestedAt'],
  ['email_verification_token_hash', 'emailVerificationTokenHash'],
];

// Identity columns are unique, so an empty string must become NULL: the demo family's
// old `phone: ""` would otherwise collide with itself.
const EMPTY_MEANS_NULL = new Set(['phone', 'phone_lookup_hash', 'email', 'pending_email']);

export function userFromRow(row) {
  if (!row) return null;
  const user = {
    id: row.id,
    name: row.name,
    role: row.role,
    consentToDrills: row.consent_to_drills,
    level: row.level,
    xp: row.xp,
    xpMax: row.xp_max,
    streak: row.streak,
    timesSafe: row.times_safe,
    timesScammed: row.times_scammed,
    primaryColor: row.primary_color,
    badgeCount: row.badge_count,
    badgeTotal: row.badge_total,
    roomName: row.room_name,
    roomBg: row.room_bg,
    safeThisWeek: row.safe_this_week,
    recentDrillResult: row.recent_drill_result ?? null,
  };
  setIfPresent(user, 'phone', row.phone);
  setIfPresent(user, 'phoneLookupHash', row.phone_lookup_hash);
  setIfPresent(user, 'email', row.email);
  setIfPresent(user, 'pendingEmail', row.pending_email);
  setIfPresent(user, 'emailVerifiedAt', iso(row.email_verified_at));
  setIfPresent(user, 'emailVerificationRequestedAt', iso(row.email_verification_requested_at));
  setIfPresent(user, 'emailVerificationTokenHash', row.email_verification_token_hash);
  setIfPresent(user, 'houseId', row.house_id);
  setIfPresent(user, 'avatar', row.avatar);
  return user;
}

/** Column values in USER_FIELDS order. A deleted property is written as NULL. */
export function userValues(user) {
  return USER_FIELDS.map(([column, key]) => {
    const value = user[key];
    if (value === undefined) return null;
    if (value === '' && EMPTY_MEANS_NULL.has(column)) return null;
    return value;
  });
}

const USER_COLUMNS = USER_FIELDS.map(([column]) => column);

export const INSERT_USER_SQL = `insert into safespace.users (id, ${USER_COLUMNS.join(', ')})
  values ($1, ${USER_COLUMNS.map((_, index) => `$${index + 2}`).join(', ')})
  returning *`;

export const UPDATE_USER_SQL = `update safespace.users
  set ${USER_COLUMNS.map((column, index) => `${column} = $${index + 2}`).join(', ')}
  where id = $1
  returning *`;

export function attemptFromRow(row) {
  if (!row) return null;
  const attempt = {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    status: row.status,
    providerId: row.provider_id ?? null,
    createdAt: iso(row.created_at),
  };
  setIfPresent(attempt, 'sentAt', iso(row.sent_at));
  setIfPresent(attempt, 'actionTokenHash', row.action_token_hash);
  setIfPresent(attempt, 'scored', row.scored);
  setIfPresent(attempt, 'outcome', row.outcome);
  setIfPresent(attempt, 'failureReason', row.failure_reason);
  setIfPresent(attempt, 'completedAt', iso(row.completed_at));
  setIfPresent(attempt, 'resultRecordId', row.result_record_id);
  return attempt;
}

export function resultFromRow(row) {
  if (!row) return null;
  const record = {
    id: row.id,
    userId: row.user_id,
    channel: row.channel,
    outcome: row.outcome ?? null,
    practice: row.practice,
    result: row.result,
    screen: row.screen ?? null,
    xpGained: row.xp_gained,
    at: iso(row.at),
  };
  setIfPresent(record, 'attemptId', row.attempt_id);
  setIfPresent(record, 'providerId', row.provider_id);
  setIfPresent(record, 'unscoredReason', row.unscored_reason);
  return record;
}
