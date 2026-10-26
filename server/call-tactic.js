// Turns a bulletin scam variant (scam-variants.js) into the parts of a call prompt that
// change per drill — the call-drill twin of intel/render.js, which does the same job for
// a scraped tactic card.
//
// The identity the caller claims NEVER comes from the variant. A variant reports a real
// scam against a real organisation; the drill must impersonate an invented one, so the
// variant only selects which of intel/render.js's fictional identities to wear.
//
// The variant's own prose (its modus operandi) is bulletin text, not ours, so it is
// treated as untrusted: collapsed to one line, capped, stripped of links and contacts,
// and dropped entirely if it names a real brand. That keeps it from adding lines to the
// system prompt or smuggling instructions into it.
import { FICTIONAL_IDENTITIES } from './intel/render.js';
import { hasContact, namesRealBrand } from './content-safety.js';
import { LINK_RE } from './scam-variants.js';

const MAX_COVER_STORY_CHARS = 240;

/** Keyword in a variant's scam name/category/entity -> which fictional identity to wear. */
export const IDENTITY_FOR_SCAM = Object.freeze({
  government: 'government_agency',
  authority: 'government_agency',
  police: 'government_agency',
  official: 'government_agency',
  tax: 'government_agency',
  bank: 'bank',
  banking: 'bank',
  loan: 'bank',
  investment: 'bank',
  credit: 'bank',
  telco: 'telco',
  telecom: 'telco',
  'phone line': 'telco',
  mobile: 'telco',
  parcel: 'delivery_company',
  delivery: 'delivery_company',
  courier: 'delivery_company',
  shipping: 'delivery_company',
  'tech support': 'tech_support',
  technical: 'tech_support',
  software: 'tech_support',
  account: 'tech_support',
  phishing: 'tech_support',
  shopping: 'online_marketplace',
  'e-commerce': 'online_marketplace',
  ecommerce: 'online_marketplace',
  marketplace: 'online_marketplace',
  seller: 'online_marketplace',
  job: 'online_marketplace',
});

const DEFAULT_IDENTITY = 'bank';

/** Which fictional identity suits this variant. Falls back rather than failing. */
export function identityKeyFor(lesson) {
  // Most specific field first: a category says who was impersonated, while a scam name
  // often describes the method ("Phishing scam" on a banking variant is a bank caller).
  // Within a field, the longest keyword wins, so "tech support" beats "support".
  const keywords = Object.keys(IDENTITY_FOR_SCAM).sort((a, b) => b.length - a.length);
  for (const field of [lesson?.scamCategory, lesson?.variantName, lesson?.scamName]) {
    if (!field) continue;
    const haystack = String(field).toLowerCase();
    const hit = keywords.find((keyword) => haystack.includes(keyword));
    if (hit) return IDENTITY_FOR_SCAM[hit];
  }
  return DEFAULT_IDENTITY;
}

/**
 * The variant's own description of how the scam runs, safe to drop into one prompt line,
 * or null when it cannot be made safe. Untrusted input: see the file header.
 */
export function coverStoryFrom(lesson) {
  const raw = [lesson?.modusOperandi, lesson?.description].find((value) => typeof value === 'string' && value.trim());
  if (!raw) return null;
  const line = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_COVER_STORY_CHARS).replace(/[\s.]+$/, '');
  if (!line || LINK_RE.test(line) || hasContact(line)) return null;
  if (/[\u0000-\u001f\u007f<>]/u.test(line)) return null;
  if (namesRealBrand(line, lesson?.impersonatedEntity)) return null;
  return line;
}

/**
 * Render one scam variant as a call persona, or null to keep the default persona.
 * The shape matches intel/render.js's renderTactic so vapi.js takes either.
 */
export function tacticFromLesson(lesson) {
  if (!lesson?.variantId) return null;
  const identity = FICTIONAL_IDENTITIES[identityKeyFor(lesson)];
  const coverStory = coverStoryFrom(lesson)
    ?? `you are calling about ${identity.topic} and need them to confirm some details`;
  const scamLabel = coverStoryFrom({ modusOperandi: lesson.scamName }) ?? 'a scam reported in Singapore';
  const roleBlock = [
    'ROLE: You are role-playing a scam caller for a CONSENTED SafeSpace safety drill.',
    `You are "${identity.caller}" from the FICTIONAL "${identity.org}". Never name a real agency, bank or company.`,
    `This drill follows a scam pattern recently reported in Singapore, "${scamLabel}".`,
    `COVER STORY: ${coverStory}.`,
    'OBJECTIVE: Using realistic pressure, get them to act on your story without checking it independently.',
    'PRESSURE: insist it has to be settled before this call ends.',
  ].join('\n');
  return {
    roleBlock,
    opener: { caller: identity.caller, org: identity.org, topic: identity.topic },
    card: {
      variantId: lesson.variantId,
      tacticName: lesson.scamName || lesson.variantName || null,
      sourceLabel: 'Singapore scam bulletin',
      sourceUrl: null,
    },
  };
}
