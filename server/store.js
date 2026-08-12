// Tiny whole-document store. Fine for a POC/demo — swap for Postgres (per the spec's
// data model) when it's real. Seeds from data.seed.json on first run.
//
// Two backends, chosen by environment:
//
//   file  (default)  — server/data.json on a real disk. Used by `npm run dev` and by
//                      the Huawei ECS deploy, where the disk persists across restarts.
//   redis (Upstash)  — used when UPSTASH_REDIS_REST_URL is set.
//
// The Redis backend exists because serverless hosts (Vercel, Lambda) give you a
// READ-ONLY filesystem. There, the very first `fs.copyFileSync` below throws EROFS and
// every endpoint 500s — the app doesn't degrade, it dies. Upstash is reachable over
// plain HTTP, so no TCP connection pooling is needed and no driver dependency either.
//
// Both backends keep the same "load the whole document, mutate, save it back" shape, so
// the logic below is identical either way. The difference is that several serverless
// instances can run at once, which makes the read-modify-write race real rather than
// theoretical — hence the compare-and-set in `mutate`.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { computeResult, KNOWN_OUTCOMES } from './xp.js';

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_FILE = path.join(__dirname, 'data.json');
const SEED_FILE = path.join(__dirname, 'data.seed.json');

// Tests and one-off tools must never have to delete the application's normal data
// file. Resolve this lazily so a test can select an isolated path even if another
// module imported the store first.
function dataFile() {
  const configured = String(process.env.SAFESPACE_DATA_FILE || '').trim();
  return configured ? path.resolve(configured) : DEFAULT_DATA_FILE;
}

const DB_KEY = 'safespace:db';
const VERSION_KEY = 'safespace:db:version';

// Read lazily rather than at import time so tests can point the store at a backend
// after the module has already been loaded.
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL;
const usingRedis = () => Boolean(redisUrl());

// Read from disk once per process. Until the store has been written to, EVERY request
// falls back to the seed, so without this each one paid a synchronous disk read inside
// the request path — on a serverless host, in the handler.
//
// The raw TEXT is cached rather than the parsed object, and re-parsed per call on
// purpose: callers mutate the document they are handed, so they each need their own
// copy. Parsing is the cheap half; the disk hit was the expensive one.
let seedText = null;
function readSeed() {
  if (seedText === null) seedText = fs.readFileSync(SEED_FILE, 'utf-8');
  return JSON.parse(seedText);
}

// --- File backend -----------------------------------------------------------

function fileRead() {
  // Read first and handle the miss, rather than checking existence and then reading:
  // the file can be removed in between (a reset, a redeploy, another test process),
  // and an ENOENT thrown from inside a request is a 500 for something recoverable.
  try {
    return { db: JSON.parse(fs.readFileSync(dataFile(), 'utf-8')), version: null };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // No file yet: hand back the seed. Whoever is mutating will persist it on save,
    // so a pure read never has to write.
    return { db: readSeed(), version: null };
  }
}

function fileWrite(db) {
  const destination = dataFile();
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    // Write and fsync a complete sibling file, then atomically replace the old
    // document. A crash can now leave an unused .tmp file, but never half JSON.
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(db, null, 2));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, destination);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') throw cleanupError;
    }
    throw error;
  }
  return true; // a single process writing synchronously cannot lose a race with itself
}

// --- Redis backend ----------------------------------------------------------

