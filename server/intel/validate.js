// The gate between model-summarised scam reporting and a live voice drill.
//
// A card's text was written by a model that read attacker-authored pages, so nothing in
// it is trusted. It passes every rule below or it is dropped whole: there is no repair
// and no partial acceptance. render.js runs this check again before a card reaches a
// prompt, so a tampered store cannot route around it.
import crypto from 'crypto';

export const IMPERSONATES = [
  'government_agency',
  'bank',
  'telco',
  'delivery_company',
  'tech_support',
  'online_marketplace',
];

export const PRESSURE_LEVERS = ['authority', 'urgency', 'fear', 'reward'];

// Only asks the call classifier can score (vapi.js classifyTurns): a code, a card
// number, or a completed transfer. A link or an app install cannot happen on a voice
// call, so a drill built on one would never produce a result.
export const ASKS = ['read_otp', 'share_card_details', 'transfer_funds'];

export const LIMITS = Object.freeze({
  tacticName: 60,
  pretext: 160,
  redFlag: 80,
  minRedFlags: 1,
  maxRedFlags: 4,
});

export const CARD_FIELDS = Object.freeze([
  'tacticName',
  'impersonates',
  'pretext',
  'pressureLever',
  'theAsk',
  'redFlags',
]);

// Real organisations a Singapore scam report is likely to name. A drill may only claim
// one of the invented identities in render.js, the same rule sms.test.mjs enforces for
// SMS. Matched on word boundaries, so "purchase" is not mistaken for Chase.
export const REAL_INSTITUTIONS = Object.freeze([
  'dbs', 'posb', 'ocbc', 'uob', 'maybank', 'citibank', 'citi', 'hsbc', 'standard chartered',
  'trust bank', 'gxs', 'chase', 'paypal', 'amazon', 'apple', 'google', 'microsoft',
  'netflix', 'meta', 'facebook', 'instagram', 'whatsapp', 'telegram', 'tiktok',
  'carousell', 'shopee', 'lazada', 'qoo10', 'grab', 'gojek', 'foodpanda', 'deliveroo',
  'lalamove', 'ninja van', 'singpost', 'dhl', 'fedex', 'iras', 'cpf', 'cpfb', 'hdb', 'lta',
  'singpass', 'scamshield', 'ncpc', 'govtech', 'singapore police', 'police force',
  'monetary authority', 'immigration and checkpoints', 'singtel', 'starhub', 'simba',
  'ticketmaster', 'sistic',
]);

