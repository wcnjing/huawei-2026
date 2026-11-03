// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  outcomeFromVapiWebhook, classifyCallTranscript, fireDrillCall, buildFirstMessage,
  CALL_OPENERS, greetingFor, DEFAULT_CALL_OPENER,
  buildAssistant, buildSystemPrompt, CALL_OUTCOMES, parseVapiCallReport, callIdFromVapiWebhook,
} from './vapi.js';

const { FICTIONAL_IDENTITIES } = await import('./intel/render.js');

const TEST_OPENER = Object.freeze({
  caller: 'Daniel',
  org: "Meridian Bank's fraud team",
  topic: 'a suspicious transaction on your account',
});

const report = (transcript, extra = {}) => ({
  message: { type: 'end-of-call-report', transcript, ...extra },
});

test('ignores events that are not an end-of-call report', () => {
  assert.equal(outcomeFromVapiWebhook({ message: { type: 'status-update' } }), null);
  assert.equal(outcomeFromVapiWebhook({ message: { transcript: 'User: goodbye' } }), null);
});

test('prefers an explicit structured outcome over the heuristic', () => {
  const body = report('the otp is 1234', { analysis: { structuredData: { outcome: 'hung_up' } } });
  assert.equal(outcomeFromVapiWebhook(body), 'hung_up');
});

test('accepts JSON-string structured data and ignores an invalid structured outcome', () => {
  assert.equal(
    outcomeFromVapiWebhook(report('', { analysis: { structuredData: '{"outcome":"caught_flag","confidence":"high"}' } })),
    'caught_flag',
  );
  assert.equal(
    outcomeFromVapiWebhook(report('User: no thanks, I am hanging up', { analysis: { structuredData: { outcome: 'made_up' } } })),
    'hung_up',
  );
});

test('a low-confidence model result cannot fail someone without transcript evidence', () => {
  assert.equal(
    outcomeFromVapiWebhook(report('User: I need to think about it.', {
      analysis: { structuredData: { outcome: 'shared_data', confidence: 'low' } },
    })),
    null,
  );
  assert.equal(
    outcomeFromVapiWebhook(report('AI: Read me the OTP.\nUser: 1 2 3 4', {
      analysis: { structuredData: { outcome: 'shared_data', confidence: 'low' } },
    })),
    'shared_data',
  );
});

test('even a high-confidence model failure requires explicit target evidence', () => {
  const uncorroborated = parseVapiCallReport(report('AI: Read me the OTP.\nUser: I need to think.', {
    analysis: { structuredData: { outcome: 'shared_data', confidence: 'high' } },
  }));
  assert.equal(uncorroborated.outcome, null);
  assert.equal(uncorroborated.unscoredReason, 'unlabelled_or_insufficient_transcript');

  assert.equal(
    outcomeFromVapiWebhook(report('AI: Read me the OTP.\nUser: 1 2 3 4', {
      analysis: { structuredData: { outcome: 'complied', confidence: 'high' } },
    })),
    'shared_data',
    'explicit target evidence may conservatively override the model failure subtype',
  );
});

test('detects shared data when the target reads out an OTP', () => {
  assert.equal(outcomeFromVapiWebhook(report([
    'AI: Please read me the OTP.',
    'User: okay, four four nine one',
  ].join('\n'))), 'shared_data');
});

test('does not fail someone merely for discussing or refusing to share an OTP', () => {
  assert.equal(classifyCallTranscript("User: I will never share my OTP with you."), 'disengaged');
  assert.equal(classifyCallTranscript("AI: Tell me the OTP.\nUser: No, OTPs are private."), 'disengaged');
});

test('detects explicit compliance and completed transfers', () => {
  assert.equal(classifyCallTranscript("User: okay, I'll transfer the money now."), 'complied');
  assert.equal(classifyCallTranscript("User: I have sent the payment already."), 'shared_data');
  assert.equal(classifyCallTranscript("User: I will not transfer any money."), 'disengaged');
});

test('recognising the scam after engaging is a partial outcome', () => {
  assert.equal(classifyCallTranscript("User: Wait, this sounds suspicious. This is a scam."), 'caught_flag');
});

test('detects the distress off-ramp when the target asks if it is a drill', () => {
  assert.equal(outcomeFromVapiWebhook(report('User: wait, is this a drill?')), 'distress_offramp');
});

test('no transcript or analysis is unscored, never promoted to a full win', () => {
  const parsed = parseVapiCallReport(report(''));
  assert.equal(parsed.outcome, null);
  assert.equal(parsed.unscoredReason, 'analysis_missing');
});