async function redisCmd(args) {
  const res = await fetch(redisUrl(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args.map(String)),
  });
  if (!res.ok) throw new Error(`upstash returned ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`upstash: ${body.error}`);
  return body.result;
}

async function redisRead() {
  const [raw, version] = await redisCmd(['MGET', DB_KEY, VERSION_KEY]);
  // Empty database: fall back to the seed, and record that we expected no version so
  // the first write only lands if nobody else seeded it first.
  if (raw == null) return { db: readSeed(), version: null };
  return { db: JSON.parse(raw), version };
}

// Writes only if the version we read is still current, so two instances handling
// requests at the same time can't silently clobber each other's XP updates. Redis
// runs this atomically; `false` is what a missing key looks like inside Lua.
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if current == ARGV[2] or (current == false and ARGV[2] == '') then
  redis.call('SET', KEYS[1], ARGV[1])
  redis.call('INCR', KEYS[2])
  return 1
end
return 0
`;

async function redisWrite(db, version) {
  const ok = await redisCmd([
    'EVAL', CAS_SCRIPT, 2, DB_KEY, VERSION_KEY, JSON.stringify(db), version ?? '',
  ]);
  return Number(ok) === 1;
}

// --- Document access --------------------------------------------------------

async function readDb() {
  return usingRedis() ? redisRead() : fileRead();
}

/**
 * Returned by a `mutate` callback that decided nothing needs changing — the write is
 * then skipped entirely, so a read-only outcome costs a read rather than a round trip
 * plus a write.
 */
const UNCHANGED = Symbol('store.unchanged');
const unchanged = (value = null) => ({ [UNCHANGED]: true, value });
let fileMutationTail = Promise.resolve();

function mutationResult(result) {
  if (result === UNCHANGED) return { changed: false, value: null };
  if (result?.[UNCHANGED]) return { changed: false, value: result.value };
  return { changed: true, value: result };
}

/**
 * Read the document, apply `fn` to it, and save it back — retrying if a concurrent
 * writer got there first. `fn` must be pure enough to run more than once: it may be
 * replayed against a fresher copy of the document. Return `UNCHANGED` from `fn` to
 * skip the write.
 */
async function mutate(fn) {
  if (!usingRedis()) {
    // `async` requests can both read before either writes even though writeFileSync is
    // synchronous. Serialize the complete read/mutate/rename transaction in-process.
    const run = async () => {
      const { db } = fileRead();
      const result = mutationResult(fn(db));
      if (result.changed) fileWrite(db);
      return result.value;
    };
    const queued = fileMutationTail.then(run, run);
    // Keep the queue usable after a rejected mutation.
    fileMutationTail = queued.then(() => undefined, () => undefined);
    return queued;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { db, version } = await readDb();
    const result = mutationResult(fn(db));
    if (!result.changed) return result.value;

    const saved = usingRedis() ? await redisWrite(db, version) : fileWrite(db);
    if (saved) return result.value;

    // Retry immediately and every writer that just collided retries in lockstep,
    // colliding again. A little jittered backoff spreads them out.
    await new Promise((r) => setTimeout(r, 10 * (attempt + 1) + Math.random() * 15));
  }
  throw new Error('store: gave up after 5 attempts, too many concurrent writers');
}

export async function getUser(id) {
  const { db } = await readDb();
  return db.users[id] || null;
}

export async function listConsentedUsers() {
  const { db } = await readDb();
  return Object.values(db.users).filter((u) => u.consentToDrills);
}

// Leaderboard = users ranked by xp, shaped for the React LeaderboardScreen.
// Explicit field list — never spreads the raw user, so PII can't leak in.
export async function getLeaderboard() {
  const { db } = await readDb();
  return Object.values(db.users)
    .sort((a, b) => b.xp - a.xp)
    .map((u, i) => ({ rank: i + 1, id: u.id, name: u.name, score: u.xp, level: u.level, wins: u.timesSafe }));
}

// All family members, shaped for the React FamilyHomeScreen (dollhouse rooms).
// Projected — this endpoint is world-readable, so it must not carry phone numbers.
export async function getFamily() {
  const { db } = await readDb();
  return Object.values(db.users).map(publicUser);
}

const OUTCOME_SET = new Set(KNOWN_OUTCOMES);
const ACTIVE_ATTEMPT_STATUSES = new Set(['created', 'sent']);
const TERMINAL_ATTEMPT_STATUSES = new Set(['completed', 'failed']);
const ONE_HOUR_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_ACCOUNT_MAX = 5;
const EMAIL_VERIFICATION_DESTINATION_MAX = 3;
const PHONE_VERIFICATION_DESTINATION_MAX = 5;
const PHONE_VERIFICATION_REQUESTER_MAX = 20;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  return Math.max(1, Math.floor(positiveNumber(value, fallback)));
}

function rateLimitSubjectKey(scope, subject) {
  const material = `${scope}\0${String(subject)}`;
  const lookupSecret = String(process.env.IDENTITY_LOOKUP_SECRET || '').trim();
  // Production already requires this secret for detach-safe account recovery, so use
  // it to stop an exposed rate-limit document from becoming an enumerable phone/email
  // directory. Development still gets stable non-raw keys before that secret is set.
  return lookupSecret.length >= 32
    ? crypto.createHmac('sha256', lookupSecret).update(material).digest('hex')
    : crypto.createHash('sha256').update(material).digest('hex');
}

/**
 * Return the still-active timestamps for one pseudonymous rate-limit subject. Old
 * entries across the scope are compacted on every successful reservation, so the
 * durable document does not retain destinations after their enforcement window.
 */
