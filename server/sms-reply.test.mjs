// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SMS_TURNS, classifyTargetReply, nextSmsTurn, parseScammerReply,
} from './sms-reply.js';

const LESSON = {
  variantId: 'v-1',
  scamName: 'Phishing scam',
  variantName: 'Fake bank security alert',
  modusOperandi: 'The sender claims a transfer was authorised and asks them to cancel it.',
  impersonatedEntity: 'Lion City Bank',
  redFlags: ['Urgent request to verify'],
  tactics: ['Urgency'],
  requestedAction: 'Read out the one-time password',
};

const HISTORY = [
  { role: 'scammer', text: 'Harbourline Bank: a transfer of S$480 was approved. Cancel it here:' },
];

// ── Deterministic safety rules, applied before any model call ────────────────
test('distress always ends the drill unscored, in any of the four languages', () => {
  const distress = ['is this a scam?', 'IS THIS REAL', 'stop please', 'help me', 'i am scared', '这是真的吗'];
  for (const text of distress) {
    const verdict = classifyTargetReply(text);
    assert.equal(verdict.outcome, 'distress_offramp', text);
    assert.equal(verdict.reveal, true, text);
  }
});

test('handing over a code or card number is a loss that ends the drill at once', () => {
  for (const text of ['the code is 418922', 'OTP 123456', 'my card is 4111 1111 1111 1111']) {
    const verdict = classifyTargetReply(text);
    assert.equal(verdict.outcome, 'shared_data', text);
    assert.equal(verdict.reveal, true, 'a drill never keeps pushing after data is shared');
  }
});

test('refusing to engage is a win and ends the drill', () => {
  for (const text of ['no thanks', 'STOP', 'this is a scam, reported']) {
    const verdict = classifyTargetReply(text);
    assert.ok(['disengaged', 'reported'].includes(verdict.outcome), `${text} -> ${verdict.outcome}`);
    assert.equal(verdict.reveal, true, text);
  }
});

test('an ordinary reply keeps the conversation going', () => {
  const verdict = classifyTargetReply('what transfer? I did not make one');
  assert.equal(verdict.outcome, null);
  assert.equal(verdict.reveal, false);
});

// ── The turn cap ─────────────────────────────────────────────────────────────
test('the exchange is capped and the last word is always the reveal', async () => {
  const history = [];
  for (let i = 0; i < MAX_SMS_TURNS; i += 1) {
    history.push({ role: 'scammer', text: `push ${i}` }, { role: 'target', text: 'hmm' });
  }
  const turn = await nextSmsTurn({
    inbound: 'hmm',
    history,
    lesson: LESSON,
    create: async () => { throw new Error('the model must not be called past the cap'); },
  });
  assert.equal(turn.reveal, true);
  assert.equal(turn.outcome, 'disengaged', 'running out of turns is not a failure');
});

test('a safety verdict short-circuits before the model is ever called', async () => {
  const turn = await nextSmsTurn({
    inbound: 'is this a scam?',
    history: HISTORY,
    lesson: LESSON,
    create: async () => { throw new Error('the model must not be called on a distress reply'); },
  });
  assert.equal(turn.outcome, 'distress_offramp');
  assert.equal(turn.reveal, true);
  assert.equal(turn.text, null, 'no scam text is sent once someone asks for help');
});

// ── The in-character reply ───────────────────────────────────────────────────
test('parseScammerReply refuses links, contacts, real brands and over-long texts', () => {
  const ok = parseScammerReply(JSON.stringify({ text: 'Please confirm the 6-digit code we just sent to release the hold.' }), LESSON);
  assert.ok(ok.text);
  const broken = [
    { text: 'Go to https://evil.example now' },
    { text: 'Call +65 9123 4567 now to confirm this urgent matter before it escalates' },
    { text: 'Lion City Bank needs the code you were sent to release the hold on this' },
    { text: 'DBS needs the code you were just sent to release the hold on this transfer' },
    { text: 'A'.repeat(400) },
    { text: '' },
  ];
  for (const reply of broken) {
    assert.equal(parseScammerReply(JSON.stringify(reply), LESSON), null, reply.text.slice(0, 30));
  }
});

test('a model failure reveals rather than leaving the person mid-scam', async () => {
  const turn = await nextSmsTurn({
    inbound: 'what transfer? I did not make one',
    history: HISTORY,
    lesson: LESSON,
    create: async () => { throw new Error('timeout'); },
  });
  assert.equal(turn.reveal, true, 'silence after a reply is the one thing we must never do');
  assert.equal(turn.text, null);
});

test('a good model reply continues the drill in character', async () => {
  const turn = await nextSmsTurn({
    inbound: 'what transfer? I did not make one',
    history: HISTORY,
    lesson: LESSON,
    create: async () => ({
      output_text: JSON.stringify({ text: 'Then it was not authorised by you. Confirm the 6-digit code to stop it.' }),
    }),
  });
  assert.equal(turn.reveal, false);
  assert.match(turn.text, /6-digit code/);
  assert.equal(turn.outcome, null);
});
