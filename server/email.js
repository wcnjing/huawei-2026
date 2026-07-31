// Email drills use a deliberately small, curated scenario library. No generated HTML
// reaches the mail provider: the Apps Script relay receives a scenario id plus validated
// action URLs and renders an allow-listed template itself.
//
// FAILS CLOSED:
//   * an absolute first-party origin and signed action URLs are required;
//   * a durable safety follow-up must be accepted by Apps Script before bait is sent;
//   * arbitrary subject/body/html fields are never sent to the relay.

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
export async function sendEmailOwnershipVerification({ to, name, verificationUrl }) {
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
  });
  return { ok: true };
}

/**
 * Ask Apps Script to persist a follow-up job and create a provider-side time trigger.
 * This is intentionally a separate request so sendDrillEmail can confirm scheduling
 * before it sends any bait.
 */
export async function scheduleEmailSafetyFollowup({ to, name, sendAt }) {
  const parsedSendAt = new Date(sendAt);
  if (!Number.isFinite(parsedSendAt.getTime())) {
    throw new EmailUnavailable('a valid safety follow-up sendAt time is required');
  }
  const data = await relay({
    kind: 'schedule-safety-followup',
    email: recipient(to),
    recipientName: recipientName(name),
    sendAt: parsedSendAt.toISOString(),
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
export async function sendEmailSafetyFollowup({ to, name }) {
  await relay({
    kind: 'safety-followup',
    email: recipient(to),
    recipientName: recipientName(name),
  });
  return { ok: true };
}

/**
 * Send one drill email. Both action URLs must be generated and supplied by the caller.
 * @param {{to: string, name: string, scenarioId?: string, revealUrl: string,
 *   reportUrl: string, safetyFollowupAfterMs?: number}} opts
 */
export async function sendDrillEmail({
  to,
  name,
  scenarioId,
  revealUrl,
  reportUrl,
  safetyFollowupAfterMs,
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
  const scenario = pickEmailScenario(scenarioId);
  const delay = resolveEmailFollowupDelay(safetyFollowupAfterMs);
  const safetyFollowupAt = new Date(Date.now() + delay).toISOString();

  const scheduled = await scheduleEmailSafetyFollowup({
    to: target,
    name: safeName,
    sendAt: safetyFollowupAt,
  });

  try {
    await relay({
      kind: 'drill',
      email: target,
      recipientName: safeName,
      scenarioId: scenario.id,
      revealUrl: safeRevealUrl,
      reportUrl: safeReportUrl,
    });
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
      { scenarioId: scenario.id, safetyFollowupAt, safetyJobId: scheduled.jobId },
      baitError,
    );
  }

  return {
    ok: true,
    scenarioId: scenario.id,
    safetyFollowupAt,
    safetyJobId: scheduled.jobId,
  };
}
