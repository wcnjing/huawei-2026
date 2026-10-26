// SafeSpace backend — serves the built React app and the consent-gated drill API.
import 'dotenv/config';
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
  getUser,
  getUserIdByToken,
  listLiveTacticCards,
  markDrillAttemptFailed,
  appendSmsTurn,
  findLiveSmsAttempt,
  getUserByPhone,
  markDrillAttemptSent,
  peekPendingResult,
  pingDb,
  publicUser,
  registerVerifiedUser,
  reservePhoneVerificationSend,
  setUserAvatar,
  setUserHomeInventory,
  setUserRoomStyle,
  setUserName,
  setVerifiedUserEmail,
} from './store.js';
import { cleanAvatar } from './avatar.js';
import { cleanHomeInventory } from './home-inventory.js';
import { cleanRoomStyle, roomView } from './room-style.js';
import {
  VapiDeliveryUnconfirmed,
  fireDrillCall,
  parseVapiCallReport,
} from './vapi.js';
import { startVerification, checkVerification, verifyMode } from './verify.js';
import {
  emailConfigured,
  emailVerificationConfigured,
  GENERATED_SCENARIO_ID,
  pickEmailScenario,
  sendDrillEmail,
  sendEmailOwnershipVerification,
} from './email.js';
import { getLessonByVariantId, getLessonForProfile, getUsableLessons, warmScamVariants } from './scam-variants.js';
import { GENERATED_ID_BASE, planQuestions, quizWriterConfigured, writeQuizRound } from './quiz-writer.js';
import { channelAllowed, cleanPresurvey } from './presurvey.js';
import { realDrillCooldownMs } from './drill-cooldown.js';
import { getPresurvey, getPresurveyOrNull, savePresurvey } from './presurvey-store.js';
import { writeDrillEmail } from './email-writer.js';
import { writeDrillSms } from './sms-writer.js';
import { tacticFromLesson } from './call-tactic.js';
import { nextSmsTurn } from './sms-reply.js';
import {
  INBOUND_SMS_PATH,
  inboundWebhookConfigured,
  inboundWebhookUrl,
  verifyTwilioSignature,
} from './twilio-signature.js';
import {
  REVEAL_TEXTS,
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
import { normalizeLanguage, pageText, withLanguage } from './language.js';
import { renderTactic } from './intel/render.js';
import {
  HouseError,
  createHouse,
  doorbellsForUser,
  getHouseView,
  joinHouse,
  leaveHouse,
  recordHouseRun,
  regenerateInviteCode,
  removeMember,
  renameHouse,
  setFamilyLink,
  editFamilyTree,
  switchHouse,
} from './houses.js';
import {
  answerHouseDrill,
  continueHouseDrill,
  createHouseDrill,
  getHouseDrill,
  leaveHouseDrill,
  respondToHouseDrill,
  skipHouseDrillTurn,
  startHouseDrill,
} from './house-drills.js';
import { ChatError, listMessages, sendMessage } from './chat.js';
import { replyAsPixi } from './pixi-chat.js';
import { ring } from './doorbell.js';

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

// The app's realtime socket goes straight to Supabase, so allow that one origin. Read
// once at startup — SUPABASE_URL is fixed for the process's lifetime, so there is no
// reason to re-parse it on every request.
function supabaseConnectSources() {
  try {
    const url = new URL(process.env.SUPABASE_URL || '');
    return url.protocol === 'https:' ? [url.origin, `wss://${url.host}`] : [];
  } catch {
    return [];
  }
}
const CONNECT_SRC = ["connect-src 'self'", ...supabaseConnectSources()].join(' ');

const app = express();
app.disable('x-powered-by');
// Keep the default direct-socket address unless the deployment explicitly declares
// its exact proxy hop count. Blindly trusting X-Forwarded-For would let a caller rotate
// a spoofed address and bypass the public OTP requester limit.
const configuredProxyHops = String(process.env.TRUST_PROXY_HOPS || '').trim();
// Whether req.ip is a caller's own address. Without the declared hop count it is
// whatever socket the deployment terminates on — on a serverless platform that address
// is the platform's, shared by everybody, so per-address limits must stay off.
let clientAddressIsReal = false;
if (configuredProxyHops) {
  const proxyHops = Number(configuredProxyHops);
  if (Number.isInteger(proxyHops) && proxyHops >= 0 && proxyHops <= 10) {
    app.set('trust proxy', proxyHops);
    clientAddressIsReal = true;
  } else {
    console.warn('[config] TRUST_PROXY_HOPS ignored; expected an integer from 0 to 10');
  }
}
/** The rate-limit bucket for "this caller", or null when no address can be trusted. */
const requesterKey = (req) => (clientAddressIsReal ? req.ip : null);
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
      CONNECT_SRC,
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

/** The signed-in user's id, or null after sending 401. Every account route needs one. */
async function requireUserId(req, res) {
  const userId = await sessionUserId(req);
  if (!userId) res.status(401).json({ error: 'sign in first' });
  return userId;
}

/** Ring every house of a user whose visible stats just changed. Never throws. */
async function ringUser(userId) {
  try {
    const topics = await doorbellsForUser(userId);
    if (topics.length) await ring(topics);
  } catch (error) {
    console.error('[doorbell] lookup failed:', error?.message || error);
  }
}

const HOUSE_ERRORS = {
  NOT_IN_HOUSE: [404, "you're not in a house"],
  ALREADY_IN_HOUSE: [409, "you're already in that house"],
  HOUSE_LIMIT: [409, 'you can be in up to 3 houses; leave one first'],
  CODE_INVALID: [400, "that code isn't valid; ask for a new one"],
  HOUSE_FULL: [409, 'that house is full (14 players)'],
  NOT_OWNER: [403, 'only the house owner can do that'],
  NOT_A_MEMBER: [404, "that player isn't in your house"],
  CANNOT_REMOVE_SELF: [400, 'use LEAVE HOUSE to leave your own house'],
  JOIN_RATE_LIMITED: [429, 'too many wrong codes; try again later'],
  INVALID_HOUSE_NAME: [400, 'house names are 1–30 letters, numbers or spaces'],
  INVALID_DRILL_RUN: [400, 'that drill run is not valid'],
  INVALID_DRILL_SETTINGS: [400, 'those drill settings are not valid'],
  INVALID_DRILL_ANSWER: [400, 'that answer is not valid'],
  DRILL_IN_PROGRESS: [409, 'a house drill is already running'],
  DRILL_NOT_FOUND: [404, 'that house drill was not found'],
  DRILL_OVER: [409, 'that house drill has ended'],
  DRILL_ALREADY_STARTED: [409, 'that house drill has already started'],
  DRILL_NOT_STARTED: [409, 'that house drill has not started yet'],
  NOT_DRILL_HOST: [403, 'only the drill host can do that'],
  NOT_INVITED: [403, "you're not in this house drill"],
  INVITE_EXPIRED: [410, 'that invite has expired'],
  NOT_YOUR_TURN: [409, "it's not your turn"],
  INVALID_FAMILY_LINK: [400, 'that family tree placement is not valid'],
  FAMILY_LINK_CONFLICT: [409, "someone can't be both your partner and your parent or child"],
  FAMILY_LINK_CYCLE: [409, "that would make someone their own ancestor"],
  FAMILY_TOO_MANY_PARENTS: [409, 'a person can have at most two parents'],
  FAMILY_TOO_MANY_CHILDREN: [409, 'a person can have at most 8 children on the tree'],
  FAMILY_PARTNER_TAKEN: [409, 'each person can have only one partner; remove the current one first'],
  FAMILY_TOO_MANY_FRIENDS: [409, 'a person can have at most 5 friends on the tree'],
  FAMILY_ALREADY_LINKED: [409, 'those two are already linked; remove that relationship first'],
  FAMILY_SIBLINGS: [409, "brothers and sisters are already family, so they can't be partners or friends"],
  FAMILY_LEVEL_CONFLICT: [409, "that doesn't fit the tree: a child sits one generation below each parent, and partners and friends sit on the same generation"],
};

const chatStatuses = {
  CHAT_ACCESS_DENIED: 403, INVALID_MESSAGE: 400, INVALID_CLIENT_KEY: 400,
  INVALID_CURSOR: 400, MESSAGE_KEY_REUSED: 409, CHAT_RATE_LIMITED: 429,
};

function houseFail(res, error) {
  if (!(error instanceof HouseError)) throw error;
  const [status, message] = HOUSE_ERRORS[error.code] ?? [400, 'house request failed'];
  if (error.retryAfterMs) res.set('Retry-After', String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))));
  return res.status(status).json({ error: message, code: error.code });
}

