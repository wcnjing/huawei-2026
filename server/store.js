// SafeSpace data store, on Postgres: Supabase in production, PGlite locally and in tests
// (see db.js). Every export keeps the contract it had on the old whole-document store,
// so server/index.js did not change when the storage moved.
//
// Each write is one transaction that locks exactly what it reads: a user row, an attempt
// row, or, where the row may not exist yet, an advisory lock on a hashed key. Writes for
// different users no longer wait for each other.
import crypto from 'crypto';
import { computeResult, KNOWN_OUTCOMES } from './xp.js';
import { query, transaction } from './db.js';
import {
  INSERT_USER_SQL,
  UPDATE_USER_SQL,
  attemptFromRow,
  resultFromRow,
  userFromRow,
  userValues,
} from './rows.js';

// Fields that must NEVER leave the server in a list/leaderboard response.
// `phone` is PII; sessions are bearer credentials.
const PRIVATE_FIELDS = [
  'phone',
  'phoneLookupHash',
  'email',
  'pendingEmail',
  'emailVerifiedAt',
  'emailVerificationRequestedAt',
  'emailVerificationTokenHash',
];

/** Strip PII before sending a user record to any client. */
export function publicUser(u) {
  if (!u) return u;
  const safe = { ...u };
  for (const f of PRIVATE_FIELDS) delete safe[f];
  return safe;
}

const OUTCOME_SET = new Set(KNOWN_OUTCOMES);
const ACTIVE_ATTEMPT_STATUSES = new Set(['created', 'sent']);
const TERMINAL_ATTEMPT_STATUSES = new Set(['completed', 'failed']);
const ONE_HOUR_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_ACCOUNT_MAX = 5;
const EMAIL_VERIFICATION_DESTINATION_MAX = 3;
const PHONE_VERIFICATION_DESTINATION_MAX = 5;
const PHONE_VERIFICATION_REQUESTER_MAX = 20;

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  return Math.max(1, Math.floor(positiveNumber(value, fallback)));
}

// --- Transaction helpers ------------------------------------------------------

async function lockUser(tx, userId) {
  const { rows } = await tx.query(
    'select * from safespace.users where id = $1 for update',
    [String(userId)],
  );
  return userFromRow(rows[0]);
}

async function requireLockedUser(tx, userId) {
  const user = await lockUser(tx, userId);
  if (!user) throw new Error(`unknown user ${userId}`);
  return user;
}

async function readUser(tx, userId) {
  const { rows } = await tx.query('select * from safespace.users where id = $1', [String(userId)]);
  return userFromRow(rows[0]);
}

async function saveUser(tx, user) {
  const { rows } = await tx.query(UPDATE_USER_SQL, [user.id, ...userValues(user)]);
  return userFromRow(rows[0]);
}

async function insertUser(tx, user) {
  const { rows } = await tx.query(INSERT_USER_SQL, [user.id, ...userValues(user)]);
  return userFromRow(rows[0]);
}

/** Serialise on a key that may have no row yet. Released when the transaction ends. */
async function advisoryLock(tx, key) {
  await tx.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
}

async function logConsent(tx, { userId, type, channel, at }) {
  await tx.query(
    'insert into safespace.consent_events (user_id, type, channel, at) values ($1, $2, $3, $4)',
    [userId, type, channel, at],
  );
}

// --- Read models ---------------------------------------------------------------

export async function getUser(id) {
  if (!id) return null;
  const { rows } = await query('select * from safespace.users where id = $1', [String(id)], 'getUser');
  return userFromRow(rows[0]);
}

export async function listConsentedUsers() {
  const { rows } = await query(
    'select * from safespace.users where consent_to_drills order by created_at, id',
    [],
    'listConsentedUsers',
  );
  return rows.map(userFromRow);
}

// Leaderboard = users ranked by xp, shaped for the React LeaderboardScreen.
// Explicit field list — never spreads the raw user, so PII can't leak in.
export async function getLeaderboard() {
  const { rows } = await query(
    'select id, name, xp, level, times_safe from safespace.users order by xp desc, created_at, id',
    [],
    'getLeaderboard',
  );
  return rows.map((u, i) => ({
    rank: i + 1, id: u.id, name: u.name, score: u.xp, level: u.level, wins: u.times_safe,
  }));
}

// All family members, shaped for the React FamilyHomeScreen (dollhouse rooms).
// Projected — this endpoint is world-readable, so it must not carry phone numbers.
export async function getFamily() {
  const { rows } = await query('select * from safespace.users order by created_at, id', [], 'getFamily');
  return rows.map((row) => publicUser(userFromRow(row)));
}

/** The cheapest possible round trip, for the keep-alive cron. */
export async function pingDb() {
  await query('select 1', [], 'pingDb');
}

// --- Scoring ------------------------------------------------------------------

function scoreUser(user, outcome, practice) {
  const r = computeResult(outcome, { practice });
  user.xp += r.xp;
  while (user.xp >= user.xpMax) {
    user.xp -= user.xpMax;
    user.level += 1;
    user.xpMax = Math.round(user.xpMax * 1.2);
  }
  if (r.streak === 'inc') {
    user.streak += 1;
    user.timesSafe += 1;
    user.safeThisWeek = true;
  } else if (r.streak === 'reset') {
    user.streak = 0;
    user.timesScammed += 1;
    user.safeThisWeek = false;
  }
  if (r.result === 'WON' || r.result === 'LOST') user.recentDrillResult = r.result;
  return r;
}