function prepareRateLimit(db, {
  scope,
  subject,
  nowMs,
  windowMs,
}) {
  db.verificationRateLimits = db.verificationRateLimits || {};
  const bucket = db.verificationRateLimits[scope]
    && typeof db.verificationRateLimits[scope] === 'object'
    ? db.verificationRateLimits[scope]
    : {};
  db.verificationRateLimits[scope] = bucket;

  for (const [key, rawHits] of Object.entries(bucket)) {
    const active = Array.isArray(rawHits)
      ? rawHits
        .map(Number)
        .filter((hit) => Number.isFinite(hit) && nowMs - hit < windowMs)
      : [];
    if (active.length) bucket[key] = active;
    else delete bucket[key];
  }

  const key = rateLimitSubjectKey(scope, subject);
  const hits = bucket[key] || [];
  bucket[key] = hits;
  return hits;
}

function retryAfterForWindow(hits, nowMs, windowMs) {
  const oldest = Math.min(...hits);
  return Math.max(1, Math.ceil(windowMs - (nowMs - oldest)));
}

function pendingQueue(db, userId, create = false) {
  const current = db.pendingResults?.[userId];
  if (Array.isArray(current)) return current;
  if (!create) return current && typeof current === 'object' ? [current] : [];

  db.pendingResults = db.pendingResults || {};
  // Transparently migrate the old one-result shape the next time this user is written.
  const queue = current && typeof current === 'object' ? [current] : [];
  db.pendingResults[userId] = queue;
  return queue;
}

function attemptState(db, create = false) {
  const current = db.drillAttempts;
  if (
    current?.byId && typeof current.byId === 'object'
    && current?.byProviderId && typeof current.byProviderId === 'object'
    && current?.byActionTokenHash && typeof current.byActionTokenHash === 'object'
  ) return current;
  if (!create) return { byId: {}, byProviderId: {}, byActionTokenHash: {} };

  db.drillAttempts = {
    byId: current?.byId || {},
    byProviderId: current?.byProviderId || {},
    byActionTokenHash: current?.byActionTokenHash || {},
  };
  return db.drillAttempts;
}

function publicAttempt(attempt) {
  if (!attempt) return null;
  const safe = { ...attempt };
  delete safe.actionTokenHash;
  return safe;
}

function findAttempt(state, { attemptId, providerId, actionTokenHash } = {}) {
  const providerAttemptId = providerId ? state.byProviderId[providerId] : null;
  const tokenAttemptId = actionTokenHash ? state.byActionTokenHash[actionTokenHash] : null;

  // If two supplied identifiers resolve to different attempts, fail closed rather
  // than allowing provider metadata to complete somebody else's attempt.
  const resolved = [providerAttemptId, attemptId, tokenAttemptId].filter(
    (id) => id && state.byId[id],
  );
  if (new Set(resolved).size > 1) return null;
  return state.byId[resolved[0]] || null;
}

function queueResult(db, userId, record) {
  pendingQueue(db, userId, true).push(record);
}

function applyOutcomeToDb(db, {
  userId,
  outcome,
  channel,
  practice,
  recordId,
  at,
  attemptId = null,
  providerId = null,
}) {
  const user = db.users[userId];
  if (!user) throw new Error(`unknown user ${userId}`);
  if (!OUTCOME_SET.has(outcome)) throw new Error(`unknown outcome ${outcome}`);

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
  db.drills = db.drills || [];
  db.drills.push(record);

  // Every real drill gets surfaced until the client explicitly ACKs it. SAFE outcomes
  // have no result screen, but delivery is still needed to clear the client's
  // "awaiting call" marker without turning an opt-out into a win or loss.
  if (!practice) queueResult(db, userId, record);
  return { record, user };
}

/**
 * Apply an outcome that does not belong to a provider attempt (practice and demo use).
 * Provider callbacks must use completeDrillAttempt so attribution and scoring are one
 * atomic, exactly-once mutation.
 */
export async function applyOutcome({ userId, outcome, channel = 'call', practice = false }) {
  const recordId = `drill_${crypto.randomUUID()}`;
  const at = new Date().toISOString();
  return mutate((db) => applyOutcomeToDb(db, {
    userId, outcome, channel, practice, recordId, at,
  }));
}

/**
 * Idempotent practice scoring for retrying/double-clicking clients. The client id is
 * namespaced to the authenticated user and stored as a digest to keep arbitrary input
 * out of document keys.
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
  const sourceKey = crypto.createHash('sha256')
    .update(`practice\0${userId}\0${cleanId}`)
    .digest('hex');
  const recordId = `drill_${crypto.randomUUID()}`;
  const at = new Date().toISOString();

  return mutate((db) => {
    db.outcomeSourceIds = db.outcomeSourceIds || {};
    const existingId = db.outcomeSourceIds[sourceKey];
    if (existingId) {
      const record = db.drills?.find((item) => item.id === existingId) || null;
      return unchanged({
        status: 'duplicate',
        applied: false,
        record,
        user: db.users[userId] || null,
      });
    }
    const { record, user } = applyOutcomeToDb(db, {
      userId,
      outcome,
      channel,
      practice: true,
      recordId,
      at,
    });
    db.outcomeSourceIds[sourceKey] = record.id;
    return { status: 'completed', applied: true, record, user };
  });
}

/** Non-destructive result reads. The first item is the next result to display. */
export async function listPendingResults(userId) {
  const { db } = await readDb();
  return [...pendingQueue(db, userId)];
}

