import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearScamVariantCache, getLessonByVariantId, getRandomLesson, lessonFromVariant,
} from './scam-variants.js';
import { buildDrillEmailInput, parseDrillEmail, writeDrillEmail } from './email-writer.js';
import { educationalPage } from './pages.js';
import { templatePixiMessages } from './drill-announce.js';
import { followupLesson } from './email.js';
import { buildPixiInput } from './pixi-writer.js';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_test' };

const BANK = {
  id: 'b-1',
  variant_name: 'Fake bank security alert',
  description: 'Victims receive an email claiming suspicious activity on their account.',
  modus_operandi: 'Scammers send an email with a link to a fake login page.',
  communication_channel: 'Email',
  impersonated_entity: 'Lion City Bank',
  red_flags: ['Urgent  request to "verify"', 'Visit www.fake-bank.example now', 42, 'Urgent request to "verify"'],
  scam_tactics: ['Urgency'],
  requested_action: 'Click a link and log in',
  verification_method: 'Call the number on the back of your card',
  prevention_advice: 'Never log in through a link in a message',
  scams: { scam_name: 'Phishing scam' },
};
const JOB = {
  id: 'j-1',
  variant_name: 'Online task job offer',
  red_flags: ['Pay a deposit to unlock earnings'],
  scams: { scam_name: 'Job scam' },
};
const EMPTY = { id: 'e-1', variant_name: 'Nothing to teach', red_flags: [] };
const VARIANTS = [BANK, JOB, EMPTY];

const GOOD_EMAIL = {
  sender: 'Harbourline Bank',
  subject: 'Unusual sign-in detected',
  paragraphs: ['We noticed a sign-in from a new device.', 'Verify your account within 24 hours or it will be locked.'],
  action: 'Verify account',
};

function mockFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(url, init);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('lessonFromVariant cleans bulletin text: whitespace, duplicates, non-strings and links', () => {
  const lesson = lessonFromVariant(BANK);
  assert.equal(lesson.variantId, 'b-1');
  assert.equal(lesson.scamName, 'Phishing scam');
  assert.deepEqual(lesson.redFlags, ['Urgent request to "verify"']);
  assert.equal(lesson.preventionAdvice, 'Never log in through a link in a message');
  assert.equal(lessonFromVariant(null), null);
  assert.equal(lessonFromVariant(EMPTY), null);
});

test('getRandomLesson picks among usable variants, read once and cached; lookups by id reuse it', async () => {
  clearScamVariantCache();
  const fetch = mockFetch(async () => new Response(JSON.stringify(VARIANTS), { status: 200 }));
  try {
    assert.equal((await getRandomLesson({ env: ENV, random: () => 0 })).variantId, 'b-1');
    assert.equal((await getRandomLesson({ env: ENV, random: () => 0.99 })).variantId, 'j-1');
    assert.equal((await getLessonByVariantId('j-1', { env: ENV })).scamName, 'Job scam');
    assert.equal(await getLessonByVariantId('e-1', { env: ENV }), null);
    assert.equal(await getLessonByVariantId(null, { env: ENV }), null);
    assert.equal(fetch.calls.length, 1);
    assert.match(fetch.calls[0].url, /^https:\/\/example\.supabase\.co\/rest\/v1\/scam_variants\?select=/);
    assert.equal(fetch.calls[0].init.headers.apikey, 'sb_secret_test');
  } finally {
    fetch.restore();
    clearScamVariantCache();
  }
});

test('variant lookups fail open: unconfigured, HTTP error, network error', async () => {
  assert.equal(await getRandomLesson({ env: {} }), null);
  let fetch = mockFetch(async () => new Response('nope', { status: 500 }));
  try {
    assert.equal(await getRandomLesson({ env: ENV }), null);
  } finally {
    fetch.restore();
    clearScamVariantCache();
  }
  fetch = mockFetch(async () => { throw new TypeError('network down'); });
  try {
    assert.equal(await getLessonByVariantId('b-1', { env: ENV }), null);
  } finally {
    fetch.restore();
    clearScamVariantCache();
  }
});

