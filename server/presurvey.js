// The pre-survey: the questions a new player answers at onboarding (and can change in
// Settings → Preferences), in src/app/screens/auth/PresurveyScreen.tsx. Answers are
// stored in safespace-prod by presurvey-store.js. This module cleans them and turns them
// into the scam topics drills are written about.
//
// Two answers steer drill content:
//   "What would you like to practise?"  → the player's picked topics (`interests`)
//   "What do you regularly do?"         → topics their everyday life exposes them to
// Each topic maps to bulletin scam types (scams.scam_name / scam_category) via
// THEME_SCAM_TYPES. A drill picks a TOPIC, then a random variant within it, so a topic
// with one bulletin variant counts as much as one with ten:
//   ~20%  any variant, so people still meet scams outside their bubble
//         ("Occasionally show other scam types" off turns this off);
//   else  topics both picked AND lived (overlap) 60%, other picked topics 25%, other
//         activity topics 15%, re-shared among whichever of those exist.
// With no answers, or nothing matching, it is random. Age and situation are kept but do
// not steer content.
//
// Channels are a hard limit: a channel the player unticked never runs a real drill.
//
// The option lists mirror src/app/data/presurvey.ts; keep them in sync.

export const AGE_RANGES = ['Under 18', '18–24', '25–34', '35–49', '50–64', '65+'];
export const SITUATIONS = ['Student', 'Working', 'Self-employed', 'Looking for work', 'Retired', 'Other'];
export const CHANNELS = ['call', 'sms', 'email'];
// Topic id → its label on the pre-survey screen (also what the AI writers are told).
export const INTEREST_LABELS = {
  shopping: 'Shopping & marketplaces',
  jobs: 'Jobs & recruitment',
  investment: 'Investment & finance',
  government: 'Government & authority',
  friends: 'Friends & impersonation',
  prizes: 'Prizes & lucky draws',
  phishing: 'Phishing & account safety',
  tech: 'Tech support',
  education: 'Education',
  tickets: 'Tickets & events',
};
export const INTEREST_IDS = Object.keys(INTEREST_LABELS);
export const ACTIVITY_LABELS = {
  shopping: 'Shop online',
  social: 'Use social media',
  investing: 'Invest or trade',
  job_search: 'Search for jobs',
  tickets: 'Buy event tickets',
  banking: 'Use online banking',
};
// Activity id → the themes it makes relevant (same table as the app's ACTIVITIES).
export const ACTIVITY_THEMES = {
  shopping: ['shopping'],
  social: ['prizes', 'phishing', 'friends'],
  investing: ['investment'],
  job_search: ['jobs'],
  tickets: ['tickets', 'shopping'],
  banking: ['phishing', 'government'],
};

// Theme → bulletin scam types, matched against "scam_name scam_category". Edit these
// when a new bulletin brings a scam type no theme covers.
export const THEME_SCAM_TYPES = {
  shopping: /e-?commerce|online shopping|marketplace/i,
  jobs: /\bjob|money mule|recruit/i,
  investment: /investment/i,
  government: /government/i,
  friends: /fake friend|^impersonation/i,
  prizes: /lucky draw|prize|giveaway/i,
  phishing: /phishing/i,
  tech: /tech(nical)? support/i,
  education: /school fee|scholarship|education/i,
  tickets: /ticket|concert/i,
};

export const DEFAULT_PRESURVEY = {
  ageRange: '',
  situation: '',
  activities: [],
  interests: [],
  channels: [...CHANNELS],
  includeOtherTypes: true,
  completed: false,
};

const EXPLORE_SHARE = 0.2;
const TIER_SHARES = { overlap: 0.6, picked: 0.25, lived: 0.15 };

const pickFrom = (allowed) => (value) => (Array.isArray(value)
  ? [...new Set(value.filter((item) => allowed.includes(item)))]
  : []);

