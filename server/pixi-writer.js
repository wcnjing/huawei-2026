// Pixi's house-chat lines after a drill, written by OpenAI from what actually happened:
// who played (by family role when the tree knows it), the channel, what they did, their
// track record, who else is in the house and what the family has been saying lately.
//
// The family's recent chat is member-authored, so it goes in as delimited data and the
// model can only answer in PIXI_SCHEMA. Every line it returns is checked again here, and
// any failure (no key, timeout, refusal, bad output) returns null so the caller posts the
// fixed templates instead. Nothing here throws.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Pixi's instructions live in server/prompts/*.md so they can be edited without touching
// code. They're read on every call (they're tiny), so an edit applies straight away.
const PROMPTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts');
export function loadPrompt(name) {
  const text = fs.readFileSync(path.join(PROMPTS_DIR, name), 'utf8');
  return text.replace(/<!--[\s\S]*?-->/g, '').trim();
}

export const DEFAULT_PIXI_MODEL = 'gpt-5-mini';
export const DEFAULT_PIXI_TIMEOUT_MS = 6000;
export const MAX_PIXI_CHARS = 400;
const MAX_CHAT_LINES = 8;
const MAX_CHAT_CHARS = 200;

export function pixiModel(env = process.env) {
  return String(env.PIXI_MODEL || '').trim() || DEFAULT_PIXI_MODEL;
}

/** PIXI_AI=off keeps the fixed templates even when a key is set (tests use this). */
export function pixiWriterConfigured(env = process.env) {
  if (String(env.PIXI_AI || '').trim().toLowerCase() === 'off') return false;
  return Boolean(String(env.OPENAI_API_KEY || '').trim());
}

function pixiTimeoutMs(env = process.env) {
  const value = Number(env.PIXI_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PIXI_TIMEOUT_MS;
}

// What the player did, in words the model can turn into a tip. Keys are xp.js outcomes.
const OUTCOME_WORDS = {
  hung_up: 'hung up on the scam call',
  disengaged: 'stopped engaging with the scammer',
  verified: 'checked with the real organisation before acting',
  reported: 'reported the scam message',
  'asked-family': 'asked family before acting',
  closed_page: 'closed the fake page without entering anything',
  cancelled_download: 'cancelled the suspicious download',
  caught_flag: 'engaged at first but caught a red flag in time',
  complied: 'did what the scammer asked',
  shared_data: 'shared personal details with the scammer',
  clicked_link: 'tapped the scam link',
  submitted_details: 'typed their details into the fake page',
  opened_attachment: 'opened the suspicious attachment',
};

const CHANNEL_WORDS = {
  call: 'a simulated scam phone call',
  sms: 'a simulated scam text message',
  email: 'a simulated scam email',
  solo: 'an individual spot-the-scam drill (a short quiz of scam scenarios)',
};

/**
 * Each member's role in the house from where they sit on the tree: Grandpa, Mum, Son…
 * Mirrors familyLabels() in src/app/screens/house/familyTreeLayout.ts. "" when unknown.
 */
export function familyRoles(tree, ids) {
  const parentsOf = new Map(ids.map((id) => [id, new Set()]));
  for (const [p, c] of tree?.parents ?? []) parentsOf.get(c)?.add(p);
  const partnerOf = new Map();
  for (const [a, b] of tree?.partners ?? []) {
    if (partnerOf.has(a) || partnerOf.has(b)) continue;
    partnerOf.set(a, b);
    partnerOf.set(b, a);
  }
  const friends = new Set((tree?.friends ?? []).flat());
  // A child of one partner counts as the couple's child.
  const familyOf = (child) => {
    const ps = [...(parentsOf.get(child) ?? [])];
    if (ps.length === 1 && partnerOf.has(ps[0])) ps.push(partnerOf.get(ps[0]));
    return ps;
  };
  const childrenOf = (id) => ids.filter((c) => familyOf(c).includes(id));
  const memo = new Map();
  const depth = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = Math.max(0, ...childrenOf(id).map((c) => depth(c, seen) + 1));
    memo.set(id, d);
    return d;
  };
  const pick = (g, male, female, other) => (g === 'male' ? male : g === 'female' ? female : other);
  const roles = new Map();
  for (const id of ids) {
    const g = tree?.genders?.[id] ?? null;
    const d = depth(id);
    let role = '';
    if (d >= 3) role = pick(g, 'Great-Grandpa', 'Great-Grandma', 'Great-Grandparent');
    else if (d === 2) role = pick(g, 'Grandpa', 'Grandma', 'Grandparent');
    else if (d === 1) role = pick(g, 'Dad', 'Mum', 'Parent');
    else if ((parentsOf.get(id)?.size ?? 0) > 0) role = pick(g, 'Son', 'Daughter', 'Child');
    else if (partnerOf.has(id)) role = pick(g, 'Husband', 'Wife', 'Partner');
    else if (friends.has(id)) role = 'Family friend';
    roles.set(id, role);
  }
  return roles;
}

