// Turns a stored tactic card into the parts of a call prompt that change per drill.
//
// Every sentence here is ours; a card only fills slots. The identity the caller claims
// never comes from the card at all. It is looked up below, so a report about a real bank
// still produces a drill from an invented one. The card is re-validated first, so nothing
// reaches a prompt on the strength of having been stored.
import { ASKS, IMPERSONATES, PRESSURE_LEVERS, validateStoredCard } from './validate.js';

// Every identity is FICTIONAL, and translated for each app language: a Tamil call that
// names its organisation in English is obviously machine-made and wastes the drill.
// The caller's given name is kept the same across languages — people do not rename
// themselves — while the organisation and the topic are said the way a speaker would.
export const FICTIONAL_IDENTITIES = Object.freeze({
  government_agency: {
    caller: 'Officer Tan', org: 'the Office of Public Trust', topic: 'an urgent matter on your bank account',
    i18n: {
      zh: { caller: '陈警官', org: '公共信托办公室', topic: '您银行账户的一件紧急事项' },
      ms: { caller: 'Pegawai Tan', org: 'Pejabat Amanah Awam', topic: 'perkara mendesak mengenai akaun bank anda' },
      ta: { caller: 'அதிகாரி டான்', org: 'பொது நம்பிக்கை அலுவலகம்', topic: 'உங்கள் வங்கிக் கணக்கு தொடர்பான அவசர விஷயம்' },
    },
  },
  bank: {
    caller: 'Daniel', org: "Meridian Bank's fraud team", topic: 'a suspicious transaction on your account',
    i18n: {
      zh: { caller: 'Daniel', org: 'Meridian Bank 诈骗调查组', topic: '您账户上一笔可疑交易' },
      ms: { caller: 'Daniel', org: 'pasukan penipuan Meridian Bank', topic: 'transaksi mencurigakan dalam akaun anda' },
      ta: { caller: 'Daniel', org: 'Meridian Bank மோசடி பிரிவு', topic: 'உங்கள் கணக்கில் சந்தேகத்திற்குரிய பரிவர்த்தனை' },
    },
  },
  telco: {
    caller: 'Priya', org: 'Northwave Mobile account security', topic: 'a problem with your mobile line',
    i18n: {
      zh: { caller: 'Priya', org: 'Northwave Mobile 账户安全部', topic: '您手机线路的问题' },
      ms: { caller: 'Priya', org: 'keselamatan akaun Northwave Mobile', topic: 'masalah dengan talian mudah alih anda' },
      ta: { caller: 'Priya', org: 'Northwave Mobile கணக்குப் பாதுகாப்பு', topic: 'உங்கள் மொபைல் இணைப்பில் உள்ள சிக்கல்' },
    },
  },
  delivery_company: {
    caller: 'Rachel', org: 'ParcelLink customer care', topic: 'a parcel being held under your name',
    i18n: {
      zh: { caller: 'Rachel', org: 'ParcelLink 客户服务', topic: '一件以您名义扣留的包裹' },
      ms: { caller: 'Rachel', org: 'khidmat pelanggan ParcelLink', topic: 'bungkusan yang ditahan atas nama anda' },
      ta: { caller: 'Rachel', org: 'ParcelLink வாடிக்கையாளர் சேவை', topic: 'உங்கள் பெயரில் நிறுத்தி வைக்கப்பட்ட பார்சல்' },
    },
  },
  tech_support: {
    caller: 'Kevin', org: 'CloudMail technical support', topic: 'a security alert on your account',
    i18n: {
      zh: { caller: 'Kevin', org: 'CloudMail 技术支持', topic: '您账户的一则安全警报' },
      ms: { caller: 'Kevin', org: 'sokongan teknikal CloudMail', topic: 'amaran keselamatan pada akaun anda' },
      ta: { caller: 'Kevin', org: 'CloudMail தொழில்நுட்ப ஆதரவு', topic: 'உங்கள் கணக்கில் பாதுகாப்பு எச்சரிக்கை' },
    },
  },
  online_marketplace: {
    caller: 'Aaron', org: 'MarketNest buyer protection', topic: 'a problem with one of your orders',
    i18n: {
      zh: { caller: 'Aaron', org: 'MarketNest 买家保障部', topic: '您其中一笔订单的问题' },
      ms: { caller: 'Aaron', org: 'perlindungan pembeli MarketNest', topic: 'masalah dengan salah satu pesanan anda' },
      ta: { caller: 'Aaron', org: 'MarketNest வாங்குபவர் பாதுகாப்பு', topic: 'உங்கள் ஆர்டர்களில் ஒன்றில் உள்ள சிக்கல்' },
    },
  },
});

export const PRESSURE_COPY = Object.freeze({
  authority: 'lean on your official position and insist you are only following procedure',
  urgency: 'insist it has to be settled before this call ends',
  fear: 'warn that their account faces serious consequences if they do not act now',
  reward: 'dangle a refund or benefit they will lose if they hesitate',
});

export const ASK_COPY = Object.freeze({
  read_otp: 'get them to read out the one-time code just sent to their phone',
  share_card_details: 'get them to read out their card number so you can "verify" it',
  transfer_funds: 'get them to move their money into a "safe account"',
});

// Fail at import rather than mid-call if a vocabulary value ever lacks its copy.
for (const [values, copy, name] of [
  [IMPERSONATES, FICTIONAL_IDENTITIES, 'FICTIONAL_IDENTITIES'],
  [PRESSURE_LEVERS, PRESSURE_COPY, 'PRESSURE_COPY'],
  [ASKS, ASK_COPY, 'ASK_COPY'],
]) {
  for (const value of values) {
    if (!copy[value]) throw new Error(`render.js: ${name} has no entry for "${value}"`);
  }
}

/**
 * Render a stored card for one call. Returns null when the card fails re-validation, and
 * the caller then uses the default persona.
 */
export function renderTactic(stored) {
  const checked = validateStoredCard(stored);
  if (!checked.ok) return null;
  const card = checked.card;
  const identity = FICTIONAL_IDENTITIES[card.impersonates];
  const pretext = card.pretext.replace(/[\s.]+$/, '');
  const roleBlock = [
    'ROLE: You are role-playing a scam caller for a CONSENTED SafeSpace safety drill.',
    `You are "${identity.caller}" from the FICTIONAL "${identity.org}". Never name a real agency, bank or company.`,
    `This drill follows a scam pattern recently reported in Singapore, "${card.tacticName}".`,
    `COVER STORY: ${pretext}.`,
    `OBJECTIVE: Using realistic pressure, ${ASK_COPY[card.theAsk]}.`,
    `PRESSURE: ${PRESSURE_COPY[card.pressureLever]}.`,
  ].join('\n');
  return {
    roleBlock,
    opener: { caller: identity.caller, org: identity.org, topic: identity.topic, i18n: identity.i18n },
    card: {
      id: card.id,
      tacticName: card.tacticName,
      sourceLabel: card.sourceLabel,
      sourceUrl: card.sourceUrl,
    },
  };
}
