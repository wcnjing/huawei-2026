// SMS drill: schedules a durable safety reveal, then sends a realistic scam text.
//
// Deliberately NOT LLM-generated. The opening text of a scam SMS is short and formulaic,
// so a curated scenario library is more reliable, costs nothing, needs no extra API key,
// and — unlike a model — cannot accidentally invent a real bank's name. The adaptive part
// (replies) is where a model earns its place; see the reply loop (not built yet).
//
// FAILS CLOSED - unconfigured means nothing is sent.

import { normalizeLanguage } from './language.js';

const TWILIO_API = 'https://api.twilio.com/2010-04-01/Accounts';
export const TWILIO_MIN_SCHEDULE_MS = 15 * 60 * 1000;
export const TWILIO_MAX_SCHEDULE_MS = 35 * 24 * 60 * 60 * 1000;
// Keep a little distance from Twilio's exact 15-minute scheduling boundary.
export const DEFAULT_REVEAL_DELAY_MS = 16 * 60 * 1000;

export class SmsUnavailable extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'SmsUnavailable';
    this.code = 'SMS_UNAVAILABLE';
  }
}

export class SmsDeliveryUnconfirmed extends Error {
  constructor(message, details = {}, cause = null) {
    super(message);
    this.name = 'SmsDeliveryUnconfirmed';
    this.code = 'SMS_DELIVERY_UNCONFIRMED';
    this.details = details;
    this.cause = cause;
  }
}

export function smsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID
      && process.env.TWILIO_AUTH_TOKEN
      && process.env.TWILIO_MESSAGING_SERVICE_SID
      && validRevealDelay(process.env.SMS_REVEAL_DELAY_MS),
  );
}

// Every institution here is FICTIONAL. Impersonating a real bank or agency in a
// simulated phishing message is a legal and reputational problem, and it is the rule
// used by the voice persona too. sms.test.mjs enforces this.
//
// Drill texts carry NO link of any kind. A real scam text almost always does, so this
// is a deliberate trade: a drill that cannot send anyone to a URL, not even our own,
// cannot train the tap that scams rely on, and leaves nothing to misfire if a text is
// forwarded. Each scenario invites a reply instead, which sms-reply.js answers in
// character. sms.test.mjs enforces that no scenario contains a URL or a domain.
// Recorded on the attempt when the text was written for this player rather than picked
// from SCENARIOS, so a reveal page can tell the two apart. Mirrors email.js.
export const GENERATED_SMS_SCENARIO_ID = 'generated';