async function insertResult(tx, record, practiceSourceKey = null) {
  await tx.query(
    `insert into safespace.drill_results
       (id, user_id, channel, outcome, practice, result, screen, xp_gained, at,
        attempt_id, provider_id, unscored_reason, practice_source_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      record.id, record.userId, record.channel, record.outcome, record.practice,
      record.result, record.screen, record.xpGained, record.at, record.attemptId ?? null,
      record.providerId ?? null, record.unscoredReason ?? null, practiceSourceKey,
    ],
  );
}

async function readResult(tx, id) {
  const { rows } = await tx.query('select * from safespace.drill_results where id = $1', [id]);
  return resultFromRow(rows[0]);
}

// Every real (non-practice) result stays pending until the client explicitly ACKs it,
// SAFE outcomes included: they have no result screen, but delivery still clears the
// client's "awaiting call" marker. The pending queue is `acknowledged_at is null`.
async function applyOutcomeInTx(tx, {
  userId,
  outcome,
  channel,
  practice,
  recordId,
  at,
  attemptId = null,
  providerId = null,
  practiceSourceKey = null,
}) {
  const user = await requireLockedUser(tx, userId);
  if (!OUTCOME_SET.has(outcome)) throw new Error(`unknown outcome ${outcome}`);

  const r = scoreUser(user, outcome, practice);
  const record = {
    id: recordId,
    userId,
    channel,
    outcome,
    practice,
    result: r.result,
    screen: r.screen,
    xpGained: r.xp,
    at,
    ...(attemptId ? { attemptId } : {}),
    ...(providerId ? { providerId } : {}),
  };
  await insertResult(tx, record, practiceSourceKey);
  return { record, user: await saveUser(tx, user) };
}

/**
 * Apply an outcome that does not belong to a provider attempt (practice and demo use).
 * Provider callbacks must use completeDrillAttempt so attribution and scoring are one
 * atomic, exactly-once mutation.
 */
export async function applyOutcome({ userId, outcome, channel = 'call', practice = false }) {
  const recordId = `drill_${crypto.randomUUID()}`;
  const at = new Date().toISOString();
  return transaction(
    (tx) => applyOutcomeInTx(tx, { userId, outcome, channel, practice, recordId, at }),
    'applyOutcome',
  );
}

/**
 * Idempotent practice scoring for retrying/double-clicking clients. The client id is
 * namespaced to the authenticated user and stored only as a digest.
 */
export async function applyPracticeOutcomeOnce({
  userId,
  clientAttemptId,
  outcome,
  channel = 'call',
} = {}) {
  const cleanId = String(clientAttemptId || '').trim();
  if (!cleanId) throw new Error('clientAttemptId is required');
  if (cleanId.length > 200) throw new Error('clientAttemptId is too long');
  const sourceKey = sha256(`practice\0${userId}\0${cleanId}`);
  const recordId = `drill_${crypto.randomUUID()}`;
  const at = new Date().toISOString();

  return transaction(async (tx) => {
    // Locking the user serialises a double-click; the unique key is the backstop.
    const user = await lockUser(tx, userId);
    const { rows } = await tx.query(
      'select * from safespace.drill_results where practice_source_key = $1',
      [sourceKey],
    );
    if (rows[0]) {
      return { status: 'duplicate', applied: false, record: resultFromRow(rows[0]), user };
    }
    const scored = await applyOutcomeInTx(tx, {
      userId,
      outcome,
      channel,
      practice: true,
      recordId,
      at,
      practiceSourceKey: sourceKey,
    });
    return { status: 'completed', applied: true, record: scored.record, user: scored.user };
  }, 'applyPracticeOutcomeOnce');
}

// --- Pending results ----------------------------------------------------------

/** Non-destructive result reads. The first item is the next result to display. */
export async function listPendingResults(userId) {
  if (!userId) return [];
  const { rows } = await query(
    `select * from safespace.drill_results
      where user_id = $1 and practice = false and acknowledged_at is null
      order by seq`,
    [String(userId)],
    'listPendingResults',
  );
  return rows.map(resultFromRow);
}

export async function peekPendingResult(userId) {
  const pending = await listPendingResults(userId);
  return pending[0] || null;
}

/** Remove exactly the result the client confirms it displayed. */
export async function ackPendingResult(userId, resultId) {
  if (!userId || !resultId) return null;
  const { rows } = await query(
    `update safespace.drill_results set acknowledged_at = now()
      where id = $1 and user_id = $2 and practice = false and acknowledged_at is null
      returning *`,
    [String(resultId), String(userId)],
    'ackPendingResult',
  );
  return resultFromRow(rows[0]);
}

/**
 * Compatibility for older routes: take only the first queued result. New routes should
 * use peekPendingResult + ackPendingResult so a failed response cannot lose a result.
 */
export async function takePendingResult(userId) {
  const pending = await peekPendingResult(userId);
  if (!pending) return null;
  return ackPendingResult(userId, pending.id);
}

// --- Provider attempts ----------------------------------------------------------

function publicAttempt(attempt) {
  if (!attempt) return null;
  const safe = { ...attempt };
  delete safe.actionTokenHash;
  return safe;
}

export class DrillAttemptConflict extends Error {
  constructor(message, { retryAfterMs = 0, attempt = null, reason = 'active' } = {}) {
    super(message);
    this.name = 'DrillAttemptConflict';
    this.code = 'DRILL_ATTEMPT_CONFLICT';
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
    this.attempt = publicAttempt(attempt);
  }
}

async function lockAttempt(tx, attemptId) {
  const { rows } = await tx.query(
    'select * from safespace.drill_attempts where id = $1 for update',
    [String(attemptId)],
  );
  return attemptFromRow(rows[0]);
}

async function attemptByProviderId(tx, providerId) {
  const { rows } = await tx.query('select * from safespace.drill_attempts where provider_id = $1', [providerId]);
  return attemptFromRow(rows[0]);
}

/**
 * Reserve an attempt before contacting a provider. When cooldownMs is supplied this
 * atomically enforces one active attempt and a per-user/channel cooldown, across every
 * server instance: the user row lock serialises them.
 */
export async function createDrillAttempt({
  userId,
  channel = 'call',
  providerId = null,
  status = 'created',
  mintActionToken = false,
  cooldownMs = 0,
} = {}) {
  if (!userId) throw new Error('userId is required');
  if (!['created', 'sent'].includes(status)) throw new Error(`invalid initial attempt status ${status}`);

  const attemptId = `attempt_${crypto.randomUUID()}`;
  const actionToken = mintActionToken ? crypto.randomBytes(32).toString('base64url') : null;
  const actionTokenHash = actionToken ? sha256(actionToken) : null;
  const createdAt = new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);
  const cleanProviderId = String(providerId || '').trim() || null;

  return transaction(async (tx) => {
    await requireLockedUser(tx, userId);

    if (cleanProviderId) {
      const existing = await attemptByProviderId(tx, cleanProviderId);
      if (existing) {
        if (existing.userId === userId && existing.channel === channel) return publicAttempt(existing);
        throw new DrillAttemptConflict('provider id already belongs to another attempt', {
          attempt: existing,
        });
      }
    }

    const minimumGap = Math.max(0, Number(cooldownMs) || 0);
    if (minimumGap > 0) {
      // Only attempts inside the window can conflict. An older attempt is past cooldown.
      const { rows } = await tx.query(
        `select * from safespace.drill_attempts
          where user_id = $1 and channel = $2 and created_at > $3
          order by created_at desc`,
        [userId, channel, new Date(createdAtMs - minimumGap).toISOString()],
      );
      const recent = rows.map(attemptFromRow);
      // A provider callback can be lost. Treat an active marker as a lock only for the
      // cooldown window; otherwise one missing webhook would block this channel forever.
      const active = recent.find((attempt) => ACTIVE_ATTEMPT_STATUSES.has(attempt.status));
      if (active) {
        throw new DrillAttemptConflict('a drill attempt is already active', {
          attempt: active,
          retryAfterMs: Math.max(0, minimumGap - (createdAtMs - Date.parse(active.createdAt))),
        });
      }
      const latest = recent[0];
      if (latest) {
        const elapsed = createdAtMs - Date.parse(latest.createdAt);
        if (elapsed < minimumGap) {
          throw new DrillAttemptConflict('drill attempt is on cooldown', {
            reason: 'cooldown',
            retryAfterMs: Math.ceil(minimumGap - elapsed),
            attempt: latest,
          });
        }
      }
    }

    const { rows } = await tx.query(
      `insert into safespace.drill_attempts
         (id, user_id, channel, status, provider_id, action_token_hash, created_at, sent_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        attemptId, userId, channel, status, cleanProviderId, actionTokenHash, createdAt,
        status === 'sent' ? createdAt : null,
      ],
    );
    return { ...publicAttempt(attemptFromRow(rows[0])), ...(actionToken ? { actionToken } : {}) };
  }, 'createDrillAttempt');
}

