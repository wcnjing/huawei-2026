// SMS drill: sends a realistic scam text, then a guaranteed reveal.
//
// Deliberately NOT LLM-generated. The opening text of a scam SMS is short and formulaic,
// so a curated scenario library is more reliable, costs nothing, needs no extra API key,
// and — unlike a model — cannot accidentally invent a real bank's name. The adaptive part
// (replies) is where a model earns its place; see the reply loop (not built yet).
//
// FAILS CLOSED - unconfigured means nothing is sent.

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';

export class SmsUnavailable extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'SmsUnavailable';
    this.code = 'SMS_UNAVAILABLE';
  }
}

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM,
  );
}

// Every institution here is FICTIONAL. Impersonating a real bank or agency in a
// simulated phishing message is a legal and reputational problem, and it is the rule
// used by the voice persona too. sms.test.mjs enforces this.
export const SCENARIOS = [
  {
    id: 'parcel',
    text: 'ParcelLink: Your delivery SG7741 is on hold - unpaid customs fee of $3.20. Settle within 12h or the item is returned: parcellink-redelivery.info/pay',
    redFlags: ['unexpected fee', 'artificial deadline', 'lookalike domain'],
  },
  {
    id: 'bank',
    text: 'Meridian Bank ALERT: A transfer of $1,480.00 to a new payee was authorised. If this was not you, cancel immediately: meridian-secure-verify.net/stop',
    redFlags: ['alarming amount', 'urgency to click', 'domain is not the bank'],
  },
  {
    id: 'govt',
    text: 'Office of Public Trust: You have an unpaid infringement notice. Failure to respond in 24h will escalate to enforcement. Ref OPT-88421: opt-notices.co/settle',
    redFlags: ['threat of escalation', 'official-sounding reference', 'unfamiliar domain'],
  },
  {
    id: 'prize',
    text: 'Congratulations! Your number was drawn in the SkyRewards quarterly giveaway. Claim your $500 credit within 48h: skyrewards-claim.link/winner',
    redFlags: ['prize you never entered', 'deadline pressure', 'too good to be true'],
  },
  {
    id: 'account',
    text: 'NOTICE: Your CloudMail account will be suspended today due to a failed security check. Re-verify now to avoid losing access: cloudmail-idcheck.net/verify',
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

async function twilioSend({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(`${TWILIO_API}/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_SMS_FROM, Body: body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio SMS ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

export function pickScenario(id) {
  if (id) return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

/**
 * Send one SMS drill, then schedule the reveal.
 * @param {{to: string, scenarioId?: string, revealAfterMs?: number}} opts
 */
export async function sendDrillSms({ to, scenarioId, revealAfterMs }) {
  if (!smsConfigured()) {
    throw new SmsUnavailable('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_SMS_FROM must be set');
  }
  const scenario = pickScenario(scenarioId);
  const sent = await twilioSend({ to, body: scenario.text });

  // The reveal is fire-and-forget on an in-process timer. Good enough for a drill that
  // lasts two minutes; a production build should hand this to a job queue so a restart
  // can never strand someone believing the scam was real.
  const delay = Number.isFinite(revealAfterMs)
    ? revealAfterMs
    : Number(process.env.SMS_REVEAL_DELAY_MS || 120_000);
  const timer = setTimeout(() => {
    twilioSend({ to, body: REVEAL_TEXT }).catch((err) =>
      console.error('[sms] reveal failed to send:', err?.message || err),
    );
  }, delay);
  timer.unref?.(); // never hold the process open just for a pending reveal

  return { sid: sent.sid, scenarioId: scenario.id, revealInMs: delay };
}
