import test from 'node:test';
import assert from 'node:assert/strict';
import {
  channelAllowed, cleanPresurvey, lessonThemes, pickLessonForProfile, pickLessonsForProfile,
  presurveyBrief, profileThemes,
} from './presurvey.js';
import { getPresurvey, getPresurveyOrNull, savePresurvey } from './presurvey-store.js';

const lesson = (id, scamName, scamCategory = null) => ({ variantId: id, scamName, scamCategory });
const LESSONS = [
  lesson('job', 'Job scam'),
  lesson('mule', 'Money mule scam', 'Money mule-related offences'),
  lesson('invest', 'Investment scam', 'Financial'),
  lesson('gov', 'Government Officials Impersonation scam', 'Impersonation'),
  lesson('shop', 'E-commerce scam'),
  lesson('ticket', 'Concert ticket scam'),
  lesson('insure', 'Insurance services scam'),
];

// A deterministic stand-in for Math.random that replays the given draws.
const draws = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const tally = (prefs, runs = 4000, lessons = LESSONS) => {
  const counts = {};
  for (let i = 0; i < runs; i += 1) {
    const id = pickLessonForProfile(lessons, prefs).variantId;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
};

test('cleanPresurvey keeps only known answers', () => {
  assert.equal(cleanPresurvey(null), null);
  assert.equal(cleanPresurvey([]), null);
  assert.deepEqual(cleanPresurvey({
    ageRange: 'old', situation: 'Student', activities: ['shopping', 'shopping', 'x'],
    interests: ['jobs', 'nope'], channels: ['sms', 'pigeon'], includeOtherTypes: 'yes',
  }), {
    ageRange: '', situation: 'Student', activities: ['shopping'], interests: ['jobs'],
    channels: ['sms'], includeOtherTypes: true, completed: false,
  });
  assert.deepEqual(cleanPresurvey({}).channels, ['call', 'sms', 'email']);
});

test('channels are a hard limit; no saved answers allow every channel', () => {
  assert.equal(channelAllowed(null, 'sms'), true);
  assert.equal(channelAllowed(cleanPresurvey({ channels: ['email'] }), 'sms'), false);
  assert.equal(channelAllowed(cleanPresurvey({ channels: ['email'] }), 'email'), true);
});

test('practise picks and regular activities become topics; age and situation do not steer', () => {
  const { picked, lived } = profileThemes(cleanPresurvey({
    ageRange: '65+', situation: 'Looking for work', activities: ['tickets'], interests: ['phishing'],
  }));
  assert.deepEqual([...picked], ['phishing']);
  assert.deepEqual([...lived].sort(), ['shopping', 'tickets']);
  assert.deepEqual(presurveyBrief(cleanPresurvey({ activities: ['social'], interests: ['jobs'] })), {
    wantsToPractise: ['Jobs & recruitment'],
    regularlyDoes: ['Use social media'],
  });
  assert.deepEqual(lessonThemes(lesson('x', 'Money mule scam')), ['jobs']);
  assert.deepEqual(lessonThemes(lesson('x', 'Government impersonation phishing scam')), ['government', 'phishing']);
  assert.deepEqual(lessonThemes(lesson('x', 'Fake friend call scam')), ['friends']);
  assert.deepEqual(lessonThemes(lesson('x', 'Insurance services scam')), []);
});

test('topics both picked and lived come first, then picked, then lived', () => {
  // Shopping is picked AND lived (Shop online); jobs only picked; investment only lived.
  const prefs = cleanPresurvey({
    interests: ['shopping', 'jobs'], activities: ['shopping', 'investing'], includeOtherTypes: false,
  });
  const counts = tally(prefs);
  const share = (...ids) => ids.reduce((sum, id) => sum + (counts[id] || 0), 0) / 4000;
  assert.ok(share('shop') > 0.54 && share('shop') < 0.66, JSON.stringify(counts));
  assert.ok(share('job', 'mule') > 0.2 && share('job', 'mule') < 0.3, JSON.stringify(counts));
  assert.ok(share('invest') > 0.11 && share('invest') < 0.19, JSON.stringify(counts));
  assert.equal(counts.gov, undefined);
});

test('about 20% of drills explore any scam, unless other scam types are switched off', () => {
  const jobSeeker = cleanPresurvey({ interests: ['jobs'], includeOtherTypes: true });
  // Draw 1 < 0.2 explores: any lesson (draw 2 picks the last one).
  assert.equal(pickLessonForProfile(LESSONS, jobSeeker, draws(0.1, 0.99)).variantId, 'insure');
  // Draw 1 ≥ 0.2 stays in the profile: tier draw, topic draw, then the variant.
  assert.equal(pickLessonForProfile(LESSONS, jobSeeker, draws(0.5, 0, 0, 0.99)).variantId, 'mule');
  const strict = { ...jobSeeker, includeOtherTypes: false };
  for (let i = 0; i < 50; i += 1) {
    assert.ok(['job', 'mule'].includes(pickLessonForProfile(LESSONS, strict).variantId));
  }
});

test('a topic with one bulletin variant is not drowned out by bigger topics', () => {
  const many = [...LESSONS, ...Array.from({ length: 12 }, (_, i) => lesson(`phish${i}`, 'Phishing scam', 'Phishing'))];
  const prefs = cleanPresurvey({ interests: ['tickets'], activities: ['social'], includeOtherTypes: false });
  const counts = tally(prefs, 4000, many);
  // Tickets is the only picked topic (25% tier, no overlap) vs social's topics (15%):
  // re-shared, tickets gets 0.25 / 0.40 ≈ 62%.
  assert.ok(counts.ticket / 4000 > 0.55 && counts.ticket / 4000 < 0.7, JSON.stringify(counts));
});

test('empty profiles or no matches are random; rounds avoid repeating variants', () => {
  assert.equal(pickLessonForProfile([], cleanPresurvey({})), null);
  assert.equal(pickLessonForProfile(LESSONS, null, () => 0).variantId, 'job');
  assert.equal(pickLessonForProfile(LESSONS, cleanPresurvey({ interests: ['tech'] }), () => 0.99).variantId, 'insure');
  const round = pickLessonsForProfile(LESSONS, cleanPresurvey({ interests: ['jobs'], includeOtherTypes: false }), 4);
  assert.equal(round.length, 4);
  assert.equal(new Set(round.map((l) => l.variantId)).size, 4);
});

// ── storage: safespace-prod's Data API ────────────────────────────────────
const PROD = { SUPABASE_PROD_URL: 'https://prod.example.supabase.co/', SUPABASE_PROD_SECRET_KEY: 'sb_secret_prod' };

function mockFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('savePresurvey upserts one row per user into safespace.presurvey_responses', async () => {
  const fetch = mockFetch(async (url, init) => new Response(JSON.stringify([JSON.parse(init.body)]), { status: 201 }));
  try {
    const saved = await savePresurvey('user_1', {
      ageRange: '25–34', activities: ['shopping', 'nope'], interests: ['jobs'], channels: ['email'], completed: true,
    }, { env: PROD });
    assert.deepEqual(saved, {
      ageRange: '25–34', situation: '', activities: ['shopping'], interests: ['jobs'],
      channels: ['email'], includeOtherTypes: true, completed: true,
    });
    const { url, init } = fetch.calls[0];
    assert.equal(url, 'https://prod.example.supabase.co/rest/v1/presurvey_responses?on_conflict=user_id');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['content-profile'], 'safespace');
    assert.equal(init.headers.apikey, 'sb_secret_prod');
    assert.match(init.headers.prefer, /resolution=merge-duplicates/);
    const row = JSON.parse(init.body);
    assert.equal(row.user_id, 'user_1');
    assert.equal(row.age_range, '25–34');
    assert.deepEqual(row.channels, ['email']);
  } finally {
    fetch.restore();
  }
});

