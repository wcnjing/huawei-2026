// SMS drill: schedules a durable safety reveal, then sends a realistic scam text.
//
// Deliberately NOT LLM-generated. The opening text of a scam SMS is short and formulaic,
// so a curated scenario library is more reliable, costs nothing, needs no extra API key,
// and — unlike a model — cannot accidentally invent a real bank's name. The adaptive part
// (replies) is where a model earns its place; see the reply loop (not built yet).
//
// FAILS CLOSED - unconfigured means nothing is sent.

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';
export const TWILIO_MIN_SCHEDULE_MS = 15 * 60 * 1000;
export const TWILIO_MAX_SCHEDULE_MS = 35 * 24 * 60 * 60 * 1000;
// Keep a little distance from Twilio's exact 15-minute scheduling boundary.
export const DEFAULT_REVEAL_DELAY_MS = 16 * 60 * 1000;

export class SmsUnavailable extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'SmsUnavailable';
    this.code = 'SMS_UNAVAILABLE';
  }
}

export class SmsDeliveryUnconfirmed extends Error {
  constructor(message, details = {}, cause = null) {
    super(message);
    this.name = 'SmsDeliveryUnconfirmed';
    this.code = 'SMS_DELIVERY_UNCONFIRMED';
    this.details = details;
    this.cause = cause;
  }
}

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
      && process.env.TWILIO_AUTH_TOKEN
      && process.env.TWILIO_MESSAGING_SERVICE_SID
      && validRevealDelay(process.env.SMS_REVEAL_DELAY_MS),
  );
}

// Every institution here is FICTIONAL. Impersonating a real bank or agency in a
// simulated phishing message is a legal and reputational problem, and it is the rule
// used by the voice persona too. sms.test.mjs enforces this.
export const SCENARIOS = [
  {
    id: 'parcel',
    text: 'ParcelLink: Your delivery SG7741 is on hold - unpaid customs fee of $3.20. Settle within 12h or the item is returned: https://parcellink.example/pay',
    redFlags: ['unexpected fee', 'artificial deadline', 'lookalike domain'],
  },
  {
    id: 'bank',
    text: 'Meridian Bank ALERT: A transfer of $1,480.00 to a new payee was authorised. If this was not you, cancel immediately: https://meridian.example/stop',
    redFlags: ['alarming amount', 'urgency to click', 'domain is not the bank'],
  },
  {
    id: 'govt',
    text: 'Office of Public Trust: You have an unpaid infringement notice. Failure to respond in 24h will escalate to enforcement. Ref OPT-88421: https://opt.example/settle',
    redFlags: ['threat of escalation', 'official-sounding reference', 'unfamiliar domain'],
  },
  {
    id: 'prize',
    text: 'Congratulations! Your number was drawn in the SkyRewards quarterly giveaway. Claim your $500 credit within 48h: https://skyrewards.example/winner',
    redFlags: ['prize you never entered', 'deadline pressure', 'too good to be true'],
  },
  {
    id: 'account',
    text: 'NOTICE: Your CloudMail account will be suspended today due to a failed security check. Re-verify now to avoid losing access: https://cloudmail.example/verify',
    redFlags: ['account suspension threat', 'same-day deadline', 'credential harvesting link'],
  },
];

// Sent after the scam text so a drill ALWAYS reveals itself, even if the person never
// replies. Non-negotiable safeguard - an unrevealed simulated scam is just a scam.
export const REVEAL_TEXT =
  'This was a SafeSpace drill - that last message was fake and you are safe. Nothing is wrong with any account. Open SafeSpace to see what gave it away.';

function basicAuth() {
  return (
    'Basic ' +
    Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  );
}

