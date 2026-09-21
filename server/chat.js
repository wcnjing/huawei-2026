import { transaction } from './db.js';
import { cleanAvatar, DEFAULT_AVATAR } from './avatar.js';
import { HouseError, lockHouseMember } from './houses.js';
import {
  lockRateLimits,
  recordRateLimitHits,
  retryAfterForWindow,
} from './store.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_RE = /^[1-9][0-9]{0,18}$/;
const MAX_CURSOR = 9223372036854775807n;
const SEND_WINDOW_MS = 60_000;
const SEND_LIMIT = 20;

export class ChatError extends Error {
  constructor(code, retryAfterMs = 0) {
    super(code);
    this.name = 'ChatError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function accessError(error) {
  if (error instanceof HouseError && error.code === 'NOT_IN_HOUSE') {
    throw new ChatError('CHAT_ACCESS_DENIED');
  }
  throw error;
}

export function normalizeText(value) {
  if (typeof value !== 'string') throw new ChatError('INVALID_MESSAGE');
  const body = value.replace(/\r\n/g, '\n');
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(body)
      || /[\uD800-\uDFFF]/u.test(body)) throw new ChatError('INVALID_MESSAGE');
  const text = body.trim();
  if (!text || Array.from(text).length > 1000) throw new ChatError('INVALID_MESSAGE');
  return text;
}

export function parseCursors({ before, after } = {}) {
  const present = [before, after].filter((value) => value !== undefined);
  if (present.length > 1) throw new ChatError('INVALID_CURSOR');
  if (!present.length) return {};
  const value = present[0];
  if (typeof value !== 'string' || !CURSOR_RE.test(value) || BigInt(value) > MAX_CURSOR) {
    throw new ChatError('INVALID_CURSOR');
  }
  return before !== undefined ? { before: value } : { after: value };
}

function messageFromRow(row) {
  return {
    id: String(row.id),
    houseId: row.house_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatar: cleanAvatar(row.sender_avatar) ?? DEFAULT_AVATAR,
    text: row.body,
    createdAt: new Date(row.created_at).toISOString(),
    clientKey: row.client_key,
  };
}

export async function listMessages(userId, houseId, cursors = {}) {
  const { before, after } = parseCursors(cursors);
  try {
    return await transaction(async (tx) => {
      const { house } = await lockHouseMember(tx, userId, houseId);
      const ascending = after !== undefined;
      const bound = after ?? before;
      const clause = bound ? `and id ${ascending ? '>' : '<'} $2::bigint` : '';
      const result = await tx.query(
        `select id::text, house_id, sender_id, sender_name, sender_avatar,
                client_key, body, created_at
           from safespace.chat_messages where house_id = $1 ${clause}
           order by chat_messages.id ${ascending ? 'asc' : 'desc'} limit 51`,
        bound ? [house.id, bound] : [house.id],
      );
      const rows = result.rows.slice(0, 50);
      if (!ascending) rows.reverse();
      return {
        houseId: house.id,
        messages: rows.map(messageFromRow),
        hasMore: result.rows.length > 50,
      };
    }, 'listMessages');
  } catch (error) {
    return accessError(error);
  }
}

export async function sendMessage(userId, houseId, input, { now = new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some((key) => key !== 'text' && key !== 'clientKey')) {
    throw new ChatError('INVALID_MESSAGE');
  }
  const text = normalizeText(input.text);
  if (typeof input.clientKey !== 'string' || !UUID_RE.test(input.clientKey)) {
    throw new ChatError('INVALID_MESSAGE');
  }
  const clientKey = input.clientKey.toLowerCase();
  const nowMs = now.getTime();
  try {
    return await transaction(async (tx) => {
      const window = { nowMs, windowMs: SEND_WINDOW_MS };
      const [bucket] = await lockRateLimits(
        tx,
        [{ scope: 'house_chat_send', subject: userId }],
        window,
      );
      const { house, user } = await lockHouseMember(tx, userId, houseId);
      const existing = await tx.query(
        `select id::text, house_id, sender_id, sender_name, sender_avatar,
                client_key, body, created_at
           from safespace.chat_messages
          where house_id = $1 and sender_id = $2 and client_key = $3`,
        [house.id, user.id, clientKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].body !== text) throw new ChatError('MESSAGE_KEY_REUSED');
        return { message: messageFromRow(existing.rows[0]), created: false, topic: house.doorbell };
      }
      if (bucket.hits.length >= SEND_LIMIT) {
        throw new ChatError(
          'CHAT_RATE_LIMITED',
          retryAfterForWindow(bucket.hits, nowMs, SEND_WINDOW_MS),
        );
      }
      const { rows } = await tx.query(
        `insert into safespace.chat_messages
           (house_id, sender_id, sender_name, sender_avatar, client_key, body, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id::text, house_id, sender_id, sender_name, sender_avatar,
                   client_key, body, created_at`,
        [house.id, user.id, user.name, cleanAvatar(user.avatar) ?? DEFAULT_AVATAR,
          clientKey, text, now.toISOString()],
      );
      await recordRateLimitHits(tx, [bucket], window);
      return { message: messageFromRow(rows[0]), created: true, topic: house.doorbell };
    }, 'sendMessage');
  } catch (error) {
    return accessError(error);
  }
}
