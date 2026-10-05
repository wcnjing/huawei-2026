// Houses: optional groups of up to 14 players who see each other's progress. A player
// can be in up to HOUSES_PER_USER houses (safespace.house_members); users.house_id is
// the one they are currently looking at, their "active" house, and is always one of
// their memberships or null.
//
// Every write is one transaction. Lock order is always: rate-limit advisory locks, then
// house rows (by id when there are several), then user rows. Memberships are counted
// under the user's row lock, so nobody can pass HOUSES_PER_USER, and joins lock the
// house row before counting, so a house can never pass HOUSE_MAX_MEMBERS.
import crypto from 'crypto';
import { query, transaction } from './db.js';
import { userFromRow } from './rows.js';
import { roomView } from './room-style.js';
import { weekStart } from './week.js';
import { cleanFamilyLinkInput } from './family-tree.js';
import {
  FAMILY_LIMITS, applyFamilyEdit, cleanFamilyEdit, cleanFamilyTree, familyEditIds, familyLinkFor,
  familyProblem, familyTreeFromLinks, replaceFamilyLink,
} from './family-rules.js';
import { announcePixiDrillOutcome } from './drill-announce.js';
import {
  addXp,
  lockRateLimits,
  lockUser,
  recordRateLimitHits,
  retryAfterForWindow,
  saveUser,
} from './store.js';

export const HOUSE_MAX_MEMBERS = 14;
export const HOUSES_PER_USER = 3;
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

async function isMember(tx, houseId, userId) {
  const { rows } = await tx.query(
    'select 1 from safespace.house_members where house_id = $1 and user_id = $2',
    [houseId, String(userId)],
  );
  return rows.length > 0;
}

/** Ids of every house the user belongs to, earliest joined first. */
async function membershipIds(tx, userId) {
  const { rows } = await tx.query(
    'select house_id from safespace.house_members where user_id = $1 order by joined_at, house_id',
    [String(userId)],
  );
  return rows.map((row) => row.house_id);
}

/**
 * Lock a house the caller belongs to, then the caller, and confirm the membership.
 * Without `expectedHouseId` that is their active house. Returns { house, user }.
 */
export async function lockHouseMember(tx, userId, expectedHouseId) {
  const houseId = expectedHouseId ?? await unlockedHouseId(tx, userId);
  if (!houseId) throw new HouseError('NOT_IN_HOUSE');
  const house = await lockHouse(tx, String(houseId));
  const user = await lockUser(tx, userId);
  if (!house || !user || !(await isMember(tx, house.id, user.id))) throw new HouseError('NOT_IN_HOUSE');
  return { house, user };
}

async function lockOwnHouse(tx, userId) {
  return lockHouseMember(tx, userId);
}

async function memberIds(tx, houseId) {
  const { rows } = await tx.query(
    'select user_id from safespace.house_members where house_id = $1 order by joined_at, user_id',
    [houseId],
  );
  return rows.map((row) => row.user_id);
}

async function addMembership(tx, houseId, userId, now) {
  await tx.query(
    'insert into safespace.house_members (house_id, user_id, joined_at) values ($1, $2, $3)',
    [houseId, userId, now.toISOString()],
  );
  // A new house becomes the one you're looking at.
  await tx.query('update safespace.users set house_id = $2 where id = $1', [userId, houseId]);
}

/**
 * Drop one membership. If it was the user's active house, their next-earliest house
 * becomes active (or none). `user` must already be locked.
 */
async function dropMembership(tx, houseId, userId) {
  await tx.query('delete from safespace.house_members where house_id = $1 and user_id = $2', [houseId, userId]);
  await tx.query(
    `update safespace.users set house_id = (
        select house_id from safespace.house_members where user_id = $1 order by joined_at, house_id limit 1)
      where id = $1 and (house_id = $2 or house_id is null)`,
    [userId, houseId],
  );
}

