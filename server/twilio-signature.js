// Proof that an inbound webhook really came from Twilio.
//
// Twilio signs each request with HMAC-SHA1 over the exact URL it posted to, followed by
// every POST parameter as name then value in alphabetical order, keyed on the account's
// auth token. Any difference — a changed body, a different path, an extra parameter —
// produces a different signature.
//
// The URL must be the one Twilio was configured with, not one derived from request
// headers: Host and X-Forwarded-Proto are attacker-controlled, so building the URL from
// them would let a caller sign a request for a URL of their choosing. It comes from
// PUBLIC_URL instead.
//
// FAILS CLOSED - unconfigured means no inbound webhook is accepted.
import crypto from 'node:crypto';

export const INBOUND_SMS_PATH = '/api/webhooks/twilio/sms';

/** The signature Twilio would send for this request. Exported so tests can sign too. */
export function signTwilioRequest(url, params, authToken) {
  const payload = Object.keys(params || {})
    .sort()
    .reduce((acc, key) => acc + key + String(params[key] ?? ''), String(url));
  return crypto.createHmac('sha1', String(authToken)).update(payload, 'utf8').digest('base64');
}

/** True only for a request Twilio could have produced. Never throws. */
export function verifyTwilioSignature({ url, params, signature, authToken } = {}) {
  if (!url || !signature || !authToken) return false;
  let expected;
  try {
    expected = signTwilioRequest(url, params || {}, authToken);
  } catch {
    return false;
  }
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The absolute URL Twilio posts to, or null when it cannot be known for certain. */
export function inboundWebhookUrl(env = process.env) {
  try {
    const parsed = new URL(String(env.PUBLIC_URL || ''));
    if (parsed.protocol !== 'https:') return null;
    return `${parsed.origin}${INBOUND_SMS_PATH}`;
  } catch {
    return null;
  }
}

export function inboundWebhookConfigured(env = process.env) {
  return Boolean(String(env.TWILIO_AUTH_TOKEN || '').trim() && inboundWebhookUrl(env));
}