export async function getDrillAttempt(idOrProviderId) {
  if (!idOrProviderId) return null;
  const { rows } = await query(
    `select * from safespace.drill_attempts where id = $1 or provider_id = $1
      order by (id = $1) desc limit 1`,
    [String(idOrProviderId)],
    'getDrillAttempt',
  );
  return publicAttempt(attemptFromRow(rows[0]));
}

export async function getDrillAttemptByActionToken(actionToken) {
  if (!actionToken) return null;
  const { rows } = await query(
    'select * from safespace.drill_attempts where action_token_hash = $1',
    [sha256(actionToken)],
    'getDrillAttemptByActionToken',
  );
  return publicAttempt(attemptFromRow(rows[0]));
}

export async function getRecentDrillAttempt({ userId, channel = 'call', since = 0 } = {}) {
  if (!userId) return null;
  const sinceMs = since instanceof Date ? since.getTime() : Number(since) || Date.parse(since) || 0;
  const { rows } = await query(
    `select * from safespace.drill_attempts
      where user_id = $1 and channel = $2 and created_at >= $3
      order by created_at desc limit 1`,
    [String(userId), channel, new Date(sinceMs).toISOString()],
    'getRecentDrillAttempt',
  );
  return publicAttempt(attemptFromRow(rows[0]));
}

export async function markDrillAttemptSent(attemptId, { providerId = null } = {}) {
  if (!attemptId) throw new Error('attemptId is required');
  const cleanProviderId = String(providerId || '').trim() || null;
  const sentAt = new Date().toISOString();
  return transaction(async (tx) => {
    const attempt = await lockAttempt(tx, attemptId);
    if (!attempt) return null;
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) return publicAttempt(attempt);

    if (cleanProviderId) {
      const owner = await attemptByProviderId(tx, cleanProviderId);
      if (owner && owner.id !== attempt.id) {
        throw new DrillAttemptConflict('provider id already belongs to another attempt', {
          attempt: owner,
        });
      }
    }
    if (attempt.providerId && cleanProviderId && attempt.providerId !== cleanProviderId) {
      throw new DrillAttemptConflict('attempt already has a different provider id', { attempt });
    }
    const { rows } = await tx.query(
      `update safespace.drill_attempts
          set status = 'sent', provider_id = coalesce($2, provider_id), sent_at = coalesce(sent_at, $3)
        where id = $1
        returning *`,
      [attempt.id, cleanProviderId, sentAt],
    );
    return publicAttempt(attemptFromRow(rows[0]));
  }, 'markDrillAttemptSent');
}

