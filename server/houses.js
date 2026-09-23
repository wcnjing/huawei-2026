// Houses: optional groups of up to six players who see each other's progress.
//
// Every write is one transaction. Lock order is always: rate-limit advisory locks, then
// the house row, then user rows. A user's house_id is re-checked under their row lock,
// so nobody can end up in two houses, and joins lock the house row before counting, so
// a house can never pass HOUSE_MAX_MEMBERS.
import crypto from 'crypto';
import { query, transaction } from './db.js';
import { userFromRow } from './rows.js';
import { weekStart } from './week.js';
import { cleanFamilyLinkInput, familyConflict, projectFamilyLink } from './family-tree.js';
import {
  addXp,
  lockRateLimits,
  lockUser,
  recordRateLimitHits,
  retryAfterForWindow,
  saveUser,
} from './store.js';

export const HOUSE_MAX_MEMBERS = 6;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const HOUSE_RUN_XP = { correct: 100, cautious: 50, wrong: 25 };
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const JOIN_WINDOW_MS = 60 * 60 * 1000;
const JOIN_LIMITS = { house_join_account: 10, house_join_requester: 30 };
const HOUSE_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'&-]{0,29}$/u;
const MAX_ROUNDS = 20;

// Codes must stay longer than five characters: db.js treats a five-character upper-case
// code as a Postgres SQLSTATE.
export class HouseError extends Error {
  constructor(code, { retryAfterMs = 0 } = {}) {
    super(code);
    this.name = 'HouseError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

/** 'k7p 3qx', 'K7P-3QX' → 'K7P3QX'; anything else → null. */
export function normaliseInviteCode(input) {
  const code = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

export function formatInviteCode(code) {
  return code ? `${code.slice(0, 3)}-${code.slice(3)}` : null;
}

function newDoorbell() {
  return `house-${crypto.randomBytes(16).toString('hex')}`;
}

function cleanHouseName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!HOUSE_NAME_RE.test(clean)) throw new HouseError('INVALID_HOUSE_NAME');
  return clean;
}

async function freshInviteCode(tx) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { rows } = await tx.query('select 1 from safespace.houses where invite_code = $1', [code]);
    if (!rows[0]) return code;
  }
  throw new Error('could not generate a unique invite code');
}

async function lockHouse(tx, houseId) {
  const { rows } = await tx.query('select * from safespace.houses where id = $1 for update', [houseId]);
  return rows[0] ?? null;
}

async function unlockedHouseId(tx, userId) {
  const { rows } = await tx.query('select house_id from safespace.users where id = $1', [String(userId)]);
  return rows[0]?.house_id ?? null;
}

/**
 * Lock the caller's house, then the caller, and confirm they are still a member.
 * Returns { house, user }.
 */
export async function lockHouseMember(tx, userId, expectedHouseId) {
  const houseId = await unlockedHouseId(tx, userId);
  if (!houseId || (expectedHouseId !== undefined && houseId !== expectedHouseId)) {
    throw new HouseError('NOT_IN_HOUSE');
  }
  const house = await lockHouse(tx, houseId);
  const user = await lockUser(tx, userId);
  if (!house || !user || user.houseId !== house.id) throw new HouseError('NOT_IN_HOUSE');
  return { house, user };
}

async function lockOwnHouse(tx, userId) {
  return lockHouseMember(tx, userId);
}

async function memberIds(tx, houseId) {
  const { rows } = await tx.query(
    'select id from safespace.users where house_id = $1 order by joined_house_at, id',
    [houseId],
  );
  return rows.map((row) => row.id);
}