export async function peekPendingResult(userId) {
  const pending = await listPendingResults(userId);
  return pending[0] || null;
}

/** Remove exactly the result the client confirms it displayed. */
export async function ackPendingResult(userId, resultId) {
  if (!userId || !resultId) return null;
  return mutate((db) => {
    const queue = pendingQueue(db, userId);
    const index = queue.findIndex((record) => record?.id === resultId);
    if (index < 0) return unchanged(null);

    // Calling pendingQueue in create mode also persists migration of a legacy singleton.
    const writableQueue = pendingQueue(db, userId, true);
    const [acknowledged] = writableQueue.splice(index, 1);
    if (writableQueue.length === 0) delete db.pendingResults[userId];
    return acknowledged;
  });
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

/**
 * Reserve an attempt before contacting a provider. When cooldownMs is supplied this
 * atomically enforces one active attempt and a per-user/channel cooldown, including
 * across Redis instances.
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
  const actionTokenHash = actionToken
    ? crypto.createHash('sha256').update(actionToken).digest('hex')
    : null;
  const createdAt = new Date().toISOString();
  const createdAtMs = Date.parse(createdAt);
  const cleanProviderId = String(providerId || '').trim() || null;
  const firedRecordId = `fired_${crypto.randomUUID()}`;

  return mutate((db) => {
    if (!db.users[userId]) throw new Error(`unknown user ${userId}`);
    const state = attemptState(db, true);

    if (cleanProviderId && state.byProviderId[cleanProviderId]) {
      const existing = state.byId[state.byProviderId[cleanProviderId]];
      if (existing?.userId === userId && existing?.channel === channel) {
        return unchanged(publicAttempt(existing));
      }
      throw new DrillAttemptConflict('provider id already belongs to another attempt', {
        attempt: existing,
      });
    }

    const minimumGap = Math.max(0, Number(cooldownMs) || 0);
    if (minimumGap > 0) {
      const matching = Object.values(state.byId)
        .filter((attempt) => attempt.userId === userId && attempt.channel === channel)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      // A provider callback can be lost. Treat an active marker as a lock only for the
      // cooldown window; otherwise one missing webhook would block this channel forever.
      const active = matching.find((attempt) =>
        ACTIVE_ATTEMPT_STATUSES.has(attempt.status)
        && createdAtMs - Date.parse(attempt.createdAt) < minimumGap);
      if (active) {
        throw new DrillAttemptConflict('a drill attempt is already active', {
          attempt: active,
          retryAfterMs: Math.max(
            0,
            minimumGap - (createdAtMs - Date.parse(active.createdAt)),
          ),
        });
      }
      const latest = matching[0];
      const elapsed = latest ? createdAtMs - Date.parse(latest.createdAt) : Infinity;
      if (elapsed < minimumGap) {
        throw new DrillAttemptConflict('drill attempt is on cooldown', {
          reason: 'cooldown',
          retryAfterMs: Math.ceil(minimumGap - elapsed),
          attempt: latest,
        });
      }
    }

    const attempt = {
      id: attemptId,
      userId,
      channel,
      status,
      providerId: cleanProviderId,
      createdAt,
      ...(status === 'sent' ? { sentAt: createdAt } : {}),
      ...(actionTokenHash ? { actionTokenHash } : {}),
    };
    state.byId[attemptId] = attempt;
    if (cleanProviderId) state.byProviderId[cleanProviderId] = attemptId;
    if (actionTokenHash) state.byActionTokenHash[actionTokenHash] = attemptId;

    db.drills = db.drills || [];
    db.drills.push({
      id: firedRecordId,
      attemptId,
      userId,
      channel,
      ...(cleanProviderId ? { providerId: cleanProviderId, callId: cleanProviderId } : {}),
      status,
      at: createdAt,
    });
    return { ...publicAttempt(attempt), ...(actionToken ? { actionToken } : {}) };
  });
}

export async function getDrillAttempt(idOrProviderId) {
  if (!idOrProviderId) return null;
  const { db } = await readDb();
  const state = attemptState(db);
  const attempt = state.byId[idOrProviderId]
    || state.byId[state.byProviderId[idOrProviderId]]
    || null;
  return publicAttempt(attempt);
}

export async function getDrillAttemptByActionToken(actionToken) {
  if (!actionToken) return null;
  const actionTokenHash = crypto.createHash('sha256').update(String(actionToken)).digest('hex');
  const { db } = await readDb();
  const state = attemptState(db);
  return publicAttempt(findAttempt(state, { actionTokenHash }));
}

export async function getRecentDrillAttempt({ userId, channel = 'call', since = 0 } = {}) {
  if (!userId) return null;
  const sinceMs = since instanceof Date ? since.getTime() : Number(since) || Date.parse(since) || 0;
  const { db } = await readDb();
  const attempts = Object.values(attemptState(db).byId)
    .filter((attempt) =>
      attempt.userId === userId
      && attempt.channel === channel
      && Date.parse(attempt.createdAt) >= sinceMs)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return publicAttempt(attempts[0] || null);
}

export async function markDrillAttemptSent(attemptId, { providerId = null } = {}) {
  if (!attemptId) throw new Error('attemptId is required');
  const cleanProviderId = String(providerId || '').trim() || null;
  const sentAt = new Date().toISOString();
  return mutate((db) => {
    const state = attemptState(db, true);
    const attempt = state.byId[attemptId];
    if (!attempt) return unchanged(null);
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) return unchanged(publicAttempt(attempt));

    const owner = cleanProviderId ? state.byProviderId[cleanProviderId] : null;
    if (owner && owner !== attemptId) {
      throw new DrillAttemptConflict('provider id already belongs to another attempt', {
        attempt: state.byId[owner],
      });
    }
    if (attempt.providerId && cleanProviderId && attempt.providerId !== cleanProviderId) {
      throw new DrillAttemptConflict('attempt already has a different provider id', {
        attempt,
      });
    }
    if (cleanProviderId) {
      attempt.providerId = cleanProviderId;
      state.byProviderId[cleanProviderId] = attemptId;
    }
    attempt.status = 'sent';
    attempt.sentAt = attempt.sentAt || sentAt;
    return publicAttempt(attempt);
  });
}

export async function markDrillAttemptFailed(attemptId, { reason = 'provider_error' } = {}) {
  if (!attemptId) throw new Error('attemptId is required');
  const completedAt = new Date().toISOString();
  return mutate((db) => {
    const state = attemptState(db, true);
    const attempt = state.byId[attemptId];
    if (!attempt) return unchanged(null);
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) return unchanged(publicAttempt(attempt));
    attempt.status = 'failed';
    attempt.scored = false;
    attempt.failureReason = String(reason || 'provider_error').slice(0, 80);
    attempt.completedAt = completedAt;
    if (attempt.actionTokenHash) {
      delete state.byActionTokenHash[attempt.actionTokenHash];
      delete attempt.actionTokenHash;
    }
    return publicAttempt(attempt);
  });
}

/**
 * Resolve and complete a provider attempt in one mutation. Unknown identifiers and
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
  const actionTokenHash = actionToken
    ? crypto.createHash('sha256').update(String(actionToken)).digest('hex')
    : null;
  if (!cleanProviderId && !attemptId && !actionTokenHash) {
    throw new Error('providerId, attemptId or actionToken is required');
  }
  if (outcome && !OUTCOME_SET.has(outcome)) throw new Error(`unknown outcome ${outcome}`);

  const completedAt = new Date().toISOString();
  const recordId = `drill_${crypto.randomUUID()}`;
  return mutate((db) => {
    const state = attemptState(db, true);
    const attempt = findAttempt(state, {
      providerId: cleanProviderId,
      attemptId,
      actionTokenHash,
    });
    if (!attempt) {
      return unchanged({
        status: 'unknown', applied: false, attempt: null, record: null, user: null,
      });
    }
    if (TERMINAL_ATTEMPT_STATUSES.has(attempt.status)) {
      const record = attempt.resultRecordId
        ? db.drills?.find((item) => item.id === attempt.resultRecordId) || null
        : null;
      return unchanged({
        status: 'duplicate',
        applied: false,
        attempt: publicAttempt(attempt),
        record,
        user: db.users[attempt.userId] || null,
      });
    }

    if (!outcome) {
      if (cleanProviderId && !attempt.providerId) {
        attempt.providerId = cleanProviderId;
        state.byProviderId[cleanProviderId] = attempt.id;
      }
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
        ...(attempt.providerId
          ? { providerId: attempt.providerId }
          : {}),
        unscoredReason: String(unscoredReason || 'analysis_missing').slice(0, 80),
      };
      db.drills = db.drills || [];
      db.drills.push(record);
      queueResult(db, attempt.userId, record);
      attempt.status = 'failed';
      attempt.scored = false;
      attempt.failureReason = record.unscoredReason;
      attempt.completedAt = completedAt;
      attempt.resultRecordId = record.id;
      if (attempt.actionTokenHash) {
        delete state.byActionTokenHash[attempt.actionTokenHash];
        delete attempt.actionTokenHash;
      }
      return {
        status: 'unscored',
        applied: false,
        attempt: publicAttempt(attempt),
        record,
        user: db.users[attempt.userId] || null,
      };
    }

    const { record, user } = applyOutcomeToDb(db, {
      userId: attempt.userId,
      outcome,
      channel: attempt.channel,
      practice: false,
      recordId,
      at: completedAt,
      attemptId: attempt.id,
      providerId: attempt.providerId || cleanProviderId,
    });
    attempt.status = 'completed';
    attempt.scored = true;
    attempt.outcome = outcome;
    attempt.completedAt = completedAt;
    attempt.resultRecordId = record.id;
    if (cleanProviderId && !attempt.providerId) {
      attempt.providerId = cleanProviderId;
      state.byProviderId[cleanProviderId] = attempt.id;
    }
    if (attempt.actionTokenHash) {
      delete state.byActionTokenHash[attempt.actionTokenHash];
      delete attempt.actionTokenHash;
    }
    return {
      status: 'completed',
      applied: true,
      attempt: publicAttempt(attempt),
      record,
      user,
    };
  });
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
// Called by /api/verify/check after OTP succeeds. Guests are keyed by their number.
export async function registerVerifiedUser({ phone, name, email }) {
  const cleanName = normaliseUserName(name);
  if (!cleanName) throw new Error('name is required');
  const lookupHash = phoneLookupHash(phone);
  return mutate((db) => {
    // Look up by phone, but key the record by an OPAQUE id. Using the phone number as the
    // primary key made it PII that leaked through every id-bearing response and URL.
    let user = Object.values(db.users).find((u) => u.phone === phone);
    if (!user && lookupHash) {
      user = Object.values(db.users).find((u) => u.phoneLookupHash === lookupHash);
    }
    if (!user) {
      const id = `usr_${crypto.randomUUID()}`;
      user = {
        id,
        name: cleanName,
        role: 'ROOKIE',
        phone,
        consentToDrills: true,
        level: 1, xp: 0, xpMax: 500, streak: 0, timesSafe: 0, timesScammed: 0,
        primaryColor: '#4ecdc4', badgeCount: 0, badgeTotal: 9,
        roomName: 'GUEST ROOM', roomBg: '#081420', safeThisWeek: true, recentDrillResult: null,
      };
      db.users[id] = user;
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
    db.consentEvents = db.consentEvents || [];
    db.consentEvents.push({ userId: user.id, type: 'granted', channel: 'otp', at: new Date().toISOString() });
    return db.users[user.id];
  });
}

export async function setUserName(userId, name) {
  const cleanName = normaliseUserName(name);
  if (!cleanName) throw new Error('name is required');
  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);
    user.name = cleanName;
    return user;
  });
}

// Backward-compatible storage helper. Setting an address never marks it verified:
// controlling the account's phone is not proof that the caller owns this inbox.
export async function setUserEmail(userId, email) {
  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);
    user.email = String(email).trim().toLowerCase();
    user.pendingEmail = user.email;
    delete user.emailVerifiedAt;
    delete user.emailVerificationTokenHash;
    return user;
  });
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
  constructor(message, { retryAfterMs = 0 } = {}) {
    super(message);
    this.name = 'VerificationRateLimitConflict';
    this.code = 'VERIFICATION_RATE_LIMITED';
    this.retryAfterMs = retryAfterMs;
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
  const tokenHash = crypto.createHash('sha256').update(opaqueId).digest('hex');
  const requestedAtMs = Number(now);
  if (!Number.isFinite(requestedAtMs)) throw new Error('now must be a finite timestamp');
  const requestedAt = new Date(requestedAtMs).toISOString();
  const boundedWindowMs = positiveNumber(rateWindowMs, ONE_HOUR_MS);
  const accountMax = positiveInteger(maxAccountSends, EMAIL_VERIFICATION_ACCOUNT_MAX);
  const destinationMax = positiveInteger(
    maxDestinationSends,
    EMAIL_VERIFICATION_DESTINATION_MAX,
  );

  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);
    if (user.email === normalized && user.emailVerifiedAt) {
      // Explicitly choosing the verified address again cancels any abandoned change
      // request and invalidates its older link.
      delete user.pendingEmail;
      delete user.emailVerificationRequestedAt;
      delete user.emailVerificationTokenHash;
      return { alreadyVerified: true, user };
    }

    const previousMs = Date.parse(user.emailVerificationRequestedAt || '');
    const waitMs = Math.max(0, Number(cooldownMs) || 0);
    if (Number.isFinite(previousMs) && requestedAtMs - previousMs < waitMs) {
      throw new EmailVerificationConflict('email verification is on cooldown', {
        retryAfterMs: Math.ceil(waitMs - (requestedAtMs - previousMs)),
      });
    }

    const accountHits = prepareRateLimit(db, {
      scope: 'email-account',
      subject: userId,
      nowMs: requestedAtMs,
      windowMs: boundedWindowMs,
    });
    if (accountHits.length >= accountMax) {
      throw new EmailVerificationConflict('email verification account limit reached', {
        retryAfterMs: retryAfterForWindow(accountHits, requestedAtMs, boundedWindowMs),
      });
    }

    const destinationHits = prepareRateLimit(db, {
      scope: 'email-destination',
      subject: normalized,
      nowMs: requestedAtMs,
      windowMs: boundedWindowMs,
    });
    if (destinationHits.length >= destinationMax) {
      throw new EmailVerificationConflict('email verification destination limit reached', {
        retryAfterMs: retryAfterForWindow(destinationHits, requestedAtMs, boundedWindowMs),
      });
    }

    accountHits.push(requestedAtMs);
    destinationHits.push(requestedAtMs);
    user.pendingEmail = normalized;
    user.emailVerificationRequestedAt = requestedAt;
    user.emailVerificationTokenHash = tokenHash;
    return { alreadyVerified: false, user };
  });
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
  const suppliedHash = crypto.createHash('sha256').update(opaqueId).digest('hex');
  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);
    if (user.pendingEmail !== normalized) return unchanged(user);
    const expectedHash = String(user.emailVerificationTokenHash || '');
    const tokenMatches = expectedHash.length === suppliedHash.length
      && crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(suppliedHash));
    if (!tokenMatches) return unchanged(user);
    delete user.pendingEmail;
    delete user.emailVerificationRequestedAt;
    delete user.emailVerificationTokenHash;
    return user;
  });
}

/**
 * Atomically reserve one public phone-OTP send. This replaces the process-local limiter
 * for the production route, so multiple serverless instances enforce the same 30-second
 * gap, five-per-hour destination cap and requester-wide cap across unique numbers.
 */
export async function reservePhoneVerificationSend({
  phone,
  requesterKey = null,
  now = Date.now(),
  cooldownMs = 30_000,
  rateWindowMs = ONE_HOUR_MS,
  maxSends = PHONE_VERIFICATION_DESTINATION_MAX,
  maxRequesterSends = PHONE_VERIFICATION_REQUESTER_MAX,
} = {}) {
  const destination = String(phone || '').trim();
  const requester = String(requesterKey || '').trim();
  if (!destination) throw new Error('phone is required');
  const requestedAtMs = Number(now);
  if (!Number.isFinite(requestedAtMs)) throw new Error('now must be a finite timestamp');
  const boundedWindowMs = positiveNumber(rateWindowMs, ONE_HOUR_MS);
  const boundedCooldownMs = Math.max(0, Number(cooldownMs) || 0);
  const destinationMax = positiveInteger(maxSends, PHONE_VERIFICATION_DESTINATION_MAX);
  const requesterMax = positiveInteger(
    maxRequesterSends,
    PHONE_VERIFICATION_REQUESTER_MAX,
  );

  return mutate((db) => {
    const hits = prepareRateLimit(db, {
      scope: 'phone-destination',
      subject: destination,
      nowMs: requestedAtMs,
      windowMs: boundedWindowMs,
    });
    if (hits.length >= destinationMax) {
      throw new VerificationRateLimitConflict('phone verification hourly limit reached', {
        retryAfterMs: retryAfterForWindow(hits, requestedAtMs, boundedWindowMs),
      });
    }
    const latest = hits.length ? hits[hits.length - 1] : null;
    if (latest !== null && requestedAtMs - latest < boundedCooldownMs) {
      throw new VerificationRateLimitConflict('phone verification is on cooldown', {
        retryAfterMs: Math.max(1, Math.ceil(
          boundedCooldownMs - (requestedAtMs - latest),
        )),
      });
    }

    const requesterHits = requester
      ? prepareRateLimit(db, {
          scope: 'phone-requester',
          subject: requester,
          nowMs: requestedAtMs,
          windowMs: boundedWindowMs,
        })
      : null;
    if (requesterHits && requesterHits.length >= requesterMax) {
      throw new VerificationRateLimitConflict('phone verification requester limit reached', {
        retryAfterMs: retryAfterForWindow(
          requesterHits,
          requestedAtMs,
          boundedWindowMs,
        ),
      });
    }

    hits.push(requestedAtMs);
    if (requesterHits) requesterHits.push(requestedAtMs);
    return {
      ok: true,
      remaining: Math.max(0, destinationMax - hits.length),
    };
  });
}

/**
 * Consume the current pending address after its signed link is opened. Requiring the
 * pending address to match also invalidates an older link when the user requests a
 * verification for a different inbox.
 */
export async function setVerifiedUserEmail(userId, verificationId) {
  const opaqueId = String(verificationId || '').trim();
  const suppliedHash = crypto.createHash('sha256').update(opaqueId).digest('hex');
  const verifiedAt = new Date().toISOString();
  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);
    const expectedHash = String(user.emailVerificationTokenHash || '');
    const tokenMatches = expectedHash.length === suppliedHash.length
      && crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(suppliedHash));
    if (!user.pendingEmail || !tokenMatches) {
      const error = new Error('email verification is no longer current');
      error.code = 'EMAIL_VERIFICATION_STALE';
      throw error;
    }
    user.email = user.pendingEmail;
    user.emailVerifiedAt = verifiedAt;
    delete user.pendingEmail;
    delete user.emailVerificationRequestedAt;
    delete user.emailVerificationTokenHash;
    db.consentEvents = db.consentEvents || [];
    db.consentEvents.push({
      userId,
      type: 'email-verified',
      channel: 'email',
      at: verifiedAt,
    });
    return user;
  });
}

