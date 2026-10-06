// Persist Pixi's drill coaching and chat replies. These are best effort and separate
// from scoring or member messages, so a chat problem cannot undo either action.
// Idempotency keys make retries safe without adding lock-order risk.
import { query } from './db.js';

export const DRILL_SCAMMED_TEXT = 'got caught out by a drill';

const CHANNEL_NAMES = { call: 'call', sms: 'text', email: 'email', house: 'house' };

/** Choose one brief, supportive reply based on the member's message. */
export function pixiChatReply(text) {
  const message = String(text || '').toLocaleLowerCase();
  if (/\b(help|scared|worried|afraid|nervous|anxious|unsafe|not safe)\b/.test(message)) {
    return 'You are safe here, and it is always okay to pause. What part would you like help thinking through?';
  }
  if (/\b(thank you|thanks|thx)\b/.test(message)) {
    return 'You are welcome. Keep sharing questions with your family so you can learn together.';
  }
  if (/\b(hello|hi|hey|good morning|good afternoon|good evening)\b/.test(message)) {
    return 'Hi there. What would you like to practise or talk through today?';
  }
  if (/\b(otp|one time code|verification code|password|passcode)\b/.test(message)) {
    return 'Good question. Never share a code or password with someone who contacts you. Did you expect the request?';
  }
  if (/\b(link|url|click|tap|attachment|file)\b/.test(message)) {
    return 'Pause before opening it. Check who sent it, then visit the official app or website yourself. What looks unusual?';
  }
  if (/\b(call|caller|phone|voicemail)\b/.test(message)) {
    return 'If a caller creates urgency, end the call and verify through a number you find yourself. What did they ask you to do?';
  }
  if (/\b(bank|payment|transfer|money|fee|parcel|delivery)\b/.test(message)) {
    return 'Check payment or delivery claims in the official app or website. What detail can you verify independently?';
  }
  if (/\b(scam|scammer|phishing|suspicious|fake)\b/.test(message)) {
    return 'Good instinct to check. Look for urgency, unexpected requests, and details you can verify independently. What stood out to you?';
  }
  if (/\b(won|safe|spotted|reported|caught)\b/.test(message)) {
    return 'Great job sharing that with the family. What clue helped you decide what to do?';
  }
  if (message.includes('?')) {
    return 'That is a good question. What detail would you like to check first? We can think it through together.';
  }
  return 'Thanks for sharing. What is one thing you would check before acting on a message like that?';
}

/** Store Pixi's idempotent reply to a member's chat message. */
export async function replyToHouseMessage(userId, messageId, text) {
  try {
    const { rows } = await query(
      `with posted as (
         insert into safespace.chat_messages
           (house_id, sender_id, sender_name, sender_avatar, client_key, body, type)
         select original.house_id, null, 'PIXI', null,
                'chat:' || original.id::text || ':pixi:reply', $3, 'pixi_message'
           from safespace.chat_messages original
          where original.id = $2::bigint and original.sender_id = $1
         on conflict (client_key) where type = 'pixi_message' do nothing
         returning house_id
       )
       select h.doorbell from posted join safespace.houses h on h.id = posted.house_id`,
      [String(userId), String(messageId), String(text)],
      'replyToHouseMessage',
    );
    return rows[0]?.doorbell ?? null;
  } catch (error) {
    console.error('[chat] could not post Pixi chat reply:', error?.message || error);
    return null;
  }
}

/** Persist Pixi's short announcement and coaching prompt after a scored drill. */
export async function announcePixiDrillOutcome(userId, key, { channel, won } = {}) {
  const channelName = CHANNEL_NAMES[channel] ?? 'practice';
  const announcement = won
    ? `🎉 Great work spotting the scam in the ${channelName} drill. You paused before clicking or sharing.`
    : `💛 You got caught by the ${channelName} drill. That's what practice is for. There is no shame. We learn together.`;
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
             ($2 || ':pixi:announce', $3),
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