export async function createHouse(userId, name, { now = new Date() } = {}) {
  const clean = cleanHouseName(name);
  return transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    if (user.houseId) throw new HouseError('ALREADY_IN_HOUSE');
    const id = `house_${crypto.randomUUID()}`;
    const doorbell = newDoorbell();
    await tx.query(
      `insert into safespace.houses (id, name, owner_id, invite_code, invite_expires_at, doorbell, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, clean, user.id, await freshInviteCode(tx), new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        doorbell, now.toISOString()],
    );
    await tx.query(
      'update safespace.users set house_id = $2, joined_house_at = $3 where id = $1',
      [user.id, id, now.toISOString()],
    );
    return { houseId: id, ring: [doorbell] };
  }, 'createHouse');
}

export async function joinHouse(userId, code, { requesterKey = null, now = new Date() } = {}) {
  const clean = normaliseInviteCode(code);
  const nowMs = now.getTime();
  // Failures are returned, not thrown, so the failed attempt's rate-limit hit commits.
  const outcome = await transaction(async (tx) => {
    const subjects = [{ scope: 'house_join_account', subject: userId }];
    if (requesterKey) subjects.push({ scope: 'house_join_requester', subject: requesterKey });
    const buckets = await lockRateLimits(tx, subjects, { nowMs, windowMs: JOIN_WINDOW_MS });
    for (const bucket of buckets) {
      if (bucket.hits.length >= JOIN_LIMITS[bucket.scope]) {
        return {
          error: 'JOIN_RATE_LIMITED',
          retryAfterMs: retryAfterForWindow(bucket.hits, nowMs, JOIN_WINDOW_MS),
        };
      }
    }
    let house = null;
    if (clean) {
      // Postgres re-checks the where clause after waiting for the lock, so a code that
      // was replaced or a house that was deleted meanwhile no longer matches.
      const { rows } = await tx.query(
        `select * from safespace.houses
          where invite_code = $1 and invite_expires_at > $2
          for update`,
        [clean, now.toISOString()],
      );
      house = rows[0] ?? null;
    }
    if (!house) {
      await recordRateLimitHits(tx, buckets, { nowMs, windowMs: JOIN_WINDOW_MS });
      return { error: 'CODE_INVALID' };
    }
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    if (user.houseId) return { error: 'ALREADY_IN_HOUSE' };
    if ((await memberIds(tx, house.id)).length >= HOUSE_MAX_MEMBERS) return { error: 'HOUSE_FULL' };
    await tx.query(
      'update safespace.users set house_id = $2, joined_house_at = $3 where id = $1',
      [user.id, house.id, now.toISOString()],
    );
    return { houseId: house.id, ring: [house.doorbell] };
  }, 'joinHouse');
  if (outcome.error) throw new HouseError(outcome.error, { retryAfterMs: outcome.retryAfterMs });
  return outcome;
}

export async function regenerateInviteCode(userId, { now = new Date() } = {}) {
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    if (house.owner_id !== user.id) throw new HouseError('NOT_OWNER');
    await tx.query(
      'update safespace.houses set invite_code = $2, invite_expires_at = $3 where id = $1',
      [house.id, await freshInviteCode(tx), new Date(now.getTime() + INVITE_TTL_MS).toISOString()],
    );
    return { ring: [house.doorbell] };
  }, 'regenerateInviteCode');
}

export async function renameHouse(userId, name) {
  const clean = cleanHouseName(name);
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    if (house.owner_id !== user.id) throw new HouseError('NOT_OWNER');
    await tx.query('update safespace.houses set name = $2 where id = $1', [house.id, clean]);
    return { ring: [house.doorbell] };
  }, 'renameHouse');
}

export async function removeMember(userId, memberId) {
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    if (house.owner_id !== user.id) throw new HouseError('NOT_OWNER');
    if (String(memberId) === user.id) throw new HouseError('CANNOT_REMOVE_SELF');
    const target = await lockUser(tx, memberId);
    if (!target || target.houseId !== house.id) throw new HouseError('NOT_A_MEMBER');
    await tx.query(
      'update safespace.users set house_id = null, joined_house_at = null where id = $1',
      [target.id],
    );
    // A new topic, so the removed player's open app stops hearing this house.
    await tx.query('update safespace.houses set doorbell = $2 where id = $1', [house.id, newDoorbell()]);
    // Ring the old topic: everyone listening refetches, and the others pick up the new one.
    return { ring: [house.doorbell] };
  }, 'removeMember');
}

/**
 * Lock the house a user belongs to, before their own row, so callers outside this module
 * can keep the house-then-user lock order. Returns null when they are in no house.
 */
export async function lockHouseOf(tx, userId) {
  const houseId = await unlockedHouseId(tx, userId);
  return houseId ? lockHouse(tx, houseId) : null;
}

/**
 * Take a member out of their house: hand ownership to the earliest remaining joiner, or
 * delete the house when they were the last member. Rotates the doorbell, so the
 * departing player's still-open app stops hearing this house, and returns the OLD topic
 * to ring after the commit — the members who stay refetch and pick up the new one.
 *
 * `house` and `user` must both already be locked, in that order.
 */
export async function releaseFromHouse(tx, house, user) {
  await tx.query(
    'update safespace.users set house_id = null, joined_house_at = null where id = $1',
    [user.id],
  );
  const remaining = await memberIds(tx, house.id);
  if (!remaining.length) {
    await tx.query('delete from safespace.houses where id = $1', [house.id]);
    return [];
  }
  await tx.query(
    'update safespace.houses set owner_id = $2, doorbell = $3 where id = $1',
    [house.id, house.owner_id === user.id ? remaining[0] : house.owner_id, newDoorbell()],
  );
  return [house.doorbell];
}

export async function leaveHouse(userId) {
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    return { ring: await releaseFromHouse(tx, house, user) };
  }, 'leaveHouse');
}

/**
 * Place the caller in their house's family tree. Only their own record changes; the
 * house row lock serialises placements so the whole-tree checks see a stable tree.
 */
export async function setFamilyLink(userId, input) {
  const clean = cleanFamilyLinkInput(input);
  if (!clean) throw new HouseError('INVALID_FAMILY_LINK');
  return transaction(async (tx) => {
    const { house, user } = await lockHouseMember(tx, userId);
    const { rows } = await tx.query(
      'select id, family_link from safespace.users where house_id = $1',
      [house.id],
    );
    const ids = new Set(rows.map((row) => row.id));
    const referenced = [clean.partnerId, ...clean.parentIds, ...clean.childIds].filter(Boolean);
    if (referenced.some((id) => id === user.id || !ids.has(id))) throw new HouseError('NOT_A_MEMBER');
    const links = new Map(rows.map((row) => [
      row.id,
      row.id === user.id ? clean : projectFamilyLink(row.family_link, row.id, ids) ?? projectFamilyLink({}, row.id, ids),
    ]));
    const conflict = familyConflict(user.id, links);
    if (conflict) throw new HouseError(conflict);
    await tx.query(
      'update safespace.users set family_link = $2::jsonb where id = $1',
      [user.id, JSON.stringify(clean)],
    );
    return { ring: [house.doorbell] };
  }, 'setFamilyLink');
}

function runFromRow(row) {
  return {
    id: row.id,
    correct: row.correct,
    cautious: row.cautious,
    wrong: row.wrong,
    xpGained: row.xp_gained,
    at: new Date(row.at).toISOString(),
  };
}

function validRoundCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ROUNDS;
}

export async function recordHouseRun(userId, { clientKey, correct, cautious, wrong } = {}, { now = new Date() } = {}) {
  const key = String(clientKey ?? '').trim();
  const counts = [correct, cautious, wrong];
  if (!key || key.length > 200 || !counts.every(validRoundCount)) throw new HouseError('INVALID_DRILL_RUN');
  const total = correct + cautious + wrong;
  if (total < 1 || total > MAX_ROUNDS) throw new HouseError('INVALID_DRILL_RUN');

  return transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    const existing = await tx.query(
      'select * from safespace.drill_runs where user_id = $1 and client_key = $2',
      [user.id, key],
    );
    if (existing.rows[0]) return { status: 'duplicate', run: runFromRow(existing.rows[0]), user };
    const earlier = await tx.query(
      'select count(*) as n from safespace.drill_runs where user_id = $1 and at >= $2',
      [user.id, weekStart(now).toISOString()],
    );
    const xpGained = Number(earlier.rows[0].n) === 0
      ? correct * HOUSE_RUN_XP.correct + cautious * HOUSE_RUN_XP.cautious + wrong * HOUSE_RUN_XP.wrong
      : 0;
    let saved = user;
    if (xpGained) saved = await saveUser(tx, addXp(user, xpGained));
    const { rows } = await tx.query(
      `insert into safespace.drill_runs (id, user_id, client_key, correct, cautious, wrong, xp_gained, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [`run_${crypto.randomUUID()}`, user.id, key, correct, cautious, wrong, xpGained, now.toISOString()],
    );
    return { status: 'completed', run: runFromRow(rows[0]), user: saved };
  }, 'recordHouseRun');
}

