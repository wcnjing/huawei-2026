// AI-written questions for the individual (solo) and house drills: spot-the-scam messages
// built from real scam variants (scam-variants.js) chosen by the player's pre-survey
// (presurvey.js), with a few genuine messages mixed in so it isn't all scams.
//
// Each question is one OpenAI call (they run in parallel) returning the quiz-scenario
// shape the app already plays (src/app/types/drills.ts FamilyScenario). The answer
// buttons are added here from a fixed vocabulary ("REPORT AS SCAM", "MARK AS SAFE",
// "ASK FAMILY FIRST", which the app translates) plus two tempting wrong answers the
// model writes, so grading stays exact in every language.
//
// These messages are only shown inside the app, so they may contain links, but only to
// ".example" domains; phone numbers and real email addresses are refused. Any failure
// returns null for that question and the caller uses a fixed message instead. Nothing
// here throws.
import OpenAI from 'openai';
import { loadPrompt, pixiModel } from './pixi-writer.js';
import { normalizeLanguage } from './language.js';
import { presurveyBrief, pickLessonsForProfile } from './presurvey.js';
import { hasContact, namesRealBrand } from './content-safety.js';

export const REPORT_ACTION = 'REPORT AS SCAM';
export const SAFE_ACTION = 'MARK AS SAFE';
export const CAUTIOUS_ACTION = 'ASK FAMILY FIRST';
export const DELETE_ACTION = 'DELETE IMMEDIATELY';
export const GENERATED_ID_BASE = 9001;
const DEFAULT_TIMEOUT_MS = 25000;
const MAX_PARALLEL = 6;
const LANGUAGE_NAMES = { en: 'English', zh: 'Simplified Chinese', ms: 'Malay', ta: 'Tamil' };

export function quizWriterConfigured(env = process.env) {
  if (String(env.QUIZ_AI || '').trim().toLowerCase() === 'off') return false;
  return Boolean(String(env.OPENAI_API_KEY || '').trim());
}

function timeoutMs(env = process.env) {
  const value = Number(env.QUIZ_AI_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

const str = { type: 'string' };
export const QUIZ_SCENARIO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'sender', 'senderAddress', 'subject', 'timestamp', 'message', 'buttonLabel',
    'senderWarning', 'temptingActions', 'clues', 'explanation'],
  properties: {
    type: { type: 'string', enum: ['sms', 'email', 'notification'] },
    sender: str,
    senderAddress: str,
    subject: str,
    timestamp: str,
    message: str,
    buttonLabel: str,
    senderWarning: str,
    temptingActions: { type: 'array', items: str, minItems: 2, maxItems: 2 },
    clues: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'text', 'explanation'],
        properties: { label: str, text: str, explanation: str },
      },
    },
    explanation: str,
  },
};

// Domains and URLs are only allowed on the reserved ".example" TLD.
const DOMAIN_RE = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*)\b/gi;
function onlyExampleDomains(text) {
  for (const match of text.matchAll(DOMAIN_RE)) {
    const host = match[1].toLowerCase();
    // Ignore things like "S$1.50", "v2.0" or "No.5": a domain needs a letter TLD.
    if (!/\.[a-z]{2,}$/.test(host)) continue;
    if (!host.endsWith('.example')) return false;
  }
  return true;
}

function clean(value, max, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return allowEmpty ? '' : null;
  if (Array.from(text).length > max) return null;
  if (/[\u0000-\u001f\u007f<>]/u.test(text) || /[\uD800-\uDFFF]/u.test(text)) return null;
  if (!onlyExampleDomains(text)) return null;
  // Email addresses are only fine on .example domains (checked above).
  if (hasContact(text, { allowEmailAddresses: true })) return null;
  if (/safespace/i.test(text)) return null;
  return text;
}

const shuffle = (items, random) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/**
 * The model's JSON as an app quiz scenario (without `id`), or null. `isScam` comes from
 * the request, never the model; the answer buttons are assembled here.
 */