test('operational endings are unscored even if stale analysis claims a win', () => {
  const body = report('', {
    endedReason: 'customer-did-not-answer',
    call: { id: 'call_no_answer', status: 'ended' },
    analysis: { structuredData: { outcome: 'disengaged', confidence: 'high' } },
  });
  assert.deepEqual(parseVapiCallReport(body), {
    callId: 'call_no_answer',
    attemptId: null,
    outcome: null,
    unscoredReason: 'no_answer',
    endedReason: 'customer-did-not-answer',
    callStatus: 'ended',
  });
  assert.equal(outcomeFromVapiWebhook(body), null);
});

test('voicemail and provider errors are operational rather than behavioral outcomes', () => {
  assert.equal(
    parseVapiCallReport(report('', { endedReason: 'voicemail' })).unscoredReason,
    'voicemail',
  );
  assert.equal(
    parseVapiCallReport(report('', { endedReason: 'pipeline-error-openai-llm-failed' })).unscoredReason,
    'provider_error',
  );
});

test('structured artifact messages are preferred over a flattened transcript', () => {
  const body = report('User: my OTP is 1 2 3 4', {
    artifact: {
      messages: [
        { role: 'assistant', message: 'Please read the OTP.' },
        { role: 'user', message: 'No thanks, I am hanging up.' },
      ],
    },
  });
  assert.equal(outcomeFromVapiWebhook(body), 'hung_up');
});

test('an unlabeled mixed transcript is unscored rather than guessed as target speech', () => {
  assert.equal(classifyCallTranscript('Please read the OTP. Okay, 1 2 3 4.'), null);
  assert.equal(
    parseVapiCallReport(report('Please read the OTP. Okay, 1 2 3 4.')).unscoredReason,
    'unlabelled_or_insufficient_transcript',
  );
});

test('extracts provider and reserved attempt ids from an exact report', () => {
  const body = report('User: goodbye', {
    call: { id: 'call_123', metadata: { attemptId: 'attempt_123' } },
  });
  assert.equal(callIdFromVapiWebhook(body), 'call_123');
  assert.equal(parseVapiCallReport(body).attemptId, 'attempt_123');
});

// --- Regression: the assistant's OWN words must not be scored -----------------
// The scripted reveal says "Stop right there. This was a SafeSpace drill." Scanning the
// whole transcript matched "stop" in the ASSISTANT's line, so a clean win where the
// caller simply hung up got mis-scored as a distress off-ramp (0 XP, no streak).
test('a clean hang-up is NOT mis-scored as distress just because the AI said "stop"', () => {
  const transcript = [
    'AI: Good afternoon, this is Officer Tan from the Office of Public Trust.',
    'User: No thanks, I will call my bank directly.',
    'AI: Stop right there. This was a SafeSpace drill. You are safe.',
  ].join('\n');
  assert.equal(outcomeFromVapiWebhook(report(transcript)), 'disengaged');
});

test('the AI merely SAYING "otp" does not count as the user sharing data', () => {
  const transcript = [
    'AI: Read me the OTP when it appears on your screen.',
    'User: No. I am hanging up.',
  ].join('\n');
  assert.equal(outcomeFromVapiWebhook(report(transcript)), 'hung_up');
});

test('user distress is still caught when the user is the one who says it', () => {
  const transcript = [
    'AI: Failure to verify will be treated as non-cooperation.',
    "User: stop, I'm scared.",
  ].join('\n');
  assert.equal(outcomeFromVapiWebhook(report(transcript)), 'distress_offramp');
});

// --- Guard clauses on the outbound call --------------------------------------
test('fireDrillCall refuses without Vapi credentials', async () => {
  const { VAPI_API_KEY, VAPI_PHONE_NUMBER_ID } = process.env;
  delete process.env.VAPI_API_KEY;
  delete process.env.VAPI_PHONE_NUMBER_ID;
  await assert.rejects(() => fireDrillCall({ toNumber: '+6591234567' }), /must be set/);
  if (VAPI_API_KEY) process.env.VAPI_API_KEY = VAPI_API_KEY;
  if (VAPI_PHONE_NUMBER_ID) process.env.VAPI_PHONE_NUMBER_ID = VAPI_PHONE_NUMBER_ID;
});

test('fireDrillCall refuses a non-E.164 number', async () => {
  process.env.VAPI_API_KEY = 'k';
  process.env.VAPI_PHONE_NUMBER_ID = 'p';
  await assert.rejects(() => fireDrillCall({ toNumber: '91234567' }), /E\.164/);
  delete process.env.VAPI_API_KEY;
  delete process.env.VAPI_PHONE_NUMBER_ID;
});