// Remove the verified phone and every session whose authority came from that
// verification. Progress and optional email remain intact so the account can reconnect
// a number later without losing its training history.
export async function detachVerifiedPhone(userId) {
  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);
    if (!user.phone) {
      const error = new Error('no verified phone on file');
      error.code = 'PHONE_NOT_ATTACHED';
      throw error;
    }

    // Preserve only a keyed lookup so a later OTP for the same number reconnects this
    // account and its progress. Never detach without it: doing so would silently orphan
    // the account that the UI promises to preserve.
    // Recompute even when a legacy hash exists. This proves the currently deployed
    // secret is available and refreshes an attached account after an intentional key
    // rotation; trusting an old hash could delete the last usable lookup and orphan it.
    user.phoneLookupHash = phoneLookupHash(user.phone, { required: true });
    delete user.phone;
    user.consentToDrills = false;
    db.sessions = db.sessions || {};
    for (const [token, session] of Object.entries(db.sessions)) {
      if (session.userId === userId) delete db.sessions[token];
    }
    db.consentEvents = db.consentEvents || [];
    db.consentEvents.push({
      userId,
      type: 'withdrawn',
      channel: 'account',
      at: new Date().toISOString(),
    });
    return user;
  });
}

// --- Sessions -------------------------------------------------------------
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
  // Generated outside `mutate` so a retry reuses the same token rather than minting
  // a fresh one on every attempt and leaving the losers orphaned in the document.
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const createdAt = new Date();
  const ttlMs = sessionTtlMs();
  await mutate((db) => {
    db.sessions = db.sessions || {};
    db.sessions[tokenHash] = {
      userId,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
    };
  });
  return token;
}

/** Look up a user by phone (server-internal only — never expose phone to clients). */
export async function getUserByPhone(phone) {
  if (!phone) return null;
  const { db } = await readDb();
  return Object.values(db.users).find((u) => u.phone === phone) || null;
}

/** Resolve a bearer token to its user id, or null. */
export async function getUserIdByToken(token) {
  if (!token) return null;
  const { db } = await readDb();
  const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
  const digestSession = db.sessions?.[tokenHash];
  const legacySession = db.sessions?.[token];
  // The raw-token lookup keeps existing local demo sessions usable for one bounded
  // migration. A successful lookup immediately replaces the bearer key with its digest.
  const session = digestSession || legacySession;
  if (!session) return null;
  const expiresAt = session.expiresAt
    ? Date.parse(session.expiresAt)
    : Date.parse(session.createdAt || '') + sessionTtlMs();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  if (!digestSession && legacySession) {
    await mutate((fresh) => {
      const current = fresh.sessions?.[token];
      if (!current) return unchanged(null);
      fresh.sessions[tokenHash] = current;
      delete fresh.sessions[token];
      return current.userId;
    });
  }
  return session.userId ?? null;
}