export async function createHouse(userId, name, { now = new Date() } = {}) {
  const clean = cleanHouseName(name);
  return transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    if ((await membershipIds(tx, user.id)).length >= HOUSES_PER_USER) throw new HouseError('HOUSE_LIMIT');
    const id = `house_${crypto.randomUUID()}`;
    const doorbell = newDoorbell();
    await tx.query(
      `insert into safespace.houses (id, name, owner_id, invite_code, invite_expires_at, doorbell, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, clean, user.id, await freshInviteCode(tx), new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        doorbell, now.toISOString()],
    );
    await addMembership(tx, id, user.id, now);
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
    const mine = await membershipIds(tx, user.id);
    if (mine.includes(house.id)) return { error: 'ALREADY_IN_HOUSE' };
    if (mine.length >= HOUSES_PER_USER) return { error: 'HOUSE_LIMIT' };
    if ((await memberIds(tx, house.id)).length >= HOUSE_MAX_MEMBERS) return { error: 'HOUSE_FULL' };
    await addMembership(tx, house.id, user.id, now);
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
    if (!target || !(await isMember(tx, house.id, target.id))) throw new HouseError('NOT_A_MEMBER');
    await dropMembership(tx, house.id, target.id);
    // A new topic, so the removed player's open app stops hearing this house.
    await tx.query('update safespace.houses set doorbell = $2 where id = $1', [house.id, newDoorbell()]);
    // Ring the old topic: everyone listening refetches, and the others pick up the new one.
    return { ring: [house.doorbell] };
  }, 'removeMember');
}

/**
 * Lock every house a user belongs to (by id), before their own row, so callers outside
 * this module keep the house-then-user lock order. Returns [] when they are in none.
 */
export async function lockHousesOf(tx, userId) {
  const ids = (await membershipIds(tx, userId)).sort();
  const houses = [];
  for (const id of ids) {
    const house = await lockHouse(tx, id);
    if (house) houses.push(house);
  }
  return houses;
}

/** Make one of the user's houses the one they're looking at. */
export async function switchHouse(userId, houseId) {
  return transaction(async (tx) => {
    const { house, user } = await lockHouseMember(tx, userId, String(houseId || ''));
    await tx.query('update safespace.users set house_id = $2 where id = $1', [user.id, house.id]);
    return { ring: [] };
  }, 'switchHouse');
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
  await dropMembership(tx, house.id, user.id);
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
 * The house's shared family tree, limited to its current members. A house saved before
 * the tree was shared has none yet: it's built from the members' own old placements.
 * `memberRows` is [{ id, family_link }].
 */
function houseFamilyTree(house, memberRows) {
  const ids = new Set(memberRows.map((row) => row.id));
  if (house.family_tree) return cleanFamilyTree(house.family_tree, ids);
  return familyTreeFromLinks(memberRows.map((row) => ({ id: row.id, link: row.family_link })));
}

async function lockedFamilyTree(tx, userId) {
  const { house, user } = await lockHouseMember(tx, userId);
  const { rows } = await tx.query(
    'select user_id as id, family_link from safespace.house_members where house_id = $1',
    [house.id],
  );
  return { house, user, ids: rows.map((row) => row.id), tree: houseFamilyTree(house, rows) };
}

async function saveFamilyTree(tx, house, user, tree, ids, now) {
  const problem = familyProblem(tree, ids);
  if (problem) throw new HouseError(problem);
  await tx.query(
    'update safespace.houses set family_tree = $2::jsonb where id = $1',
    [house.id, JSON.stringify({ ...tree, updatedAt: now.toISOString(), updatedBy: user.id })],
  );
  return { ring: [house.doorbell] };
}

/**
 * Change the house's family tree. Any member may edit anyone's place: `input` is one
 * edit or a list of up to four, applied in order to the LATEST stored tree (under the
 * house lock), so edits made at the same time on different phones all land. The result
 * must still make sense (family-rules.js) or nothing is saved.
 */
export async function editFamilyTree(userId, input, { now = new Date() } = {}) {
  const list = Array.isArray(input) ? input : [input];
  if (!list.length || list.length > FAMILY_LIMITS.editsPerRequest) throw new HouseError('INVALID_FAMILY_LINK');
  const edits = list.map(cleanFamilyEdit);
  if (edits.some((edit) => !edit)) throw new HouseError('INVALID_FAMILY_LINK');
  return transaction(async (tx) => {
    const { house, user, ids, tree } = await lockedFamilyTree(tx, userId);
    const members = new Set(ids);
    if (edits.some((edit) => familyEditIds(edit).some((id) => !members.has(id)))) throw new HouseError('NOT_A_MEMBER');
    const next = edits.reduce(applyFamilyEdit, tree);
    return saveFamilyTree(tx, house, user, next, ids, now);
  }, 'editFamilyTree');
}

/**
 * The older app's "save my branch": replaces everything about the caller on the shared
 * tree with their placement.
 */
export async function setFamilyLink(userId, input, { now = new Date() } = {}) {
  const clean = cleanFamilyLinkInput(input);
  if (!clean) throw new HouseError('INVALID_FAMILY_LINK');
  return transaction(async (tx) => {
    const { house, user, ids, tree } = await lockedFamilyTree(tx, userId);
    const referenced = [clean.partnerId, ...clean.parentIds, ...clean.childIds, ...clean.friendIds].filter(Boolean);
    if (referenced.some((id) => id === user.id || !ids.includes(id))) throw new HouseError('NOT_A_MEMBER');
    return saveFamilyTree(tx, house, user, replaceFamilyLink(tree, user.id, clean), ids, now);
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

  const outcome = await transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    return recordRunLocked(tx, user, key, { correct, cautious, wrong }, now);
  }, 'recordHouseRun');
  if (outcome.status === 'completed') {
    await announcePixiDrillOutcome(userId, `run:${outcome.run.id}`, {
      channel: 'house',
      won: outcome.run.wrong === 0,
    });
  }
  return outcome;
}

/** Only the week's first run earns XP. `user` must already be locked by `tx`. */
export async function recordRunLocked(tx, user, key, { correct, cautious, wrong }, now) {
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
function memberView(user, stats, ownerId, family = null) {
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
    family,
    room: roomView(user),
  };
}

async function soloView(self, since, houses = []) {
  const stats = await weeklyStats([self.id], since);
  return { self: memberView(self, stats.get(self.id), null), house: null, houses };
}

/** Every house the user is in, for the switcher: { id, name, memberCount, active }. */
async function houseSummaries(userId, activeId) {
  const { rows } = await query(
    `select h.id, h.name, (select count(*) from safespace.house_members c where c.house_id = h.id) as member_count
       from safespace.house_members m join safespace.houses h on h.id = m.house_id
      where m.user_id = $1
      order by m.joined_at, h.id`,
    [String(userId)],
    'houseSummaries',
  );
  return rows.map((row) => ({ id: row.id, name: row.name, memberCount: Number(row.member_count), active: row.id === activeId }));
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
  const houses = await houseSummaries(self.id, self.houseId ?? null);
  if (!self.houseId) return soloView(self, since, houses);
  const { rows: houseRows } = await query('select * from safespace.houses where id = $1', [self.houseId], 'house');
  const house = houseRows[0];
  if (!house) return soloView(self, since, houses);
  const { rows: memberRows } = await query(
    `select u.*, m.family_link as membership_family_link
       from safespace.house_members m join safespace.users u on u.id = m.user_id
      where m.house_id = $1
      order by m.joined_at, u.id`,
    [house.id],
    'houseMembers',
  );
  const members = memberRows.map((row) => ({ user: userFromRow(row), familyLink: row.membership_family_link }));
  const stats = await weeklyStats(members.map((m) => m.user.id), since);
  const tree = houseFamilyTree(house, members.map((m) => ({ id: m.user.id, family_link: m.familyLink })));
  const views = members.map((m) => memberView(m.user, stats.get(m.user.id), house.owner_id, familyLinkFor(tree, m.user.id)));
  const selfInHouse = views.find((m) => m.id === self.id);
  if (!selfInHouse) return soloView(self, since, houses);
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
      // Who last changed the shared family tree, and when (null until someone does).
      familyUpdatedAt: house.family_tree?.updatedAt ?? null,
      familyUpdatedBy: house.family_tree?.updatedBy ?? null,
    },
    houses,
  };
}

/** Doorbells of every house the user is in: their name, avatar or progress shows in all. */
export async function doorbellsForUser(userId) {
  const { rows } = await query(
    `select h.doorbell from safespace.house_members m
       join safespace.houses h on h.id = m.house_id
      where m.user_id = $1`,
    [String(userId)],
    'doorbellsForUser',
  );
  return rows.map((row) => row.doorbell);
}