// --- Read model -------------------------------------------------------------------

async function weeklyStats(userIds, since) {
  const results = await query(
    `select user_id, bool_or(result = 'LOST') as lost
       from safespace.drill_results
      where user_id = any($1) and at >= $2
      group by user_id`,
    [userIds, since],
    'weeklyResults',
  );
  const runs = await query(
    `select user_id, sum(correct) as correct, sum(cautious) as cautious, sum(wrong) as wrong
       from safespace.drill_runs
      where user_id = any($1) and at >= $2
      group by user_id`,
    [userIds, since],
    'weeklyRuns',
  );
  const stats = new Map(userIds.map((id) => [id, { active: false, lost: false, weekRun: null }]));
  for (const row of results.rows) Object.assign(stats.get(row.user_id), { active: true, lost: row.lost });
  for (const row of runs.rows) {
    Object.assign(stats.get(row.user_id), {
      active: true,
      weekRun: { correct: Number(row.correct), cautious: Number(row.cautious), wrong: Number(row.wrong) },
    });
  }
  return stats;
}

// Explicit field list: never spread a user row, so private fields cannot leak.
function memberView(user, stats, ownerId, memberIdSet = null) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? null,
    level: user.level,
    xp: user.xp,
    xpMax: user.xpMax,
    streak: user.streak,
    timesSafe: user.timesSafe,
    timesScammed: user.timesScammed,
    badgeCount: user.badgeCount,
    badgeTotal: user.badgeTotal,
    recentDrillResult: user.recentDrillResult ?? null,
    isOwner: user.id === ownerId,
    activeThisWeek: stats.active,
    safeThisWeek: !stats.lost,
    weekRun: stats.weekRun,
    family: memberIdSet ? projectFamilyLink(user.familyLink, user.id, memberIdSet) : null,
  };
}