export async function markDrillAttemptFailed(attemptId, { reason = 'provider_error' } = {}) {
  if (!attemptId) throw new Error('attemptId is required');
  const completedAt = new Date().toISOString();
  return transaction(async (tx) => {
    const attempt = await lockAttempt(tx, attemptId);
    if (!attempt) return null;
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) return publicAttempt(attempt);
    const { rows } = await tx.query(
      `update safespace.drill_attempts
          set status = 'failed', scored = false, failure_reason = $2, completed_at = $3,
              action_token_hash = null
        where id = $1
        returning *`,
      [attempt.id, String(reason || 'provider_error').slice(0, 80), completedAt],
    );
    return publicAttempt(attemptFromRow(rows[0]));
  }, 'markDrillAttemptFailed');
}

const FINISH_ATTEMPT_SQL = `update safespace.drill_attempts
    set status = $2, scored = $3, outcome = $4, failure_reason = $5, completed_at = $6,
        result_record_id = $7, provider_id = coalesce(provider_id, $8), action_token_hash = null
  where id = $1
  returning *`;

/**
 * Resolve and lock the attempt the identifiers name. If they name more than one attempt,
 * fail closed rather than let provider metadata complete somebody else's attempt.
 */
async function lockAttemptByIdentifiers(tx, { providerId, attemptId, actionTokenHash }) {
  const { rows } = await tx.query(
    `select * from safespace.drill_attempts
      where provider_id = $1 or id = $2 or action_token_hash = $3
      order by id
      for update`,
    [providerId, attemptId, actionTokenHash],
  );
  return rows.length === 1 ? attemptFromRow(rows[0]) : null;
}

/**
 * Resolve and complete a provider attempt in one transaction. Unknown identifiers and
 * terminal/replayed callbacks never touch XP. Supplying no outcome records an
 * operational, unscored failure rather than silently turning missing evidence into a win.
 */
export async function completeDrillAttempt({
  providerId = null,
  attemptId = null,
  actionToken = null,
  outcome = null,
  unscoredReason = null,
} = {}) {
  const cleanProviderId = String(providerId || '').trim() || null;
  const cleanAttemptId = attemptId ? String(attemptId) : null;
  const actionTokenHash = actionToken ? sha256(actionToken) : null;
  if (!cleanProviderId && !cleanAttemptId && !actionTokenHash) {
    throw new Error('providerId, attemptId or actionToken is required');
  }
  if (outcome && !OUTCOME_SET.has(outcome)) throw new Error(`unknown outcome ${outcome}`);

  const completedAt = new Date().toISOString();
  const recordId = `drill_${crypto.randomUUID()}`;
  return transaction(async (tx) => {
    const attempt = await lockAttemptByIdentifiers(tx, {
      providerId: cleanProviderId,
      attemptId: cleanAttemptId,
      actionTokenHash,
    });
    if (!attempt) {
      return { status: 'unknown', applied: false, attempt: null, record: null, user: null };
    }
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) {
      return {
        status: 'duplicate',
        applied: false,
        attempt: publicAttempt(attempt),
        record: attempt.resultRecordId ? await readResult(tx, attempt.resultRecordId) : null,
        user: await readUser(tx, attempt.userId),
      };
    }

    const recordProviderId = attempt.providerId || cleanProviderId;
    if (!outcome) {
      const record = {
        id: recordId,
        userId: attempt.userId,
        channel: attempt.channel,
        outcome: null,
        practice: false,
        result: 'UNSCORED',
        screen: null,
        xpGained: 0,
        at: completedAt,
        attemptId: attempt.id,
        ...(recordProviderId ? { providerId: recordProviderId } : {}),
        unscoredReason: String(unscoredReason || 'analysis_missing').slice(0, 80),
      };
      await insertResult(tx, record);
      const { rows } = await tx.query(FINISH_ATTEMPT_SQL, [
        attempt.id, 'failed', false, null, record.unscoredReason, completedAt, record.id, cleanProviderId,
      ]);
      return {
        status: 'unscored',
        applied: false,
        attempt: publicAttempt(attemptFromRow(rows[0])),
        record,
        user: await readUser(tx, attempt.userId),
      };
    }

    const { record, user } = await applyOutcomeInTx(tx, {
      userId: attempt.userId,
      outcome,
      channel: attempt.channel,
      practice: false,
      recordId,
      at: completedAt,
      attemptId: attempt.id,
      providerId: recordProviderId,
    });
    const { rows } = await tx.query(FINISH_ATTEMPT_SQL, [
      attempt.id, 'completed', true, outcome, null, completedAt, record.id, cleanProviderId,
    ]);
    return {
      status: 'completed',
      applied: true,
      attempt: publicAttempt(attemptFromRow(rows[0])),
      record,
      user,
    };
  }, 'completeDrillAttempt');
}

