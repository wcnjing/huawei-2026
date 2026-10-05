// A member's room look. The option ids mirror src/app/types/roomStyle.ts (a frontend
// module the server can't import); room-style.test.mjs checks the two lists stay equal.
// Unlike home-inventory.js this is a fixed allowlist: the values end up in other
// members' browsers, so nothing outside these ids (e.g. arbitrary CSS) is ever stored.
export const ROOM_STYLE_OPTIONS = {
  wall: ['auto', 'midnight', 'violet', 'lagoon', 'rose', 'forest'],
  pattern: ['grid', 'plain', 'stripes', 'stars', 'brick', 'hex', 'circuit'],
  floor: ['original', 'oak', 'tile', 'checker', 'carpet', 'concrete', 'neon', 'metal'],
  light: ['auto', 'mint', 'green', 'pink', 'purple', 'gold'],
};
const MAX_NAME_LENGTH = 32;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A copy with exactly the allowed shape, or null if anything doesn't fit. */
export function cleanRoomStyle(input) {
  if (!isPlainObject(input)) return null;
  const clean = {};
  for (const [key, options] of Object.entries(ROOM_STYLE_OPTIONS)) {
    if (!options.includes(input[key])) return null;
    clean[key] = input[key];
  }
  if (typeof input.glow !== 'boolean') return null;
  clean.glow = input.glow;
  const name = input.name ?? '';
  if (typeof name !== 'string') return null;
  // Same normalisation as the client: no control characters, trimmed, at most 32.
  clean.name = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return clean;
}

/**
 * What a member's housemates see of their room: its look, owned furniture and layout,
 * plus the coin balance the member has chosen to share through the room UI. Other
 * home-inventory fields remain private.
 */
export function roomView(user) {
  const inventory = isPlainObject(user?.homeInventory) ? user.homeInventory : {};
  const items = inventory.purchasedItems?.[user.id];
  const layout = inventory.roomLayouts?.[user.id];
  const balance = inventory.coins?.[user.id];
  return {
    style: user?.roomStyle ?? null,
    items: Array.isArray(items) ? items : [],
    layout: isPlainObject(layout) ? layout : null,
    coins: Number.isSafeInteger(balance) && balance >= 0 ? balance : 0,
  };
}