test('fireDrillCall attaches the reserved attempt id as provider metadata', async () => {
  process.env.VAPI_API_KEY = 'k';
  process.env.VAPI_PHONE_NUMBER_ID = 'p';
  const realFetch = global.fetch;
  let sent;
  global.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'call_123', status: 'queued' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    await fireDrillCall({
      toNumber: '+6591234567',
      name: 'JUDGE',
      attemptId: 'attempt_reserved',
    });
  } finally {
    global.fetch = realFetch;
    delete process.env.VAPI_API_KEY;
    delete process.env.VAPI_PHONE_NUMBER_ID;
  }
  assert.deepEqual(sent.metadata, { attemptId: 'attempt_reserved' });
});

test('every opener in every language names the person', () => {
  // It is the one place their profile name appears, so no shape may drop it.
  for (const [lang, shapes] of Object.entries(CALL_OPENERS)) {
    assert.ok(shapes.length >= 3, `${lang} has only ${shapes.length} shape(s) to vary between`);
    for (const template of shapes) {
      const line = template({ name: 'JUDGE', greeting: 'X', opener: TEST_OPENER });
      assert.match(line, /JUDGE/, `${lang}: ${line}`);
      assert.ok(line.length > 30 && line.length < 260, `${lang}, ${line.length} chars: ${line}`);
    }
    assert.match(buildFirstMessage('JUDGE', undefined, { language: lang }), /JUDGE/, lang);
  }
});

test('the greeting follows the hour in Singapore, not the server', () => {
  const at = (iso) => greetingFor(new Date(iso));
  assert.equal(at('2026-11-03T01:00:00Z'), 'Good morning', '9am in Singapore');
  assert.equal(at('2026-11-03T06:00:00Z'), 'Good afternoon', '2pm in Singapore');
  assert.equal(at('2026-11-03T12:00:00Z'), 'Good evening', '8pm in Singapore');
  // The server being in UTC must not change any of the above.
  assert.equal(at('2026-11-02T23:30:00Z'), 'Good morning', '7:30am in Singapore');
});

test('openers vary, so a repeat user practises the scam and not our phrasing', () => {
  for (const lang of Object.keys(CALL_OPENERS)) {
    const lines = new Set();
    for (let i = 0; i < 40; i += 1) lines.add(buildFirstMessage('JUDGE', undefined, { language: lang }));
    assert.ok(lines.size > 1, `forty ${lang} calls produced one identical opening line`);
  }
});

test('a malformed name falls back instead of being spoken', () => {
  for (const bad of ['Bob <script>', '', '   ', 'x'.repeat(40), '1234']) {
    assert.match(buildFirstMessage(bad), /the account holder/, JSON.stringify(bad));
  }
});

test('transient call assistant requests a constrained structured outcome', () => {
  const assistant = buildAssistant('JUDGE');
  const plan = assistant.analysisPlan.structuredDataPlan;
  assert.equal(plan.enabled, true);
  assert.equal(plan.timeoutSeconds, 10);
  assert.match(plan.messages[1].content, /\{\{transcript\}\}/);
  assert.match(plan.messages[1].content, /\{\{endedReason\}\}/);
  assert.deepEqual(plan.schema.properties.outcome.enum, CALL_OUTCOMES);
  assert.deepEqual(plan.schema.required, ['outcome', 'confidence']);
  assert.match(plan.schema.properties.outcome.description, /Never infer a failure from ambiguity/);
  assert.equal(assistant.artifactPlan.recordingEnabled, false);
  assert.equal(assistant.artifactPlan.videoRecordingEnabled, false);
  assert.equal(assistant.artifactPlan.loggingEnabled, false);
  assert.equal(assistant.artifactPlan.transcriptPlan.enabled, true);
});

// --- Scam intel: the default persona is untouched ----------------------------
// These hashes were taken from the call as it shipped before scam intel existed. With no
// tactic, a drill must be byte-for-byte that call. If you change the persona or the safety
// rules on purpose, update them; if this fails and you did not, intel leaked into the
// default path.
test('with no tactic, the call prompt and opener are byte-for-byte the pre-intel call', () => {
  const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
  const assistant = buildAssistant('JUDGE');
  assert.equal(
    sha256(assistant.model.messages[0].content),
    '84a8b23ecec405d3138dcc255eccae5baafec7371a1a35a35e0dab18b10f65bb',
  );
  // The opener now varies on purpose (CALL_OPENERS), so it is pinned by shape rather
  // than by hash: every template, with the default persona, names the account holder
  // and the default organisation.
  for (let i = 0; i < CALL_OPENERS.length; i += 1) {
    const line = buildFirstMessage('JUDGE', undefined, { random: () => i / CALL_OPENERS.length });
    assert.match(line, /JUDGE/, line);
    assert.match(line, /Office of Public Trust/, line);
  }
});