export const SCENARIOS = [
  {
    id: 'parcel',
    text: 'ParcelLink: Your delivery SG7741 is on hold - unpaid customs fee of $3.20. Settle within 12h or the item is returned. Reply PAY to clear it.',
    translations: {
      zh: 'ParcelLink：您的包裹 SG7741 已被扣留，尚欠关税 $3.20。请在12小时内付清，否则包裹将被退回。回复 PAY 即可处理。',
      ms: 'ParcelLink: Penghantaran anda SG7741 ditahan - yuran kastam $3.20 belum dibayar. Jelaskan dalam 12 jam atau barang akan dipulangkan. Balas PAY untuk selesaikan.',
      ta: 'ParcelLink: உங்கள் பார்சல் SG7741 நிறுத்தி வைக்கப்பட்டுள்ளது - $3.20 சுங்கக் கட்டணம் செலுத்தப்படவில்லை. 12 மணி நேரத்தில் செலுத்தாவிட்டால் திருப்பி அனுப்பப்படும். PAY என பதிலளிக்கவும்.',
    },
    redFlags: ['unexpected fee', 'artificial deadline', 'lookalike domain'],
  },
  {
    id: 'bank',
    text: 'Meridian Bank ALERT: A transfer of $1,480.00 to a new payee was authorised. If this was not you, reply STOP NOW to cancel it.',
    translations: {
      zh: 'Meridian Bank 警报：一笔 $1,480.00 的转账已授权给新收款人。如非本人操作，请立即回复 STOP NOW 取消。',
      ms: 'AMARAN Meridian Bank: Pindahan $1,480.00 kepada penerima baharu telah dibenarkan. Jika ini bukan anda, balas STOP NOW untuk batalkan.',
      ta: 'Meridian Bank எச்சரிக்கை: புதிய பெறுநருக்கு $1,480.00 பரிமாற்றம் அங்கீகரிக்கப்பட்டது. இது நீங்கள் இல்லையென்றால், STOP NOW என பதிலளித்து ரத்து செய்யவும்.',
    },
    redFlags: ['alarming amount', 'urgency to click', 'domain is not the bank'],
  },
  {
    id: 'govt',
    text: 'Office of Public Trust: You have an unpaid infringement notice. Failure to respond in 24h will escalate to enforcement. Reply with your case number OPT-88421 to respond.',
    translations: {
      zh: 'Office of Public Trust：您有一张未缴的违规通知。24小时内未回应将转交执法处理。请回复案件编号 OPT-88421 以作回应。',
      ms: 'Office of Public Trust: Anda mempunyai notis kesalahan yang belum dibayar. Gagal menjawab dalam 24 jam akan membawa kepada tindakan penguatkuasaan. Balas dengan nombor kes OPT-88421 untuk menjawab.',
      ta: 'Office of Public Trust: உங்களுக்கு செலுத்தப்படாத விதிமீறல் அறிவிப்பு உள்ளது. 24 மணி நேரத்தில் பதிலளிக்காவிட்டால் அமலாக்க நடவடிக்கை எடுக்கப்படும். வழக்கு எண் OPT-88421 என பதிலளிக்கவும்.',
    },
    redFlags: ['threat of escalation', 'official-sounding reference', 'unfamiliar domain'],
  },
  {
    id: 'prize',
    text: 'Congratulations! Your number was drawn in the SkyRewards quarterly giveaway. Reply CLAIM within 48h to receive your $500 credit.',
    translations: {
      zh: '恭喜！您的号码在 SkyRewards 季度抽奖中被抽中。请在48小时内回复 CLAIM 领取 $500 奖励。',
      ms: 'Tahniah! Nombor anda terpilih dalam cabutan bertuah suku tahunan SkyRewards. Balas CLAIM dalam 48 jam untuk menuntut kredit $500 anda.',
      ta: 'வாழ்த்துகள்! SkyRewards காலாண்டு குலுக்கலில் உங்கள் எண் தேர்வானது. 48 மணி நேரத்தில் CLAIM என பதிலளித்து $500 பெறுங்கள்.',
    },
    redFlags: ['prize you never entered', 'deadline pressure', 'too good to be true'],
  },
  {
    id: 'account',
    text: 'NOTICE: Your CloudMail account will be suspended today due to a failed security check. Reply VERIFY now to avoid losing access.',
    translations: {
      zh: '通知：您的 CloudMail 账户未通过安全检查，将于今天被暂停。请立即回复 VERIFY 重新验证，以免无法登录。',
      ms: 'NOTIS: Akaun CloudMail anda akan digantung hari ini kerana gagal semakan keselamatan. Balas VERIFY sekarang supaya tidak hilang akses.',
      ta: 'அறிவிப்பு: பாதுகாப்புச் சோதனை தோல்வியால் உங்கள் CloudMail கணக்கு இன்று முடக்கப்படும். அணுகலை இழக்காமல் இருக்க இப்போதே VERIFY என பதிலளிக்கவும்.',
    },
    redFlags: ['account suspension threat', 'same-day deadline', 'credential harvesting link'],
  },
];

// Sent after the scam text so a drill ALWAYS reveals itself, even if the person never
// replies. Non-negotiable safeguard - an unrevealed simulated scam is just a scam.
export const REVEAL_TEXTS = {
  en: 'This was a SafeSpace drill - that last message was fake and you are safe. Nothing is wrong with any account. Open SafeSpace to see what gave it away.',
  zh: '这是 SafeSpace 演练——刚才那条信息是假的，您是安全的。您的账户都没有问题。打开 SafeSpace 看看有哪些破绽。',
  ms: 'Ini ialah latihan SafeSpace - mesej tadi palsu dan anda selamat. Tiada masalah dengan mana-mana akaun. Buka SafeSpace untuk melihat tanda-tandanya.',
  ta: 'இது ஒரு SafeSpace பயிற்சி - முந்தைய செய்தி போலியானது, நீங்கள் பாதுகாப்பாக இருக்கிறீர்கள். எந்தக் கணக்கிலும் பிரச்சனை இல்லை. எது காட்டிக்கொடுத்தது என்று பார்க்க SafeSpace-ஐத் திறக்கவும்.',
};
export const REVEAL_TEXT = REVEAL_TEXTS.en;

function basicAuth() {
  return (
    'Basic ' +
    Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  );
}

