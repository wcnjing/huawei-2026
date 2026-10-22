import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAUTIOUS_ACTION, REPORT_ACTION, SAFE_ACTION, buildQuizInput, genuineCount, parseQuizScenario,
  planQuestions, writeQuizRound, writeQuizScenario,
} from './quiz-writer.js';
import { cleanPresurvey } from './presurvey.js';

const SCAM_REPLY = {
  type: 'email',
  sender: 'Harbourline Rewards',
  senderAddress: 'rewards@harb0urline-secure.example',
  subject: 'Your points expire tonight',
  timestamp: '9:41 AM',
  message: 'Your 12,000 Harbourline points expire at midnight. Redeem now at http://harbourline-redeem.example/login to avoid losing S$120 in rewards.',
  buttonLabel: 'Redeem now',
  senderWarning: 'The domain swaps the letter o for a zero.',
  temptingActions: ['LOG IN TO REDEEM', 'pay the s$2 fee'],
  clues: [
    { label: 'Look-alike domain', text: 'harb0urline-secure.example', explanation: 'A zero replaces the letter o.' },
    { label: 'Deadline', text: 'expire at midnight', explanation: 'Pressure stops you checking.' },
  ],
  explanation: 'This was a points-expiry phishing email. Open the official app yourself instead.',
};

const lesson = (id, scamName) => ({ variantId: id, scamName, impersonatedEntity: 'Lion City Bank', redFlags: ['x'] });
const LESSONS = [lesson('job', 'Job scam'), lesson('mule', 'Money mule scam'), lesson('shop', 'E-commerce scam')];

test('parseQuizScenario builds the app shape with fixed answer buttons', () => {
  const scam = parseQuizScenario(SCAM_REPLY, { isScam: true, random: () => 0 });
  assert.equal(scam.isScam, true);
  assert.equal(scam.correctAction, REPORT_ACTION);
  assert.deepEqual([...scam.actions].sort(), [CAUTIOUS_ACTION, 'LOG IN TO REDEEM', 'PAY THE S$2 FEE', REPORT_ACTION].sort());
  assert.equal(scam.senderEmail, 'rewards@harb0urline-secure.example');
  assert.equal(scam.senderDomain, 'harb0urline-secure.example');
  assert.equal(scam.subject, 'Your points expire tonight');
  assert.equal(scam.clues.length, 2);

  const safe = parseQuizScenario({ ...SCAM_REPLY, senderWarning: '' }, { isScam: false });
  assert.equal(safe.correctAction, SAFE_ACTION);
  assert.deepEqual([...safe.actions].sort(), [CAUTIOUS_ACTION, 'DELETE IMMEDIATELY', REPORT_ACTION, SAFE_ACTION].sort());
});

test('parseQuizScenario refuses real domains, phone numbers, markup and the real organisation', () => {
  const broken = [
    { ...SCAM_REPLY, message: 'Redeem at http://harbourline.com/login now.' },
    { ...SCAM_REPLY, senderAddress: 'rewards@harbourline.sg' },
    { ...SCAM_REPLY, message: 'Call us on +65 6123 4567 to redeem.' },
    { ...SCAM_REPLY, message: 'Reply to 9123 4567 to redeem.' },
    { ...SCAM_REPLY, subject: '<b>Points</b>' },
    { ...SCAM_REPLY, sender: 'Lion City Bank Rewards' },
    { ...SCAM_REPLY, message: 'This is a SafeSpace quiz.' },
    { ...SCAM_REPLY, subject: '' },
    { ...SCAM_REPLY, clues: SCAM_REPLY.clues.slice(0, 1) },
    { ...SCAM_REPLY, type: 'fax' },
  ];
  for (const reply of broken) {
    assert.equal(parseQuizScenario(reply, { isScam: true, impersonatedEntity: 'Lion City Bank' }), null, JSON.stringify(reply).slice(0, 120));
  }
  // Amounts and dotted words are not mistaken for domains.
  assert.ok(parseQuizScenario({ ...SCAM_REPLY, message: 'Only S$1.50 today, v2.0 of the app, No.5 voucher.' }, { isScam: true }));
});

test('rounds mix in about one genuine message in five, built from the pre-survey', () => {
  assert.equal(genuineCount(3), 0);
  assert.equal(genuineCount(5), 1);
  assert.equal(genuineCount(10), 2);
  const presurvey = cleanPresurvey({ interests: ['jobs'], includeOtherTypes: false });
  const specs = planQuestions(LESSONS, presurvey, 5);
  assert.equal(specs.length, 5);
  assert.equal(specs.filter((s) => !s.lesson).length, 1);
  for (const spec of specs.filter((s) => s.lesson)) assert.ok(['job', 'mule', 'shop'].includes(spec.lesson.variantId));

  const input = buildQuizInput({ lesson: LESSONS[0], language: 'ms', presurvey });
  assert.equal(input.kind, 'scam');
  assert.equal(input.languageName, 'Malay');
  assert.deepEqual(input.recipient.wantsToPractise, ['Jobs & recruitment']);
  assert.equal(buildQuizInput({ lesson: null, language: 'en', presurvey }).kind, 'genuine');
});

test('writeQuizRound writes in parallel and leaves nulls where a question failed', async () => {
  let calls = 0;
  const create = async () => {
    calls += 1;
    if (calls === 2) throw new Error('timeout');
    return { output_text: JSON.stringify(SCAM_REPLY) };
  };
  const specs = [{ lesson: LESSONS[0] }, { lesson: LESSONS[1] }, { lesson: null }];
  const round = await writeQuizRound(specs, { language: 'en', create });
  assert.equal(round.length, 3);
  assert.equal(round.filter(Boolean).length, 2);
  assert.equal(round.find(Boolean).correctAction, REPORT_ACTION);
  assert.equal(await writeQuizScenario({ lesson: LESSONS[0] }, { env: {} }), null, 'no OpenAI key: fixed messages');
});