export function parseQuizScenario(raw, { isScam, impersonatedEntity = null, random = Math.random } = {}) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!['sms', 'email', 'notification'].includes(data?.type)) return null;
  const sender = clean(data.sender, 60);
  const senderAddress = clean(data.senderAddress, 80, { allowEmpty: true });
  const subject = clean(data.subject, 120, { allowEmpty: true });
  const timestamp = clean(data.timestamp, 20);
  const message = clean(data.message, 900);
  const buttonLabel = clean(data.buttonLabel, 30, { allowEmpty: true });
  const senderWarning = clean(data.senderWarning, 200, { allowEmpty: true });
  const explanation = clean(data.explanation, 500);
  const tempting = (Array.isArray(data.temptingActions) ? data.temptingActions : [])
    .map((a) => clean(a, 28)).filter(Boolean).map((a) => a.toUpperCase());
  const clues = (Array.isArray(data.clues) ? data.clues : []).map((clue) => ({
    label: clean(clue?.label, 40),
    text: clean(clue?.text, 160),
    explanation: clean(clue?.explanation, 240),
  })).filter((clue) => clue.label && clue.text && clue.explanation).slice(0, 4);
  if ([sender, senderAddress, subject, timestamp, message, buttonLabel, senderWarning, explanation].includes(null)) return null;
  if (tempting.length !== 2 || clues.length < 2) return null;
  if (data.type === 'email' && !subject) return null;

  const allText = [sender, senderAddress, subject, message, buttonLabel, explanation].join(' ');
  if (namesRealBrand(allText, impersonatedEntity)) return null;

  const fixed = [REPORT_ACTION, SAFE_ACTION, CAUTIOUS_ACTION, DELETE_ACTION];
  const wrong = tempting.filter((a) => !fixed.includes(a));
  const actions = isScam
    ? [REPORT_ACTION, CAUTIOUS_ACTION, ...wrong]
    : [SAFE_ACTION, REPORT_ACTION, DELETE_ACTION, CAUTIOUS_ACTION];
  if (actions.length !== 4) return null;

  const isEmail = data.type === 'email';
  return {
    targetMember: '',
    type: data.type,
    isScam,
    sender,
    ...(isEmail ? { senderEmail: senderAddress, senderDomain: senderAddress.split('@')[1] || senderAddress } : { senderDomain: senderAddress }),
    senderWarning,
    ...(subject ? { subject } : {}),
    timestamp,
    message,
    ...(buttonLabel ? { buttonLabel } : {}),
    correctAction: isScam ? REPORT_ACTION : SAFE_ACTION,
    actions: shuffle(actions, random),
    clues,
    explanation,
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

/** The model input for one question; `lesson` is null for a genuine message. */
export function buildQuizInput({ lesson, language, presurvey, now = new Date() }) {
  const lang = normalizeLanguage(language);
  return {
    kind: lesson ? 'scam' : 'genuine',
    language: lang,
    languageName: LANGUAGE_NAMES[lang] ?? 'English',
    today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(now),
    recipient: presurveyBrief(presurvey),
    ...(lesson ? {
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
    } : {}),
  };
}

/** One quiz question, or null. `lesson` null writes a genuine (safe) message. */
export async function writeQuizScenario({ lesson = null, language = 'en', presurvey = null }, { env = process.env, create, random } = {}) {
  if (!create && !quizWriterConfigured(env)) return null;
  const model = pixiModel(env);
  const request = {
    model,
    instructions: loadPrompt('quiz-scenario.md'),
    input: JSON.stringify(buildQuizInput({ lesson, language, presurvey })),
    text: { format: { type: 'json_schema', name: 'quiz_scenario', schema: QUIZ_SCENARIO_SCHEMA, strict: true } },
    ...(/^gpt-5/.test(model) ? { reasoning: { effort: 'low' } } : {}),
  };
  try {
    const send = create ?? ((body, options) => openaiClient(env).responses.create(body, options));
    const response = await send(request, { timeout: timeoutMs(env) });
    const scenario = parseQuizScenario(response?.output_text ?? '', {
      isScam: Boolean(lesson), impersonatedEntity: lesson?.impersonatedEntity, random,
    });
    if (!scenario) console.error('[quiz-writer] model reply was unusable; using a fixed message');
    return scenario;
  } catch (error) {
    console.error('[quiz-writer] call failed:', error?.name || 'error', error?.status ?? '');
    return null;
  }
}

/** How many genuine (safe) messages a round of `count` mixes in: about one in five. */
export function genuineCount(count) {
  return count >= 4 ? Math.max(1, Math.round(count * 0.2)) : 0;
}

/**
 * The questions for one player's slots: `count` specs ({ lesson, presurvey }) with the
 * right share of genuine messages, in random order. `lessons` is every usable variant.
 */
export function planQuestions(lessons, presurvey, count, random = Math.random) {
  const genuine = genuineCount(count);
  const scams = pickLessonsForProfile(lessons, presurvey, count - genuine, random);
  const specs = [
    ...scams.map((lesson) => ({ lesson, presurvey })),
    ...Array.from({ length: count - scams.length }, () => ({ lesson: null, presurvey })),
  ];
  return shuffle(specs, random);
}

/** Write every spec in parallel (bounded); returns scenarios or nulls, in order. */
export async function writeQuizRound(specs, { language = 'en', ...options } = {}) {
  const results = new Array(specs.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < specs.length) {
      const index = next;
      next += 1;
      results[index] = await writeQuizScenario({ ...specs[index], language }, options);
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL, specs.length) }, worker));
  return results;
}