/** The survey answers in their stored shape, or null when the input is not an object. */
export function cleanPresurvey(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  return {
    ageRange: AGE_RANGES.includes(input.ageRange) ? input.ageRange : '',
    situation: SITUATIONS.includes(input.situation) ? input.situation : '',
    activities: pickFrom(Object.keys(ACTIVITY_THEMES))(input.activities),
    interests: pickFrom(INTEREST_IDS)(input.interests),
    channels: Array.isArray(input.channels) ? pickFrom(CHANNELS)(input.channels) : [...CHANNELS],
    includeOtherTypes: typeof input.includeOtherTypes === 'boolean' ? input.includeOtherTypes : true,
    completed: input.completed === true,
  };
}

/** True unless the player unticked this channel. No saved answers allow everything. */
export function channelAllowed(preferences, channel) {
  return !preferences || preferences.channels.includes(channel);
}

/**
 * { picked, lived }: topics from "What would you like to practise?" and topics from
 * "What do you regularly do?".
 */
export function profileThemes(preferences) {
  const picked = new Set(preferences?.interests ?? []);
  const lived = new Set();
  for (const activity of preferences?.activities ?? []) {
    for (const theme of ACTIVITY_THEMES[activity] ?? []) lived.add(theme);
  }
  return { picked, lived };
}

/** What the AI writers are told about the player: labels only, no personal details. */
export function presurveyBrief(preferences) {
  return {
    wantsToPractise: (preferences?.interests ?? []).map((id) => INTEREST_LABELS[id]).filter(Boolean),
    regularlyDoes: (preferences?.activities ?? []).map((id) => ACTIVITY_LABELS[id]).filter(Boolean),
  };
}

/** The themes a lesson (scam-variants.js) belongs to, from its scam type. */
export function lessonThemes(lesson) {
  const type = `${lesson?.scamName ?? ''} ${lesson?.scamCategory ?? ''}`.trim();
  return Object.keys(THEME_SCAM_TYPES).filter((theme) => THEME_SCAM_TYPES[theme].test(type));
}

const pickOne = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];

/** The player's topics that have variants, grouped by tier, with each topic's variants. */
function tiersFor(lessons, preferences) {
  const { picked, lived } = profileThemes(preferences);
  const byTheme = new Map();
  for (const lesson of lessons) {
    for (const theme of lessonThemes(lesson)) {
      if (!picked.has(theme) && !lived.has(theme)) continue;
      if (!byTheme.has(theme)) byTheme.set(theme, []);
      byTheme.get(theme).push(lesson);
    }
  }
  const themes = [...byTheme.keys()];
  return {
    byTheme,
    tiers: {
      overlap: themes.filter((t) => picked.has(t) && lived.has(t)),
      picked: themes.filter((t) => picked.has(t) && !lived.has(t)),
      lived: themes.filter((t) => !picked.has(t) && lived.has(t)),
    },
  };
}

/** One lesson for this player's next drill, or null when there are none. */
export function pickLessonForProfile(lessons, preferences, random = Math.random) {
  if (!lessons?.length) return null;
  if (!preferences) return pickOne(lessons, random);
  const { byTheme, tiers } = tiersFor(lessons, preferences);
  const available = Object.keys(TIER_SHARES).filter((tier) => tiers[tier].length);
  if (!available.length) return pickOne(lessons, random);
  if (preferences.includeOtherTypes && random() < EXPLORE_SHARE) return pickOne(lessons, random);

  const total = available.reduce((sum, tier) => sum + TIER_SHARES[tier], 0);
  let draw = random() * total;
  let tier = available[available.length - 1];
  for (const name of available) {
    draw -= TIER_SHARES[name];
    if (draw < 0) { tier = name; break; }
  }
  return pickOne(byTheme.get(pickOne(tiers[tier], random)), random);
}

/**
 * `count` lessons for a quiz round, chosen like pickLessonForProfile but avoiding
 * repeats while there are unused variants left.
 */
export function pickLessonsForProfile(lessons, preferences, count, random = Math.random) {
  const chosen = [];
  const used = new Set();
  for (let i = 0; i < count && lessons?.length; i += 1) {
    let pick = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      pick = pickLessonForProfile(lessons, preferences, random);
      if (!used.has(pick.variantId)) break;
    }
    if (used.has(pick.variantId)) {
      pick = lessons.find((lesson) => !used.has(lesson.variantId)) ?? pick;
    }
    used.add(pick.variantId);
    chosen.push(pick);
  }
  return chosen;
}