test('parseDrillEmail accepts plain copy and refuses links, contacts, markup and the real organisation', () => {
  const real = { impersonatedEntity: 'Lion City Bank' };
  assert.deepEqual(parseDrillEmail(JSON.stringify(GOOD_EMAIL), real), GOOD_EMAIL);
  const broken = [
    { ...GOOD_EMAIL, paragraphs: ['Go to www.harbourline.example', 'now'] },
    { ...GOOD_EMAIL, paragraphs: ['Email help@harbourline.example', 'now'] },
    { ...GOOD_EMAIL, paragraphs: ['Call +65 6123 4567 today', 'now'] },
    { ...GOOD_EMAIL, subject: '<b>Alert</b>' },
    { ...GOOD_EMAIL, sender: 'Lion City Bank' },
    { ...GOOD_EMAIL, paragraphs: ['This is a SafeSpace drill.', 'now'] },
    { ...GOOD_EMAIL, paragraphs: ['only one'] },
    { ...GOOD_EMAIL, action: 'x'.repeat(31) },
  ];
  for (const email of broken) assert.equal(parseDrillEmail(email, real), null, JSON.stringify(email));
  assert.equal(parseDrillEmail('not json'), null);
});

test('writeDrillEmail sends the variant, never the user, and falls back to null on failure', async () => {
  const lesson = lessonFromVariant(BANK);
  let request;
  const content = await writeDrillEmail(lesson, {
    language: 'zh',
    create: async (body) => { request = body; return { output_text: JSON.stringify(GOOD_EMAIL) }; },
  });
  assert.deepEqual(content, GOOD_EMAIL);
  const input = JSON.parse(request.input);
  assert.equal(input.language, 'zh');
  assert.equal(input.scam.variant, 'Fake bank security alert');
  assert.deepEqual(input, buildDrillEmailInput(lesson, 'zh'));
  assert.equal(request.text.format.strict, true);

  assert.equal(await writeDrillEmail(lesson, { create: async () => { throw new Error('timeout'); } }), null);
  assert.equal(await writeDrillEmail(lesson, {
    create: async () => ({ output_text: JSON.stringify({ ...GOOD_EMAIL, sender: 'Lion City Bank' }) }),
  }), null);
  assert.equal(await writeDrillEmail(lesson, { env: {} }), null);
  assert.equal(await writeDrillEmail(null, { create: async () => ({ output_text: '{}' }) }), null);
});

test('the drill page shows the lesson with every bulletin value escaped', () => {
  const lesson = {
    ...lessonFromVariant(BANK),
    scamName: '<script>alert(1)</script>',
    redFlags: ['Asks for your <b>OTP</b>'],
  };
  const { html } = educationalPage({ title: 't', heading: 'h', message: 'm', variant: 'lose', lesson });
  assert.match(html, /The real scam behind this drill/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<li>Asks for your &lt;b&gt;OTP&lt;\/b&gt;<\/li>/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(educationalPage({ title: 't', heading: 'h', message: 'm' }).html, /class="lesson"/);
});

test('Pixi templates and model input use the lesson; the impersonated entity stays out', () => {
  const lesson = lessonFromVariant(BANK);
  const [, guidance] = templatePixiMessages({ channel: 'email', won: false, lesson });
  assert.match(guidance, /Urgent request to "verify"/);
  assert.match(templatePixiMessages({ channel: 'email', won: false })[1], /sender address/);

  const context = {
    userId: 'u1', userName: 'MEI', streak: 0, timesSafe: 0, timesScammed: 1,
    members: [{ id: 'u1', name: 'MEI' }], tree: null, recentChat: [],
  };
  const input = buildPixiInput(context, { channel: 'email', won: false, outcome: 'clicked_link', lesson });
  assert.equal(input.drill.realScam.scamType, 'Phishing scam');
  assert.deepEqual(input.drill.realScam.redFlags, ['Urgent request to "verify"']);
  assert.doesNotMatch(JSON.stringify(input), /Lion City Bank/);
  assert.equal(buildPixiInput(context, { channel: 'email', won: true }).drill.realScam, null);
});

test('the safety follow-up carries only plain-text red flags and advice', () => {
  assert.deepEqual(followupLesson(lessonFromVariant(BANK)), {
    scamName: 'Phishing scam',
    redFlags: ['Urgent request to "verify"'],
    advice: 'Never log in through a link in a message',
  });
  assert.equal(followupLesson(null), null);
  assert.equal(followupLesson({ redFlags: [], preventionAdvice: '  ' }), null);
});

test('drill pages have no "Return to SafeSpace" link', () => {
  assert.doesNotMatch(educationalPage({ title: 't', heading: 'h', message: 'm' }).html, /Return to SafeSpace|class="home"/);
});