test('a malformed tactic is ignored rather than half-applied', () => {
  const plain = buildAssistant('JUDGE');
  for (const tactic of [{}, { roleBlock: 42 }, { roleBlock: 'ROLE: x', opener: { caller: 'A' } }]) {
    const assistant = buildAssistant('JUDGE', tactic);
    assert.equal(assistant.model.messages[0].content, plain.model.messages[0].content);
    // The opener is random now, so compare the persona it used, not the exact words.
    assert.match(assistant.firstMessage, /Office of Public Trust/, assistant.firstMessage);
    assert.doesNotMatch(assistant.firstMessage, /\bA\b from/, 'a half-built opener must not be used');
  }
});

test('fireDrillCall sends a rendered tactic ahead of the unchanged safety rules', async () => {
  process.env.VAPI_API_KEY = 'k';
  process.env.VAPI_PHONE_NUMBER_ID = 'p';
  const realFetch = global.fetch;
  let sent;
  global.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: 'call_456', status: 'queued' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    await fireDrillCall({
      toNumber: '+6591234567',
      name: 'JUDGE',
      tactic: {
        roleBlock: 'ROLE: test persona',
        opener: { caller: 'Rachel', org: 'ParcelLink customer care', topic: 'a parcel held under your name' },
      },
    });
  } finally {
    global.fetch = realFetch;
    delete process.env.VAPI_API_KEY;
    delete process.env.VAPI_PHONE_NUMBER_ID;
  }
  // One opener shape withholds the caller's name, so match the organisation instead.
  assert.match(sent.assistant.firstMessage, /ParcelLink customer care/, sent.assistant.firstMessage);
  const system = sent.assistant.model.messages[0].content;
  assert.ok(system.startsWith('ROLE: test persona\nSTYLE:'));
  assert.ok(system.includes('HARD SAFETY RULES'));
  assert.ok(!system.includes('Officer Tan'));
});