export const PIXI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['announcement', 'followUp'],
  properties: {
    announcement: {
      type: 'string',
      description: `What happened, in one or two short sentences, at most ${MAX_PIXI_CHARS} characters.`,
    },
    followUp: {
      type: 'string',
      description: `A tip, question or nudge that gets the family talking, at most ${MAX_PIXI_CHARS} characters.`,
    },
  },
};


// Em and en dashes read as machine-written in a family chat, so they become commas
// ("5–10" becomes "5 to 10"), then any doubled or dangling punctuation is tidied.
export function humanizeDashes(text) {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*([,.!?;:])/g, '$1')
    .replace(/^\s*,\s*|\s*,\s*$/g, '');
}

function cleanLine(value) {
  if (typeof value !== 'string') return null;
  const text = humanizeDashes(value.replace(/\r\n/g, '\n')).trim();
  if (!text || Array.from(text).length > MAX_PIXI_CHARS) return null;
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(text) || /[\uD800-\uDFFF]/u.test(text)) return null;
  // A link in a scam-awareness chat is exactly what we teach people not to tap.
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|sg|ly|io)\b/i.test(text)) return null;
  return text;
}

/** The model's JSON as [announcement, followUp], or null when anything is off. */
export function parsePixiOutput(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const announcement = cleanLine(data?.announcement);
  const followUp = cleanLine(data?.followUp);
  return announcement && followUp ? [announcement, followUp] : null;
}

// Names are stored in capitals ("AH HUAT"); the model copies whatever it is given, so it
// gets them as people write them ("Ah Huat").
export const displayName = (name) => String(name ?? '').toLowerCase()
  .replace(/(^|[\s'-])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());

// Families call parents and grandparents by role ("Dad", "Grandma") and everyone else by
// name ("Mei", never "Daughter" or "Child").
const ADDRESS_BY_ROLE = new Set(['Dad', 'Mum', 'Grandpa', 'Grandma', 'Great-Grandpa', 'Great-Grandma']);

/**
 * What Pixi calls each member. One label per person, so the model can't write
 * "Dad Ah Huat".
 */
export function familyCallNames(context) {
  const roles = familyRoles(context.tree, context.members.map((m) => m.id));
  return new Map(context.members.map((m) => {
    const role = roles.get(m.id);
    return [m.id, ADDRESS_BY_ROLE.has(role) ? role : displayName(m.name)];
  }));
}

const clip = (text, max) => {
  const chars = Array.from(String(text ?? ''));
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
};

/**
 * The user message for the model. `context` comes from loadPixiContext() in
 * drill-announce.js; `drill` is { channel, won, outcome, run }.
 */
export function buildPixiInput(context, drill) {
  const callThem = familyCallNames(context);
  const family = context.members
    .filter((m) => m.id !== context.userId)
    .map((m) => ({ callThem: callThem.get(m.id) }));
  return {
    drill: {
      type: CHANNEL_WORDS[drill.channel] ?? 'a scam-spotting drill',
      result: drill.won ? 'spotted the scam' : 'got caught by the scam',
      whatTheyDid: OUTCOME_WORDS[drill.outcome] ?? null,
      quizRounds: drill.run
        ? { correct: drill.run.correct, cautious: drill.run.cautious, wrong: drill.run.wrong }
        : null,
    },
    player: {
      callThem: callThem.get(context.userId) ?? displayName(context.userName),
      currentStreak: context.streak,
      timesSpottedBefore: context.timesSafe,
      timesCaughtBefore: context.timesScammed,
    },
    family,
    recentChat: context.recentChat
      .slice(-MAX_CHAT_LINES)
      .map((m) => ({ from: (m.senderId && callThem.get(m.senderId)) || displayName(m.from), text: clip(m.text, MAX_CHAT_CHARS) })),
  };
}

let client = null;
let clientKey = null;
function openaiClient(env = process.env) {
  const key = String(env.OPENAI_API_KEY || '').trim();
  if (!client || clientKey !== key) {
    client = new OpenAI({ apiKey: key, maxRetries: 0 });
    clientKey = key;
  }
  return client;
}

/**
 * One structured OpenAI call: the parsed JSON reply, or null on any failure. `create`
 * replaces the SDK call in tests.
 */
async function callPixiModel({ instructions, input, name, schema }, { env = process.env, create } = {}) {
  if (!create && !pixiWriterConfigured(env)) return null;
  const model = pixiModel(env);
  const request = {
    model,
    instructions,
    input: JSON.stringify(input),
    text: { format: { type: 'json_schema', name, schema, strict: true } },
    // Short chat lines don't need deliberation, and someone is waiting on this.
    ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'minimal' } } : {}),
  };
  try {
    const send = create ?? ((body, options) => openaiClient(env).responses.create(body, options));
    const response = await send(request, { timeout: pixiTimeoutMs(env) });
    return JSON.parse(response?.output_text ?? '');
  } catch (error) {
    console.error(`[pixi] ${name} call failed:`, error?.name || 'error', error?.status ?? '');
    return null;
  }
}

