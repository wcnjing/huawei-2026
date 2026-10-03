// When a player gets caught out by a drill, post a short line into their house chat so
// the house can talk it through. Only a drill someone fell for is announced; wins and
// anything unscored are not. The wording is "got caught out", not blame: this is meant
// to start a supportive conversation, not to rank or shame anyone.
//
// Best effort and separate from scoring: it runs after the scoring transaction commits
// and never throws, so a chat problem cannot fail or undo a result. The key makes a
// replay a no-op. One statement and no explicit locks, so it adds no lock-order risk to
// the house/user locking convention.
import { query } from './db.js';

export const DRILL_SCAMMED_TEXT = 'got caught out by a drill';

/** Returns the house doorbell topic if a line was posted, else null. */
export async function announceDrillScammed(userId, key) {
  try {
    const { rows } = await query(
      `with posted as (
         insert into safespace.chat_messages
           (house_id, sender_id, sender_name, sender_avatar, client_key, body, type)
         select h.id, u.id, u.name, u.avatar, $2, $3, 'drill_scammed'
           from safespace.users u
           join safespace.houses h on h.id = u.house_id
          where u.id = $1
         on conflict (house_id, sender_id, client_key) do nothing
         returning house_id
       )
       select h.doorbell from posted join safespace.houses h on h.id = posted.house_id`,
      [String(userId), String(key), DRILL_SCAMMED_TEXT],
      'announceDrillScammed',
    );
    return rows[0]?.doorbell ?? null;
  } catch (error) {
    console.error('[chat] could not announce a drill:', error?.message || error);
    return null;
  }
}
