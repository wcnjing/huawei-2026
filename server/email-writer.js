// The drill email's copy, written by OpenAI from a real scam variant (scam-variants.js)
// and the player's pre-survey (what they practise and regularly do), in the player's app
// language. Alongside the email it writes the lesson (scam type, red flags, advice) in
// that same language, for the reveal page, the result screen and the safety follow-up.
//
// The model writes plain text only: a fictional sender name, a subject, four to six
// paragraphs (~150–250 words) and a button label. It never writes links or HTML; Apps
// Script renders the email, escapes every field and attaches the signed first-party
// reveal/report links. Every field is checked again here, and any failure (no key,
// timeout, refusal, bad output, the real impersonated organisation named) returns null so
// the caller sends a fixed template instead. Nothing here throws.
import OpenAI from 'openai';
import { loadPrompt, pixiModel } from './pixi-writer.js';
import { LINK_RE } from './scam-variants.js';
import { normalizeLanguage } from './language.js';
import { presurveyBrief } from './presurvey.js';
import { hasContact, namesRealBrand } from './content-safety.js';

export const DEFAULT_EMAIL_WRITER_TIMEOUT_MS = 20000;
export const EMAIL_CONTENT_LIMITS = {
  sender: 40,
  subject: 100,
  action: 30,
  paragraph: 600,
  minParagraphs: 4,
  maxParagraphs: 6,
  // Whole body, in characters, so it works for Chinese as well as English.
  minBody: 300,
  maxBody: 2200,
  lessonLine: 240,
  maxRedFlags: 4,
};
const LANGUAGE_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

export function emailWriterConfigured(env = process.env) {
  if (String(env.EMAIL_AI || '').trim().toLowerCase() === 'off') return false;
  return Boolean(String(env.OPENAI_API_KEY || '').trim());
}

function timeoutMs(env = process.env) {
  const value = Number(env.EMAIL_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EMAIL_WRITER_TIMEOUT_MS;
}

const L = EMAIL_CONTENT_LIMITS;
export const DRILL_EMAIL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sender', 'subject', 'paragraphs', 'action', 'lesson'],
  properties: {
    sender: { type: 'string', description: 'Fictional organisation display name.' },
    subject: { type: 'string' },
    paragraphs: { type: 'array', items: { type: 'string' }, minItems: L.minParagraphs, maxItems: L.maxParagraphs },
    action: { type: 'string', description: 'Button label, two to four words.' },
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
 * The model's JSON as { sender, subject, paragraphs, action, lesson }, or null. Also
 * rejects any field naming the real organisation the scam impersonated, or SafeSpace.
 * `lesson` (the translated red flags and advice) may be null if only it was unusable.
 */
export function parseDrillEmail(raw, { impersonatedEntity = null } = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const sender = cleanField(data?.sender, L.sender);
  const subject = cleanField(data?.subject, L.subject);
  const action = cleanField(data?.action, L.action);
  const rawParagraphs = Array.isArray(data?.paragraphs) ? data.paragraphs : [];
  if (rawParagraphs.length < L.minParagraphs || rawParagraphs.length > L.maxParagraphs) return null;
  const paragraphs = rawParagraphs.map((p) => cleanField(p, L.paragraph));
  if (!sender || !subject || !action || paragraphs.some((p) => !p)) return null;
  const bodyLength = Array.from(paragraphs.join('')).length;
  if (bodyLength < L.minBody || bodyLength > L.maxBody) return null;

  const content = { sender, subject, paragraphs, action };
  const allText = [sender, subject, action, ...paragraphs].join(' ');
  if (/safespace/i.test(allText)) return null;
  if (namesRealBrand(allText, impersonatedEntity)) return null;
  return { ...content, lesson: cleanLesson(data?.lesson) };
}

/** The model input: the variant, the player's interests and the language; never identity. */
export function buildDrillEmailInput(lesson, language, presurvey = null, now = new Date()) {
  const lang = normalizeLanguage(language);
  return {
    language: lang,
    languageName: LANGUAGE_NAMES[lang] ?? 'English',
    // Singapore date, so deadlines and order dates in the email look current.
    today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(now),
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
 * The drill email written from `lesson` for this player, or null to send a fixed
 * template. `presurvey` makes it relatable; `create` replaces the SDK call in tests.
 */
export async function writeDrillEmail(lesson, {
  language = 'en', presurvey = null, env = process.env, create,
} = {}) {
  if (!lesson || (!create && !emailWriterConfigured(env))) return null;
  const model = pixiModel(env);
  const request = {
    model,
    instructions: loadPrompt('drill-email.md'),
    input: JSON.stringify(buildDrillEmailInput(lesson, language, presurvey)),
    text: { format: { type: 'json_schema', name: 'drill_email', schema: DRILL_EMAIL_SCHEMA, strict: true } },
    ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'low' } } : {}),
  };
  try {
    const send = create ?? ((body, options) => openaiClient(env).responses.create(body, options));
    const response = await send(request, { timeout: timeoutMs(env) });
    const content = parseDrillEmail(response?.output_text ?? '', lesson);
    if (!content) console.error('[email-writer] model reply was unusable; using a template');
    return content;
  } catch (error) {
    console.error('[email-writer] call failed:', error?.name || 'error', error?.status ?? '');
    return null;
  }
}