/** Backward-compatible post-send helper used by the existing call/email/SMS routes. */
export async function recordDrillFired({ userId, channel = 'call', callId = null }) {
  return createDrillAttempt({
    userId,
    channel,
    providerId: callId,
    status: 'sent',
  });
}

// --- Accounts -------------------------------------------------------------------

function normaliseUserName(name) {
  return String(name || '').trim().toUpperCase().slice(0, 30);
}

function identityLookupSecret({ required = false } = {}) {
  const secret = String(process.env.IDENTITY_LOOKUP_SECRET || '').trim();
  if (secret.length >= 32) return secret;
  if (!required) return null;
  const error = new Error('identity recovery is not configured');
  error.code = 'IDENTITY_RECOVERY_UNAVAILABLE';
  throw error;
}

// Keep a stable, non-reversible account lookup after a user removes the raw phone
// number. A keyed digest is important here: the space of valid phone numbers is small
// enough that an ordinary SHA-256 digest could be enumerated offline.
function phoneLookupHash(phone, { required = false } = {}) {
  const secret = identityLookupSecret({ required });
  if (!secret) return null;
  return crypto
    .createHmac('sha256', secret)
    .update(String(phone || '').trim())
    .digest('hex');
}

// Upsert a phone-verified user and log a 'granted' consent event (the audit trail).
// Called by /api/verify/check after OTP succeeds.
export async function registerVerifiedUser({ phone, name, email }) {
  const cleanName = normaliseUserName(name);
  if (!cleanName) throw new Error('name is required');
  const lookupHash = phoneLookupHash(phone);
  const newId = `usr_${crypto.randomUUID()}`;
  const at = new Date().toISOString();

  return transaction(async (tx) => {
    // Two OTP checks for the same new number must not create two accounts. There is no
    // row to lock yet, so serialise on a digest of the number. The unique index on
    // phone is the backstop.
    await advisoryLock(tx, `register:${sha256(`register\0${phone}`)}`);

    // Look up by phone, but key the record by an OPAQUE id. Using the phone number as the
    // primary key made it PII that leaked through every id-bearing response and URL.
    let { rows } = await tx.query('select * from safespace.users where phone = $1 for update', [phone]);
    if (!rows[0] && lookupHash) {
      ({ rows } = await tx.query(
        'select * from safespace.users where phone_lookup_hash = $1 for update',
        [lookupHash],
      ));
    }
    let user = userFromRow(rows[0]);
    const isNew = !user;
    if (isNew) {
      user = {
        id: newId,
        name: cleanName,
        role: 'ROOKIE',
        phone,
        consentToDrills: true,
        level: 1, xp: 0, xpMax: 500, streak: 0, timesSafe: 0, timesScammed: 0,
        primaryColor: '#4ecdc4', badgeCount: 0, badgeTotal: 9,
        roomName: 'GUEST ROOM', roomBg: '#081420', safeThisWeek: true, recentDrillResult: null,
      };
    }
    user.phone = phone;
    if (lookupHash) user.phoneLookupHash = lookupHash;
    user.name = cleanName;
    // A phone OTP proves control of the phone, not of an email address. Keep an
    // optional address as an unverified candidate until its signed ownership link is
    // opened. Real email drills require `emailVerifiedAt`.
    if (email) {
      const candidate = String(email).trim().toLowerCase();
      if (user.email !== candidate) {
        delete user.emailVerifiedAt;
        delete user.emailVerificationTokenHash;
        user.email = candidate;
        user.pendingEmail = candidate;
      } else if (!user.emailVerifiedAt) {
        user.pendingEmail = candidate;
      } else {
        delete user.pendingEmail;
        delete user.emailVerificationRequestedAt;
        delete user.emailVerificationTokenHash;
      }
    }
    user.consentToDrills = true;

    const saved = isNew ? await insertUser(tx, user) : await saveUser(tx, user);
    await logConsent(tx, { userId: saved.id, type: 'granted', channel: 'otp', at });
    return saved;
  }, 'registerVerifiedUser');
}

export async function setUserName(userId, name) {
  const cleanName = normaliseUserName(name);
  if (!cleanName) throw new Error('name is required');
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    user.name = cleanName;
    return saveUser(tx, user);
  }, 'setUserName');
}

// Backward-compatible storage helper. Setting an address never marks it verified:
// controlling the account's phone is not proof that the caller owns this inbox.
export async function setUserEmail(userId, email) {
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    user.email = String(email).trim().toLowerCase();
    user.pendingEmail = user.email;
    delete user.emailVerifiedAt;
    delete user.emailVerificationTokenHash;
    return saveUser(tx, user);
  }, 'setUserEmail');
}

