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

const CHANNEL_NAMES = { call: 'call', sms: 'text', email: 'email', house: 'house' };

/** Persist Pixi's short announcement and coaching prompt after a scored drill. */
export async function announcePixiDrillOutcome(userId, key, { channel, won } = {}) {
  const channelName = CHANNEL_NAMES[channel] ?? 'practice';
  const announcement = won
    ? `🎉 %s spotted the scam in the ${channelName} drill. Great job pausing before clicking or sharing.`
    : `💛 %s got caught by the ${channelName} drill. That's what practice is for—no shame, we learn together.`;
  const guidance = won
    ? 'Pixi asks: what clue helped you spot it? Share one with the family so we can all stay sharp.'
    : channel === 'call'
      ? 'Pixi tip: end suspicious calls and verify with a number you find yourself. What could you check before acting next time?'
      : channel === 'sms'
        ? 'Pixi tip: pause before tapping links or paying fees. Open the official app or website yourself. What clue will you watch for next time?'
        : channel === 'email'
          ? 'Pixi tip: check the full sender address, and avoid unexpected links or files. What clue will you watch for next time?'
          : 'Pixi tip: pause, inspect the clues, and check with someone you trust. What clue will you remember next time?';

  try {
    const { rows } = await query(
      `with posted as (
         insert into safespace.chat_messages
           (house_id, sender_id, sender_name, sender_avatar, client_key, body, type)
         select h.id, null, 'PIXI', null, messages.client_key, messages.body, 'pixi_message'
           from safespace.users u
           join safespace.houses h on h.id = u.house_id
           cross join lateral (values
             ($2 || ':pixi:announce', format($3, u.name)),
             ($2 || ':pixi:guide', $4)
           ) as messages(client_key, body)
          where u.id = $1
         on conflict (client_key) where type = 'pixi_message' do nothing
         returning house_id
       )
       select h.doorbell from posted join safespace.houses h on h.id = posted.house_id limit 1`,
      [String(userId), String(key), announcement, guidance],
      'announcePixiDrillOutcome',
    );
    return rows[0]?.doorbell ?? null;
  } catch (error) {
    console.error('[chat] could not post Pixi drill guidance:', error?.message || error);
    return null;
  }
}

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
