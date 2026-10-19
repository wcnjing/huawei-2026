// Email drills are written by email-writer.js from a real scam variant, or fall back to a
// small, curated scenario library. No generated HTML or link reaches the mail provider:
// the Apps Script relay receives plain-text copy (or a template id) plus validated action
// URLs, escapes everything and renders the email itself.
//
// FAILS CLOSED:
//   * an absolute first-party origin and signed action URLs are required;
//   * a durable safety follow-up must be accepted by Apps Script before bait is sent;
//   * HTML and links are never sent to the relay. Dynamic copy is plain text only: the
//     generated drill copy (checked by email-writer.js) and the safety follow-up's
//     lesson (cleaned by scam-variants.js); Apps Script re-validates and escapes both.

import { normalizeLanguage } from './language.js';

export class EmailUnavailable extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'EmailUnavailable';
    this.code = 'EMAIL_UNAVAILABLE';
  }
}

export class EmailLinkInvalid extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'EmailLinkInvalid';
    this.code = 'EMAIL_LINK_INVALID';
  }
}

export class EmailDeliveryUnconfirmed extends Error {
  constructor(message, details = {}, cause = null) {
    super(message);
    this.name = 'EmailDeliveryUnconfirmed';
    this.code = 'EMAIL_DELIVERY_UNCONFIRMED';
    this.details = details;
    this.cause = cause;
  }
}

export const DEFAULT_EMAIL_SAFETY_FOLLOWUP_MS = 10 * 60 * 1000;
export const MIN_EMAIL_SAFETY_FOLLOWUP_MS = 60 * 1000;
export const MAX_EMAIL_SAFETY_FOLLOWUP_MS = 24 * 60 * 60 * 1000;

// These ids are also allow-listed in apps-script/Code.gs, where the final escaped HTML
// is rendered. All organisations are fictional.
export const EMAIL_SCENARIOS = [
  { id: 'bank', sender: 'Meridian Bank', subject: 'Security alert: review required' },
  { id: 'parcel', sender: 'ParcelLink', subject: 'Delivery fee still outstanding' },
  { id: 'password', sender: 'CloudMail', subject: 'Password reset confirmation needed' },
  { id: 'govt', sender: 'Office of Public Trust', subject: 'Notice requires your response' },
  { id: 'scholarship', sender: 'Northstar Scholars', subject: 'Your scholarship selection' },
  { id: 'job', sender: 'WorkHarbor', subject: 'Remote role: onboarding required' },
  { id: 'refund', sender: 'NovaCart', subject: 'Refund could not be processed' },
  { id: 'account', sender: 'CloudMail', subject: 'Account suspension warning' },
];

// The scenario id for copy written by email-writer.js; Code.gs renders `content` for it.
export const GENERATED_SCENARIO_ID = 'generated';

function relayConfigured() {
  return Boolean(process.env.GOOGLE_SCRIPT_URL && process.env.GOOGLE_SCRIPT_SECRET);
}

function configuredActionOrigin() {
  const raw = process.env.PUBLIC_URL || process.env.EMAIL_ACTION_ORIGIN || '';
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== 'https:'
      || parsed.username
      || parsed.password
      || (parsed.pathname !== '/' && parsed.pathname !== '')
      || parsed.search
      || parsed.hash
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function emailVerificationConfigured() {
  return relayConfigured() && Boolean(configuredActionOrigin());
}

export function emailConfigured() {
  return emailVerificationConfigured() && validFollowupDelay(
    process.env.EMAIL_SAFETY_FOLLOWUP_DELAY_MS,
  );
}

function validFollowupDelay(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  const delay = Number(raw);
  return Number.isFinite(delay)
    && delay >= MIN_EMAIL_SAFETY_FOLLOWUP_MS
    && delay <= MAX_EMAIL_SAFETY_FOLLOWUP_MS;
}

export function resolveEmailFollowupDelay(value) {
  const raw = value
    ?? process.env.EMAIL_SAFETY_FOLLOWUP_DELAY_MS
    ?? DEFAULT_EMAIL_SAFETY_FOLLOWUP_MS;
  if (!validFollowupDelay(raw)) {
    throw new EmailUnavailable(
      `email safety follow-up delay must be between ${MIN_EMAIL_SAFETY_FOLLOWUP_MS} `
      + `and ${MAX_EMAIL_SAFETY_FOLLOWUP_MS} ms`,
    );
  }
  return Number(raw);
}

function signedTokenShape(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16,}$/.test(value);
}

/**
 * Validate—not generate—a link supplied by the caller. Signature verification remains
 * the destination route's responsibility; here we enforce HTTPS, the configured
 * first-party origin, the expected action path, and the signed-token wire format.
 */