async function twilioSend({ to, body, sendAt }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const params = new URLSearchParams({
    To: to,
    MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
    Body: body,
  });
  if (sendAt) {
    params.set('ScheduleType', 'fixed');
    params.set('SendAt', sendAt);
  }
  const res = await fetch(`${TWILIO_API}/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) {
    const error = new Error(`Twilio SMS ${res.status}: ${JSON.stringify(data)}`);
    error.code = 'SMS_PROVIDER_REJECTED';
    throw error;
  }
  return data;
}

async function twilioCancel(messageSid) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const res = await fetch(
    `${TWILIO_API}/${accountSid}/Messages/${encodeURIComponent(messageSid)}.json`,
    {
      method: 'POST',
      headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ Status: 'canceled' }),
    },
  );
  const data = await res.json();
  if (!res.ok || data?.status !== 'canceled') {
    throw new Error(`Twilio SMS cancellation ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function validRevealDelay(raw) {
  if (raw === undefined || raw === null || raw === '') return true;
  const delay = Number(raw);
  return Number.isFinite(delay)
    && delay >= TWILIO_MIN_SCHEDULE_MS
    && delay <= TWILIO_MAX_SCHEDULE_MS;
}

export function resolveRevealDelay(revealAfterMs) {
  const raw = revealAfterMs ?? process.env.SMS_REVEAL_DELAY_MS ?? DEFAULT_REVEAL_DELAY_MS;
  if (!validRevealDelay(raw)) {
    throw new SmsUnavailable(
      `SMS reveal delay must be between ${TWILIO_MIN_SCHEDULE_MS} and ${TWILIO_MAX_SCHEDULE_MS} ms`,
    );
  }
  return Number(raw);
}

export function scenarioText(scenario, language = 'en') {
  const lang = normalizeLanguage(language);
  return (lang !== 'en' && scenario.translations?.[lang]) || scenario.text;
}

export function pickScenario(id) {
  if (id) return SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
  return SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
}

export function personalizeSmsText(text, name) {
  const targetName = String(name || '').trim();
  return targetName ? `${targetName}, ${text}` : text;
}

/**
 * Schedule the safety reveal with Twilio, then send one SMS drill. Scheduling first is
 * deliberate: if Twilio cannot durably accept the reveal, the bait is never sent.
 *
 * Twilio fixed scheduling requires a Messaging Service and accepts SendAt values from
 * 15 minutes to 35 days in the future. Since a drill text carries no link, that
 * scheduled reveal is the only automatic way out; the app's own buttons are the other.
 *
 * @param {{to: string, name?: string, scenarioId?: string, revealAfterMs?: number,
 *   language?: string, content?: {text: string}|null}} opts
 */
export async function sendDrillSms({
  to, name, scenarioId, revealAfterMs, language, content = null,
}) {
  if (!smsConfigured()) {
    throw new SmsUnavailable(
      'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID must be set; '
      + 'SMS_REVEAL_DELAY_MS, when set, must be between 15 minutes and 35 days',
    );
  }
  const written = typeof content?.text === 'string' ? content.text.trim() : '';
  const scenario = written ? null : pickScenario(scenarioId);
  // Neither path adds a URL: the scheduled reveal below is the drill's way out, and a
  // reply is answered by sms-reply.js.
  const bait = written || scenarioText(scenario, language);
  const delay = resolveRevealDelay(revealAfterMs);
  const revealAt = new Date(Date.now() + delay).toISOString();
  const scheduled = await twilioSend({ to, body: REVEAL_TEXTS[normalizeLanguage(language)], sendAt: revealAt });
  if (!scheduled?.sid || scheduled.status !== 'scheduled') {
    throw new SmsUnavailable('Twilio did not confirm the safety reveal as scheduled; bait was not sent');
  }

  let sent;
  try {
    sent = await twilioSend({ to, body: personalizeSmsText(bait, name) });
  } catch (baitError) {
    if (baitError?.code === 'SMS_PROVIDER_REJECTED') {
      // Twilio explicitly rejected the bait, so it is safe to remove the otherwise
      // confusing standalone reveal. Network/response ambiguity follows the branch
      // below and always keeps the reveal.
      try {
        await twilioCancel(scheduled.sid);
      } catch (cancelError) {
        console.error('[sms] rejected bait reveal cancellation failed:', cancelError);
      }
      throw baitError;
    }
    // A network failure can happen after Twilio accepted the bait. Never cancel the
    // already-scheduled reveal on an ambiguous response: an extra reassurance is safer
    // than a delivered simulated scam that is never revealed.
    throw new SmsDeliveryUnconfirmed(
      'SMS delivery could not be confirmed; safety reveal remains scheduled',
      {
        scenarioId: scenario ? scenario.id : GENERATED_SMS_SCENARIO_ID,
        revealSid: scheduled.sid,
        revealAt,
        revealInMs: delay,
      },
      baitError,
    );
  }
  return {
    sid: sent.sid,
    revealSid: scheduled.sid,
    // What was actually sent, so the caller can record it as the exchange's first turn.
    baitText: personalizeSmsText(bait, name),
    scenarioId: scenario ? scenario.id : GENERATED_SMS_SCENARIO_ID,
    revealAt,
    revealInMs: delay,
  };
}