export class EmailVerificationConflict extends Error {
  constructor(message, { retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'EmailVerificationConflict';
    this.code = 'EMAIL_VERIFICATION_CONFLICT';
    this.retryAfterMs = retryAfterMs;
  }
}

export class VerificationRateLimitConflict extends Error {
  constructor(message, { retryAfterMs = 0, reason = 'rate_limited' } = {}) {
    super(message);
    this.name = 'VerificationRateLimitConflict';
    this.code = 'VERIFICATION_RATE_LIMITED';
    this.reason = reason;
    this.retryAfterMs = retryAfterMs;
  }
}

// --- Rate limits ------------------------------------------------------------------

function rateLimitSubjectKey(scope, subject) {
  const material = `${scope}\0${String(subject)}`;
  const lookupSecret = String(process.env.IDENTITY_LOOKUP_SECRET || '').trim();
  // Production already requires this secret for detach-safe account recovery, so use
  // it to stop an exposed rate-limit table from becoming an enumerable phone/email
  // directory. Development still gets stable non-raw keys before that secret is set.
  return lookupSecret.length >= 32
    ? crypto.createHmac('sha256', lookupSecret).update(material).digest('hex')
    : crypto.createHash('sha256').update(material).digest('hex');
}

function retryAfterForWindow(hits, nowMs, windowMs) {
  const oldest = Math.min(...hits);
  return Math.max(1, Math.ceil(windowMs - (nowMs - oldest)));
}

/**
 * Lock each (scope, subject) and read its still-active hits, oldest first. Locks are
 * taken in sorted order so two requests touching the same keys cannot deadlock.
 */
async function lockRateLimits(tx, subjects, { nowMs, windowMs }) {
  const buckets = subjects.map(({ scope, subject }) => ({
    scope,
    key: rateLimitSubjectKey(scope, subject),
    hits: [],
  }));
  for (const lockKey of buckets.map(({ scope, key }) => `rate:${scope}:${key}`).sort()) {
    await advisoryLock(tx, lockKey);
  }
  const cutoff = new Date(nowMs - windowMs).toISOString();
  for (const bucket of buckets) {
    const { rows } = await tx.query(
      `select hit_at from safespace.rate_limit_hits
        where scope = $1 and subject_key = $2 and hit_at > $3
        order by hit_at`,
      [bucket.scope, bucket.key, cutoff],
    );
    bucket.hits = rows.map((row) => new Date(row.hit_at).getTime());
  }
  return buckets;
}

/** Record one send per bucket, and delete hits whose window has passed. */
async function recordRateLimitHits(tx, buckets, { nowMs, windowMs }) {
  const cutoff = new Date(nowMs - windowMs).toISOString();
  // Expired hits are deleted, not kept: the table must not become a record of every
  // number and inbox that was ever verified.
  for (const scope of new Set(buckets.map((bucket) => bucket.scope))) {
    await tx.query('delete from safespace.rate_limit_hits where scope = $1 and hit_at <= $2', [scope, cutoff]);
  }
  const at = new Date(nowMs).toISOString();
  for (const bucket of buckets) {
    await tx.query(
      'insert into safespace.rate_limit_hits (scope, subject_key, hit_at) values ($1, $2, $3)',
      [bucket.scope, bucket.key, at],
    );
  }
}

/**
 * Atomically reserve an ownership-verification send. This prevents a signed-in user
 * from turning the verification endpoint into a rapid mail relay, including when
 * several server instances receive requests at once.
 */
export async function beginEmailVerification({
  userId,
  email,
  verificationId,
  cooldownMs = 60_000,
  now = Date.now(),
  rateWindowMs = ONE_HOUR_MS,
  maxAccountSends = EMAIL_VERIFICATION_ACCOUNT_MAX,
  maxDestinationSends = EMAIL_VERIFICATION_DESTINATION_MAX,
} = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  const opaqueId = String(verificationId || '').trim();
  if (!userId || !normalized || opaqueId.length < 32) {
    throw new Error('userId, email and an opaque verificationId are required');
  }
  const tokenHash = sha256(opaqueId);
  const requestedAtMs = Number(now);
  if (!Number.isFinite(requestedAtMs)) throw new Error('now must be a finite timestamp');
  const requestedAt = new Date(requestedAtMs).toISOString();
  const windowMs = positiveNumber(rateWindowMs, ONE_HOUR_MS);
  const accountMax = positiveInteger(maxAccountSends, EMAIL_VERIFICATION_ACCOUNT_MAX);
  const destinationMax = positiveInteger(maxDestinationSends, EMAIL_VERIFICATION_DESTINATION_MAX);

  return transaction(async (tx) => {
    // Row lock first, advisory locks second: the lock order every writer follows.
    const user = await requireLockedUser(tx, userId);
    if (user.email === normalized && user.emailVerifiedAt) {
      // Explicitly choosing the verified address again cancels any abandoned change
      // request and invalidates its older link.
      delete user.pendingEmail;
      delete user.emailVerificationRequestedAt;
      delete user.emailVerificationTokenHash;
      return { alreadyVerified: true, user: await saveUser(tx, user) };
    }

    const previousMs = Date.parse(user.emailVerificationRequestedAt || '');
    const waitMs = Math.max(0, Number(cooldownMs) || 0);
    if (Number.isFinite(previousMs) && requestedAtMs - previousMs < waitMs) {
      throw new EmailVerificationConflict('email verification is on cooldown', {
        retryAfterMs: Math.ceil(waitMs - (requestedAtMs - previousMs)),
      });
    }

    const window = { nowMs: requestedAtMs, windowMs };
    const [account, destination] = await lockRateLimits(tx, [
      { scope: 'email-account', subject: userId },
      { scope: 'email-destination', subject: normalized },
    ], window);
    if (account.hits.length >= accountMax) {
      throw new EmailVerificationConflict('email verification account limit reached', {
        retryAfterMs: retryAfterForWindow(account.hits, requestedAtMs, windowMs),
      });
    }
    if (destination.hits.length >= destinationMax) {
      throw new EmailVerificationConflict('email verification destination limit reached', {
        retryAfterMs: retryAfterForWindow(destination.hits, requestedAtMs, windowMs),
      });
    }

    await recordRateLimitHits(tx, [account, destination], window);
    user.pendingEmail = normalized;
    user.emailVerificationRequestedAt = requestedAt;
    user.emailVerificationTokenHash = tokenHash;
    return { alreadyVerified: false, user: await saveUser(tx, user) };
  }, 'beginEmailVerification');
}

function tokenMatches(expectedHash, suppliedHash) {
  const expected = String(expectedHash || '');
  return expected.length === suppliedHash.length
    && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(suppliedHash));
}