test('getPresurvey reads the row back; failures are loud for saving but quiet for drills', async () => {
  let fetch = mockFetch(async (url, init) => {
    assert.equal(init.headers['accept-profile'], 'safespace');
    assert.match(url, /presurvey_responses\?user_id=eq\.user_1/);
    return new Response(JSON.stringify([{ user_id: 'user_1', interests: ['tickets'], activities: [], channels: ['sms'] }]));
  });
  try {
    const got = await getPresurvey('user_1', { env: PROD });
    assert.deepEqual(got.interests, ['tickets']);
    assert.deepEqual(got.channels, ['sms']);
  } finally {
    fetch.restore();
  }

  fetch = mockFetch(async () => new Response('{"code":"42501","message":"permission denied for schema safespace"}', { status: 403 }));
  try {
    await assert.rejects(() => getPresurvey('user_1', { env: PROD }), { code: 'PRESURVEY_STORE_UNAVAILABLE' });
    await assert.rejects(() => savePresurvey('user_1', {}, { env: PROD }), /permission denied/);
    assert.equal(await getPresurveyOrNull('user_1', { env: PROD }), null);
  } finally {
    fetch.restore();
  }
  await assert.rejects(() => getPresurvey('user_1', { env: {} }), /SUPABASE_PROD_URL/);
});
