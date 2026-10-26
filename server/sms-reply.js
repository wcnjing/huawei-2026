// What happens when someone texts back during an SMS drill.
//
// The drill answers in character for a few turns, the way the voice drill does, because
// the pressure a scammer applies after the first hesitation is where the practice is.
// Three rules make that safe, and they are all enforced here rather than in a prompt:
//
//   1. A deterministic read of the inbound text comes FIRST. Distress, a shared code or
//      card number, and a clear refusal all end the drill immediately, before any model
//      is called. A person asking "is this real?" must never get another scam text.
//   2. The exchange is capped (MAX_SMS_TURNS). Running out of turns ends it as a win.
//   3. Anything that is not a clean, in-character reply reveals instead. A model failure,
//      a timeout, a refusal, a link, a real brand — all of them fall through to the
//      reveal. Leaving someone mid-scam with silence is the one unacceptable outcome.
//
// The scheduled reveal from sms.js remains the backstop underneath all of this.
import OpenAI from 'openai';
import { loadPrompt, pixiModel } from './pixi-writer.js';
import { LINK_RE } from './scam-variants.js';
import { hasContact, namesRealBrand } from './content-safety.js';

export const MAX_SMS_TURNS = 4;
export const MAX_REPLY_CHARS = 200;
export const DEFAULT_SMS_REPLY_TIMEOUT_MS = 10000;

