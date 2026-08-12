// Phone-ownership + consent verification via Twilio Verify.
//
// FAILS CLOSED. Three modes:
//   'twilio'   — all three TWILIO_* vars set        -> real Verify SMS
//   'dev'      — ALLOW_DEV_VERIFY=true (explicit!)  -> fixed bypass code, offline/demo
//   'disabled' — anything else                      -> every verification is REFUSED
//
// The dev bypass must be opted into deliberately. A missing/typo'd TWILIO_* var must never
// silently downgrade to "accept 000000 from anyone" — that would let a caller register a
// number they don't own and have SafeSpace place a real drill call to a non-consenting person.

export const DEV_CODE = '000000';

let forcedDevWarned = false;

export class VerificationUnavailable extends Error {
  constructor() {
    super('phone verification is not configured (set TWILIO_* keys, or ALLOW_DEV_VERIFY=true for offline demos)');
    this.name = 'VerificationUnavailable';
    this.code = 'VERIFY_UNAVAILABLE';
  }
}

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
  );
}

/** 'twilio' | 'dev' | 'disabled' */
export function verifyMode() {
  // ESCAPE HATCH — DEMO ONLY. Normally Twilio wins so a typo'd TWILIO_* var can never
  // silently downgrade to "accept 000000 from anyone" (see the header comment). This
  // forces the bypass even with Twilio fully configured, which means ANY caller can
  // claim ANY number and have SafeSpace place a real drill call to it. It is named to
  // be greppable and is meant to be removed after the demo, not shipped.
  if (process.env.UNSAFE_FORCE_DEV_VERIFY === 'true') {
    if (!forcedDevWarned) {
      forcedDevWarned = true;
      console.warn(
        '[verify] UNSAFE_FORCE_DEV_VERIFY=true — phone ownership is NOT being checked. '
          + 'Anyone can register any number. Unset this before real use.',
      );
    }
    return 'dev';
  }
  if (twilioConfigured()) return 'twilio';
  if (process.env.ALLOW_DEV_VERIFY === 'true') return 'dev';
  return 'disabled';
}

function basicAuth() {
  const t = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');
  return `Basic ${t}`;
}

/** Send a verification code. Returns { dev, devCode? }. Throws if verification is disabled. */
export async function startVerification(phone) {
  const mode = verifyMode();
  if (mode === 'disabled') throw new VerificationUnavailable();
  if (mode === 'dev') {
    // Only reachable when an operator set ALLOW_DEV_VERIFY=true. Logged server-side so the
    // code is recoverable even if a caller never sees the response body.
    console.warn(`[verify] DEV BYPASS active — code for ${phone} is ${DEV_CODE}`);
    return { dev: true, devCode: DEV_CODE };
  }
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const res = await fetch(`https://verify.twilio.com/v2/Services/${sid}/Verifications`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Channel: 'sms' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio Verify start ${res.status}: ${JSON.stringify(data)}`);
  return { dev: false, status: data.status };
}

/** Check a code. Returns true iff it's valid/approved. Throws if verification is disabled. */
export async function checkVerification(phone, code) {
  const mode = verifyMode();
  if (mode === 'disabled') throw new VerificationUnavailable();
  if (mode === 'dev') return code === DEV_CODE;
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const res = await fetch(`https://verify.twilio.com/v2/Services/${sid}/VerificationCheck`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: phone, Code: code }),
  });
  const data = await res.json();
  if (!res.ok) return false;
  return data.status === 'approved';
}

export const isDevMode = () => verifyMode() === 'dev';
