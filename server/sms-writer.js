// The drill text's copy, written by OpenAI from a real scam variant (scam-variants.js)
// and the player's pre-survey (what they practise and regularly do), in the player's app
// language. Alongside the text it writes the lesson (scam type, red flags, advice) in
// that same language, for the reveal page, the result screen and the safety reveal.
//
// This is the SMS twin of email-writer.js and follows the same rules. The model writes
// ONE short line of plain text and no link: sms.js appends the signed first-party reveal
// URL itself, so a model can never choose where a drill sends someone. Every field is
// checked again here, and any failure (no key, timeout, refusal, bad output, the real
// impersonated organisation named) returns null so the caller sends a curated scenario
// from sms.js instead. Nothing here throws.
import OpenAI from 'openai';
import { loadPrompt, pixiModel } from './pixi-writer.js';
import { LINK_RE } from './scam-variants.js';
import { normalizeLanguage } from './language.js';
import { presurveyBrief } from './presurvey.js';
import { hasContact, namesRealBrand } from './content-safety.js';

export const DEFAULT_SMS_WRITER_TIMEOUT_MS = 15000;
export const SMS_CONTENT_LIMITS = {
  // A signed reveal URL and the player's name are appended after this, and the whole
  // thing should still sit inside two SMS segments. Counted in characters so it works
  // for Chinese and Tamil as well as English.
  maxText: 180,
  minText: 40,
  lessonLine: 240,
  maxRedFlags: 4,
};
const LANGUAGE_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

export function smsWriterConfigured(env = process.env) {
  if (String(env.SMS_AI || '').trim().toLowerCase() === 'off') return false;
  return Boolean(String(env.OPENAI_API_KEY || '').trim());
}

function timeoutMs(env = process.env) {
  const value = Number(env.SMS_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SMS_WRITER_TIMEOUT_MS;
}

const L = SMS_CONTENT_LIMITS;
export const DRILL_SMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'lesson'],
  properties: {
    text: { type: 'string', description: 'The whole scam text, one line, no link.' },
    lesson: {
      type: 'object',
      additionalProperties: false,
      required: ['scamName', 'redFlags', 'advice'],
      properties: {
        scamName: { type: 'string' },
        redFlags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: L.maxRedFlags },
        advice: { type: 'string' },
      },
    },
  },
};

function cleanField(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || Array.from(text).length > max) return null;
  if (/[\u0000-\u001f\u007f<>]/u.test(text) || /[\uD800-\uDFFF]/u.test(text)) return null;
  if (LINK_RE.test(text) || hasContact(text)) return null;
  return text;
}

function cleanLesson(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const scamName = cleanField(raw.scamName, L.lessonLine);
  const advice = cleanField(raw.advice, L.lessonLine * 2);
  const redFlags = (Array.isArray(raw.redFlags) ? raw.redFlags : [])
    .map((flag) => cleanField(flag, L.lessonLine)).filter(Boolean).slice(0, L.maxRedFlags);
  return redFlags.length || advice ? { scamName, redFlags, advice } : null;
}

/**
 * The model's JSON as { text, lesson }, or null. Also rejects any text naming the real
 * organisation the scam impersonated, or SafeSpace. `lesson` may be null if only it was
 * unusable: a good bait text is still worth sending with the variant's own English lesson.
 */
export function parseDrillSms(raw, { impersonatedEntity = null } = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const text = cleanField(data?.text, L.maxText);
  if (!text || Array.from(text).length < L.minText) return null;
  if (/safespace/i.test(text)) return null;
  if (namesRealBrand(text, impersonatedEntity)) return null;
  return { text, lesson: cleanLesson(data?.lesson) };
}

/** The model input: the variant, the player's interests and the language; never identity. */
export function buildDrillSmsInput(lesson, language, presurvey = null, now = new Date()) {
  const lang = normalizeLanguage(language);
  return {
    language: lang,
    languageName: LANGUAGE_NAMES[lang] ?? 'English',
    // Singapore date, so deadlines and order dates in the text look current.
    today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(now),
    maxCharacters: L.maxText,
    recipient: presurveyBrief(presurvey),
    scam: {
      type: lesson.scamName,
      variant: lesson.variantName,
      description: lesson.description,
      howItWorks: lesson.modusOperandi,
      impersonatedEntity: lesson.impersonatedEntity,
      requestedAction: lesson.requestedAction,
      tactics: lesson.tactics,
      redFlags: lesson.redFlags,
      howToCheck: lesson.verificationMethod,
      advice: lesson.preventionAdvice,
    },
  };
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

/**
 * The drill text written from `lesson` for this player, or null to send a curated
 * scenario. `presurvey` makes it relatable; `create` replaces the SDK call in tests.
 */
export async function writeDrillSms(lesson, {
  language = 'en', presurvey = null, env = process.env, create,
} = {}) {
  if (!lesson || (!create && !smsWriterConfigured(env))) return null;
  const model = pixiModel(env);
  const request = {
    model,
    instructions: loadPrompt('drill-sms.md'),
    input: JSON.stringify(buildDrillSmsInput(lesson, language, presurvey)),
    text: { format: { type: 'json_schema', name: 'drill_sms', schema: DRILL_SMS_SCHEMA, strict: true } },
    ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'low' } } : {}),
  };
  try {
    const send = create ?? ((body, options) => openaiClient(env).responses.create(body, options));
    const response = await send(request, { timeout: timeoutMs(env) });
    const content = parseDrillSms(response?.output_text ?? '', lesson);
    if (!content) console.error('[sms-writer] model reply was unusable; using a scenario');
    return content;
  } catch (error) {
    console.error('[sms-writer] call failed:', error?.name || 'error', error?.status ?? '');
    return null;
  }
}
