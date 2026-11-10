// The house chat's custom emojis, as the server sees them. In a message they are short
// codes between colons (":shield:", ":pixi:", ":head-3f2a9c1b:") that the app draws as
// pixel pictures (src/app/screens/chat/chatEmoji.tsx has the same codes; a test checks they
// match). Messages are stored exactly as typed, so nothing here changes what members send.
// Pixi gets the list so it can read them and use them in its replies, and any code it makes
// up is taken out before the reply is posted.

/** Each code and what it shows, in words for the model. Same order as the app's picker. */
export const CHAT_EMOJI = {
  pixi: 'Pixi\'s own face (you)',
  mascot: 'the pixel mascot from the leaderboard',
  shield: 'a green shield: safe, protected',
  trophy: 'a gold trophy: a win, well done',
  medal: 'a gold medal: first place',
  star: 'a yellow star: great job',
  flame: 'an orange flame: on fire, a streak',
  coin: 'a gold coin: coins, money',
  bulb: 'a light bulb: an idea or a tip',
  tick: 'a green tick: yes, done, correct',
  cross: 'a red cross: no, wrong',
  warning: 'an orange warning sign: careful, a red flag',
  skull: 'a red skull: got scammed, danger',
  flag: 'an orange flag: report it',
  lock: 'a padlock: private, keep it secret',
  eye: 'an eye: look closely, check first',
  house: 'a house: home',
  family: 'a family: the whole family',
  bell: 'a bell: heads up, a reminder',
  phone: 'a phone: a call',
  email: 'an envelope: an email',
  chat: 'a speech bubble: let\'s talk',
  sun: 'a sun: good morning',
  moon: 'a moon: good night',
  tree: 'a tree: the family tree',
  badge: 'a badge: an achievement',
};

/**
 * The code for a member's head: "head-" and the first 8 letters or digits of their id
 * (the first block of a UUID). The app's headCode() in chatEmoji.tsx is the same.
 */
export function headCode(id) {
  return `head-${String(id ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`;
}

// A code in text: a letter, then letters, digits or dashes. Starting with a letter keeps
// times like "10:30:45" out of it.
export const EMOJI_CODE_RE = /:([a-z][a-z0-9-]{1,31}):/g;

/** Every code that means something in this house: the fixed set and each member's head. */
export function emojiCodes(members = []) {
  return new Set([...Object.keys(CHAT_EMOJI), ...members.map((m) => headCode(m.id))]);
}

/**
 * The list Pixi is given: [{ code: ':shield:', shows: 'a green shield: …' }, …], then one
 * entry per member's head, named the way Pixi calls them (`callThem`, a Map of id → name).
 */
export function emojiGuide(members = [], callThem = new Map()) {
  return [
    ...Object.entries(CHAT_EMOJI).map(([code, shows]) => ({ code: `:${code}:`, shows })),
    ...members.map((m) => ({
      code: `:${headCode(m.id)}:`,
      shows: `${callThem.get(m.id) || m.name}'s head`,
    })),
  ];
}

/** `text` without any code that isn't in `codes`, tidied so no gap or stray space is left. */
export function dropUnknownEmoji(text, codes) {
  return String(text)
    .replace(EMOJI_CODE_RE, (match, code) => (codes.has(code) ? match : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?;:](?![a-z]))/g, '$1')
    .trim();
}
