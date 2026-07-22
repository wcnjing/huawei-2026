// Real email drill: generate a phishing-style email, then send it.
// Ported from the standalone email-webapp (huawei-webapp branch) into this backend so
// all three channels - call, SMS, email - run through one consent-gated API.
//
// No new npm deps: OpenAI is called over plain HTTP, same as Vapi/Twilio elsewhere.
// FAILS CLOSED - if either provider is unconfigured, nothing is sent.

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

export class EmailUnavailable extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'EmailUnavailable';
    this.code = 'EMAIL_UNAVAILABLE';
  }
}

// GOOGLE_SCRIPT_SECRET is required, not optional: the Apps Script web app is deployed
// with access "Anyone", so the shared secret is the only thing standing between that
// public URL and an open mail relay. No secret -> we refuse to send at all.
export function emailConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY && process.env.GOOGLE_SCRIPT_URL && process.env.GOOGLE_SCRIPT_SECRET,
  );
}

const SCAM_TOPICS = [
  'a bank account security alert',
  'an undelivered parcel with an unpaid fee',
  'a password reset you did not request',
  'a government agency claiming an unpaid fine',
  'a scholarship you have been selected for',
  'a remote job offer requiring an upfront training fee',
  'an online order refund needing payment details',
  'an account suspension unless you verify now',
];

// Same persona contract as the voice drill: FICTIONAL institutions only, bounded
// pressure, and a reveal that is scripted rather than improvised.
function buildPrompt(revealUrl, reportUrl) {
  const topic = SCAM_TOPICS[Math.floor(Math.random() * SCAM_TOPICS.length)];
  return [
    'You are writing ONE phishing-style email for a CONSENTED SafeSpace safety drill.',
    'The recipient has explicitly opted in to being drilled.',
    '',
    'TOPIC: ' + topic,
    '',
    'RULES:',
    '- Invent a FICTIONAL sender organisation. Never name a real bank, agency or brand.',
    '- Subject line + 2-4 short sentences. Urgent but professional, like real phishing.',
    '- Apply pressure, but never threaten harm or legal arrest.',
    '- Include exactly two links, as real anchor tags:',
    '    the bait link  -> ' + revealUrl,
    '    a "Report as suspicious" link -> ' + reportUrl,
    '- Return ONLY HTML body content (<p>, <strong>, <a>). No <html>/<head>/<body> tags.',
    '- Do NOT include the words "drill" or "SafeSpace" anywhere - clicking the bait link',
    '  is what reveals it. A giveaway in the email defeats the exercise.',
  ].join('\n');
}

/**
 * Generate + send one drill email. Throws EmailUnavailable if unconfigured,
 * or Error on a provider failure (callers must not echo the message to clients).
 */
export async function sendDrillEmail({ to }) {
  if (!emailConfigured()) {
    throw new EmailUnavailable(
      'OPENAI_API_KEY, GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET must be set to send drill emails',
    );
  }
  const base = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  const revealUrl = base + '/drill-reveal';
  const reportUrl = base + '/drill-report';

  // 1. Generate the body.
  const gen = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.EMAIL_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(revealUrl, reportUrl) }],
    }),
  });
  const genData = await gen.json();
  if (!gen.ok) throw new Error('OpenAI ' + gen.status + ': ' + JSON.stringify(genData));
  const html = genData?.choices?.[0]?.message?.content;
  if (!html) throw new Error('OpenAI returned no content');

  // 2. Send it.
  const send = await fetch(process.env.GOOGLE_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.GOOGLE_SCRIPT_SECRET,
      email: to,
      subject: 'Immediate Action Required',
      html,
    }),
  });
  const sendData = await send.json().catch(() => ({}));
  if (!send.ok || sendData?.success === false) {
    throw new Error('Mail sender failed: ' + JSON.stringify(sendData));
  }
  return { ok: true };
}
