// How long a channel must rest between real drills.
//
// The baseline is a plain rate limit. SMS and email also carry a hard floor: their
// safety follow-up is scheduled for later, so re-firing before it lands would leave a
// person holding two baits and no reveal yet. The floor keeps the order honest.
//
// Dev mode is the one exception; see realDrillCooldownMs.

import { resolveRevealDelay } from './sms.js';
import { resolveEmailFollowupDelay } from './email.js';
import { isDevMode } from './verify.js';

export const DEFAULT_REAL_DRILL_COOLDOWN_MS = 5 * 60 * 1000;
const MIN_CONFIGURABLE_COOLDOWN_MS = 5_000;

/**
 * The cooldown for `channel`, in ms, or 0 when drills may be re-fired immediately.
 *
 * Dev mode (verify.js: ALLOW_DEV_VERIFY, or the UNSAFE_FORCE_DEV_VERIFY escape hatch)
 * returns 0 so a demo can fire the same channel over and over without waiting. Note that
 * a zero cooldown also lifts the one-active-attempt lock in createDrillAttempt, which
 * skips its whole window check — fine for a demo, never for real use. Dev mode already
 * means phone ownership is not being checked, so this grants nothing new to an attacker,
 * but it does mean a forced bypass left on in production removes drill rate limiting too.
 */
export function realDrillCooldownMs(channel) {
  if (isDevMode()) return 0;
  const configured = Number(process.env.REAL_DRILL_COOLDOWN_MS);
  const baseline = Number.isFinite(configured) && configured >= MIN_CONFIGURABLE_COOLDOWN_MS
    ? configured
    : DEFAULT_REAL_DRILL_COOLDOWN_MS;
  if (channel === 'sms') return Math.max(baseline, resolveRevealDelay());
  if (channel === 'email') return Math.max(baseline, resolveEmailFollowupDelay());
  return baseline;
}
