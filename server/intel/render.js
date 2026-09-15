// Turns a stored tactic card into the parts of a call prompt that change per drill.
//
// Every sentence here is ours; a card only fills slots. The identity the caller claims
// never comes from the card at all. It is looked up below, so a report about a real bank
// still produces a drill from an invented one. The card is re-validated first, so nothing
// reaches a prompt on the strength of having been stored.
import { ASKS, IMPERSONATES, PRESSURE_LEVERS, validateStoredCard } from './validate.js';

export const FICTIONAL_IDENTITIES = Object.freeze({
  government_agency: { caller: 'Officer Tan', org: 'the Office of Public Trust', topic: 'an urgent matter on your bank account' },
  bank: { caller: 'Daniel', org: "Meridian Bank's fraud team", topic: 'a suspicious transaction on your account' },
  telco: { caller: 'Priya', org: 'Northwave Mobile account security', topic: 'a problem with your mobile line' },
  delivery_company: { caller: 'Rachel', org: 'ParcelLink customer care', topic: 'a parcel being held under your name' },
  tech_support: { caller: 'Kevin', org: 'CloudMail technical support', topic: 'a security alert on your account' },
  online_marketplace: { caller: 'Aaron', org: 'MarketNest buyer protection', topic: 'a problem with one of your orders' },
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
    opener: { caller: identity.caller, org: identity.org, topic: identity.topic },
    card: {
      id: card.id,
      tacticName: card.tacticName,
      sourceLabel: card.sourceLabel,
      sourceUrl: card.sourceUrl,
    },
  };
}
