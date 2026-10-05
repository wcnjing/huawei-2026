// House drills: a turn-based game each member plays on their own phone.
//
// The host opens a lobby, which invites everyone else in the house. The host starts
// whenever they like; only players who accepted take part. Turns rotate through the
// players (A, B, C, A, B, C…) until each has had `perPlayer` turns. After each answer the
// game pauses on a shared reveal until every player taps Continue (or the host moves on),
// so the whole house goes at the same pace. Phones learn about changes from the house
// doorbell and poll as a fallback.
//
// Scenario content lives in the client, so the server stores only scenario ids and the
// outcome the answering phone reports — the same trust model as POST /api/drills/house-run.
// Every write locks the house row first (via lockHouseMember), then the drill row.
import crypto from 'crypto';
import { query, transaction } from './db.js';
import { HouseError, lockHouseMember, recordRunLocked } from './houses.js';
import { lockUser } from './store.js';

export const PER_PLAYER = { min: 2, max: 5 };
export const INVITE_WINDOW_MS = 2 * 60 * 1000;
export const LOBBY_TTL_MS = 10 * 60 * 1000;
export const IDLE_TTL_MS = 30 * 60 * 1000;
// A finished game stays visible this long so every phone can show the summary.
export const RECENT_MS = 10 * 60 * 1000;
const OUTCOMES = new Set(['correct', 'cautious', 'wrong']);
const MAX_SCENARIO_ID = 10_000;
const MAX_ACTION_LENGTH = 80;
const MAX_CLUES = 10;
const LIVE = new Set(['lobby', 'playing']);

function isoNow(now) {
  return now.toISOString();
}

/** A lobby nobody started, or a game nobody touched, quietly lapses. */
function effectiveStatus(row, now) {
  const age = now.getTime() - new Date(row.updated_at).getTime();
  if (row.status === 'lobby' && now.getTime() - new Date(row.created_at).getTime() > LOBBY_TTL_MS) return 'cancelled';
  if (row.status === 'playing' && age > IDLE_TTL_MS) return 'cancelled';
  return row.status;
}

function inviteExpired(state, now) {
  return now.getTime() > new Date(state.inviteExpiresAt).getTime();
}

export function drillView(row, now = new Date()) {
  const state = row.state;
  const expired = inviteExpired(state, now);
  return {
    id: row.id,
    hostId: row.host_id,
    status: effectiveStatus(row, now),
    perPlayer: state.perPlayer,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    inviteExpiresAt: state.inviteExpiresAt,
    startedAt: state.startedAt ?? null,
    finishedAt: state.finishedAt ?? null,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar ?? null,
      status: p.status === 'invited' && expired ? 'expired' : p.status,
    })),
    turns: state.turns,
    currentTurn: state.currentTurn,
    revealing: state.revealing === true,
    ready: state.ready ?? [],
    answers: state.answers,
    xp: state.xp ?? null,
  };
}

async function houseMembers(tx, houseId) {
  const { rows } = await tx.query(
    `select u.id, u.name, u.avatar from safespace.house_members m
       join safespace.users u on u.id = m.user_id
      where m.house_id = $1 order by m.joined_at, u.id`,
    [houseId],
  );
  return rows;
}

async function saveDrill(tx, id, status, state, now) {
  await tx.query(
    'update safespace.house_drills set status = $2, state = $3::jsonb, updated_at = $4 where id = $1',
    [id, status, JSON.stringify(state), isoNow(now)],
  );
}