function chatFail(res, error) {
  const status = error instanceof ChatError ? chatStatuses[error.code] : null;
  if (!status) return fail(res, 500, 'Could not load/send messages.', error);
  if (status === 429) {
    res.set('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
  }
  return res.status(status).json({ error: 'Chat request failed.', code: error.code });
}

function validChatBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  return keys.length === 2 && keys.includes('text') && keys.includes('clientKey');
}

/** Run a house change for the signed-in user, ring, and answer with the fresh view. */
function houseRoute(change) {
  return async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    try {
      const result = await change(userId, req);
      await ring(result?.ring ?? []);
      return res.json(await getHouseView(userId));
    } catch (error) {
      return houseFail(res, error);
    }
  };
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
  const language = normalizeLanguage(res.req?.query?.lang);
  const page = educationalPage({
    ...options,
    language,
    title: pageText(language, options.title),
    heading: pageText(language, options.heading),
    message: pageText(language, options.message),
    confirmLabel: pageText(language, options.confirmLabel),
    confirmAction: options.confirmAction ? withLanguage(options.confirmAction, language) : options.confirmAction,
  });
  return res.status(page.status).type('html').send(page.html);
}

// Scam intel is opt-in. Off, empty, stale or broken all mean the same thing on the call
// path: the default persona, exactly as before intel existed. A lookup failure is logged
// and never stops a call being placed.
async function tacticForCall(preferences = null) {
  // Same content path as the SMS and email drills: a bulletin scam variant chosen for
  // this player's pre-survey (presurvey.js), worn as a fictional caller by call-tactic.js.
  try {
    const lesson = await getLessonForProfile(preferences);
    const tactic = tacticFromLesson(lesson);
    if (tactic) return { tactic, lesson };
  } catch (error) {
    console.error('[call] variant lookup failed; trying scraped intel:', error?.message || error);
  }
  // Scraped intel cards are the older, opt-in path and stay as a fallback.
  if (process.env.INTEL_ENABLED !== 'true') return { tactic: null, lesson: null };
  try {
    const cards = await listLiveTacticCards();
    const rendered = cards.map((card) => renderTactic(card)).filter(Boolean);
    if (rendered.length < cards.length) {
      console.error(`[intel] ${cards.length - rendered.length} stored tactic card(s) failed re-validation`);
    }
    return {
      tactic: rendered.length ? rendered[crypto.randomInt(rendered.length)] : null,
      lesson: null,
    };
  } catch (error) {
    console.error('[intel] tactic lookup failed; using the default persona:', error?.message || error);
    return { tactic: null, lesson: null };
  }
}

