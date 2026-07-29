// SafeSpace backend — serves the built React app and the drill API.
// Two jobs: fire real surprise calls (Vapi) and turn drill outcomes into XP the UI reads.
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  getUser, getUserByPhone, getFamily, getLeaderboard, applyOutcome, takePendingResult,
  recordDrillFired, registerVerifiedUser, setUserEmail, detachVerifiedPhone, publicUser,
  createSession, getUserIdByToken,
} from './store.js';
import { fireDrillCall, outcomeFromVapiWebhook } from './vapi.js';
import { startVerification, checkVerification, rateLimited, verifyMode } from './verify.js';
import { sendDrillEmail, emailConfigured } from './email.js';
import { sendDrillSms, smsConfigured } from './sms.js';

// Verification failures that mean "not configured" are a 503, not a bad request.
const verifyErrStatus = (e) => (e?.code === 'VERIFY_UNAVAILABLE' ? 503 : 502);

// Never echo upstream (Twilio/Vapi) error bodies to clients — they carry account SIDs,
// phone-number ids and config detail. Log the detail, return something generic.
function fail(res, status, publicMessage, err) {
  if (err) console.error(`[api] ${publicMessage}:`, err?.message || err);
  return res.status(status).json({ error: publicMessage });
}

// Express 4 does not catch rejections from `async` handlers — an unhandled one leaves
// the request open until the client times out, which looks like a hung app rather than
// an error. Store reads hit the network on the Redis backend, so every async route goes
// through this and fails loudly instead.
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch((e) => {
    if (res.headersSent) return;
    fail(res, 500, 'something went wrong', e);
  });

// --- Auth: a drill places a REAL phone call, so identity must be proven with a
// server-issued bearer token. A client-supplied user id is an assertion, not proof.
function bearerToken(req) {
  const h = req.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}
/** Resolves to the authenticated user id, or null. */
async function sessionUserId(req) {
  return getUserIdByToken(bearerToken(req));
}
/** Authenticated user id, falling back to the shared demo account for anonymous visitors. */
async function actingUserId(req) {
  return (await sessionUserId(req)) || DEFAULT_USER;
}

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const DEFAULT_USER = process.env.DRILL_USER || 'you';

const app = express();
app.use(express.json());

// Register API routes through `api`, never `app`, so asyncRoute cannot be forgotten.
// Forgetting it is uniquely nasty: the rejection only happens when the store actually
// fails, which on the file backend it never does — so a missing wrapper is invisible in
// local dev and only hangs requests in the deployed serverless environment. Making it
// structural removes the chance to forget.
const api = {
  get: (path, handler) => app.get(path, asyncRoute(handler)),
  post: (path, handler) => app.post(path, asyncRoute(handler)),
};

// --- Read models (replace the React app's mock arrays) ---
// Identity comes from the session token only — a client-supplied ?user= would let
// anyone read any account.
api.get('/api/me', async (req, res) => {
  const user = await getUser(await actingUserId(req));
  if (!user) return res.status(404).json({ error: 'unknown user' });
  res.json(publicUser(user));
});

