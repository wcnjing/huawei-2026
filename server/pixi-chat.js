// Pixi talking back in the house chat. After a member's message is saved, their app asks
// for a Pixi reply in a separate request, so sending never waits on OpenAI and the reply
// is written inside a request on every host (a serverless function is frozen once it
// responds, so it can't be left running in the background).
//
// Pixi considers every member message, and the model decides whether to answer: always
// when named, usually for greetings and scam questions, and not when the family are
// talking to each other (server/prompts/pixi-chat-reply.md). Each house gets a capped number of model calls an
// hour, and a reply is keyed by the message it answers so it is posted at most once.
import { query, transaction } from './db.js';
import { ChatError, messageFromRow } from './chat.js';
import { loadHouseFamily } from './drill-announce.js';
import { pixiShouldConsider, pixiWriterConfigured, writePixiReply } from './pixi-writer.js';
import { lockRateLimits, recordRateLimitHits } from './store.js';

const MESSAGE_ID_RE = /^[1-9][0-9]{0,18}$/;
const RECENT_LINES = 17;
export const PIXI_REPLY_WINDOW_MS = 60 * 60 * 1000;
export const PIXI_REPLY_LIMIT = 60;

// `id` comes back as text, so ordering must name chat_messages.id: a bare `id` sorts the
// text column, which puts "99" after "168".
const COLUMNS = `id::text, house_id, sender_id, sender_name, sender_avatar,
                 client_key, body, created_at, type`;

const lineFromRow = (row) => ({
  id: String(row.id),
  senderId: row.sender_id,
  from: row.sender_name,
  text: row.body,
  type: row.type,
  createdAt: new Date(row.created_at).toISOString(),
});

/** Take one model call from the house's hourly budget. False when it is spent. */
async function reserveReply(houseId, nowMs) {
  return transaction(async (tx) => {
    const window = { nowMs, windowMs: PIXI_REPLY_WINDOW_MS };
    const [bucket] = await lockRateLimits(tx, [{ scope: 'pixi_reply', subject: houseId }], window);
    if (bucket.hits.length >= PIXI_REPLY_LIMIT) return false;
    await recordRateLimitHits(tx, [bucket], window);
    return true;
  }, 'reservePixiReply');
}

/**
 * Let Pixi answer `messageId`, the caller's own latest message in `houseId`.
 * Resolves to { message, topic }: the posted reply and the house doorbell, or
 * { message: null } when Pixi stays quiet. Throws ChatError for a bad id or no access.
 */
export async function replyAsPixi(userId, houseId, messageId, { now = new Date(), writeReply } = {}) {
  if (typeof messageId !== 'string' || !MESSAGE_ID_RE.test(messageId)) {
    throw new ChatError('INVALID_MESSAGE');
  }
  const { rows: [house] } = await query(
    `select h.id, h.doorbell, h.family_tree
       from safespace.house_members m join safespace.houses h on h.id = m.house_id
      where m.house_id = $1 and m.user_id = $2`,
    [String(houseId), String(userId)],
    'replyAsPixi.access',
  );
  if (!house) throw new ChatError('CHAT_ACCESS_DENIED');
  const quiet = { message: null, topic: house.doorbell };
  // `writeReply` stands in for OpenAI in tests.
  if (!writeReply && !pixiWriterConfigured()) return quiet;

  const { rows } = await query(
    `select ${COLUMNS} from safespace.chat_messages
      where house_id = $1 order by chat_messages.id desc limit ${RECENT_LINES}`,
    [house.id],
    'replyAsPixi.recent',
  );
  const recent = rows.reverse().map(lineFromRow);
  // Only the newest member message gets an answer: an older one has been talked past,
  // and whoever sent the newer one asks about that instead.
  const latest = [...recent].reverse().find((m) => m.type === 'message');
  if (!latest || latest.id !== messageId || latest.senderId !== String(userId)) return quiet;
  const clientKey = `reply:${messageId}:pixi`;
  if (rows.some((row) => row.type === 'pixi_message' && row.client_key === clientKey)) return quiet;
  const flags = pixiShouldConsider(latest, recent, now.getTime());
  if (!flags.consider) return quiet;
  if (!await reserveReply(house.id, now.getTime())) return quiet;

  const { members, tree } = await loadHouseFamily(house.id, house.family_tree);
  const text = await (writeReply ?? writePixiReply)({ members, tree, recentChat: recent }, latest, flags);
  if (!text) return quiet;

  const { rows: posted } = await query(
    `insert into safespace.chat_messages
       (house_id, sender_id, sender_name, sender_avatar, client_key, body, type)
     values ($1, null, 'PIXI', null, $2, $3, 'pixi_message')
     on conflict (client_key) where type = 'pixi_message' do nothing
     returning ${COLUMNS}`,
    [house.id, clientKey, text],
    'replyAsPixi.post',
  );
  return posted[0] ? { message: messageFromRow(posted[0]), topic: house.doorbell } : quiet;
}