function intelRefreshSecret() {
  const secret = String(process.env.CRON_SECRET || '');
  return secret.length >= 32 ? secret : null;
}

// --- Read models -----------------------------------------------------------

api.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

// Called daily by a Vercel cron (vercel.json): a free-tier Supabase project pauses after
// a week without activity. It reveals nothing beyond reachability, so it needs no session.
api.get('/api/health/db', async (_req, res) => {
  try {
    await pingDb();
    return res.json({ ok: true });
  } catch (error) {
    return fail(res, 503, 'database unreachable', error);
  }
});

api.get('/api/me', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) return res.status(404).json({ error: 'unknown user' });
  return res.json(accountView(user));
});

// An individual (solo) drill round written for this player: real scam variants chosen by
// their pre-survey, with about one genuine message in five, in their app language. 503
// (the app then plays its fixed messages) when AI or the scam database is unavailable;
// questions that fail individually are simply left out and the app tops the round up.
api.post('/api/drills/solo-round', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const count = Math.min(10, Math.max(1, Math.floor(Number(req.body?.count) || 5)));
  if (!quizWriterConfigured()) return fail(res, 503, 'AI-written rounds are not configured');
  const lessons = await getUsableLessons();
  if (!lessons.length) return fail(res, 503, 'scam variants are unavailable');
  const presurvey = await getPresurveyOrNull(userId);
  const written = await writeQuizRound(planQuestions(lessons, presurvey, count), {
    language: normalizeLanguage(req.body?.language),
  });
  const scenarios = written
    .map((scenario, i) => (scenario ? { ...scenario, id: GENERATED_ID_BASE + i } : null))
    .filter(Boolean);
  if (!scenarios.length) return fail(res, 503, 'could not write a round right now');
  return res.json({ scenarios });
});

api.get('/api/drills/pending-result', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  res.json({ pending: await peekPendingResult(userId) });
});

