// Developer shortcut: sign in on localhost without a phone OTP.
//
// Three independent locks keep this off anything real:
//   1. The route is only registered when NODE_ENV is not "production" and the process is
//      not on Vercel (see devLoginEnabled).
//   2. Each request must arrive on a loopback socket with a localhost Host header and no
//      forwarding headers, so a reverse proxy on the same machine (nginx on the ECS box)
//      cannot relay a public request into it.
//   3. It only ever signs in as the fixed `dev_player` account, which has no phone, no
//      email and no drill consent, so it can never trigger a real call, SMS or email.
//
// The first sign-in also creates a small "DEV HOUSE" (dev_player plus three dev
// housemates) so house, chat and family-tree screens have something to show.
import crypto from 'crypto';
import { transaction } from './db.js';
import { createSession } from './store.js';

export const DEV_USER_ID = 'dev_player';
const DEV_HOUSE_ID = 'house_dev';

const DEV_MEMBERS = [
  { id: DEV_USER_ID, name: 'DEV', color: '#00ff88', room: 'DEV ROOM', bg: '#0c1a10', family: null },
  { id: 'dev_grandma', name: 'GRANDMA', color: '#c77dff', room: "GRANDMA'S ROOM", bg: '#100c20',
    family: { gender: 'female' } },
  { id: 'dev_mum', name: 'MUM', color: '#ff2d55', room: "MUM'S ROOM", bg: '#1a0c14',
    family: { gender: 'female', parentIds: ['dev_grandma'] } },
  { id: 'dev_dad', name: 'DAD', color: '#4ecdc4', room: "DAD'S ROOM", bg: '#081420',
    family: { gender: 'male', partnerId: 'dev_mum' } },
];

export function devLoginEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' && !env.VERCEL && env.DISABLE_DEV_LOGIN !== 'true';
}

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** True only for a request made directly from this machine to a localhost address. */
export function isLocalRequest(req) {
  if (!LOOPBACK.has(req.socket?.remoteAddress)) return false;
  if (req.get('x-forwarded-for') || req.get('x-real-ip') || req.get('forwarded')) return false;
  const host = String(req.get('host') || '').toLowerCase().replace(/:\d+$/, '');
  return LOCAL_HOSTS.has(host);
}

function familyRecord(partial) {
  return partial && { role: null, gender: null, parentIds: [], partnerId: null, childIds: [], ...partial };
}

/** Ensure the dev account and its house exist, then open a session for it. */
export async function devLogin() {
  await transaction(async (tx) => {
    for (const [i, m] of DEV_MEMBERS.entries()) {
      await tx.query(
        `insert into safespace.users
           (id, name, consent_to_drills, primary_color, room_name, room_bg, avatar, family_link, created_at)
         values ($1, $2, false, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
         on conflict (id) do nothing`,
        [m.id, m.name, m.color, m.room, m.bg,
          JSON.stringify({ color: m.color, glow: m.color, hat: 'None', eyes: 'Default', outfit: 'Standard' }),
          m.family ? JSON.stringify(familyRecord(m.family)) : null, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()],
      );
    }
    const { rows } = await tx.query('select house_id from safespace.users where id = $1 for update', [DEV_USER_ID]);
    if (rows[0]?.house_id) return;
    await tx.query(
      `insert into safespace.houses (id, name, owner_id, doorbell)
       values ($1, 'DEV HOUSE', $2, $3)
       on conflict (id) do nothing`,
      [DEV_HOUSE_ID, DEV_USER_ID, `house-${crypto.randomBytes(16).toString('hex')}`],
    );
    // Only dev accounts that are not already in some other house.
    await tx.query(
      `update safespace.users set house_id = $1, joined_house_at = created_at
        where id = any($2) and house_id is null`,
      [DEV_HOUSE_ID, DEV_MEMBERS.map((m) => m.id)],
    );
  }, 'devLogin');
  const token = await createSession(DEV_USER_ID);
  return { token, userId: DEV_USER_ID, name: 'DEV' };
}