// Liveness probe for systemd/monitoring. Deliberately says nothing about which
// providers are configured — that would hand an attacker a map of the deployment.
api.get('/api/health', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

api.get('/api/leaderboard', async (_req, res) => res.json(await getLeaderboard()));

api.get('/api/family', async (_req, res) => res.json(await getFamily()));

// On app open: is there a real-drill result waiting? (drives routing to result screen)
api.get('/api/drills/pending-result', async (req, res) => {
  res.json({ pending: await takePendingResult(await actingUserId(req)) });
});

// --- In-app practice drill finished (win/lose from the simulated UI). Half XP. ---
api.post('/api/drills/practice-result', async (req, res) => {
  const { outcome, channel = 'call' } = req.body || {};
  if (!outcome) return res.status(400).json({ error: 'outcome required' });
  try {
    // Session-derived, never req.body.user — otherwise anyone could write to any account.
    const { record, user: u } = await applyOutcome({ userId: await actingUserId(req), outcome, channel, practice: true });
    res.json({ record, user: publicUser(u) });
  } catch (e) {
    return fail(res, 400, 'could not record drill result', e);
  }
});

// --- Phone registration: verify ownership + consent via OTP (Twilio Verify / dev bypass). ---
api.post('/api/verify/start', async (req, res) => {
  const phone = (req.body?.phone || '').trim();
  if (!E164.test(phone)) return res.status(400).json({ error: 'phone must be E.164, e.g. +6591234567' });
  if (rateLimited(phone)) return res.status(429).json({ error: 'too many attempts, wait a bit' });
  try {
    const out = await startVerification(phone);
    res.json({ ok: true, ...out }); // out.dev + out.devCode only in explicit dev mode
  } catch (e) {
    return fail(res, verifyErrStatus(e), 'verification service unavailable', e);
  }
});

api.post('/api/verify/check', async (req, res) => {
  const phone = (req.body?.phone || '').trim();
  const code = (req.body?.code || '').trim();
  const name = String(req.body?.name || '').trim();
  if (!E164.test(phone) || !code) return res.status(400).json({ error: 'phone and code required' });
  // Email is optional, but if supplied it must be well-formed — it becomes a real
  // send target, so don't store junk the client happened to submit.
  const email = req.body?.email;
  if (email !== undefined && email !== null && email !== '' && !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: 'email is not a valid address' });
  }
  if (!NAME_RE.test(name)) {
    return res.status(400).json({ error: 'name is required (letters, spaces, apostrophes or hyphens)' });
  }
  try {
    const approved = await checkVerification(phone, code);
    if (!approved) return res.status(401).json({ ok: false, error: 'incorrect or expired code' });
    const user = await registerVerifiedUser({ phone, name, email: req.body?.email });
    // Proving control of the number is what earns a session; the token is the only
    // thing that later authorises firing a real call to it.
    const token = await createSession(user.id);
    res.json({ ok: true, token, userId: user.id, name: user.name });
  } catch (e) {
    return fail(res, verifyErrStatus(e), 'verification service unavailable', e);
  }
});

// --- Fire a REAL surprise call now (demo button / scheduler). Gated on consent. ---
// AUTHENTICATION REQUIRED. This dials a real human. The target is derived from the
// caller's own session — never from the request body — so nobody can make the platform
// call a number that isn't theirs. `consentToDrills` records a past consent event; it is
// NOT an authorisation check and must not be treated as one.
api.post('/api/drills/fire', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });

  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });

  try {
    const call = await fireDrillCall({ toNumber: user.phone, name: user.name });
    await recordDrillFired({ userId, channel: 'call', callId: call.id });
    res.json({ ok: true, callId: call.id, status: call.status });
  } catch (e) {
    return fail(res, 502, 'could not place the drill call', e);
  }
});

// --- Set the session user's own email (so the email drill has somewhere to send).
//     AUTH REQUIRED: you can only set the address on the account whose phone you proved.
//     This does NOT let you send to it directly — it just records your own address, which
//     the email drill below then uses. That keeps the "own address only" invariant: the
//     send target always comes from the stored account, never straight from a request. ---
api.post('/api/me/email', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to add an email' });
  const email = (req.body?.email || '').trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email is not a valid address' });
  try {
    const user = await setUserEmail(userId, email);
    res.json({ ok: true, user: publicUser(user) });
  } catch (e) {
    return fail(res, 400, 'could not save email', e);
  }
});

// Detaching also withdraws drill consent and revokes every session created from the
// phone verification. A new OTP is required before another real drill can run.
api.post('/api/me/phone/detach', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to remove your verified phone' });

  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });

  await detachVerifiedPhone(userId);
  res.json({ ok: true });
});