export async function createHouseDrill(userId, { perPlayer } = {}, { now = new Date() } = {}) {
  if (!Number.isInteger(perPlayer) || perPlayer < PER_PLAYER.min || perPlayer > PER_PLAYER.max) {
    throw new HouseError('INVALID_DRILL_SETTINGS');
  }
  return transaction(async (tx) => {
    const { house, user } = await lockHouseMember(tx, userId);
    const { rows: live } = await tx.query(
      `select * from safespace.house_drills
        where house_id = $1 and status in ('lobby', 'playing') for update`,
      [house.id],
    );
    for (const row of live) {
      if (LIVE.has(effectiveStatus(row, now))) throw new HouseError('DRILL_IN_PROGRESS');
      await saveDrill(tx, row.id, 'cancelled', row.state, now);
    }
    const members = await houseMembers(tx, house.id);
    const host = members.find((m) => m.id === user.id);
    const others = members.filter((m) => m.id !== user.id);
    const state = {
      perPlayer,
      inviteExpiresAt: new Date(now.getTime() + INVITE_WINDOW_MS).toISOString(),
      players: [host, ...others].map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar ?? null,
        status: m.id === user.id ? 'accepted' : 'invited',
      })),
      turns: [],
      currentTurn: 0,
      answers: [],
      xp: null,
    };
    const id = `hdrill_${crypto.randomUUID()}`;
    await tx.query(
      `insert into safespace.house_drills (id, house_id, host_id, status, state, created_at, updated_at)
       values ($1, $2, $3, 'lobby', $4::jsonb, $5, $5)`,
      [id, house.id, user.id, JSON.stringify(state), isoNow(now)],
    );
    return { drillId: id, ring: [house.doorbell] };
  }, 'createHouseDrill');
}

/**
 * Lock the caller's house and the drill, check it is still live, and let `change` edit a
 * copy of its state. `change` returns the new status. Saves and rings the house.
 */
async function changeDrill(userId, drillId, now, label, change) {
  return transaction(async (tx) => {
    const { house, user } = await lockHouseMember(tx, userId);
    const { rows } = await tx.query(
      'select * from safespace.house_drills where id = $1 and house_id = $2 for update',
      [String(drillId ?? ''), house.id],
    );
    const row = rows[0];
    if (!row) throw new HouseError('DRILL_NOT_FOUND');
    if (!LIVE.has(effectiveStatus(row, now))) throw new HouseError('DRILL_OVER');
    const state = structuredClone(row.state);
    const outcome = await change({ tx, row, state, user, isHost: row.host_id === user.id });
    if (outcome?.unchanged) return { drillId: row.id, ring: [] };
    await saveDrill(tx, row.id, outcome.status, state, now);
    return { drillId: row.id, ring: [house.doorbell] };
  }, label);
}

function playerOf(state, userId) {
  return state.players.find((p) => p.id === userId) ?? null;
}

export async function respondToHouseDrill(userId, drillId, accept, { now = new Date() } = {}) {
  return changeDrill(userId, drillId, now, 'respondToHouseDrill', ({ row, state, user, isHost }) => {
    if (row.status !== 'lobby') throw new HouseError('DRILL_ALREADY_STARTED');
    const player = playerOf(state, user.id);
    if (!player || player.status === 'left') throw new HouseError('NOT_INVITED');
    if (isHost) return { unchanged: true };
    if (inviteExpired(state, now)) throw new HouseError('INVITE_EXPIRED');
    const next = accept ? 'accepted' : 'declined';
    if (player.status === next) return { unchanged: true };
    player.status = next;
    return { status: 'lobby' };
  });
}

function validScenarioIds(ids, count) {
  return Array.isArray(ids)
    && ids.length === count
    && ids.every((id) => Number.isInteger(id) && id >= 1 && id <= MAX_SCENARIO_ID)
    && new Set(ids).size === ids.length;
}

export async function startHouseDrill(userId, drillId, scenarioIds, { now = new Date() } = {}) {
  return changeDrill(userId, drillId, now, 'startHouseDrill', ({ row, state, isHost }) => {
    if (!isHost) throw new HouseError('NOT_DRILL_HOST');
    if (row.status !== 'lobby') throw new HouseError('DRILL_ALREADY_STARTED');
    const playing = state.players.filter((p) => p.status === 'accepted');
    if (!validScenarioIds(scenarioIds, playing.length * state.perPlayer)) {
      throw new HouseError('INVALID_DRILL_SETTINGS');
    }
    for (const p of state.players) if (p.status === 'invited') p.status = 'expired';
    state.turns = [];
    for (let round = 0; round < state.perPlayer; round += 1) {
      playing.forEach((p, i) => {
        state.turns.push({ playerId: p.id, scenarioId: scenarioIds[round * playing.length + i] });
      });
    }
    state.currentTurn = 0;
    state.startedAt = isoNow(now);
    return { status: 'playing' };
  });
}

