// SafeSpace backend — serves the built React app and the consent-gated drill API.
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  DrillAttemptConflict,
  EmailVerificationConflict,
  VerificationRateLimitConflict,
  ackPendingResult,
  applyOutcome,
  applyPracticeOutcomeOnce,
  beginEmailVerification,
  cancelEmailVerification,
  completeDrillAttempt,
  createDrillAttempt,
  createSession,
  detachVerifiedPhone,
  getDrillAttempt,
  getFamily,
  getLeaderboard,
  getUser,
  getUserIdByToken,
  markDrillAttemptFailed,
  markDrillAttemptSent,
  peekPendingResult,
  publicUser,
  registerVerifiedUser,
  reservePhoneVerificationSend,
  setUserName,
  setVerifiedUserEmail,
} from './store.js';
import {
  VapiDeliveryUnconfirmed,
  fireDrillCall,
  parseVapiCallReport,
} from './vapi.js';
import { startVerification, checkVerification, verifyMode } from './verify.js';
import {
  emailConfigured,
  emailVerificationConfigured,
  resolveEmailFollowupDelay,
  sendDrillEmail,
  sendEmailOwnershipVerification,
} from './email.js';
import {
  resolveRevealDelay,
  sendDrillSms,
  smsConfigured,
} from './sms.js';
import {
  createEmailDrillLinks,
  createEmailVerificationUrl,
  drillLinksConfigured,
  verifyDrillActionToken,
  verifyEmailVerificationToken,
} from './drill-links.js';
import { KNOWN_OUTCOMES } from './xp.js';
import { educationalPage } from './pages.js';

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u;
const OUTCOMES = new Set(KNOWN_OUTCOMES);
const PRACTICE_CHANNELS = new Set(['call', 'sms', 'email']);
const CLIENT_REAL_OUTCOMES = {
  sms: new Set(['reported', 'clicked_link']),
  email: new Set(['reported', 'submitted_details']),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');
const DEFAULT_USER = process.env.DRILL_USER || 'you';

const app = express();
app.disable('x-powered-by');
// Keep the default direct-socket address unless the deployment explicitly declares
// its exact proxy hop count. Blindly trusting X-Forwarded-For would let a caller rotate
// a spoofed address and bypass the public OTP requester limit.
const configuredProxyHops = String(process.env.TRUST_PROXY_HOPS || '').trim();
if (configuredProxyHops) {
  const proxyHops = Number(configuredProxyHops);
  if (Number.isInteger(proxyHops) && proxyHops >= 0 && proxyHops <= 10) {
    app.set('trust proxy', proxyHops);
  } else {
    console.warn('[config] TRUST_PROXY_HOPS ignored; expected an integer from 0 to 10');
  }
}
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data: https://fonts.gstatic.com",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: https:",
      "manifest-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "worker-src 'self'",
    ].join('; '),
  });
  if (req.path.startsWith('/api/') || req.path.startsWith('/drill-') || req.path === '/email-verify') {
    res.set('Cache-Control', 'no-store');
  }
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const verifyErrStatus = (error) => (error?.code === 'VERIFY_UNAVAILABLE' ? 503 : 502);

// Provider errors can contain account identifiers. Keep them in server logs and return
// a stable, non-sensitive message to the browser.
function fail(res, status, publicMessage, error) {
  if (error) console.error(`[api] ${publicMessage}:`, error?.message || error);
  return res.status(status).json({ error: publicMessage });
}

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch((error) => {
    if (error?.code === 'INVALID_SESSION') {
      return res.status(401).json({ error: 'session expired; verify your phone again' });
    }
    if (!res.headersSent) fail(res, 500, 'something went wrong', error);
  });

const api = {
  get: (route, handler) => app.get(route, asyncRoute(handler)),
  post: (route, handler) => app.post(route, asyncRoute(handler)),
};

