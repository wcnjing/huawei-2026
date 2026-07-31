import crypto from 'crypto';

const ACTIONS = new Set(['reveal', 'report']);
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;

function secret() {
  return process.env.DRILL_LINK_SECRET || '';
}

function actionOrigin() {
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

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signature(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function drillLinksConfigured() {
  return secret().length >= 32 && Boolean(actionOrigin());
}

export function createDrillActionToken(
  { attemptId, action },
  { now = Date.now(), ttlSeconds = DEFAULT_TTL_SECONDS } = {},
) {
  if (!drillLinksConfigured()) {
    throw new Error('DRILL_LINK_SECRET (32+ chars) and PUBLIC_URL are required');
  }
  if (!attemptId || !ACTIONS.has(action)) throw new Error('invalid drill action token request');

  const payload = encode({
    v: 1,
    attemptId,
    action,
    exp: Math.floor(now / 1000) + ttlSeconds,
  });
  return `${payload}.${signature(payload)}`;
}

export function verifyDrillActionToken(token, expectedAction, { now = Date.now() } = {}) {
  if (!secret() || !ACTIONS.has(expectedAction) || typeof token !== 'string') return null;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra || !safeEqual(signature(payload), suppliedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      parsed?.v !== 1
      || parsed?.action !== expectedAction
      || !parsed?.attemptId
      || !Number.isFinite(parsed?.exp)
      || parsed.exp < Math.floor(now / 1000)
    ) return null;
    return { attemptId: String(parsed.attemptId), action: parsed.action };
  } catch {
    return null;
  }
}

export function createEmailDrillLinks(attemptId) {
  const base = actionOrigin();
  const reveal = createDrillActionToken({ attemptId, action: 'reveal' });
  const report = createDrillActionToken({ attemptId, action: 'report' });
  return {
    revealUrl: `${base}/drill-reveal?token=${encodeURIComponent(reveal)}`,
    reportUrl: `${base}/drill-report?token=${encodeURIComponent(report)}`,
  };
}

export function createEmailVerificationToken(
  { userId, verificationId },
  { now = Date.now(), ttlSeconds = 30 * 60 } = {},
) {
  if (!drillLinksConfigured()) {
    throw new Error('DRILL_LINK_SECRET (32+ chars) and PUBLIC_URL are required');
  }
  const opaqueId = String(verificationId || '').trim();
  if (!userId || opaqueId.length < 32) {
    throw new Error('userId and an opaque verificationId are required');
  }

  const payload = encode({
    v: 1,
    purpose: 'email-verification',
    userId: String(userId),
    verificationId: opaqueId,
    exp: Math.floor(now / 1000) + ttlSeconds,
  });
  return `${payload}.${signature(payload)}`;
}

export function verifyEmailVerificationToken(token, { now = Date.now() } = {}) {
  if (!secret() || typeof token !== 'string') return null;
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra || !safeEqual(signature(payload), suppliedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      parsed?.v !== 1
      || parsed?.purpose !== 'email-verification'
      || !parsed?.userId
      || typeof parsed?.verificationId !== 'string'
      || parsed.verificationId.length < 32
      || !Number.isFinite(parsed?.exp)
      || parsed.exp < Math.floor(now / 1000)
    ) return null;
    return {
      userId: String(parsed.userId),
      verificationId: String(parsed.verificationId),
    };
  } catch {
    return null;
  }
}

export function createEmailVerificationUrl(userId, verificationId) {
  const base = actionOrigin();
  const token = createEmailVerificationToken({ userId, verificationId });
  return `${base}/email-verify?token=${encodeURIComponent(token)}`;
}