/**
 * Release only the exact send reservation that failed. Comparing both the address and
 * opaque credential prevents a slow failure for request A from deleting a newer request
 * B made for the same inbox.
 */
export async function cancelEmailVerification(userId, email, verificationId) {
  const normalized = String(email || '').trim().toLowerCase();
  const opaqueId = String(verificationId || '').trim();
  if (!userId || !normalized || opaqueId.length < 32) {
    throw new Error('userId, email and an opaque verificationId are required');
  }
  const suppliedHash = sha256(opaqueId);
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    if (user.pendingEmail !== normalized) return user;
    if (!tokenMatches(user.emailVerificationTokenHash, suppliedHash)) return user;
    delete user.pendingEmail;
    delete user.emailVerificationRequestedAt;
    delete user.emailVerificationTokenHash;
    return saveUser(tx, user);
  }, 'cancelEmailVerification');
}

/**
 * Atomically reserve one public phone-OTP send, so every server instance enforces the
 * same 30-second gap, five-per-hour destination cap and requester-wide cap across
 * unique numbers.
 */
export async function reservePhoneVerificationSend({
  phone,
  requesterKey = null,
  now = Date.now(),
  cooldownMs = 30_000,
  rateWindowMs = ONE_HOUR_MS,
  maxSends = PHONE_VERIFICATION_DESTINATION_MAX,
  maxRequesterSends = PHONE_VERIFICATION_REQUESTER_MAX,
  // The destination caps exist to stop us texting a real phone repeatedly. When the
  // caller sends no SMS at all (dev bypass), they guard nothing and only block demos.
  // The requester cap still applies: it bounds writes to this store either way.
  skipDestinationLimit = false,
} = {}) {
  const destination = String(phone || '').trim();
  const requester = String(requesterKey || '').trim();
  if (!destination) throw new Error('phone is required');
  const requestedAtMs = Number(now);
  if (!Number.isFinite(requestedAtMs)) throw new Error('now must be a finite timestamp');
  const windowMs = positiveNumber(rateWindowMs, ONE_HOUR_MS);
  const boundedCooldownMs = Math.max(0, Number(cooldownMs) || 0);
  const destinationMax = positiveInteger(maxSends, PHONE_VERIFICATION_DESTINATION_MAX);
  const requesterMax = positiveInteger(maxRequesterSends, PHONE_VERIFICATION_REQUESTER_MAX);

  return transaction(async (tx) => {
    const subjects = [
      ...(skipDestinationLimit ? [] : [{ scope: 'phone-destination', subject: destination }]),
      ...(requester ? [{ scope: 'phone-requester', subject: requester }] : []),
    ];
    const window = { nowMs: requestedAtMs, windowMs };
    const buckets = await lockRateLimits(tx, subjects, window);
    const destinationBucket = buckets.find((bucket) => bucket.scope === 'phone-destination') || null;
    const requesterBucket = buckets.find((bucket) => bucket.scope === 'phone-requester') || null;

    const hits = destinationBucket?.hits ?? null;
    if (hits && hits.length >= destinationMax) {
      throw new VerificationRateLimitConflict('phone verification hourly limit reached', {
        reason: 'destination_hourly',
        retryAfterMs: retryAfterForWindow(hits, requestedAtMs, windowMs),
      });
    }
    const latest = hits?.length ? hits[hits.length - 1] : null;
    if (latest !== null && requestedAtMs - latest < boundedCooldownMs) {
      throw new VerificationRateLimitConflict('phone verification is on cooldown', {
        reason: 'destination_cooldown',
        retryAfterMs: Math.max(1, Math.ceil(boundedCooldownMs - (requestedAtMs - latest))),
      });
    }
    if (requesterBucket && requesterBucket.hits.length >= requesterMax) {
      throw new VerificationRateLimitConflict('phone verification requester limit reached', {
        reason: 'requester_hourly',
        retryAfterMs: retryAfterForWindow(requesterBucket.hits, requestedAtMs, windowMs),
      });
    }

    await recordRateLimitHits(tx, buckets, window);
    return {
      ok: true,
      remaining: hits ? Math.max(0, destinationMax - (hits.length + 1)) : null,
    };
  }, 'reservePhoneVerificationSend');
}

/**
 * Consume the current pending address after its signed link is opened. Requiring the
 * pending address to match also invalidates an older link when the user requests a
 * verification for a different inbox.
 */
export async function setVerifiedUserEmail(userId, verificationId) {
  const suppliedHash = sha256(String(verificationId || '').trim());
  const verifiedAt = new Date().toISOString();
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    if (!user.pendingEmail || !tokenMatches(user.emailVerificationTokenHash, suppliedHash)) {
      const error = new Error('email verification is no longer current');
      error.code = 'EMAIL_VERIFICATION_STALE';
      throw error;
    }
    user.email = user.pendingEmail;
    user.emailVerifiedAt = verifiedAt;
    delete user.pendingEmail;
    delete user.emailVerificationRequestedAt;
    delete user.emailVerificationTokenHash;
    const saved = await saveUser(tx, user);
    await logConsent(tx, { userId, type: 'email-verified', channel: 'email', at: verifiedAt });
    return saved;
  }, 'setVerifiedUserEmail');
}

