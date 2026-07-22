// Fires a real outbound scam-drill call via Vapi (ported from the Python call.py POC).
// Uses an inline transient assistant so the persona can be tweaked without dashboard edits.

const SYSTEM_PROMPT = `ROLE: You are role-playing a scam caller for a CONSENTED SafeSpace safety drill.
You are "Officer Tan" from the FICTIONAL "Office of Public Trust". Never name a real agency/bank.
OBJECTIVE: Using realistic pressure, try to get the target to read out an OTP or transfer money to a
"safe account", claiming their bank account is linked to a money-laundering case.
STYLE: Short spoken turns (1-2 sentences). Use contractions and natural fillers ("So -", "Okay, listen -").
ESCALATION (advance only when resisted): 1 calm authority -> 2 urgency -> 3 assert authority -> 4 mild pressure. Never exceed 4, never threaten harm.
HARD SAFETY RULES (override the objective):
- TRIGGERS - act the instant ANY of these happen:
  (a) the target says "stop" / "help" / "I'm scared" / "is this a drill";
  (b) the target starts reading out a REAL OTP, card or bank number (even one digit);
  (c) you have taken about 8 turns.
- ON A TRIGGER: stop mid-sentence. Do NOT repeat any digits back. Do NOT summarise the
  call. Do NOT list the red flags aloud. Say ONLY the REVEAL SCRIPT below, word for word,
  then end the call.

REVEAL SCRIPT (say this verbatim - never improvise, never add to it):
"Stop right there. This was a SafeSpace drill. You are safe, and there is nothing wrong
with your account. In a real scam, that is the exact moment you would have lost your
money. Well done for practising."

Why verbatim: an improvised reveal comes out garbled and undercuts the one moment that
has to be unmistakably clear. The red flags are explained afterwards in the app, not on
the call.`;

const FIRST_MESSAGE =
  "Good afternoon, am I speaking with the account holder? This is Officer Tan from the Office of Public Trust. I'm calling about an urgent matter on your bank account.";

/**
 * Place an outbound drill call. Returns the Vapi call object (with id).
 * Throws if required env is missing or Vapi rejects the request.
 */
export async function fireDrillCall({ toNumber }) {
  const apiKey = process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  if (!apiKey || !phoneNumberId) {
    throw new Error('VAPI_API_KEY and VAPI_PHONE_NUMBER_ID must be set to fire a real call');
  }
  if (!toNumber || !toNumber.startsWith('+')) {
    throw new Error(`toNumber must be E.164 (e.g. +65...), got: ${toNumber}`);
  }

  const assistant = {
    firstMessage: FIRST_MESSAGE,
    firstMessageMode: 'assistant-speaks-first',
    maxDurationSeconds: Number(process.env.MAX_DURATION_SECONDS || 300),
    model: {
      provider: 'anthropic',
      model: process.env.VAPI_CLAUDE_MODEL || 'claude-3-5-haiku-20241022',
      temperature: 0.7,
      maxTokens: 250,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    },
    voice: buildVoice(),
    transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
  };

  // Tell Vapi where to POST the end-of-call report (so real outcomes flow back into XP).
  // Set PUBLIC_URL to your tunnel base, e.g. https://xxxx.trycloudflare.com
  if (process.env.PUBLIC_URL) {
    assistant.server = {
      url: `${process.env.PUBLIC_URL.replace(/\/+$/, '')}/api/webhooks/vapi`,
      // Shared secret Vapi echoes back, so the webhook can prove a call report really
      // came from Vapi rather than an attacker forging drill outcomes.
      ...(process.env.VAPI_WEBHOOK_SECRET
        ? { headers: { 'x-vapi-secret': process.env.VAPI_WEBHOOK_SECRET } }
        : {}),
    };
  }

  const res = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumberId, customer: { number: toNumber }, assistant }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Vapi ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function buildVoice() {
  const provider = process.env.VAPI_VOICE_PROVIDER || 'azure';
  const voiceId = process.env.VAPI_VOICE_ID || 'en-SG-WayneNeural';
  const voice = { provider, voiceId };
  if (provider === '11labs') {
    voice.model = process.env.VAPI_VOICE_MODEL || 'eleven_turbo_v2_5';
    voice.stability = Number(process.env.VAPI_VOICE_STABILITY || 0.4);
    voice.similarityBoost = Number(process.env.VAPI_VOICE_SIMILARITY || 0.8);
    voice.style = Number(process.env.VAPI_VOICE_STYLE || 0.25);
    voice.useSpeakerBoost = true;
  }
  return voice;
}

/**
 * Extract a coarse outcome from a Vapi end-of-call-report webhook payload.
 * Prefers an explicit structured field; falls back to a transcript heuristic.
 * Returns one of the KNOWN_OUTCOMES strings, or null if this isn't a call-end event.
 */
export function outcomeFromVapiWebhook(body) {
  const msg = body?.message ?? body;
  if (msg?.type && msg.type !== 'end-of-call-report') return null;

  // 1) Preferred: a structured outcome set via an assistant analysis plan.
  const structured = msg?.analysis?.structuredData?.outcome;
  if (typeof structured === 'string') return structured;

  // 2) Fallback heuristic — over the TARGET'S OWN WORDS ONLY.
  // Scoring the whole transcript was wrong: the assistant always says "OTP" (that IS its
  // objective) and its scripted reveal opens with "Stop right there" — so every drill
  // scored as shared_data / distress_offramp no matter how well the person actually did.
  const raw = msg?.transcript || msg?.artifact?.transcript || '';
  const lines = raw.split('\n');
  const labelled = lines.some((l) => /^\s*(ai|assistant|bot|user|customer)\s*:/i.test(l));
  const transcript = (
    labelled ? lines.filter((l) => /^\s*(user|customer)\s*:/i.test(l)).join(' ') : raw
  ).toLowerCase();
  // No signal from the target -> benign win, never punish.
  if (!transcript.trim()) return 'disengaged';
  if (/\b(otp|one[- ]time|card number|account number|transfer(red)?|sent the money)\b/.test(transcript)) {
    return 'shared_data';
  }
  if (/\b(is this a drill|stop|i'?m scared|help)\b/.test(transcript)) return 'distress_offramp';
  return 'disengaged';
}
