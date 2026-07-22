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
import { computeResult } from './xp.js';

// Fields that must NEVER leave the server in a list/leaderboard response.
// `phone` is PII; sessions are bearer credentials.
const PRIVATE_FIELDS = ['phone', 'email'];

/** Strip PII before sending a user record to any client. */
export function publicUser(u) {
  if (!u) return u;
  const safe = { ...u };
  for (const f of PRIVATE_FIELDS) delete safe[f];
  return safe;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');
const SEED_FILE = path.join(__dirname, 'data.seed.json');

const DB_KEY = 'safespace:db';
const VERSION_KEY = 'safespace:db:version';

// Read lazily rather than at import time so tests can point the store at a backend
// after the module has already been loaded.
const redisUrl = () => process.env.UPSTASH_REDIS_REST_URL;
const usingRedis = () => Boolean(redisUrl());

const readSeed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));

// --- File backend -----------------------------------------------------------

function fileRead() {
  // Read first and handle the miss, rather than checking existence and then reading:
  // the file can be removed in between (a reset, a redeploy, another test process),
  // and an ENOENT thrown from inside a request is a 500 for something recoverable.
  try {
    return { db: JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')), version: null };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // No file yet: hand back the seed. Whoever is mutating will persist it on save,
    // so a pure read never has to write.
    return { db: readSeed(), version: null };
  }
}

function fileWrite(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
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
 * Read the document, apply `fn` to it, and save it back — retrying if a concurrent
 * writer got there first. `fn` must be pure enough to run more than once: it may be
 * replayed against a fresher copy of the document.
 */
async function mutate(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { db, version } = await readDb();
    const result = fn(db);
    const saved = usingRedis() ? await redisWrite(db, version) : fileWrite(db);
    if (saved) return result;
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

/**
 * Apply a finished drill's outcome to a user: award XP, adjust streak/stats,
 * and (for scored real calls) queue a pending result the app shows on next open.
 */
export async function applyOutcome({ userId, outcome, channel = 'call', practice = false }) {
  return mutate((db) => {
    const user = db.users[userId];
    if (!user) throw new Error(`unknown user ${userId}`);

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
      id: `drill_${Date.now()}`,
      userId,
      channel,
      outcome,
      practice,
      result: r.result,
      screen: r.screen,
      xpGained: r.xp,
      at: new Date().toISOString(),
    };
    db.drills.push(record);

    // Real (non-practice) scored drills get surfaced when the user next opens the app.
    if (!practice && r.screen) {
      db.pendingResults[userId] = record;
    }

    return { record, user };
  });
}

export async function takePendingResult(userId) {
  // Checked before entering `mutate` so the common case — app opens, nothing waiting —
  // costs a read instead of a write. This runs on every app open.
  const { db } = await readDb();
  if (!db.pendingResults?.[userId]) return null;

  return mutate((d) => {
    const pending = d.pendingResults[userId] || null;
    if (pending) delete d.pendingResults[userId];
    return pending;
  });
}

export async function recordDrillFired({ userId, channel = 'call', callId = null }) {
  await mutate((db) => {
    db.drills.push({
      id: `fired_${Date.now()}`,
      userId,
      channel,
      callId,
      status: 'fired',
      at: new Date().toISOString(),
    });
  });
}

// Upsert a phone-verified user and log a 'granted' consent event (the audit trail).
// Called by /api/verify/check after OTP succeeds. Guests are keyed by their number.
export async function registerVerifiedUser({ phone, name, email }) {
  return mutate((db) => {
    // Look up by phone, but key the record by an OPAQUE id. Using the phone number as the
    // primary key made it PII that leaked through every id-bearing response and URL.
    let user = Object.values(db.users).find((u) => u.phone === phone);
    if (!user) {
      const id = `usr_${crypto.randomUUID()}`;
      user = {
        id,
        name: (name || 'GUEST').toString().trim().toUpperCase().slice(0, 10) || 'GUEST',
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
    // Optional address supplied while consenting. Email drills can ONLY go to this stored
    // address — never to one named in a request, which is what made the standalone
    // email-webapp an open phishing relay.
    if (email) user.email = String(email).trim().toLowerCase();
    user.consentToDrills = true;
    db.consentEvents = db.consentEvents || [];
    db.consentEvents.push({ userId: user.id, type: 'granted', channel: 'otp', at: new Date().toISOString() });
    return db.users[user.id];
  });
}

// --- Sessions -------------------------------------------------------------
// A drill places a real phone call, so the caller must prove who they are with a
// server-issued bearer token. A client-supplied user id is an assertion, not proof.

/** Issue a session token for a verified user. Returns the opaque token. */
export async function createSession(userId) {
  // Generated outside `mutate` so a retry reuses the same token rather than minting
  // a fresh one on every attempt and leaving the losers orphaned in the document.
  const token = crypto.randomBytes(32).toString('hex');
  await mutate((db) => {
    db.sessions = db.sessions || {};
    db.sessions[token] = { userId, createdAt: new Date().toISOString() };
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
  return db.sessions?.[token]?.userId ?? null;
}