function skippedAnswer(state, turn) {
  return { turn, playerId: state.turns[turn].playerId, scenarioId: state.turns[turn].scenarioId,
    action: null, outcome: null, foundClues: 0, skipped: true };
}

/** Move past the current turn, skipping anyone who left. Returns true when the game is over. */
function advance(state) {
  state.revealing = false;
  state.ready = [];
  state.currentTurn += 1;
  while (state.currentTurn < state.turns.length) {
    const player = playerOf(state, state.turns[state.currentTurn].playerId);
    if (player && player.status === 'accepted') return false;
    state.answers.push(skippedAnswer(state, state.currentTurn));
    state.currentTurn += 1;
  }
  return true;
}

/** Record each player's answered turns as their drill run; returns the XP each gained. */
async function finish(tx, row, state, now) {
  state.finishedAt = isoNow(now);
  const xp = {};
  const ids = [...new Set(state.answers.filter((a) => !a.skipped).map((a) => a.playerId))].sort();
  for (const id of ids) {
    const user = await lockUser(tx, id);
    if (!user) continue;
    const mine = state.answers.filter((a) => !a.skipped && a.playerId === id);
    const counts = { correct: 0, cautious: 0, wrong: 0 };
    for (const a of mine) counts[a.outcome] += 1;
    const result = await recordRunLocked(tx, user, `house-drill:${row.id}`, counts, now);
    xp[id] = result.run.xpGained;
  }
  state.xp = xp;
  return { status: 'finished' };
}

function validAnswer(body) {
  return body
    && Number.isInteger(body.turn)
    && typeof body.action === 'string'
    && body.action.trim().length >= 1
    && body.action.length <= MAX_ACTION_LENGTH
    && OUTCOMES.has(body.outcome)
    && Number.isInteger(body.foundClues)
    && body.foundClues >= 0
    && body.foundClues <= MAX_CLUES;
}

export async function answerHouseDrill(userId, drillId, body, { now = new Date() } = {}) {
  if (!validAnswer(body)) throw new HouseError('INVALID_DRILL_ANSWER');
  return changeDrill(userId, drillId, now, 'answerHouseDrill', async ({ tx, row, state, user }) => {
    if (row.status !== 'playing') throw new HouseError('DRILL_NOT_STARTED');
    // A retried request for a turn this player already answered changes nothing.
    if (state.answers.some((a) => a.turn === body.turn && a.playerId === user.id && !a.skipped)) {
      return { unchanged: true };
    }
    const turn = state.turns[state.currentTurn];
    if (state.revealing || body.turn !== state.currentTurn || !turn || turn.playerId !== user.id) {
      throw new HouseError('NOT_YOUR_TURN');
    }
    state.answers.push({
      turn: state.currentTurn,
      playerId: user.id,
      scenarioId: turn.scenarioId,
      action: body.action.trim(),
      outcome: body.outcome,
      foundClues: body.foundClues,
      skipped: false,
    });
    // Hold here until everyone has seen the answer and tapped Continue.
    state.revealing = true;
    state.ready = [];
    return { status: 'playing' };
  });
}

function everyoneReady(state) {
  return state.players
    .filter((p) => p.status === 'accepted')
    .every((p) => state.ready.includes(p.id));
}

/**
 * A player has seen the current answer and is ready to move on. When every remaining
 * player is ready the next turn starts. The host may `force` it for players who wandered off.
 * A stale or repeated request (the game already moved on) changes nothing.
 */
