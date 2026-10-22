// The real-world scam behind an email drill. Each drill picks a random scam_variants row
// extracted from the police bulletins by scam-intelligence/; email-writer.js turns it into
// the drill email, and the same variant (its id is kept on the drill attempt) supplies the
// lesson afterwards: the reveal and report pages, Pixi's house-chat post and the safety
// follow-up email.
//
// FAILS OPEN: with Supabase unset, no usable variant, a slow or broken request, there is
// no variant and the drill falls back to a fixed template with no lesson. Bulletin text is
// AI-extracted, so it is treated as untrusted: trimmed, clipped, and any line with a link
// is dropped (a link is exactly what we teach people not to follow). Callers still
// escape it for their own medium.

import { pickLessonForProfile } from './presurvey.js';

// Warm reads take 0.2–0.6 s; the first after a cold start (TLS, an idle Supabase
// project waking) can take a few seconds. A drill send already waits on OpenAI, so this
// is generous; the startup warm-up below means players rarely pay it at all.
const DEFAULT_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MISS_TTL_MS = 60 * 1000;
const MAX_TEXT = 240;
const MAX_LONG_TEXT = 800;
const MAX_RED_FLAGS = 4;
const MAX_TACTICS = 3;
export const LINK_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|sg|ly|io|gov|edu|co)\b/i;

const SELECT = 'id,variant_name,description,modus_operandi,communication_channel,'
  + 'impersonated_entity,red_flags,scam_tactics,requested_action,verification_method,'
  + 'prevention_advice,scams(scam_name,scam_category)';

let cache = null;

export function scamVariantsConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function cleanText(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || LINK_RE.test(text)) return null;
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text;
}

function cleanList(value, max) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item)).filter(Boolean))].slice(0, max);
}

/** A scam_variants row (with embedded scams) as a lesson, or null if it teaches nothing. */
export function lessonFromVariant(variant) {
  if (!variant || typeof variant !== 'object' || !variant.id) return null;
  const lesson = {
    variantId: String(variant.id),
    scamName: cleanText(variant.scams?.scam_name),
    scamCategory: cleanText(variant.scams?.scam_category),
    variantName: cleanText(variant.variant_name),
    description: cleanText(variant.description, MAX_LONG_TEXT),
    modusOperandi: cleanText(variant.modus_operandi, MAX_LONG_TEXT),
    impersonatedEntity: cleanText(variant.impersonated_entity),
    redFlags: cleanList(variant.red_flags, MAX_RED_FLAGS),
    tactics: cleanList(variant.scam_tactics, MAX_TACTICS),
    requestedAction: cleanText(variant.requested_action),
    verificationMethod: cleanText(variant.verification_method),
    preventionAdvice: cleanText(variant.prevention_advice),
  };
  return lesson.redFlags.length || lesson.preventionAdvice ? lesson : null;
}

async function fetchVariants(config, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${config.url}/rest/v1/scam_variants?select=${encodeURIComponent(SELECT)}`,
      { headers: { apikey: config.key, accept: 'application/json' }, signal: controller.signal },
    );
    if (!response.ok) {
      console.error(`[scam-variants] lookup returned ${response.status}`);
      return null;
    }
    const rows = await response.json();
    return Array.isArray(rows) ? rows : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Every usable variant as a lesson, cached briefly so a drill's steps share one read. */
async function loadLessons({ env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS, now = Date.now() } = {}) {
  const config = scamVariantsConfig(env);
  if (!config) return [];
  if (cache && cache.expiresAt > now) return cache.lessons;
  let rows = null;
  try {
    rows = await fetchVariants(config, timeoutMs);
  } catch (error) {
    console.error('[scam-variants] lookup failed:', error?.name || error?.message || 'error');
  }
  const lessons = (rows ?? []).map(lessonFromVariant).filter(Boolean);
  cache = { lessons, expiresAt: now + (rows ? CACHE_TTL_MS : MISS_TTL_MS) };
  return lessons;
}

/** Every usable variant's lesson (cached), e.g. to plan a quiz round. Never throws. */
export async function getUsableLessons(options = {}) {
  return loadLessons(options);
}

/** A random variant's lesson for a new drill, or null. Never throws. */
export async function getRandomLesson({ random = Math.random, ...options } = {}) {
  const lessons = await loadLessons(options);
  return lessons.length ? lessons[Math.floor(random() * lessons.length)] : null;
}

/**
 * A variant's lesson chosen for this player's pre-survey answers (presurvey.js): mostly
 * from scam types that fit them, sometimes any. Null preferences mean random. Never throws.
 */
export async function getLessonForProfile(preferences, { random = Math.random, ...options } = {}) {
  return pickLessonForProfile(await loadLessons(options), preferences, random);
}

/** The lesson for the variant a drill was written from, or null. Never throws. */
export async function getLessonByVariantId(variantId, options = {}) {
  if (!variantId) return null;
  const lessons = await loadLessons(options);
  return lessons.find((lesson) => lesson.variantId === String(variantId)) ?? null;
}

/**
 * Loads the variants once at server start so the first drill, reveal page or Pixi post
 * finds them cached. Logs how many are usable. Never throws.
 */
export async function warmScamVariants(options = {}) {
  if (!scamVariantsConfig(options.env)) return 0;
  const lessons = await loadLessons(options);
  console.log(`[scam-variants] ${lessons.length} usable scam variants loaded`);
  return lessons.length;
}

/** Tests only. */
export function clearScamVariantCache() {
  cache = null;
}