async function soloView(self, since) {
  const stats = await weeklyStats([self.id], since);
  return { self: memberView(self, stats.get(self.id), null), house: null };
}

// These four reads are not one transaction, so the house can change under them: it can
// be deleted, or the caller removed from it, between the user read and the member read.
// Both cases answer with the solo view. Never return a house without the caller's own
// member view in it — the client uses `self` to decide whether it knows who it is.
export async function getHouseView(userId, { now = new Date() } = {}) {
  const since = weekStart(now).toISOString();
  const { rows: selfRows } = await query('select * from safespace.users where id = $1', [String(userId)], 'houseSelf');
  const self = userFromRow(selfRows[0]);
  if (!self) throw new Error(`unknown user ${userId}`);
  if (!self.houseId) return soloView(self, since);
  const { rows: houseRows } = await query('select * from safespace.houses where id = $1', [self.houseId], 'house');
  const house = houseRows[0];
  if (!house) return soloView(self, since);
  const { rows: memberRows } = await query(
    'select * from safespace.users where house_id = $1 order by joined_house_at, id',
    [house.id],
    'houseMembers',
  );
  const members = memberRows.map(userFromRow);
  const stats = await weeklyStats(members.map((m) => m.id), since);
  const memberIdSet = new Set(members.map((m) => m.id));
  const views = members.map((m) => memberView(m, stats.get(m.id), house.owner_id, memberIdSet));
  const selfInHouse = views.find((m) => m.id === self.id);
  if (!selfInHouse) return soloView(self, since);
  const codeLive = house.invite_code && new Date(house.invite_expires_at).getTime() > now.getTime();
  return {
    self: selfInHouse,
    house: {
      id: house.id,
      name: house.name,
      ownerId: house.owner_id,
      inviteCode: codeLive ? formatInviteCode(house.invite_code) : null,
      inviteExpiresAt: codeLive ? new Date(house.invite_expires_at).toISOString() : null,
      doorbell: house.doorbell,
      members: views,
    },
  };
}

export async function doorbellForUser(userId) {
  const { rows } = await query(
    `select h.doorbell from safespace.users u
       join safespace.houses h on h.id = u.house_id
      where u.id = $1`,
    [String(userId)],
    'doorbellForUser',
  );
  return rows[0]?.doorbell ?? null;
}
