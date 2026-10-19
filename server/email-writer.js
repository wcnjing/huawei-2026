// The drill email's copy, written by OpenAI from a real scam variant (scam-variants.js).
//
// The model writes plain text only: a fictional sender name, a subject, two paragraphs
// and a button label. It never writes links or HTML; Apps Script renders the email,
// escapes every field and attaches the signed first-party reveal/report links. Every
// field is checked again here, and any failure (no key, timeout, refusal, bad output, the
// real impersonated organisation named) returns null so the caller sends a fixed
// template instead. Nothing here throws.
import OpenAI from 'openai';
import { loadPrompt, pixiModel } from './pixi-writer.js';
import { LINK_RE } from './scam-variants.js';
import { normalizeLanguage } from './language.js';

export const DEFAULT_EMAIL_WRITER_TIMEOUT_MS = 12000;
export const EMAIL_CONTENT_LIMITS = { sender: 40, subject: 100, paragraph: 400, action: 30 };

export function emailWriterConfigured(env = process.env) {
  if (String(env.EMAIL_AI || '').trim().toLowerCase() === 'off') return false;
  return Boolean(String(env.OPENAI_API_KEY || '').trim());
}

function timeoutMs(env = process.env) {
  const value = Number(env.EMAIL_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_EMAIL_WRITER_TIMEOUT_MS;
}

export const DRILL_EMAIL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['sender', 'subject', 'paragraphs', 'action'],
  properties: {
    sender: { type: 'string', description: 'Fictional organisation display name.' },
    subject: { type: 'string' },
    paragraphs: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    action: { type: 'string', description: 'Button label, two to four words.' },
  },
};

const EMAIL_ADDRESS_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /\+?\d[\d\s-]{6,}\d/;

function cleanField(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || Array.from(text).length > max) return null;
  if (/[\u0000-\u001f\u007f<>]/u.test(text) || /[\uD800-\uDFFF]/u.test(text)) return null;
  if (LINK_RE.test(text) || EMAIL_ADDRESS_RE.test(text) || PHONE_RE.test(text)) return null;
  return text;
}

/**
 * The model's JSON as { sender, subject, paragraphs: [a, b], action }, or null. Also
 * rejects any field naming the real organisation the scam impersonated.
 */
export function parseDrillEmail(raw, { impersonatedEntity = null } = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const L = EMAIL_CONTENT_LIMITS;
  const sender = cleanField(data?.sender, L.sender);
  const subject = cleanField(data?.subject, L.subject);
  const action = cleanField(data?.action, L.action);
  const paragraphs = Array.isArray(data?.paragraphs) && data.paragraphs.length === 2
    ? data.paragraphs.map((p) => cleanField(p, L.paragraph))
    : [];
  if (!sender || !subject || !action || paragraphs.length !== 2 || paragraphs.some((p) => !p)) return null;
  const content = { sender, subject, paragraphs, action };
  if (/safespace/i.test(Object.values(content).flat().join(' '))) return null;
  const real = String(impersonatedEntity || '').trim().toLowerCase();
  if (real.length >= 3 && Object.values(content).flat().join(' ').toLowerCase().includes(real)) return null;
  return content;
}

/** The model input: the variant's shape, never the user's identity. */
export function buildDrillEmailInput(lesson, language) {
  return {
    language: normalizeLanguage(language),
    scam: {
      type: lesson.scamName,
      variant: lesson.variantName,
      description: lesson.description,
      howItWorks: lesson.modusOperandi,
      impersonatedEntity: lesson.impersonatedEntity,
      requestedAction: lesson.requestedAction,
      tactics: lesson.tactics,
      redFlags: lesson.redFlags,
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
 * The drill email written from `lesson`, or null to send a fixed template. `create`
 * replaces the SDK call in tests.
 */
export async function writeDrillEmail(lesson, { language = 'en', env = process.env, create } = {}) {
  if (!lesson || (!create && !emailWriterConfigured(env))) return null;
  const model = pixiModel(env);
  const request = {
    model,
    instructions: loadPrompt('drill-email.md'),
    input: JSON.stringify(buildDrillEmailInput(lesson, language)),
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