// --- Real EMAIL drill. Same contract as /fire: AUTHENTICATION REQUIRED, and the
//     recipient is the session user's OWN stored address — never one from the request.
//     (The standalone email-webapp took a target address from the body with no auth,
//     which made it an open phishing relay.) ---
api.post('/api/drills/email', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });

  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.email) return res.status(400).json({ error: 'no email on file — add one when you register' });
  if (!emailConfigured()) return fail(res, 503, 'email drills are not configured');

  try {
    await sendDrillEmail({ to: user.email, name: user.name });
    await recordDrillFired({ userId, channel: 'email' });
    res.json({ ok: true });
  } catch (e) {
    return fail(res, 502, 'could not send the drill email', e);
  }
});

// --- Real SMS drill. Same contract as /fire and /email: AUTH REQUIRED, and the text
//     goes to the session user's OWN verified number — never one from the request. ---
api.post('/api/drills/sms', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });

  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });
  if (!smsConfigured()) return fail(res, 503, 'SMS drills are not configured');

  try {
    const out = await sendDrillSms({ to: user.phone, name: user.name, scenarioId: req.body?.scenario });
    await recordDrillFired({ userId, channel: 'sms' });
    res.json({ ok: true, scenarioId: out.scenarioId, revealInMs: out.revealInMs });
  } catch (e) {
    return fail(res, 502, 'could not send the drill SMS', e);
  }
});

// --- Vapi end-of-call webhook: compute outcome -> XP -> queue result for the user. ---
// This route is deliberately internet-facing (Vapi must reach it), and it MUTATES a
// user's training record — so it must prove the request really came from Vapi.
// Fails closed: no configured secret, no webhook.
api.post('/api/webhooks/vapi', async (req, res) => {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return fail(res, 503, 'webhook not configured');
  if (!timingSafeEqualStr(req.get('x-vapi-secret') || '', secret)) {
    return fail(res, 401, 'invalid webhook signature');
  }

  const outcome = outcomeFromVapiWebhook(req.body);
  if (!outcome) return res.json({ ignored: true }); // not a call-end event

  // Attribute to whoever actually took the call, by the number Vapi dialled.
  const called = req.body?.message?.customer?.number;
  const userId = (await getUserByPhone(called))?.id ?? DEFAULT_USER;
  try {
    const { record } = await applyOutcome({ userId, outcome, channel: 'call', practice: false });
    res.json({ ok: true, outcome, result: record.result });
  } catch (e) {
    return fail(res, 400, 'could not record call outcome', e);
  }
});

// --- Demo helper: simulate a real-call result WITHOUT live telephony/tunnel, so the
//     "surprise call -> result appears on next app open" loop is demoable offline.
//     Writes real (non-practice) results, so it is registered ONLY when explicitly
//     enabled — it must not exist in a deployed environment. ---
if (process.env.ENABLE_DEMO_ROUTES === 'true') {
  console.warn('[demo] /api/drills/simulate enabled — NEVER enable in production.');
  api.post('/api/drills/simulate', async (req, res) => {
    const { outcome = 'disengaged' } = req.body || {};
    try {
      const { record } = await applyOutcome({ userId: await actingUserId(req), outcome, channel: 'call', practice: false });
      res.json({ ok: true, record });
    } catch (e) {
      return fail(res, 400, 'could not simulate result', e);
    }
  });
}

// --- Serve the built React app (run `npm run build` first) ---
app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

// Only bind a port when run directly (`node server/index.js`). Importing this module —
// e.g. from the route tests — must not start a listener or occupy port 3000.
const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`SafeSpace backend on http://localhost:${PORT}`);
    const mode = verifyMode();
    if (mode === 'dev') {
      console.warn(`[verify] mode=dev — ALLOW_DEV_VERIFY=true, code "${'0'.repeat(6)}" accepted. NEVER enable in production.`);
    } else if (mode === 'disabled') {
      console.warn('[verify] mode=disabled — phone registration will refuse (503). Set TWILIO_* keys, or ALLOW_DEV_VERIFY=true for offline demos.');
    } else {
      console.log('[verify] mode=twilio — real Verify SMS');
    }
  });
}

export { app };