export async function continueHouseDrill(userId, drillId, turn, { force = false, now = new Date() } = {}) {
  return changeDrill(userId, drillId, now, 'continueHouseDrill', async ({ tx, row, state, user, isHost }) => {
    if (row.status !== 'playing') throw new HouseError('DRILL_NOT_STARTED');
    const player = playerOf(state, user.id);
    if (!player || player.status !== 'accepted') throw new HouseError('NOT_INVITED');
    if (force && !isHost) throw new HouseError('NOT_DRILL_HOST');
    if (!state.revealing || turn !== state.currentTurn) return { unchanged: true };
    if (!force) {
      if (state.ready.includes(user.id)) return { unchanged: true };
      state.ready.push(user.id);
      if (!everyoneReady(state)) return { status: 'playing' };
    }
    return advance(state) ? finish(tx, row, state, now) : { status: 'playing' };
  });
}

/** The host moves the game on when the current player has wandered off. */
export async function skipHouseDrillTurn(userId, drillId, turn, { now = new Date() } = {}) {
  return changeDrill(userId, drillId, now, 'skipHouseDrillTurn', async ({ tx, row, state, isHost }) => {
    if (!isHost) throw new HouseError('NOT_DRILL_HOST');
    if (row.status !== 'playing') throw new HouseError('DRILL_NOT_STARTED');
    // An answered turn is moved on with continueHouseDrill's `force` instead.
    if (turn !== state.currentTurn || state.revealing) return { unchanged: true };
    state.answers.push(skippedAnswer(state, state.currentTurn));
    return advance(state) ? finish(tx, row, state, now) : { status: 'playing' };
  });
}

/**
 * A player drops out. Their remaining turns are skipped. The host leaving ends the game
 * for everyone (a lobby is cancelled; a game in play finishes and credits answered turns).
 */
export async function leaveHouseDrill(userId, drillId, { now = new Date() } = {}) {
  return changeDrill(userId, drillId, now, 'leaveHouseDrill', async ({ tx, row, state, user, isHost }) => {
    const player = playerOf(state, user.id);
    if (!player) throw new HouseError('NOT_INVITED');
    if (row.status === 'lobby') {
      if (isHost) return { status: 'cancelled' };
      if (player.status === 'left') return { unchanged: true };
      player.status = 'left';
      return { status: 'lobby' };
    }
    if (isHost) return finish(tx, row, state, now);
    if (player.status !== 'accepted') return { unchanged: true };
    player.status = 'left';
    if (!state.players.some((p) => p.status === 'accepted')) return finish(tx, row, state, now);
    if (state.revealing) {
      // Their answer (if this was their turn) stands; stop waiting for them.
      state.ready = state.ready.filter((id) => id !== user.id);
      if (everyoneReady(state) && advance(state)) return finish(tx, row, state, now);
      return { status: 'playing' };
    }
    const current = state.turns[state.currentTurn];
    if (current?.playerId === user.id) {
      state.answers.push(skippedAnswer(state, state.currentTurn));
      if (advance(state)) return finish(tx, row, state, now);
    }
    return { status: 'playing' };
  });
}

/**
 * The drill this player should see: their house's live game, or its most recent game
 * for a while after it ended (so the summary survives a refresh). Null when there is
 * none, or when the player was never part of it.
 */
export async function getHouseDrill(userId, { now = new Date(), drillId = null } = {}) {
  const { rows: userRows } = await query(
    'select house_id from safespace.users where id = $1',
    [String(userId)],
    'houseDrillUser',
  );
  const houseId = userRows[0]?.house_id;
  if (!houseId) return { drill: null };
  const { rows } = drillId
    ? await query(
      'select * from safespace.house_drills where id = $1 and house_id = $2',
      [String(drillId), houseId],
      'houseDrillById',
    )
    : await query(
      'select * from safespace.house_drills where house_id = $1 order by created_at desc limit 1',
      [houseId],
      'houseDrillLatest',
    );
  const row = rows[0];
  if (!row) return { drill: null };
  const view = drillView(row, now);
  const me = view.players.find((p) => p.id === String(userId));
  // Everyone invited sees the lobby; once it starts, only those who took part.
  if (!me || (view.startedAt && me.status !== 'accepted' && me.status !== 'left')) return { drill: null };
  if (!LIVE.has(view.status) && !drillId) {
    const endedAt = new Date(row.updated_at).getTime();
    if (now.getTime() - endedAt > RECENT_MS) return { drill: null };
  }
  return { drill: view };
}