// Plain prose only: no colons, quotes, brackets, markup or line breaks, so nothing in a
// card can open a new prompt section or close a delimiter.
const SAFE_TEXT = /^[\p{L}\p{N} .,'’&()/%$-]+$/u;
const INSTRUCTION_SHAPED =
  /\b(?:ignore|disregard|override|instructions?|prompts?|system|assistant|jailbreak|developer|you must|you are now|new task|as an ai|safety rules?|reveal script)\b/i;
const LINK_SHAPED = /\b(?:https?|www)\b|\.(?:com|sg|net|org|gov|io|co|me|ly)\b/i;
// Phone, account and card numbers. A short amount such as $3.20 still passes.
const LONG_NUMBER = /(?:\d[\s-]?){5,}/;
const MINISTRY = /\bministry of\b/i;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REAL_INSTITUTION = new RegExp(`\\b(?:${REAL_INSTITUTIONS.map(escapeRegex).join('|')})\\b`, 'i');

export function mentionsRealInstitution(text) {
  const value = String(text ?? '');
  return REAL_INSTITUTION.test(value) || MINISTRY.test(value);
}

function checkText(field, value, max, reasons) {
  if (typeof value !== 'string') {
    reasons.push(`${field}: not text`);
    return;
  }
  const text = value.trim();
  if (text.length < 3) reasons.push(`${field}: too short`);
  if (text.length > max) reasons.push(`${field}: longer than ${max} characters`);
  if (!SAFE_TEXT.test(text)) reasons.push(`${field}: disallowed characters`);
  if (INSTRUCTION_SHAPED.test(text)) reasons.push(`${field}: instruction-shaped language`);
  if (LINK_SHAPED.test(text)) reasons.push(`${field}: contains a link or domain`);
  if (LONG_NUMBER.test(text)) reasons.push(`${field}: contains a long number`);
  if (mentionsRealInstitution(text)) reasons.push(`${field}: names a real organisation`);
}

/**
 * Check a candidate card from the summariser.
 * Returns { ok: true, card } with trimmed fields, or { ok: false, reasons }.
 */
export function validateCard(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, reasons: ['card: not an object'] };
  }
  const reasons = [];
  const unexpected = Object.keys(candidate).filter((key) => !CARD_FIELDS.includes(key));
  if (unexpected.length) reasons.push(`card: unexpected fields ${unexpected.join(', ')}`);

  checkText('tacticName', candidate.tacticName, LIMITS.tacticName, reasons);
  checkText('pretext', candidate.pretext, LIMITS.pretext, reasons);
  if (!IMPERSONATES.includes(candidate.impersonates)) reasons.push('impersonates: not an allowed value');
  if (!PRESSURE_LEVERS.includes(candidate.pressureLever)) reasons.push('pressureLever: not an allowed value');
  if (!ASKS.includes(candidate.theAsk)) reasons.push('theAsk: not an allowed value');

  const flags = candidate.redFlags;
  if (!Array.isArray(flags)) {
    reasons.push('redFlags: not a list');
  } else {
    if (flags.length < LIMITS.minRedFlags || flags.length > LIMITS.maxRedFlags) {
      reasons.push(`redFlags: needs ${LIMITS.minRedFlags} to ${LIMITS.maxRedFlags} items`);
    }
    flags.forEach((flag, index) => checkText(`redFlags[${index}]`, flag, LIMITS.redFlag, reasons));
  }

  if (reasons.length) return { ok: false, reasons };
  return {
    ok: true,
    card: {
      tacticName: candidate.tacticName.trim(),
      impersonates: candidate.impersonates,
      pretext: candidate.pretext.trim(),
      pressureLever: candidate.pressureLever,
      theAsk: candidate.theAsk,
      redFlags: flags.map((flag) => flag.trim()),
    },
  };
}

/** Stable id, so re-reporting the same tactic refreshes its card instead of duplicating it. */
export function cardId(card) {
  const key = [card.impersonates, card.theAsk, card.pressureLever, card.tacticName.toLowerCase()].join('|');
  return `tactic_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
}

/**
 * Re-check a card read back from the store, provenance included. Runs immediately before
 * rendering, so having been stored earns a card nothing.
 */
export function validateStoredCard(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return { ok: false, reasons: ['card: not an object'] };
  }
  const checked = validateCard(Object.fromEntries(CARD_FIELDS.map((field) => [field, stored[field]])));
  if (!checked.ok) return checked;

  const reasons = [];
  if (stored.id !== cardId(checked.card)) reasons.push('id: does not match card contents');
  let url = null;
  try {
    url = new URL(stored.sourceUrl);
  } catch {
    // Reported below.
  }
  if (url?.protocol !== 'https:') reasons.push('sourceUrl: not an https URL');
  if (!Number.isFinite(Date.parse(stored.fetchedAt))) reasons.push('fetchedAt: not a timestamp');
  if (typeof stored.sourceLabel !== 'string' || !stored.sourceLabel.trim() || stored.sourceLabel.length > 80) {
    reasons.push('sourceLabel: malformed');
  }
  if (reasons.length) return { ok: false, reasons };

  return {
    ok: true,
    card: {
      ...checked.card,
      id: stored.id,
      sourceId: String(stored.sourceId || ''),
      sourceLabel: stored.sourceLabel,
      sourceUrl: url.toString(),
      fetchedAt: stored.fetchedAt,
    },
  };
}
