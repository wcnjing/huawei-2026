// Pure outcome -> result/XP mapping. No I/O, so it's unit-testable in isolation.
// This is the single rule that both real calls (via the Vapi webhook) and in-app
// practice drills run through, so scoring stays consistent across entry points.

export const FULL_XP = 100;
export const PARTIAL_XP = 50;
export const PRACTICE_FACTOR = 0.5; // practice drills award half XP of a real surprise call

// Normalised outcome vocabulary (real call + sms/email + practice all map onto these).
// win:      resisted cleanly            -> result-win, full XP, streak++
// partial:  engaged but caught it in time-> result-win, partial XP, streak++
// loss:     complied / shared data      -> result-lose, 0 XP, streak reset
// safe-exit: distress off-ramp fired    -> neutral, no XP, streak untouched (never punish distress)
const OUTCOME_KIND = {
  // wins
  hung_up: 'win',
  disengaged: 'win',
  verified: 'win',
  reported: 'win',
  'asked-family': 'win',
  closed_page: 'win',
  cancelled_download: 'win',
  // partial wins (caught a red flag but engaged first)
  caught_flag: 'partial',
  // losses
  complied: 'loss',
  shared_data: 'loss',
  clicked_link: 'loss',
  submitted_details: 'loss',
  opened_attachment: 'loss',
  // safety off-ramp — deliberately not scored
  distress_offramp: 'safe-exit',
};

/**
 * @param {string} outcome  one of OUTCOME_KIND keys
 * @param {{practice?: boolean}} opts
 * @returns {{result:'WON'|'LOST'|'SAFE', screen:string|null, xp:number, streak:'inc'|'reset'|'none'}}
 */
export function computeResult(outcome, opts = {}) {
  const kind = OUTCOME_KIND[outcome] ?? 'win'; // unknown -> treat as a benign win, never punish
  const factor = opts.practice ? PRACTICE_FACTOR : 1;

  switch (kind) {
    case 'win':
      return { result: 'WON', screen: 'result-win', xp: Math.round(FULL_XP * factor), streak: 'inc' };
    case 'partial':
      return { result: 'WON', screen: 'result-win', xp: Math.round(PARTIAL_XP * factor), streak: 'inc' };
    case 'loss':
      return { result: 'LOST', screen: 'result-lose', xp: 0, streak: 'reset' };
    case 'safe-exit':
      return { result: 'SAFE', screen: null, xp: 0, streak: 'none' };
    default:
      return { result: 'WON', screen: 'result-win', xp: Math.round(FULL_XP * factor), streak: 'inc' };
  }
}

export const KNOWN_OUTCOMES = Object.keys(OUTCOME_KIND);