// Remove the verified phone and every session whose authority came from that
// verification. Progress and optional email remain intact so the account can reconnect
// a number later without losing its training history.
export async function detachVerifiedPhone(userId) {
  const at = new Date().toISOString();
  return transaction(async (tx) => {
    const user = await requireLockedUser(tx, userId);
    if (!user.phone) {
      const error = new Error('no verified phone on file');
      error.code = 'PHONE_NOT_ATTACHED';
      throw error;
    }

    // Preserve only a keyed lookup so a later OTP for the same number reconnects this
    // account and its progress. Never detach without it: doing so would silently orphan
    // the account that the UI promises to preserve. Recompute even when a hash exists,
    // which proves the deployed secret is available and migrates to a rotated key.
    user.phoneLookupHash = phoneLookupHash(user.phone, { required: true });
    delete user.phone;
    user.consentToDrills = false;
    const saved = await saveUser(tx, user);
    await tx.query('delete from safespace.sessions where user_id = $1', [user.id]);
    await logConsent(tx, { userId: user.id, type: 'withdrawn', channel: 'account', at });
    return saved;
  }, 'detachVerifiedPhone');
}

// --- Sessions -------------------------------------------------------------------
// A drill places a real phone call, so the caller must prove who they are with a
// server-issued bearer token. A client-supplied user id is an assertion, not proof.

function sessionTtlMs() {
  return Math.max(
    60_000,
    Number(process.env.SESSION_TTL_MS) || 30 * 24 * 60 * 60 * 1000,
  );
}

/** Issue a session token for a verified user. Returns the opaque token. */
export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date();
  await query(
    `insert into safespace.sessions (token_hash, user_id, created_at, expires_at)
     values ($1, $2, $3, $4)`,
    [
      sha256(token),
      String(userId),
      createdAt.toISOString(),
      new Date(createdAt.getTime() + sessionTtlMs()).toISOString(),
    ],
    'createSession',
  );
  return token;
}

/** Look up a user by phone (server-internal only — never expose phone to clients). */
export async function getUserByPhone(phone) {
  if (!phone) return null;
  const { rows } = await query('select * from safespace.users where phone = $1', [phone], 'getUserByPhone');
  return userFromRow(rows[0]);
}

/** Resolve a bearer token to its user id, or null. */
export async function getUserIdByToken(token) {
  if (!token) return null;
  const { rows } = await query(
    'select user_id, expires_at from safespace.sessions where token_hash = $1',
    [sha256(token)],
    'getUserIdByToken',
  );
  const session = rows[0];
  if (!session) return null;
  return new Date(session.expires_at).getTime() > Date.now() ? session.user_id : null;
}

// --- Scam intel tactic cards ------------------------------------------------------
// A bounded rotating set, not an archive. Cards are written only by the refresh job
// after validation, and re-validated again before any call uses one, so nothing here is
// trusted for having been stored.

export const MAX_TACTIC_CARDS = 10;
export const DEFAULT_TACTIC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function tacticMaxAgeMs() {
  const configured = Number(process.env.INTEL_CARD_MAX_AGE_MS);
  return Number.isFinite(configured)
    && configured >= 60 * 60 * 1000
    && configured <= 180 * 24 * 60 * 60 * 1000
    ? configured
    : DEFAULT_TACTIC_MAX_AGE_MS;
}

function liveTacticCards(cards, nowMs, maxAgeMs) {
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    const fetchedAt = Date.parse(card?.fetchedAt);
    // A timestamp from the future is as suspect as a stale one.
    return Number.isFinite(fetchedAt) && fetchedAt <= nowMs + 5 * 60 * 1000 && nowMs - fetchedAt <= maxAgeMs;
  });
}

async function storedTacticCards(runner) {
  const { rows } = await runner('select card from safespace.tactic_cards order by fetched_at desc');
  return rows.map((row) => row.card);
}

export async function listLiveTacticCards({ now = Date.now(), maxAgeMs = tacticMaxAgeMs() } = {}) {
  const cards = await storedTacticCards((sql) => query(sql, [], 'listLiveTacticCards'));
  return liveTacticCards(cards, now, maxAgeMs);
}

/**
 * Merge freshly validated cards into the live set: newest first, one card per id, capped.
 * Re-running a refresh with the same results only refreshes timestamps, so a duplicated
 * cron invocation cannot grow the set.
 */
export async function mergeTacticCards(incoming, { now = Date.now(), maxAgeMs = tacticMaxAgeMs() } = {}) {
  return transaction(async (tx) => {
    await advisoryLock(tx, 'safespace:tactic-cards');
    const existing = await storedTacticCards((sql) => tx.query(sql));
    const byId = new Map();
    const candidates = liveTacticCards(
      [...(Array.isArray(incoming) ? incoming : []), ...existing],
      now,
      maxAgeMs,
    );
    for (const card of candidates) {
      if (typeof card?.id === 'string' && !byId.has(card.id)) byId.set(card.id, card);
    }
    const cards = [...byId.values()]
      .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))
      .slice(0, MAX_TACTIC_CARDS);

    await tx.query('delete from safespace.tactic_cards');
    for (const card of cards) {
      await tx.query(
        'insert into safespace.tactic_cards (id, card, fetched_at) values ($1, $2, $3)',
        [card.id, JSON.stringify(card), card.fetchedAt],
      );
    }
    return cards;
  }, 'mergeTacticCards');
}
