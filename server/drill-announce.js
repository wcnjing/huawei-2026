// Persist Pixi's drill coaching in the house chat (its chat replies are pixi-chat.js).
// Best effort and separate from scoring, so a chat problem cannot undo a result.
// Idempotency keys make retries safe without adding lock-order risk.
import { query } from './db.js';
import { cleanFamilyTree, familyTreeFromLinks } from './family-rules.js';
import { pixiWriterConfigured, writePixiMessages } from './pixi-writer.js';

export const DRILL_SCAMMED_TEXT = 'got caught out by a drill';

const CHANNEL_NAMES = { call: 'call', sms: 'text', email: 'email', solo: 'individual' };

/** The fixed lines, used when OpenAI is off or its reply can't be used. */
export function templatePixiMessages({ channel, won } = {}) {
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
  return [announcement, guidance];
}

/** A house's members ({ id, name }) and its family tree. `familyTree` is houses.family_tree. */
export async function loadHouseFamily(houseId, familyTree) {
  const { rows } = await query(
    `select m.user_id as id, m.family_link, u.name
       from safespace.house_members m join safespace.users u on u.id = m.user_id
      where m.house_id = $1`,
    [houseId],
    'loadHouseFamily',
  );
  const ids = new Set(rows.map((row) => row.id));
  const tree = familyTree
    ? cleanFamilyTree(familyTree, ids)
    : familyTreeFromLinks(rows.map((row) => ({ id: row.id, link: row.family_link })));
  return { members: rows.map((row) => ({ id: row.id, name: row.name })), tree };
}

/** Everything Pixi's writer reads about the player's current house, or null. Read-only. */
export async function loadPixiContext(userId) {
  const { rows: [user] } = await query(
    `select u.id, u.name, u.streak, u.times_safe, u.times_scammed, h.id as house_id, h.family_tree
       from safespace.users u join safespace.houses h on h.id = u.house_id
      where u.id = $1`,
    [String(userId)],
    'loadPixiContext.user',
  );
  if (!user) return null;
  const { members, tree } = await loadHouseFamily(user.house_id, user.family_tree);
  const { rows: chatRows } = await query(
    `select sender_id, sender_name, body from safespace.chat_messages
      where house_id = $1 and type in ('message', 'pixi_message')
      order by id desc limit 8`,
    [user.house_id],
    'loadPixiContext.chat',
  );
  return {
    userId: user.id,
    userName: user.name,
    streak: user.streak,
    timesSafe: user.times_safe,
    timesScammed: user.times_scammed,
    members,
    tree,
    recentChat: chatRows.reverse().map((row) => ({ senderId: row.sender_id, from: row.sender_name, text: row.body })),
  };
}

async function alreadyAnnounced(key) {
  const { rows } = await query(
    `select 1 from safespace.chat_messages where type = 'pixi_message' and client_key = $1`,
    [`${key}:pixi:announce`],
    'alreadyAnnounced',
  );
  return rows.length > 0;
}

/** Lines written by OpenAI for this drill, or null to use the templates. Never throws. */
async function writtenMessages(userId, key, drill) {
  if (!pixiWriterConfigured()) return null;
  try {
    // A replayed result must not pay for a second reply that the insert would drop.
    if (await alreadyAnnounced(key)) return null;
    const context = await loadPixiContext(userId);
    return context ? await writePixiMessages(context, drill) : null;
  } catch (error) {
    console.error('[pixi] could not gather drill context:', error?.message || error);
    return null;
  }
}

/**
 * Persist Pixi's announcement and follow-up after a scored drill. With OPENAI_API_KEY set,
 * OpenAI writes them from the drill and the family (pixi-writer.js); otherwise, or when
 * that fails, the fixed templates are posted. Awaited rather than backgrounded because a
 * serverless function is frozen once it responds; the writer's timeout bounds the wait.
 * `outcome` is the xp.js outcome and `run` the house quiz counts, both optional.
 */
export async function announcePixiDrillOutcome(userId, key, { channel, won, outcome = null, run = null } = {}) {
  const written = await writtenMessages(userId, key, { channel, won, outcome, run });
  // The insert runs both lines through format() for the template's %s, so a % the model
  // wrote has to be escaped to survive it.
  const [announcement, guidance] = written
    ? written.map((line) => line.replace(/%/g, '%%'))
    : templatePixiMessages({ channel, won });

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
             ($2 || ':pixi:guide', format($4, u.name))
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