/** [announcement, followUp] written by OpenAI, or null to fall back to the templates. */
export async function writePixiMessages(context, drill, options = {}) {
  const raw = await callPixiModel({
    instructions: loadPrompt('pixi-drill-post.md'),
    input: buildPixiInput(context, drill),
    name: 'pixi_chat',
    schema: PIXI_SCHEMA,
  }, options);
  if (raw === null) return null;
  const lines = parsePixiOutput(raw);
  if (!lines) console.error('[pixi] model reply was unusable; using templates');
  return lines;
}

// ---- Chat replies -------------------------------------------------------------------

// Every member message goes to the model, which decides whether Pixi should answer.
// `mentioned` (Pixi named) and `engaged` (Pixi posted within the last few messages, and
// recently) tell it how directly Pixi is being spoken to, and let the app show
// "Pixi is typing" only when a reply is likely.
export const PIXI_NAME_RE = /\bpixi\b/i;
export const ENGAGED_LOOKBACK = 6;
export const ENGAGED_WINDOW_MS = 30 * 60 * 1000;
const REPLY_CHAT_LINES = 16;

/** `recent` is the house's latest messages, oldest first, ending with `latest`. */
export function pixiShouldConsider(latest, recent, now = Date.now()) {
  if (!latest || latest.type !== 'message') return { consider: false, mentioned: false, engaged: false };
  const mentioned = PIXI_NAME_RE.test(latest.text);
  const before = recent.filter((m) => m.id !== latest.id).slice(-ENGAGED_LOOKBACK);
  const engaged = before.some((m) => m.type === 'pixi_message'
    && now - Date.parse(m.createdAt) <= ENGAGED_WINDOW_MS);
  return { consider: true, mentioned, engaged };
}

export const PIXI_REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'text'],
  properties: {
    reply: {
      type: 'boolean',
      description: 'True to post a reply. False when the family are talking to each other and Pixi should stay quiet.',
    },
    text: {
      type: 'string',
      description: `The reply, at most ${MAX_PIXI_CHARS} characters. Empty when reply is false.`,
    },
  },
};


/** The reply text, or null when Pixi stays quiet or the reply is unusable. */
export function parsePixiReply(raw) {
  if (!raw || typeof raw !== 'object' || raw.reply !== true) return null;
  return cleanLine(raw.text);
}

/**
 * The model input for a chat reply. `context` holds the house's members, tree and
 * recent chat (each { id, from, senderId, text, type, createdAt }), ending with `latest`.
 */
export function buildPixiReplyInput(context, latest, { mentioned, engaged = false }) {
  const callThem = familyCallNames(context);
  const nameOf = (m) => (m.type === 'pixi_message'
    ? 'Pixi'
    : (m.senderId && callThem.get(m.senderId)) || displayName(m.from));
  return {
    family: context.members.map((m) => ({ callThem: callThem.get(m.id) })),
    recentChat: context.recentChat
      .filter((m) => m.id !== latest.id)
      .slice(-REPLY_CHAT_LINES)
      .map((m) => ({ from: nameOf(m), text: clip(m.text, MAX_CHAT_CHARS) })),
    latest: { from: nameOf(latest), text: clip(latest.text, MAX_PIXI_CHARS * 2) },
    mentioned,
    pixiRecentlyActive: engaged,
  };
}

/** Pixi's reply to `latest`, or null to stay quiet. Never throws. */
export async function writePixiReply(context, latest, flags, options = {}) {
  const raw = await callPixiModel({
    instructions: loadPrompt('pixi-chat-reply.md'),
    input: buildPixiReplyInput(context, latest, flags),
    name: 'pixi_reply',
    schema: PIXI_REPLY_SCHEMA,
  }, options);
  return raw === null ? null : parsePixiReply(raw);
}
