// A drill finishing posts a neutral "finished a drill" line into the player's house chat,
// to start a conversation. It never says how the drill went: a missed drill is private,
// and the chat must not become a place to shame anyone for one.
//
// Best effort and separate from scoring: it runs after the scoring transaction commits
// and never throws, so a chat problem cannot fail or undo a result. The key makes a
// replay a no-op. One statement and no explicit locks, so it adds no lock-order risk to
// the house/user locking convention.
import { query } from './db.js';

export const DRILL_FINISHED_TEXT = 'finished a drill';

/** Returns the house doorbell topic if a line was posted, else null. */
export async function announceDrillFinished(userId, key) {
  try {
    const { rows } = await query(
      `with posted as (
         insert into safespace.chat_messages
           (house_id, sender_id, sender_name, sender_avatar, client_key, body, type)
         select h.id, u.id, u.name, u.avatar, $2, $3, 'drill_finished'
           from safespace.users u
           join safespace.houses h on h.id = u.house_id
          where u.id = $1
         on conflict (house_id, sender_id, client_key) do nothing
         returning house_id
       )
       select h.doorbell from posted join safespace.houses h on h.id = posted.house_id`,
      [String(userId), String(key), DRILL_FINISHED_TEXT],
      'announceDrillFinished',
    );
    return rows[0]?.doorbell ?? null;
  } catch (error) {
    console.error('[chat] could not announce a finished drill:', error?.message || error);
    return null;
  }
}