export function validateEmailActionUrl(value, expectedPath) {
  const origin = configuredActionOrigin();
  try {
    const parsed = new URL(String(value || ''));
    if (
      !origin
      || parsed.protocol !== 'https:'
      || parsed.origin !== origin
      || parsed.pathname !== expectedPath
      || parsed.username
      || parsed.password
      || parsed.hash
      || !signedTokenShape(parsed.searchParams.get('token') || '')
    ) {
      throw new Error('invalid');
    }
    return parsed.toString();
  } catch {
    throw new EmailLinkInvalid(
      `${expectedPath} URL must be an absolute, signed first-party HTTPS URL matching `
      + 'PUBLIC_URL (or EMAIL_ACTION_ORIGIN)',
    );
  }
}

export function pickEmailScenario(id) {
  if (id) return EMAIL_SCENARIOS.find((scenario) => scenario.id === id) || EMAIL_SCENARIOS[0];
  return EMAIL_SCENARIOS[Math.floor(Math.random() * EMAIL_SCENARIOS.length)];
}

function recipient(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new EmailUnavailable('a valid recipient email is required');
  }
  return email;
}

function recipientName(value) {
  return String(value || '').trim().slice(0, 80);
}

async function relay(payload) {
  if (!relayConfigured()) {
    throw new EmailUnavailable('GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET must be set');
  }
  const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.GOOGLE_SCRIPT_SECRET, ...payload }),
  });
  let data;
  try {
    data = await response.json();
  } catch (cause) {
    const error = new Error('mail sender returned an unreadable response');
    error.code = response.ok ? 'EMAIL_DELIVERY_AMBIGUOUS' : 'EMAIL_PROVIDER_REJECTED';
    error.cause = cause;
    throw error;
  }
  if (!response.ok || data?.success !== true) {
    const error = new Error('Mail sender failed: ' + JSON.stringify(data));
    error.code = 'EMAIL_PROVIDER_REJECTED';
    throw error;
  }
  return data;
}

/**
 * Sends the ownership challenge only. The caller must persist pending state and verify
 * the token when /email-verify is opened.
 */
export async function sendEmailOwnershipVerification({ to, name, verificationUrl, language }) {
  if (!emailVerificationConfigured()) {
    throw new EmailUnavailable(
      'GOOGLE_SCRIPT_URL, GOOGLE_SCRIPT_SECRET and HTTPS PUBLIC_URL '
      + '(or EMAIL_ACTION_ORIGIN) must be configured',
    );
  }
  const safeUrl = validateEmailActionUrl(verificationUrl, '/email-verify');
  await relay({
    kind: 'email-verification',
    email: recipient(to),
    recipientName: recipientName(name),
    verificationUrl: safeUrl,
    language: normalizeLanguage(language),
  });
  return { ok: true };
}

const LESSON_MAX_FLAGS = 4;
const LESSON_MAX_CHARS = 240;

/** The follow-up's slice of a scam-variants.js lesson, or null. Plain text only. */
export function followupLesson(lesson) {
  if (!lesson || typeof lesson !== 'object') return null;
  const text = (value) => (typeof value === 'string' && value.trim()
    ? Array.from(value.trim()).slice(0, LESSON_MAX_CHARS).join('')
    : null);
  const redFlags = (Array.isArray(lesson.redFlags) ? lesson.redFlags : [])
    .map(text).filter(Boolean).slice(0, LESSON_MAX_FLAGS);
  const scamName = text(lesson.scamName);
  const advice = text(lesson.preventionAdvice);
  return redFlags.length || advice ? { scamName, redFlags, advice } : null;
}

/**
 * Ask Apps Script to persist a follow-up job and create a provider-side time trigger.
 * This is intentionally a separate request so sendDrillEmail can confirm scheduling
 * before it sends any bait.
 */
export async function scheduleEmailSafetyFollowup({ to, name, sendAt, language, lesson = null }) {
  const parsedSendAt = new Date(sendAt);
  if (!Number.isFinite(parsedSendAt.getTime())) {
    throw new EmailUnavailable('a valid safety follow-up sendAt time is required');
  }
  const data = await relay({
    kind: 'schedule-safety-followup',
    email: recipient(to),
    recipientName: recipientName(name),
    sendAt: parsedSendAt.toISOString(),
    language: normalizeLanguage(language),
    ...(followupLesson(lesson) ? { lesson: followupLesson(lesson) } : {}),
  });
  if (data?.scheduled !== true || !data?.jobId) {
    throw new EmailUnavailable('mail relay did not confirm the safety follow-up schedule');
  }
  return { jobId: String(data.jobId), sendAt: parsedSendAt.toISOString() };
}

