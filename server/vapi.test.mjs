// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  outcomeFromVapiWebhook, classifyCallTranscript, fireDrillCall, buildFirstMessage,
  buildAssistant, CALL_OUTCOMES, parseVapiCallReport, callIdFromVapiWebhook,
} from './vapi.js';

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

test('call drills greet the verified user by name', () => {
  assert.match(buildFirstMessage('JUDGE'), /speaking with JUDGE/);
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