// Voice selection must produce a provider-compatible ID even without deployment overrides.
test('call assistant defaults to the selected ElevenLabs voice and preserves provider overrides', () => {
  const keys = ['VAPI_VOICE_PROVIDER', 'VAPI_VOICE_ID', 'VAPI_VOICE_MODEL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    let voice = buildAssistant('TEST').voice;
    assert.equal(voice.provider, '11labs');
    assert.ok(DEFAULT_VOICE_IDS.en.includes(voice.voiceId), voice.voiceId);
    assert.equal(voice.model, 'eleven_turbo_v2_5');

    process.env.VAPI_VOICE_PROVIDER = 'azure';
    assert.deepEqual(buildAssistant('TEST').voice, { provider: 'azure', voiceId: 'en-SG-WayneNeural' });

    process.env.VAPI_VOICE_PROVIDER = '11labs';
    process.env.VAPI_VOICE_ID = 'another-voice';
    process.env.VAPI_VOICE_MODEL = 'eleven_flash_v2_5';
    voice = buildAssistant('TEST').voice;
    assert.equal(voice.voiceId, 'another-voice');
    assert.equal(voice.model, 'eleven_flash_v2_5');
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

// ── Calls in the player's language ──────────────────────────────────────────
const {
  CALL_REVEAL_SCRIPTS, transcriberFor, voiceFor, languageInstruction, DEFAULT_VOICE_IDS,
} = await import('./vapi.js');

test('every app language has a translated reveal script, and it never drifts', () => {
  for (const lang of ['en', 'zh', 'ms', 'ta']) {
    const script = CALL_REVEAL_SCRIPTS[lang];
    assert.ok(script && script.length > 40, `${lang} has no reveal script`);
    assert.match(script, /SafeSpace/, `${lang} reveal must name SafeSpace`);
  }
  // The reveal is the one thing a frightened person must understand. Each translation
  // has to be in its own script, not English with a note attached.
  for (const lang of ['zh', 'ms', 'ta']) {
    assert.notEqual(CALL_REVEAL_SCRIPTS[lang], CALL_REVEAL_SCRIPTS.en, `${lang} is still English`);
  }
  // 'SafeSpace' is kept untranslated on purpose, so exclude it before checking.
  assert.doesNotMatch(CALL_REVEAL_SCRIPTS.zh.replaceAll('SafeSpace', ''), /[a-z]{4,}/, 'zh is English prose');
});

test('the prompt carries the language and the matching reveal script', () => {
  const ta = buildSystemPrompt(null, 'ta');
  assert.match(ta, /Tamil/, 'the model is told which language to speak');
  assert.ok(ta.includes(CALL_REVEAL_SCRIPTS.ta), 'the Tamil reveal script is in the prompt');
  assert.ok(!ta.includes(CALL_REVEAL_SCRIPTS.en), 'the English reveal must not also be there');
  // English is unchanged, byte for byte, so the pinned hash still protects it.
  assert.equal(buildSystemPrompt(null, 'en'), buildSystemPrompt(null));
});

test('the safety rules survive translation', () => {
  for (const lang of ['en', 'zh', 'ms', 'ta']) {
    const prompt = buildSystemPrompt(null, lang);
    assert.ok(prompt.includes('HARD SAFETY RULES'), lang);
    assert.ok(prompt.includes('REVEAL SCRIPT'), lang);
    assert.ok(prompt.indexOf('HARD SAFETY RULES') < prompt.indexOf('REVEAL SCRIPT'), lang);
  }
});

test('Tamil needs nova-3, so every language uses it', () => {
  for (const [lang, code] of [['en', 'en'], ['zh', 'zh'], ['ms', 'ms'], ['ta', 'ta']]) {
    const t = transcriberFor(lang);
    assert.equal(t.provider, 'deepgram');
    assert.equal(t.model, 'nova-3', `${lang} must not fall back to nova-2`);
    assert.equal(t.language, code);
  }
  assert.equal(transcriberFor('klingon').language, 'en', 'an unknown language is English');
});


test('the assistant speaks, hears and reveals in one language throughout', () => {
  const assistant = buildAssistant('JUDGE', null, { language: 'zh' });
  assert.equal(assistant.transcriber.language, 'zh');
  assert.equal(assistant.voice.provider, voiceFor('zh').provider, 'one provider across languages');
  assert.ok(assistant.model.messages[0].content.includes(CALL_REVEAL_SCRIPTS.zh));
  assert.match(assistant.firstMessage, /JUDGE/, 'the name still appears');
  assert.doesNotMatch(assistant.firstMessage, /Good (morning|afternoon|evening)/, assistant.firstMessage);
});

test('languageInstruction names the language in English for the model', () => {
  assert.match(languageInstruction('zh'), /Chinese/);
  assert.match(languageInstruction('ms'), /Malay/);
  assert.match(languageInstruction('ta'), /Tamil/);
  assert.equal(languageInstruction('en'), '');
});

test('a translated call names its organisation in that language too', () => {
  for (const lang of ['zh', 'ms', 'ta']) {
    const line = buildFirstMessage('JUDGE', DEFAULT_CALL_OPENER, { language: lang, random: () => 0 });
    assert.doesNotMatch(line, /Office of Public Trust/, `${lang} left the org in English: ${line}`);
    assert.doesNotMatch(line, /Officer Tan/, `${lang} left the caller in English: ${line}`);
    assert.doesNotMatch(line, /bank account/, `${lang} left the topic in English: ${line}`);
  }
  // English is untouched.
  assert.match(
    buildFirstMessage('JUDGE', DEFAULT_CALL_OPENER, { language: 'en', random: () => 0 }),
    /Officer Tan from the Office of Public Trust/,
  );
});

test('every fictional identity is translated into every language', () => {
  for (const [key, identity] of Object.entries(FICTIONAL_IDENTITIES)) {
    for (const lang of ['zh', 'ms', 'ta']) {
      const translated = identity.i18n?.[lang];
      assert.ok(translated, `${key} has no ${lang} translation`);
      for (const field of ['caller', 'org', 'topic']) {
        assert.ok(translated[field], `${key}.${lang} is missing ${field}`);
      }
    }
  }
});

test('each language has two voices, and they are real ElevenLabs ids', () => {
  for (const [lang, ids] of Object.entries(DEFAULT_VOICE_IDS)) {
    assert.equal(ids.length, 2, `${lang} should have two voices to vary between`);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9]{20}$/, `${lang}: ${id}`);
  }
});

test('a call picks one of its language voices, and env still wins', () => {
  const env = {};
  const first = voiceFor('ta', { random: () => 0, env });
  const second = voiceFor('ta', { random: () => 0.9, env });
  assert.equal(first.voiceId, DEFAULT_VOICE_IDS.ta[0]);
  assert.equal(second.voiceId, DEFAULT_VOICE_IDS.ta[1]);
  assert.notEqual(first.voiceId, second.voiceId, 'both Tamil voices are reachable');

  const overridden = voiceFor('ta', { random: () => 0, env: { VAPI_VOICE_ID_TA: 'custom_id_x' } });
  assert.equal(overridden.voiceId, 'custom_id_x', 'an explicit id still wins');
});