async function twilioSend({ to, body, sendAt }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const params = new URLSearchParams({
    To: to,
    MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    Body: body,
  });
  if (sendAt) {
    params.set('ScheduleType', 'fixed');
    params.set('SendAt', sendAt);
  }
  const res = await fetch(`${TWILIO_API}/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(`Twilio SMS ${res.status}: ${JSON.stringify(data)}`);
    error.code = 'SMS_PROVIDER_REJECTED';
    throw error;
  }
  return data;
}

async function twilioCancel(messageSid) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(
    `${TWILIO_API}/${accountSid}/Messages/${encodeURIComponent(messageSid)}.json`,
    {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ Status: 'canceled' }),
    },
  );
  const data = await res.json();
  if (!res.ok || data?.status !== 'canceled') {
    throw new Error(`Twilio SMS cancellation ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function validRevealDelay(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  const delay = Number(raw);
  return Number.isFinite(delay)
    && delay >= TWILIO_MIN_SCHEDULE_MS
    && delay <= TWILIO_MAX_SCHEDULE_MS;
}

export function resolveRevealDelay(revealAfterMs) {
  const raw = revealAfterMs ?? process.env.SMS_REVEAL_DELAY_MS ?? DEFAULT_REVEAL_DELAY_MS;
  if (!validRevealDelay(raw)) {
    throw new SmsUnavailable(
      `SMS reveal delay must be between ${TWILIO_MIN_SCHEDULE_MS} and ${TWILIO_MAX_SCHEDULE_MS} ms`,
    );
  }
  return Number(raw);
}

function configuredActionOrigin() {
  const raw = process.env.PUBLIC_URL || process.env.EMAIL_ACTION_ORIGIN || '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function looksLikeSignedToken(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16,}$/.test(value);
}

export function validateSmsRevealUrl(value) {
  if (!value) return null;
  const expectedOrigin = configuredActionOrigin();
  try {
    const parsed = new URL(String(value));
    if (
      !expectedOrigin
      || parsed.protocol !== 'https:'
      || parsed.origin !== expectedOrigin
      || parsed.pathname !== '/drill-reveal'
      || parsed.username
      || parsed.password
      || parsed.hash
      || !looksLikeSignedToken(parsed.searchParams.get('token') || '')
    ) {
      throw new Error('invalid');
    }
    return parsed.toString();
  } catch {
    throw new SmsUnavailable(
      'revealUrl must be an absolute, signed first-party HTTPS URL matching PUBLIC_URL',
    );
  }
}

export function scenarioText(scenario, revealUrl) {
  const safeRevealUrl = validateSmsRevealUrl(revealUrl);
  if (!safeRevealUrl) return scenario.text;
  return scenario.text.replace(/https:\/\/[a-z0-9.-]+\.example\/\S+$/i, safeRevealUrl);
}

export function pickScenario(id) {
  if (id) return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

export function personalizeSmsText(text, name) {
  const targetName = String(name || '').trim();
  return targetName ? `${targetName}, ${text}` : text;
}

/**
 * Schedule the safety reveal with Twilio, then send one SMS drill. Scheduling first is
 * deliberate: if Twilio cannot durably accept the reveal, the bait is never sent.
 *
 * Twilio fixed scheduling requires a Messaging Service and accepts SendAt values from
 * 15 minutes to 35 days in the future. A signed first-party revealUrl can provide an
 * immediate safe exit while the scheduled plain-text reveal remains the fallback.
 *
 * @param {{to: string, name?: string, scenarioId?: string, revealAfterMs?: number,
 *   revealUrl?: string}} opts
 */
export async function sendDrillSms({ to, name, scenarioId, revealAfterMs, revealUrl }) {
  if (!smsConfigured()) {
    throw new SmsUnavailable(
      'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID must be set; '
      + 'SMS_REVEAL_DELAY_MS, when set, must be between 15 minutes and 35 days',
    );
  }
  const scenario = pickScenario(scenarioId);
  // Validate and render every caller-controlled value before creating a durable job.
  const bait = scenarioText(scenario, revealUrl);
  const delay = resolveRevealDelay(revealAfterMs);
  const revealAt = new Date(Date.now() + delay).toISOString();
  const scheduled = await twilioSend({ to, body: REVEAL_TEXT, sendAt: revealAt });
  if (!scheduled?.sid || scheduled.status !== 'scheduled') {
    throw new SmsUnavailable('Twilio did not confirm the safety reveal as scheduled; bait was not sent');
  }

  let sent;
  try {
    sent = await twilioSend({ to, body: personalizeSmsText(bait, name) });
  } catch (baitError) {
    if (baitError?.code === 'SMS_PROVIDER_REJECTED') {
      // Twilio explicitly rejected the bait, so it is safe to remove the otherwise
      // confusing standalone reveal. Network/response ambiguity follows the branch
      // below and always keeps the reveal.
      try {
        await twilioCancel(scheduled.sid);
      } catch (cancelError) {
        console.error('[sms] rejected bait reveal cancellation failed:', cancelError);
      }
      throw baitError;
    }
    // A network failure can happen after Twilio accepted the bait. Never cancel the
    // already-scheduled reveal on an ambiguous response: an extra reassurance is safer
    // than a delivered simulated scam that is never revealed.
    throw new SmsDeliveryUnconfirmed(
      'SMS delivery could not be confirmed; safety reveal remains scheduled',
      {
        scenarioId: scenario.id,
        revealSid: scheduled.sid,
        revealAt,
        revealInMs: delay,
      },
      baitError,
    );
  }
  return {
    sid: sent.sid,
    revealSid: scheduled.sid,
    scenarioId: scenario.id,
    revealAt,
    revealInMs: delay,
  };
}