function bearerToken(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function sessionUserId(req) {
  const header = req.get('authorization') || '';
  if (!header) return null;
  const token = bearerToken(req);
  const userId = token ? await getUserIdByToken(token) : null;
  if (!userId) {
    const error = new Error('invalid or expired session');
    error.code = 'INVALID_SESSION';
    throw error;
  }
  return userId;
}

async function actingUserId(req) {
  return (await sessionUserId(req)) || DEFAULT_USER;
}

function timingSafeEqualStr(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function accountView(user) {
  return {
    ...publicUser(user),
    phoneVerified: Boolean(user?.phone),
    emailVerified: Boolean(user?.email && user?.emailVerifiedAt && !user?.pendingEmail),
  };
}

function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, 1)}${'*'.repeat(Math.min(3, Math.max(1, local.length - 1)))}@${domain}`;
}

function realDrillCooldownMs(channel) {
  const configured = Number(process.env.REAL_DRILL_COOLDOWN_MS);
  const baseline = Number.isFinite(configured) && configured >= 5_000
    ? configured
    : 5 * 60 * 1000;
  if (channel === 'sms') return Math.max(baseline, resolveRevealDelay());
  if (channel === 'email') return Math.max(baseline, resolveEmailFollowupDelay());
  return baseline;
}

function attemptConflict(res, error) {
  if (!(error instanceof DrillAttemptConflict) && error?.code !== 'DRILL_ATTEMPT_CONFLICT') {
    return false;
  }
  const retryAfterMs = Math.max(0, Number(error.retryAfterMs) || 0);
  if (retryAfterMs) res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.status(409).json({
    error: error.reason === 'cooldown'
      ? `the last drill finished; this channel is on cooldown for another ${seconds}s`
      : 'a drill is already active; wait for it to finish',
    reason: error.reason || 'active',
    retryAfterMs,
  });
  return true;
}

async function markProviderFailure(attemptId, error) {
  try {
    await markDrillAttemptFailed(attemptId, {
      reason: String(error?.code || error?.name || 'provider_error').slice(0, 80),
    });
  } catch (storeError) {
    console.error('[api] could not mark provider attempt failed:', storeError?.message || storeError);
  }
}

function callConfigured() {
  let publicOrigin = null;
  try {
    const parsed = new URL(process.env.PUBLIC_URL || '');
    if (
      parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && (parsed.pathname === '/' || parsed.pathname === '')
      && !parsed.search
      && !parsed.hash
    ) {
      publicOrigin = parsed.origin;
    }
  } catch {
    // Invalid public URL means Vapi cannot safely report an outcome.
  }
  return Boolean(
    process.env.VAPI_API_KEY
      && process.env.VAPI_PHONE_NUMBER_ID
      && publicOrigin
      && String(process.env.VAPI_WEBHOOK_SECRET || '').length >= 32,
  );
}

// educationalPage (imported from ./pages.js) renders the win/lose/neutral drill-link
// landing page; this just ships it.
function sendEducationalPage(res, options) {
  const page = educationalPage(options);
  return res.status(page.status).type('html').send(page.html);
}

// --- Read models -----------------------------------------------------------

api.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

api.get('/api/me', async (req, res) => {
  const user = await getUser(await actingUserId(req));
  if (!user) return res.status(404).json({ error: 'unknown user' });
  return res.json(accountView(user));
});

// Until explicit family membership exists, registered accounts are private: anonymous
// visitors see only seed/demo characters and a signed-in user sees themselves as well.
api.get('/api/family', async (req, res) => {
  const ownId = await sessionUserId(req);
  const family = (await getFamily()).filter(
    (user) => !String(user.id).startsWith('usr_') || user.id === ownId,
  );
  res.json(family);
});

api.get('/api/leaderboard', async (req, res) => {
  const ownId = await sessionUserId(req);
  const leaderboard = (await getLeaderboard()).filter(
    (user) => !String(user.id).startsWith('usr_') || user.id === ownId,
  );
  res.json(leaderboard.map((user, index) => ({ ...user, rank: index + 1 })));
});

api.get('/api/drills/pending-result', async (req, res) => {
  res.json({ pending: await peekPendingResult(await actingUserId(req)) });
});

api.post('/api/drills/pending-result/:resultId/ack', async (req, res) => {
  const acknowledged = await ackPendingResult(await actingUserId(req), req.params.resultId);
  if (!acknowledged) return res.status(404).json({ error: 'result not found' });
  return res.json({ ok: true });
});

// --- Practice scoring ------------------------------------------------------

api.post('/api/drills/practice-result', async (req, res) => {
  const outcome = String(req.body?.outcome || '').trim();
  const channel = String(req.body?.channel || 'call').trim();
  const clientAttemptId = String(
    req.body?.attemptId || req.body?.idempotencyKey || '',
  ).trim();
  if (!OUTCOMES.has(outcome)) return res.status(400).json({ error: 'unknown drill outcome' });
  if (!PRACTICE_CHANNELS.has(channel)) return res.status(400).json({ error: 'unknown drill channel' });
  if (!clientAttemptId) return res.status(400).json({ error: 'attemptId is required' });

  try {
    const result = await applyPracticeOutcomeOnce({
      userId: await actingUserId(req),
      clientAttemptId,
      outcome,
      channel,
    });
    return res.json({
      status: result.status,
      applied: result.applied,
      record: result.record,
      user: publicUser(result.user),
    });
  } catch (error) {
    return fail(res, 400, 'could not record drill result', error);
  }
});

// --- Phone ownership and account ------------------------------------------

api.post('/api/verify/start', async (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!E164.test(phone)) {
    return res.status(400).json({ error: 'phone must be E.164, e.g. +6591234567' });
  }
  // A disabled provider cannot possibly send an OTP. Do not burn a durable cooldown
  // reservation for a deterministic configuration failure; otherwise a second setup
  // check misleadingly returns 429 even though no message was attempted.
  if (verifyMode() === 'disabled') {
    return fail(res, 503, 'verification service unavailable');
  }
  try {
    await reservePhoneVerificationSend({
      phone,
      requesterKey: req.ip,
      maxRequesterSends: process.env.PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR,
    });
  } catch (error) {
    if (
      error instanceof VerificationRateLimitConflict
      || error?.code === 'VERIFICATION_RATE_LIMITED'
    ) {
      const retryAfterMs = Math.max(0, Number(error.retryAfterMs) || 0);
      if (retryAfterMs) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      }
      return res.status(429).json({
        error: 'too many attempts, wait a bit',
        retryAfterMs,
      });
    }
    throw error;
  }
  try {
    const output = await startVerification(phone);
    return res.json({ ok: true, ...output });
  } catch (error) {
    return fail(res, verifyErrStatus(error), 'verification service unavailable', error);
  }
});

api.post('/api/verify/check', async (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  const code = String(req.body?.code || '').trim();
  const name = String(req.body?.name || '').trim();
  const email = req.body?.email == null ? '' : String(req.body.email).trim();

  if (!E164.test(phone) || !code) return res.status(400).json({ error: 'phone and code required' });
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email is not a valid address' });
  }
  if (!NAME_RE.test(name)) {
    return res.status(400).json({
      error: 'name is required (letters, spaces, apostrophes or hyphens)',
    });
  }

  try {
    const approved = await checkVerification(phone, code);
    if (!approved) return res.status(401).json({ ok: false, error: 'incorrect or expired code' });
    const user = await registerVerifiedUser({ phone, name, email: email || undefined });
    const token = await createSession(user.id);
    return res.json({
      ok: true,
      token,
      userId: user.id,
      name: user.name,
      emailVerified: Boolean(user.email && user.emailVerifiedAt && !user.pendingEmail),
    });
  } catch (error) {
    return fail(res, verifyErrStatus(error), 'verification service unavailable', error);
  }
});

api.post('/api/me/name', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to update your name' });
  const name = String(req.body?.name || '').trim();
  if (!NAME_RE.test(name)) {
    return res.status(400).json({
      error: 'name is required (letters, spaces, apostrophes or hyphens)',
    });
  }
  try {
    return res.json({ ok: true, user: accountView(await setUserName(userId, name)) });
  } catch (error) {
    return fail(res, 400, 'could not update name', error);
  }
});

api.post('/api/me/phone/detach', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to remove your verified phone' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });
  try {
    await detachVerifiedPhone(userId);
    return res.json({ ok: true });
  } catch (error) {
    if (error?.code === 'IDENTITY_RECOVERY_UNAVAILABLE') {
      return fail(res, 503, 'phone removal is temporarily unavailable', error);
    }
    throw error;
  }
});

// --- Email ownership -------------------------------------------------------

async function startEmailOwnership(req, res) {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to verify an email' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email is not a valid address' });
  if (!emailVerificationConfigured() || !drillLinksConfigured()) {
    return fail(res, 503, 'email verification is not configured');
  }

  let reservation;
  const verificationId = crypto.randomBytes(32).toString('base64url');
  try {
    reservation = await beginEmailVerification({ userId, email, verificationId });
  } catch (error) {
    if (error instanceof EmailVerificationConflict || error?.code === 'EMAIL_VERIFICATION_CONFLICT') {
      const retryAfterMs = Math.max(0, Number(error.retryAfterMs) || 0);
      if (retryAfterMs) res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      return res.status(429).json({
        error: 'verification already sent; wait before trying again',
        retryAfterMs,
      });
    }
    throw error;
  }
  if (reservation.alreadyVerified) return res.json({ ok: true, verified: true });

  const user = reservation.user;
  try {
    const verificationUrl = createEmailVerificationUrl(userId, verificationId);
    await sendEmailOwnershipVerification({ to: email, name: user.name, verificationUrl });
    return res.json({ ok: true, verified: false });
  } catch (error) {
    await cancelEmailVerification(userId, email, verificationId).catch((storeError) => {
      console.error('[api] could not release email verification:', storeError?.message || storeError);
    });
    return fail(res, 502, 'could not send the verification email', error);
  }
}

api.post('/api/me/email/verification/start', startEmailOwnership);
// Compatibility endpoint: it now starts ownership verification and never directly
// attaches an unproved address.
api.post('/api/me/email', startEmailOwnership);

api.get('/api/me/email/status', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to check email verification' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  const verified = Boolean(user.email && user.emailVerifiedAt && !user.pendingEmail);
  return res.json({
    verified,
    emailHint: verified ? maskEmail(user.email) : null,
    pending: Boolean(user.pendingEmail),
  });
});

api.get('/email-verify', async (req, res) => {
  const token = String(req.query?.token || '');
  const verified = verifyEmailVerificationToken(token);
  if (!verified) {
    return sendEducationalPage(res, {
      title: 'Verification link invalid',
      heading: 'This link is invalid or expired',
      message: 'Return to SafeSpace and request a fresh email verification link.',
      status: 400,
    });
  }
  return sendEducationalPage(res, {
    title: 'Confirm email verification',
    heading: 'Confirm this inbox',
    message: 'Press the button to confirm that this email belongs to you. SafeSpace does not verify ownership from an automatic link preview.',
    confirmAction: `/email-verify?token=${encodeURIComponent(token)}`,
    confirmLabel: 'VERIFY MY EMAIL',
  });
});

api.post('/email-verify', async (req, res) => {
  const verified = verifyEmailVerificationToken(String(req.query?.token || ''));
  if (!verified) {
    return sendEducationalPage(res, {
      title: 'Verification link invalid',
      heading: 'This link is invalid or expired',
      message: 'Return to SafeSpace and request a fresh email verification link.',
      status: 400,
    });
  }
  try {
    await setVerifiedUserEmail(verified.userId, verified.verificationId);
    return sendEducationalPage(res, {
      title: 'Email verified',
      heading: 'Email verified',
      message: 'This inbox can now receive your consented SafeSpace email drills.',
    });
  } catch (error) {
    if (error?.code === 'EMAIL_VERIFICATION_STALE') {
      return sendEducationalPage(res, {
        title: 'Verification link replaced',
        heading: 'A newer link replaced this one',
        message: 'Use the most recent verification email, or request another from SafeSpace.',
        status: 410,
      });
    }
    return fail(res, 500, 'could not verify email', error);
  }
});

// --- Real drills -----------------------------------------------------------

api.post('/api/drills/fire', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });
  if (!callConfigured()) return fail(res, 503, 'call drills are not configured');

  let attempt;
  try {
    attempt = await createDrillAttempt({
      userId,
      channel: 'call',
      cooldownMs: realDrillCooldownMs('call'),
    });
  } catch (error) {
    if (attemptConflict(res, error)) return;
    throw error;
  }

  let call;
  try {
    call = await fireDrillCall({
      toNumber: user.phone,
      name: user.name,
      attemptId: attempt.id,
    });
    if (!call?.id) throw new Error('Vapi accepted the request without a call id');
  } catch (error) {
    if (error instanceof VapiDeliveryUnconfirmed || error?.code === 'VAPI_DELIVERY_UNCONFIRMED') {
      try {
        await markDrillAttemptSent(attempt.id);
      } catch (storeError) {
        console.error('[api] unconfirmed call state could not be persisted:', storeError?.message || storeError);
      }
      return res.status(202).json({
        ok: true,
        drillId: attempt.id,
        status: 'delivery-unconfirmed',
        deliveryConfirmed: false,
      });
    }
    await markProviderFailure(attempt.id, error);
    return fail(res, 502, 'could not place the drill call', error);
  }

  try {
    await markDrillAttemptSent(attempt.id, { providerId: call.id });
  } catch (error) {
    // The call is already live and carries the attempt id in Vapi metadata, so do not
    // tell the user to retry and accidentally place a second call.
    console.error('[api] call placed but sent-state persistence failed:', error?.message || error);
  }
  return res.json({ ok: true, drillId: attempt.id, callId: call.id, status: call.status });
});

api.post('/api/drills/email', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.email || !user.emailVerifiedAt || user.pendingEmail) {
    return res.status(400).json({ error: 'verify your email before running a drill' });
  }
  if (!emailConfigured() || !drillLinksConfigured()) {
    return fail(res, 503, 'email drills are not configured');
  }

  let attempt;
  try {
    attempt = await createDrillAttempt({
      userId,
      channel: 'email',
      cooldownMs: realDrillCooldownMs('email'),
    });
  } catch (error) {
    if (attemptConflict(res, error)) return;
    throw error;
  }

  let output;
  try {
    const links = createEmailDrillLinks(attempt.id);
    output = await sendDrillEmail({
      to: user.email,
      name: user.name,
      scenarioId: req.body?.scenario,
      ...links,
    });
  } catch (error) {
    if (error?.code === 'EMAIL_DELIVERY_UNCONFIRMED') {
      try {
        await markDrillAttemptSent(attempt.id);
      } catch (storeError) {
        console.error('[api] unconfirmed email state could not be persisted:', storeError?.message || storeError);
      }
      const {
        safetyJobId: _privateSafetyJobId,
        ...safeDetails
      } = error.details || {};
      return res.status(202).json({
        ok: true,
        drillId: attempt.id,
        status: 'delivery-unconfirmed',
        deliveryConfirmed: false,
        ...safeDetails,
      });
    }
    await markProviderFailure(attempt.id, error);
    return fail(res, 502, 'could not send the drill email', error);
  }
  try {
    await markDrillAttemptSent(attempt.id);
  } catch (error) {
    // Both the bait and its durable reveal are already accepted. Preserve the live
    // attempt so either signed action can still complete it; a retry could double-send.
    console.error('[api] email sent but sent-state persistence failed:', error?.message || error);
  }
  return res.json({
    ok: true,
    drillId: attempt.id,
    scenarioId: output.scenarioId,
    safetyFollowupAt: output.safetyFollowupAt,
  });
});

api.post('/api/drills/sms', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });
  if (!smsConfigured() || !drillLinksConfigured()) {
    return fail(res, 503, 'SMS drills are not configured');
  }

  let attempt;
  try {
    attempt = await createDrillAttempt({
      userId,
      channel: 'sms',
      cooldownMs: realDrillCooldownMs('sms'),
    });
  } catch (error) {
    if (attemptConflict(res, error)) return;
    throw error;
  }

  let output;
  try {
    const { revealUrl } = createEmailDrillLinks(attempt.id);
    output = await sendDrillSms({
      to: user.phone,
      name: user.name,
      scenarioId: req.body?.scenario,
      revealUrl,
    });
  } catch (error) {
    if (error?.code === 'SMS_DELIVERY_UNCONFIRMED') {
      try {
        await markDrillAttemptSent(attempt.id);
      } catch (storeError) {
        console.error('[api] unconfirmed SMS state could not be persisted:', storeError?.message || storeError);
      }
      const { revealSid: _privateRevealSid, ...safeDetails } = error.details || {};
      return res.status(202).json({
        ok: true,
        drillId: attempt.id,
        status: 'delivery-unconfirmed',
        deliveryConfirmed: false,
        ...safeDetails,
      });
    }
    await markProviderFailure(attempt.id, error);
    return fail(res, 502, 'could not send the drill SMS', error);
  }
  try {
    await markDrillAttemptSent(attempt.id, { providerId: output.sid });
  } catch (error) {
    console.error('[api] SMS sent but sent-state persistence failed:', error?.message || error);
  }
  return res.json({
    ok: true,
    drillId: attempt.id,
    scenarioId: output.scenarioId,
    revealAt: output.revealAt,
    revealInMs: output.revealInMs,
  });
});

api.post('/api/drills/:drillId/complete', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to complete a real drill' });
  const attempt = await getDrillAttempt(req.params.drillId);
  if (!attempt || attempt.userId !== userId) return res.status(404).json({ error: 'drill not found' });

  const outcome = String(req.body?.outcome || '').trim();
  if (!CLIENT_REAL_OUTCOMES[attempt.channel]?.has(outcome)) {
    return res.status(400).json({ error: 'outcome is not valid for this drill' });
  }
  const result = await completeDrillAttempt({ attemptId: attempt.id, outcome });
  if (result.status === 'unknown') return res.status(404).json({ error: 'drill not found' });
  return res.json({
    ok: true,
    status: result.status,
    applied: result.applied,
    record: result.record,
    user: result.user ? publicUser(result.user) : null,
  });
});

async function signedDrillAction(req, res, action, outcome, shouldComplete) {
  const token = String(req.query?.token || '');
  const verified = verifyDrillActionToken(token, action);
  if (!verified) {
    return sendEducationalPage(res, {
      title: 'Drill link invalid',
      heading: 'This drill link is invalid or expired',
      message: 'No action was recorded. Return to SafeSpace if you want to start another drill.',
      status: 400,
    });
  }
  const attempt = await getDrillAttempt(verified.attemptId);
  if (!attempt || !['email', 'sms'].includes(attempt.channel)) {
    return sendEducationalPage(res, {
      title: 'Drill unavailable',
      heading: 'This drill is no longer available',
      message: 'No action was recorded.',
      status: 404,
    });
  }
  if (!shouldComplete) {
    const isReport = action === 'report';
    return sendEducationalPage(res, {
      title: isReport ? 'Confirm report' : 'Open SafeSpace link',
      heading: isReport ? 'Report this message?' : 'Continue to the drill reveal?',
      message: 'Press the button to continue. Automatic email and messaging link previews cannot record a drill result.',
      confirmAction: `/${isReport ? 'drill-report' : 'drill-reveal'}?token=${encodeURIComponent(token)}`,
      confirmLabel: isReport ? 'CONFIRM REPORT' : 'SHOW DRILL REVEAL',
    });
  }
  const completion = await completeDrillAttempt({ attemptId: attempt.id, outcome });
  if (completion.status === 'unknown') {
    return sendEducationalPage(res, {
      title: 'Drill unavailable',
      heading: 'This drill is no longer available',
      message: 'No action was recorded.',
      status: 404,
    });
  }
  if (completion.status === 'duplicate' && completion.record?.outcome !== outcome) {
    return sendEducationalPage(res, {
      title: 'Drill already completed',
      heading: 'This drill already has a result',
      message: 'SafeSpace kept the first confirmed action and did not replace it with this one.',
    });
  }
  const duplicate = completion.status === 'duplicate';
  if (action === 'report') {
    // Reported it → SUCCESS.
    return sendEducationalPage(res, {
      variant: 'win',
      title: 'Drill passed — you reported it',
      heading: duplicate ? 'Already reported — nice work' : 'Good catch. This was a SafeSpace drill.',
      message: duplicate
        ? 'You spotted this one and reported it. That instinct — report, then verify through an official channel — is exactly what keeps scammers out.'
        : 'That message was fake, and you did the right thing. Reporting it and checking through an official app or number you find yourself is the reflex that beats real scams.',
    });
  }
  // Clicked the link → FAILURE. This is the teaching moment.
  return sendEducationalPage(res, {
    variant: 'lose',
    title: 'Gotcha — this was a SafeSpace drill',
    heading: duplicate ? 'You already opened this drill link' : 'Gotcha — this was a SafeSpace drill',
    message: 'The message and the organisation were fictional, so you are completely safe. But in a real scam, that click is the moment you would have handed over your details or money. Next time: stop, and check through an official app, number, or website you find yourself — never the link in the message.',
  });
}

api.get('/drill-reveal', (req, res) =>
  signedDrillAction(req, res, 'reveal', 'clicked_link', false));
api.post('/drill-reveal', (req, res) =>
  signedDrillAction(req, res, 'reveal', 'clicked_link', true));
api.get('/drill-report', (req, res) =>
  signedDrillAction(req, res, 'report', 'reported', false));
api.post('/drill-report', (req, res) =>
  signedDrillAction(req, res, 'report', 'reported', true));

// --- Vapi callback ---------------------------------------------------------

api.post('/api/webhooks/vapi', async (req, res) => {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (String(secret || '').length < 32) return fail(res, 503, 'webhook not configured');
  if (!timingSafeEqualStr(req.get('x-vapi-secret') || '', secret)) {
    return fail(res, 401, 'invalid webhook signature');
  }

  const report = parseVapiCallReport(req.body);
  if (!report) return res.json({ ignored: true });
  if (!report.callId && !report.attemptId) {
    return res.json({ ignored: true, reason: 'unknown attempt' });
  }

  try {
    const result = await completeDrillAttempt({
      providerId: report.callId,
      attemptId: report.attemptId,
      outcome: report.outcome,
      unscoredReason: report.unscoredReason,
    });
    if (result.status === 'unknown') {
      return res.json({ ignored: true, reason: 'unknown attempt' });
    }
    return res.json({
      ok: true,
      status: result.status,
      applied: result.applied,
      outcome: report.outcome,
      unscoredReason: report.unscoredReason,
      result: result.record?.result || null,
    });
  } catch (error) {
    return fail(res, 500, 'could not record call outcome', error);
  }
});

// Offline-only helper. It is absent unless explicitly enabled and still validates the
// same outcome vocabulary as production paths.
if (process.env.ENABLE_DEMO_ROUTES === 'true') {
  console.warn('[demo] /api/drills/simulate enabled — NEVER enable in production.');
  api.post('/api/drills/simulate', async (req, res) => {
    const outcome = String(req.body?.outcome || 'disengaged').trim();
    if (!OUTCOMES.has(outcome)) return res.status(400).json({ error: 'unknown drill outcome' });
    try {
      const result = await applyOutcome({
        userId: await actingUserId(req),
        outcome,
        channel: 'call',
        practice: false,
      });
      return res.json({ ok: true, record: result.record });
    } catch (error) {
      return fail(res, 400, 'could not simulate result', error);
    }
  });
}

// Keep malformed JSON and unknown API routes machine-readable; otherwise Express's
// default HTML error page (or the SPA fallback) makes client failures look successful.
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && error?.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'request body too large' });
  }
  if (res.headersSent) return next(error);
  return fail(res, 500, 'something went wrong', error);
});
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));

app.use(express.static(DIST));
app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`SafeSpace backend on http://localhost:${PORT}`);
    const mode = verifyMode();
    if (mode === 'dev') {
      console.warn('[verify] mode=dev — fixed code accepted. NEVER enable in production.');
    } else if (mode === 'disabled') {
      console.warn('[verify] mode=disabled — phone registration will refuse (503).');
    } else {
      console.log('[verify] mode=twilio — real Verify SMS');
    }
  });
}

export { app };