api.post('/api/drills/pending-result/:resultId/ack', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const acknowledged = await ackPendingResult(userId, req.params.resultId);
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
  const userId = await requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await applyPracticeOutcomeOnce({
      userId,
      clientAttemptId,
      outcome,
      channel,
    });
    if (result.applied) await ringUser(userId);
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
      // The dev bypass returns a fixed code without texting anyone, so the
      // per-destination caps protect nothing here. Same reasoning as the
      // 'disabled' short-circuit above.
      skipDestinationLimit: verifyMode() === 'dev',
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
      const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      const wait = seconds >= 120 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds}s`;
      return res.status(429).json({
        error: error.reason === 'requester_hourly'
          ? `too many verification requests from this network; try again in ${wait}`
          : `too many codes sent to this number; try again in ${wait}`,
        reason: error.reason || 'rate_limited',
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
  const avatarInput = req.body?.avatar ?? null;
  const avatar = avatarInput == null ? null : cleanAvatar(avatarInput);

  if (!E164.test(phone) || !code) return res.status(400).json({ error: 'phone and code required' });
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email is not a valid address' });
  }
  // A name is needed only to create an account; a returning number keeps its own.
  if (name && !NAME_RE.test(name)) {
    return res.status(400).json({ error: 'name must use letters, spaces, apostrophes or hyphens' });
  }
  if (avatarInput != null && !avatar) return res.status(400).json({ error: 'avatar is invalid' });

  try {
    const approved = await checkVerification(phone, code);
    if (!approved) return res.status(401).json({ ok: false, error: 'incorrect or expired code' });
    let user;
    try {
      user = await registerVerifiedUser({ phone, name, email: email || undefined, avatar: avatar ?? undefined });
    } catch (error) {
      if (error?.code === 'NO_ACCOUNT') {
        return res.status(404).json({ code: 'NO_ACCOUNT', error: 'no account for this number yet' });
      }
      throw error;
    }
    await ringUser(user.id);
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
    const user = await setUserName(userId, name);
    await ringUser(userId);
    return res.json({ ok: true, user: accountView(user) });
  } catch (error) {
    return fail(res, 400, 'could not update name', error);
  }
});

// The pre-survey's answers, stored in safespace-prod (presurvey-store.js). Private:
// only the player reads or writes their own.
api.get('/api/me/presurvey', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  try {
    return res.json({ presurvey: await getPresurvey(userId) });
  } catch (error) {
    return fail(res, 503, 'pre-survey storage is unavailable', error);
  }
});

api.post('/api/me/presurvey', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  if (!cleanPresurvey(req.body?.presurvey)) {
    return res.status(400).json({ error: 'pre-survey responses are invalid' });
  }
  try {
    return res.json({ presurvey: await savePresurvey(userId, req.body.presurvey) });
  } catch (error) {
    return fail(res, 503, 'could not save your pre-survey answers', error);
  }
});

api.post('/api/me/avatar', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  if (!cleanAvatar(req.body?.avatar)) return res.status(400).json({ error: 'avatar is invalid' });
  const user = await setUserAvatar(userId, req.body.avatar);
  await ringUser(userId);
  return res.json({ ok: true, user: accountView(user) });
});

// A member's coin balance, furniture and layout are shared in their room view. Ring the
// house when any of those visible room details change; other inventory fields stay private.
api.post('/api/me/home-inventory', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  if (!cleanHomeInventory(req.body?.homeInventory)) {
    return res.status(400).json({ error: 'home inventory is invalid' });
  }
  const before = await getUser(userId);
  const user = await setUserHomeInventory(userId, req.body.homeInventory);
  const roomKey = (u) => JSON.stringify(u ? [roomView(u).items, roomView(u).layout, roomView(u).coins] : null);
  if (roomKey(before) !== roomKey(user)) await ringUser(userId);
  return res.json({ ok: true, user: accountView(user) });
});

// The room's look (colours, wallpaper, floor, name) is shown to the whole house.
api.post('/api/me/room-style', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  if (!cleanRoomStyle(req.body?.roomStyle)) {
    return res.status(400).json({ error: 'room style is invalid' });
  }
  const user = await setUserRoomStyle(userId, req.body.roomStyle);
  await ringUser(userId);
  return res.json({ ok: true, user: accountView(user) });
});

// --- Houses -------------------------------------------------------------------

api.get('/api/house', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  return res.json(await getHouseView(userId));
});

api.post('/api/house', houseRoute((userId, req) => createHouse(userId, req.body?.name)));
api.post('/api/house/join', houseRoute((userId, req) =>
  joinHouse(userId, req.body?.code, { requesterKey: requesterKey(req) })));
api.post('/api/house/code', houseRoute((userId) => regenerateInviteCode(userId)));
api.post('/api/house/name', houseRoute((userId, req) => renameHouse(userId, req.body?.name)));
api.post('/api/house/members/:memberId/remove', houseRoute((userId, req) =>
  removeMember(userId, req.params.memberId)));
api.post('/api/house/leave', houseRoute((userId) => leaveHouse(userId)));
api.post('/api/house/switch', houseRoute((userId, req) => switchHouse(userId, req.body?.houseId)));
api.post('/api/house/family', houseRoute((userId, req) => setFamilyLink(userId, req.body?.family)));
// Any member edits the shared tree: { edits: [ {kind, ...}, ... ] } (see family-rules.js).
api.post('/api/house/family/edit', houseRoute((userId, req) => editFamilyTree(userId, req.body?.edits)));

api.get('/api/house/drill', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  return res.json(await getHouseDrill(userId));
});

/** Run a house-drill change, ring the house, and answer with that drill's fresh view. */
function drillRoute(change) {
  return async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    try {
      const result = await change(userId, req);
      await ring(result.ring);
      return res.json(await getHouseDrill(userId, { drillId: result.drillId }));
    } catch (error) {
      return houseFail(res, error);
    }
  };
}

api.post('/api/house/drill', drillRoute((userId, req) =>
  createHouseDrill(userId, { perPlayer: req.body?.perPlayer, mode: req.body?.mode ?? 'turns' })));
api.post('/api/house/drill/:drillId/respond', drillRoute((userId, req) =>
  respondToHouseDrill(userId, req.params.drillId, req.body?.accept === true)));
/**
 * AI-written questions for a house drill that is about to start, or null. In turns mode
 * each turn is written from its answering player's pre-survey; in a race everyone answers
 * the same questions, so they cycle through every player's pre-survey. `fallbackIds` are
 * the fixed messages the host's phone chose; any question that couldn't be written keeps
 * its fixed message. Only the host of a lobby triggers this, so others can't spend calls.
 */
async function writeHouseDrillQuestions(userId, drillId, fallbackIds, language) {
  if (!quizWriterConfigured() || !Array.isArray(fallbackIds)) return null;
  const { drill } = await getHouseDrill(userId, { drillId });
  if (!drill || drill.hostId !== String(userId) || drill.status !== 'lobby') return null;
  const lessons = await getUsableLessons();
  if (!lessons.length) return null;
  const playing = drill.players.filter((p) => p.status === 'accepted');
  if (!playing.length) return null;
  const surveys = await Promise.all(playing.map((p) => getPresurveyOrNull(p.id)));

  // The same slot order startHouseDrill uses: race = perPlayer shared questions; turns =
  // round by round, one per player.
  const owners = drill.mode === 'race'
    ? Array.from({ length: drill.perPlayer }, (_, i) => i % playing.length)
    : Array.from({ length: drill.perPlayer * playing.length }, (_, i) => i % playing.length);
  if (owners.length !== fallbackIds.length) return null;
  const specs = new Array(owners.length);
  playing.forEach((_, playerIndex) => {
    const slots = owners.flatMap((owner, slot) => (owner === playerIndex ? [slot] : []));
    planQuestions(lessons, surveys[playerIndex], slots.length).forEach((spec, k) => { specs[slots[k]] = spec; });
  });
  const written = await writeQuizRound(specs, { language });
  if (!written.some(Boolean)) return null;
  const scenarios = {};
  const ids = written.map((scenario, slot) => {
    if (!scenario) return fallbackIds[slot];
    const id = GENERATED_ID_BASE + slot;
    scenarios[id] = { ...scenario, id };
    return id;
  });
  return { ids, scenarios };
}

api.post('/api/house/drill/:drillId/start', drillRoute(async (userId, req) => {
  const fallbackIds = req.body?.scenarioIds;
  const written = await writeHouseDrillQuestions(
    userId, req.params.drillId, fallbackIds, normalizeLanguage(req.body?.language),
  ).catch((error) => {
    console.error('[house-drill] could not write questions:', error?.message || error);
    return null;
  });
  return written
    ? startHouseDrill(userId, req.params.drillId, written.ids, { scenarios: written.scenarios })
    : startHouseDrill(userId, req.params.drillId, fallbackIds);
}));
api.post('/api/house/drill/:drillId/answer', drillRoute((userId, req) =>
  answerHouseDrill(userId, req.params.drillId, req.body)));
api.post('/api/house/drill/:drillId/skip', drillRoute((userId, req) =>
  skipHouseDrillTurn(userId, req.params.drillId, req.body?.turn)));
api.post('/api/house/drill/:drillId/continue', drillRoute((userId, req) =>
  continueHouseDrill(userId, req.params.drillId, req.body?.turn, { force: req.body?.force === true })));
api.post('/api/house/drill/:drillId/leave', drillRoute((userId, req) =>
  leaveHouseDrill(userId, req.params.drillId)));

api.get('/api/houses/:houseId/chat/messages', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  try {
    const result = await listMessages(userId, req.params.houseId, {
      before: req.query.before,
      after: req.query.after,
    });
    return res.json(result);
  } catch (error) {
    return chatFail(res, error);
  }
});

api.post('/api/houses/:houseId/chat/messages', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  try {
    if (!validChatBody(req.body)) throw new ChatError('INVALID_MESSAGE');
    const result = await sendMessage(userId, req.params.houseId, req.body);
    await ring([result.topic]);
    return res.status(result.created ? 201 : 200).json({ message: result.message });
  } catch (error) {
    return chatFail(res, error);
  }
});

// Asked by the sender's app right after a message is saved, so sending never waits on
// OpenAI. Answers with Pixi's reply, or { message: null } when Pixi stays quiet.
api.post('/api/houses/:houseId/chat/messages/:messageId/pixi-reply', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  try {
    const result = await replyAsPixi(userId, req.params.houseId, req.params.messageId);
    if (result.message) await ring([result.topic]);
    return res.json({ message: result.message });
  } catch (error) {
    return chatFail(res, error);
  }
});

api.post('/api/drills/house-run', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const body = req.body || {};
  try {
    const result = await recordHouseRun(userId, {
      clientKey: body.clientKey,
      correct: body.correct,
      cautious: body.cautious,
      wrong: body.wrong,
    });
    if (result.status === 'completed') await ringUser(userId);
    return res.json({ status: result.status, run: result.run, user: accountView(result.user) });
  } catch (error) {
    return houseFail(res, error);
  }
});

api.post('/api/me/phone/detach', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in to remove your verified phone' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });
  try {
    // Detaching also leaves the house, so the housemates who stay need the ring — after
    // the commit, never inside the transaction.
    const { ring: topics } = await detachVerifiedPhone(userId);
    await ring(topics);
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
  const language = normalizeLanguage(req.body?.language);
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
    const verificationUrl = withLanguage(createEmailVerificationUrl(userId, verificationId), language);
    await sendEmailOwnershipVerification({ to: email, name: user.name, verificationUrl, language });
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

/**
 * The lesson kept with an email drill: the bulletin variant's, with its words replaced by
 * the writer's translation for the player's language. English bulletin fields with no
 * translation are dropped for other languages so the reveal page never mixes languages.
 */
function drillLesson(variant, translated, language) {
  const english = language === 'en';
  return {
    variantId: variant.variantId,
    language,
    scamName: translated?.scamName || (english ? variant.scamName : null),
    variantName: english ? variant.variantName : null,
    redFlags: translated?.redFlags?.length ? translated.redFlags : (english ? variant.redFlags : []),
    preventionAdvice: translated?.advice || (english ? variant.preventionAdvice : null),
    verificationMethod: english ? variant.verificationMethod : null,
  };
}

const CHANNEL_LABELS = { call: 'Call', sms: 'SMS', email: 'Email' };

/**
 * The player's survey answers when `channel` is one they allow, otherwise sends a 403
 * and returns undefined. Channels are a hard limit; no saved answers allow everything.
 */
async function preferencesAllowing(res, userId, channel) {
  const preferences = await getPresurveyOrNull(userId);
  if (channelAllowed(preferences, channel)) return preferences;
  res.status(403).json({
    error: `${CHANNEL_LABELS[channel]} drills are turned off in your drill preferences`,
    code: 'CHANNEL_DISABLED',
  });
  return undefined;
}

api.post('/api/drills/fire', async (req, res) => {
  const userId = await sessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'sign in (verify your phone) to run a real drill' });
  const user = await getUser(userId);
  if (!user) return res.status(401).json({ error: 'session no longer valid' });
  if (!user.consentToDrills) return res.status(403).json({ error: 'user has not consented to drills' });
  if (!user.phone) return res.status(400).json({ error: 'no verified phone on file' });
  const preferences = await preferencesAllowing(res, userId, 'call');
  if (preferences === undefined) return;
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

  const { tactic, lesson: variant } = await tacticForCall(preferences);
  // The call has no written copy to translate, so the lesson kept on the attempt is the
  // variant's own; the reveal page and result screen then teach the scam that was run.
  const lesson = variant ? drillLesson(variant, null, 'en') : null;
  const scamVariantId = variant ? variant.variantId : null;
  let call;
  try {
    call = await fireDrillCall({
      toNumber: user.phone,
      name: user.name,
      attemptId: attempt.id,
      tactic,
    });
    if (!call?.id) throw new Error('Vapi accepted the request without a call id');
  } catch (error) {
    if (error instanceof VapiDeliveryUnconfirmed || error?.code === 'VAPI_DELIVERY_UNCONFIRMED') {
      try {
        await markDrillAttemptSent(attempt.id, { scamVariantId, lesson });
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
    await markDrillAttemptSent(attempt.id, { providerId: call.id, scamVariantId, lesson });
  } catch (error) {
    // The call is already live and carries the attempt id in Vapi metadata, so do not
    // tell the user to retry and accidentally place a second call.
    console.error('[api] call placed but sent-state persistence failed:', error?.message || error);
  }
  return res.json({
    ok: true,
    drillId: attempt.id,
    callId: call.id,
    status: call.status,
    tactic: tactic ? tactic.card : null,
  });
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
  const preferences = await preferencesAllowing(res, userId, 'email');
  if (preferences === undefined) return;
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

  // A real scam variant from the bulletins, chosen for the player's pre-survey
  // (presurvey.js), written up by OpenAI as an email relatable to what they practise and
  // regularly do, in their app language. The lesson (red flags, advice) comes back in
  // that language too and is kept on the attempt, so the reveal page, the result screen,
  // Pixi and the safety follow-up teach the same scam in the same language. Asking for a
  // template scenario, or any failure, sends a fixed template.
  const language = normalizeLanguage(req.body?.language);
  const variant = req.body?.scenario ? null : await getLessonForProfile(preferences);
  const content = variant ? await writeDrillEmail(variant, { language, presurvey: preferences }) : null;
  const lesson = content ? drillLesson(variant, content.lesson, language) : null;
  const scamVariantId = content ? variant.variantId : null;
  const scenarioId = content ? GENERATED_SCENARIO_ID : pickEmailScenario(req.body?.scenario).id;
  let output;
  try {
    const links = createEmailDrillLinks(attempt.id);
    output = await sendDrillEmail({
      to: user.email,
      name: user.name,
      scenarioId,
      revealUrl: withLanguage(links.revealUrl, language),
      reportUrl: withLanguage(links.reportUrl, language),
      language,
      content,
      lesson,
    });
  } catch (error) {
    if (error?.code === 'EMAIL_DELIVERY_UNCONFIRMED') {
      try {
        await markDrillAttemptSent(attempt.id, { scenarioId, scamVariantId, lesson, language });
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
    await markDrillAttemptSent(attempt.id, { scenarioId: output.scenarioId, scamVariantId, lesson, language });
  } catch (error) {
    // Both the bait and its durable reveal are already accepted. Preserve the live
    // attempt so either signed action can still complete it; a retry could double-send.
    console.error('[api] email sent but sent-state persistence failed:', error?.message || error);
  }
  return res.json({
    ok: true,
    drillId: attempt.id,
    scenarioId: output.scenarioId,
    // The lesson in the player's language, for the in-app result screen.
    scenario: lesson
      ? { ...output.scenario, flags: lesson.redFlags, advice: lesson.preventionAdvice }
      : output.scenario,
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
  const preferences = await preferencesAllowing(res, userId, 'sms');
  if (preferences === undefined) return;
  // No drill links are needed: an SMS drill carries no URL (sms.js).
  if (!smsConfigured()) {
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

  // The same content path as the email drill: a real scam variant from the bulletins,
  // chosen for the player's pre-survey (presurvey.js), written up by OpenAI as a text
  // relatable to what they practise and regularly do, in their app language. The lesson
  // comes back in that language and is kept on the attempt, so the reveal page, the
  // result screen and Pixi teach the same scam. Asking for a named scenario, or any
  // failure along the way, falls back to a curated scenario from sms.js.
  const language = normalizeLanguage(req.body?.language);
  const variant = req.body?.scenario ? null : await getLessonForProfile(preferences);
  const content = variant ? await writeDrillSms(variant, { language, presurvey: preferences }) : null;
  const lesson = content ? drillLesson(variant, content.lesson, language) : null;
  const scamVariantId = content ? variant.variantId : null;

  let output;
  try {
    output = await sendDrillSms({
      to: user.phone,
      name: user.name,
      scenarioId: req.body?.scenario,
      language,
      content,
    });
  } catch (error) {
    if (error?.code === 'SMS_DELIVERY_UNCONFIRMED') {
      try {
        await markDrillAttemptSent(attempt.id, { scamVariantId, lesson, language });
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
    await markDrillAttemptSent(attempt.id, {
      providerId: output.sid, scenarioId: output.scenarioId, scamVariantId, lesson, language,
    });
    // The bait is the first turn of the exchange, so a reply the person sends has the
    // opening text as context and counts against the same cap (sms-reply.js).
    await appendSmsTurn(attempt.id, { role: 'scammer', text: output.baitText });
  } catch (error) {
    console.error('[api] SMS sent but sent-state persistence failed:', error?.message || error);
  }
  return res.json({
    ok: true,
    drillId: attempt.id,
    scenarioId: output.scenarioId,
    // The lesson in the player's language, for the in-app result screen.
    lesson: lesson ? { flags: lesson.redFlags, advice: lesson.preventionAdvice } : null,
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
  if (result.applied) await ringUser(result.record.userId);
  return res.json({
    ok: true,
    status: result.status,
    applied: result.applied,
    record: result.record,
    user: result.user ? publicUser(result.user) : null,
  });
});

function sendDrillEndedPage(res) {
  return sendEducationalPage(res, {
    title: 'Drill ended',
    heading: 'This drill has ended',
    message: 'This drill is already over, so its links no longer work and nothing was recorded. Open SafeSpace to see your result or start a new drill.',
    status: 410,
  });
}

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
  // Once a drill is over (completed, or failed/unscored) its email and SMS links stop
  // working: no confirm button, no second result, no replayed lesson.
  if (attempt.status === 'completed' || attempt.status === 'failed') {
    return sendDrillEndedPage(res);
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
  if (completion.applied) await ringUser(completion.record.userId);
  // Another click finished the drill between the check above and this one.
  if (completion.status !== 'completed') return sendDrillEndedPage(res);
  const lesson = attempt.lesson ?? await getLessonByVariantId(attempt.scamVariantId);
  if (action === 'report') {
    // Reported it → SUCCESS.
    return sendEducationalPage(res, {
      variant: 'win',
      title: 'Drill passed — you reported it',
      heading: 'Good catch. This was a SafeSpace drill.',
      message: 'That message was fake, and you did the right thing. Reporting it and checking through an official app or number you find yourself is the reflex that beats real scams.',
      lesson,
    });
  }
  // Clicked the link → FAILURE. This is the teaching moment.
  return sendEducationalPage(res, {
    variant: 'lose',
    title: 'Gotcha — this was a SafeSpace drill',
    heading: 'Gotcha — this was a SafeSpace drill',
    message: 'The message and the organisation were fictional, so you are completely safe. But in a real scam, that click is the moment you would have handed over your details or money. Next time: stop, and check through an official app, number, or website you find yourself — never the link in the message.',
    lesson,
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

// --- Inbound SMS: the drill replies in character ----------------------------
// Twilio posts form-encoded, not JSON, so this route brings its own parser. The reply
// goes back as TwiML in the response body, which costs no extra API call.
//
// The scheduled reveal from sms.js is NOT cancelled when the drill reveals here: an
// extra "you are safe" text is harmless, and a missed one is not.
const twilioForm = express.urlencoded({ extended: false, limit: '64kb' });

function twiml(message) {
  if (!message) return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  const escaped = String(message).replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ));
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

const sendTwiml = (res, message) => res.type('text/xml').send(twiml(message));

app.post(INBOUND_SMS_PATH, twilioForm, asyncRoute(async (req, res) => {
  if (!inboundWebhookConfigured()) return fail(res, 503, 'inbound SMS is not configured');
  const ok = verifyTwilioSignature({
    url: inboundWebhookUrl(),
    params: req.body || {},
    signature: req.get('x-twilio-signature') || '',
    authToken: process.env.TWILIO_AUTH_TOKEN,
  });
  if (!ok) return fail(res, 401, 'invalid webhook signature');

  const from = String(req.body?.From || '').trim();
  const inbound = String(req.body?.Body || '').trim();
  // A text from someone with no drill running gets no reply at all. Answering a stranger
  // would mean sending scam-shaped text to a number that never consented to one.
  const user = from ? await getUserByPhone(from) : null;
  const attempt = user ? await findLiveSmsAttempt(user.id) : null;
  if (!attempt) return sendTwiml(res, null);

  // Recorded when the bait was sent. `lesson` only carries one when a model wrote the
  // copy, so a curated scenario would otherwise always be revealed in English.
  const language = normalizeLanguage(attempt.language || attempt.lesson?.language);
  await appendSmsTurn(attempt.id, { role: 'target', text: inbound });

  let turn;
  try {
    turn = await nextSmsTurn({
      inbound,
      history: attempt.smsTurns || [],
      lesson: attempt.lesson || null,
      language,
    });
  } catch (error) {
    // Never leave someone mid-scam because our own code threw.
    console.error('[sms-reply] turn failed; revealing:', error?.message || error);
    turn = { text: null, reveal: true, outcome: 'disengaged' };
  }

  if (!turn.reveal && turn.text) {
    await appendSmsTurn(attempt.id, { role: 'scammer', text: turn.text });
    return sendTwiml(res, turn.text);
  }

  const reveal = REVEAL_TEXTS[language] || REVEAL_TEXTS.en;
  try {
    const result = await completeDrillAttempt({
      attemptId: attempt.id,
      outcome: turn.outcome || 'disengaged',
    });
    if (result.applied) await ringUser(result.record.userId);
  } catch (error) {
    // The reveal still goes out: being told you are safe matters more than the score.
    console.error('[sms-reply] could not record the outcome:', error?.message || error);
  }
  return sendTwiml(res, reveal);
}));

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
    if (result.applied) await ringUser(result.record.userId);
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

// --- Scam intel refresh -----------------------------------------------------
// GET is what Vercel Cron sends, with "Authorization: Bearer $CRON_SECRET"; POST is the
// same job as a manual demo trigger. Both need the secret, because a refresh spends model
// tokens and fetches third-party sites. The job is imported on demand so the Claude SDK is
// never loaded on the call path.
async function handleIntelRefresh(req, res) {
  const secret = intelRefreshSecret();
  if (!secret) return fail(res, 503, 'intel refresh not configured');
  if (!timingSafeEqualStr(req.get('authorization') || '', `Bearer ${secret}`)) {
    return fail(res, 401, 'unauthorized');
  }
  try {
    const { runIntelRefresh } = await import('./intel/refresh.js');
    return res.json({ ok: true, ...(await runIntelRefresh()) });
  } catch (error) {
    if (error?.code === 'INTEL_UNAVAILABLE') return fail(res, 503, 'intel refresh not configured', error);
    return fail(res, 500, 'intel refresh failed', error);
  }
}

api.get('/api/intel/refresh', handleIntelRefresh);
api.post('/api/intel/refresh', handleIntelRefresh);

// Offline-only helper. It is absent unless explicitly enabled and still validates the
// same outcome vocabulary as production paths.
if (process.env.ENABLE_DEMO_ROUTES === 'true') {
  console.warn('[demo] /api/drills/simulate enabled — NEVER enable in production.');
  api.post('/api/drills/simulate', async (req, res) => {
    const outcome = String(req.body?.outcome || 'disengaged').trim();
    if (!OUTCOMES.has(outcome)) return res.status(400).json({ error: 'unknown drill outcome' });
    const userId = await requireUserId(req, res);
    if (!userId) return;
    try {
      const result = await applyOutcome({
        userId,
        outcome,
        channel: 'call',
        practice: false,
      });
      await ringUser(userId);
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
  const HOST = process.env.HOST || undefined;
  app.listen(PORT, HOST, () => {
    console.log(`SafeSpace backend on http://${HOST || 'localhost'}:${PORT}`);
    void warmScamVariants();
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