export async function cancelEmailSafetyFollowup(jobId) {
  if (!jobId) return { canceled: false };
  const data = await relay({ kind: 'cancel-safety-followup', jobId: String(jobId) });
  return { canceled: data?.canceled === true };
}

/** Sends an immediate, unambiguous manual safety follow-up. */
export async function sendEmailSafetyFollowup({ to, name, language }) {
  await relay({
    kind: 'safety-followup',
    email: recipient(to),
    recipientName: recipientName(name),
    language: normalizeLanguage(language),
  });
  return { ok: true };
}

/**
 * Send one drill email. Both action URLs must be generated and supplied by the caller.
 * `content` is generated copy from email-writer.js ({ sender, subject, paragraphs,
 * action }); without it the template `scenarioId` is sent. `lesson` is the real scam
 * variant from scam-variants.js, or null; it goes into the safety follow-up.
 * @param {{to: string, name: string, scenarioId?: string, revealUrl: string,
 *   reportUrl: string, safetyFollowupAfterMs?: number, language?: string,
 *   content?: object|null, lesson?: object|null}} opts
 */
export async function sendDrillEmail({
  to,
  name,
  scenarioId,
  revealUrl,
  reportUrl,
  safetyFollowupAfterMs,
  language,
  content = null,
  lesson = null,
}) {
  if (!emailConfigured()) {
    throw new EmailUnavailable(
      'GOOGLE_SCRIPT_URL, GOOGLE_SCRIPT_SECRET and HTTPS PUBLIC_URL '
      + '(or EMAIL_ACTION_ORIGIN) must be configured; EMAIL_SAFETY_FOLLOWUP_DELAY_MS '
      + 'must be between 1 minute and 24 hours when set',
    );
  }

  const target = recipient(to);
  const safeName = recipientName(name);
  const safeRevealUrl = validateEmailActionUrl(revealUrl, '/drill-reveal');
  const safeReportUrl = validateEmailActionUrl(reportUrl, '/drill-report');
  if (safeRevealUrl === safeReportUrl) {
    throw new EmailLinkInvalid('revealUrl and reportUrl must be different signed action URLs');
  }
  const scenario = content
    ? { id: GENERATED_SCENARIO_ID, sender: content.sender, subject: content.subject }
    : pickEmailScenario(scenarioId);
  const publicScenario = { id: scenario.id, sender: scenario.sender, subject: scenario.subject };
  const delay = resolveEmailFollowupDelay(safetyFollowupAfterMs);
  const safetyFollowupAt = new Date(Date.now() + delay).toISOString();
  const lang = normalizeLanguage(language);

  const scheduled = await scheduleEmailSafetyFollowup({
    to: target,
    name: safeName,
    sendAt: safetyFollowupAt,
    language: lang,
    lesson,
  });

  try {
    const delivery = await relay({
      kind: 'drill',
      email: target,
      recipientName: safeName,
      scenarioId: scenario.id,
      ...(content ? {
        content: {
          sender: content.sender,
          subject: content.subject,
          paragraphs: content.paragraphs,
          action: content.action,
        },
      } : {}),
      revealUrl: safeRevealUrl,
      reportUrl: safeReportUrl,
      language: lang,
    });
    if (typeof delivery?.sender === 'string') publicScenario.sender = delivery.sender;
    if (typeof delivery?.subject === 'string') publicScenario.subject = delivery.subject;
  } catch (baitError) {
    if (baitError?.code === 'EMAIL_PROVIDER_REJECTED') {
      // A structured provider rejection confirms that no bait was accepted, so the
      // standalone follow-up can be removed without risking an unrevealed drill.
      try {
        await cancelEmailSafetyFollowup(scheduled.jobId);
      } catch (cancelError) {
        console.error('[email] rejected bait follow-up cancellation failed:', cancelError);
      }
      throw baitError;
    }
    // A timeout or lost response does not prove the provider rejected the bait. Keep
    // the durable follow-up: canceling it could leave an accepted bait email
    // unrevealed. The caller treats this as delivery-unknown, not as a safe retry.
    throw new EmailDeliveryUnconfirmed(
      'email delivery could not be confirmed; safety follow-up remains scheduled',
      { scenarioId: scenario.id, scenario: publicScenario, safetyFollowupAt, safetyJobId: scheduled.jobId },
      baitError,
    );
  }

  return {
    ok: true,
    scenarioId: scenario.id,
    scenario: publicScenario,
    safetyFollowupAt,
    safetyJobId: scheduled.jobId,
  };
}