// Someone asking for help, or asking whether this is real, is never scored and never
// pushed again. Matches the voice drill's distress off-ramp. Four languages, because a
// person under pressure falls back to their first one.
const DISTRESS_RE = [
  /\b(is|are)\s+(this|that|you)\s+(a\s+)?(scam|real|fake|genuine|legit)/i,
  /\bis\s+this\s+safespace\b/i,
  /\b(help|scared|frightened|worried|anxious|panic)\b/i,
  /\bstop\s+(please|it|this)\b/i,
  /\bplease\s+stop\b/i,
  /\bwhat('?s| is)\s+going\s+on\b/i,
  /这是(真的|真|骗局|诈骗)/,
  /救命|好怕|害怕/,
  /\b(tolong|takut|penipuan ke)\b/i,
  /உதவி|பயமா/,
];

// A code or card number actually handed over. Deliberately narrow: discussing an OTP
// ("I would never share my OTP") is not sharing one, exactly as the call drill rules say.
const SHARED_DATA_RE = [
  /(?:^|\b)(?:otp|code|pin|password)\D{0,15}\d{4,8}\b/i,
  /\b\d{4,8}\s*(?:is|was)?\s*(?:the|my)\s*(?:otp|code|pin)\b/i,
  /\b(?:\d[ -]?){13,19}\b/, // a card number
];

const REPORTED_RE = [
  /\b(this|it)\s+is\s+a\s+scam\b/i,
  /\b(report(ed|ing)?|scamshield|police)\b/i,
];

const DISENGAGED_RE = [
  /^\s*(no|nope|no thanks|not interested|go away|leave me alone|stop)\s*[.!]?\s*$/i,
  /\bi('m| am)\s+not\s+(doing|giving|sharing)\b/i,
  /\bblock(ing|ed)?\s+(you|this)\b/i,
];

function matches(patterns, text) {
  return patterns.some((re) => re.test(text));
}

/**
 * The deterministic read of what the person just sent. Returns an outcome and whether
 * the drill ends now, or { outcome: null, reveal: false } to keep going. Never calls a
 * model: these are the cases where waiting on one would be wrong.
 */
export function classifyTargetReply(inbound) {
  const text = String(inbound || '').trim();
  if (!text) return { outcome: null, reveal: false };
  // Distress is checked first and wins over everything, including a shared code.
  if (matches(DISTRESS_RE, text)) return { outcome: 'distress_offramp', reveal: true };
  if (matches(SHARED_DATA_RE, text)) return { outcome: 'shared_data', reveal: true };
  if (matches(REPORTED_RE, text)) return { outcome: 'reported', reveal: true };
  if (matches(DISENGAGED_RE, text)) return { outcome: 'disengaged', reveal: true };
  return { outcome: null, reveal: false };
}

export const SCAMMER_REPLY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text'],
  properties: {
    text: { type: 'string', description: 'The next scam text, one line, no link.' },
  },
};

/** The model's JSON as { text }, or null to reveal instead. Same checks as sms-writer. */
export function parseScammerReply(raw, { impersonatedEntity = null } = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const value = typeof data?.text === 'string' ? data.text.replace(/\s+/g, ' ').trim() : '';
  if (!value || Array.from(value).length > MAX_REPLY_CHARS) return null;
  if (/[\u0000-\u001f\u007f<>]/u.test(value) || /[\uD800-\uDFFF]/u.test(value)) return null;
  if (LINK_RE.test(value) || hasContact(value)) return null;
  if (/safespace/i.test(value)) return null;
  if (namesRealBrand(value, impersonatedEntity)) return null;
  return { text: value };
}

function timeoutMs(env = process.env) {
  const value = Number(env.SMS_REPLY_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SMS_REPLY_TIMEOUT_MS;
}

let client = null;
let clientKey = null;
function openaiClient(env) {
  const key = String(env.OPENAI_API_KEY || '').trim();
  if (!client || clientKey !== key) {
    client = new OpenAI({ apiKey: key, maxRetries: 0 });
    clientKey = key;
  }
  return client;
}

/** How many times the drill has already answered. The cap counts the drill's turns. */
export function scammerTurnsUsed(history = []) {
  return history.filter((turn) => turn?.role === 'scammer').length;
}

/**
 * The drill's next move: either an in-character reply, or the reveal and an outcome.
 *
 * @returns {Promise<{text: string|null, reveal: boolean, outcome: string|null}>}
 *   `text` is the scam text to send and is null whenever `reveal` is true.
 */
export async function nextSmsTurn({
  inbound, history = [], lesson = null, language = 'en', env = process.env, create,
} = {}) {
  const verdict = classifyTargetReply(inbound);
  if (verdict.reveal) return { text: null, reveal: true, outcome: verdict.outcome };
  // Out of turns is a win: they engaged without being caught out.
  if (scammerTurnsUsed(history) >= MAX_SMS_TURNS) {
    return { text: null, reveal: true, outcome: 'disengaged' };
  }
  if (!create && !String(env.OPENAI_API_KEY || '').trim()) {
    return { text: null, reveal: true, outcome: 'disengaged' };
  }

  const model = pixiModel(env);
  const request = {
    model,
    instructions: loadPrompt('drill-sms-reply.md'),
    input: JSON.stringify({
      language,
      scam: lesson && {
        type: lesson.scamName,
        howItWorks: lesson.modusOperandi,
        requestedAction: lesson.requestedAction,
        tactics: lesson.tactics,
      },
      conversation: history.map((turn) => ({ from: turn.role, text: turn.text })),
      latestReply: String(inbound || ''),
      maxCharacters: MAX_REPLY_CHARS,
    }),
    text: { format: { type: 'json_schema', name: 'scammer_reply', schema: SCAMMER_REPLY_SCHEMA, strict: true } },
    ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'low' } } : {}),
  };
  try {
    const send = create ?? ((body, options) => openaiClient(env).responses.create(body, options));
    const response = await send(request, { timeout: timeoutMs(env) });
    const reply = parseScammerReply(response?.output_text ?? '', lesson ?? {});
    if (!reply) {
      console.error('[sms-reply] model reply was unusable; revealing instead');
      return { text: null, reveal: true, outcome: 'disengaged' };
    }
    return { text: reply.text, reveal: false, outcome: null };
  } catch (error) {
    console.error('[sms-reply] call failed:', error?.name || 'error', error?.status ?? '');
    return { text: null, reveal: true, outcome: 'disengaged' };
  }
}
