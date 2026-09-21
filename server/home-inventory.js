// Coins and furniture. Item ids come from the client's shop catalogue (src/app/
// shop-catalogue.ts, a frontend-only module the server can't import), which grows over
// time, so this validates shape and bounds rather than an exact allowlist — unlike
// avatar.js, which can afford a fixed enum because that set almost never changes.
// One signed-in id today, but the client's local snapshot keeps every id it has ever
// seen on that device (old role ids pending a one-off migration, every account that's
// signed into a shared/demo device) until each is folded away, so this stays generous
// rather than tight — MAX_SERIALISED_BYTES is the real size control below.
const MAX_KEYS = 64;
const MAX_ITEMS_PER_MEMBER = 200;
const MAX_ID_LENGTH = 64;
const MAX_SERIALISED_BYTES = 20_000;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Used as both object keys and array entries below. Object.entries() never yields
// these for a plain `{}` literal, but a JSON-parsed request body can carry any string
// key — accepting one here would silently set the accumulator's prototype instead of
// an own property (`clean[key] = ...` with key "__proto__"), dropping that entry.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
    && !UNSAFE_KEYS.has(value);
}

function cleanCoins(coins) {
  if (!isPlainObject(coins)) return null;
  const entries = Object.entries(coins);
  if (entries.length > MAX_KEYS) return null;
  const clean = {};
  for (const [key, value] of entries) {
    if (!isId(key) || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
    clean[key] = Math.floor(value);
  }
  return clean;
}

function cleanIdList(list) {
  if (!Array.isArray(list) || list.length > MAX_ITEMS_PER_MEMBER) return null;
  const clean = [];
  for (const id of list) {
    if (!isId(id)) return null;
    clean.push(id);
  }
  return [...new Set(clean)];
}

function cleanItemsByMember(byMember) {
  if (!isPlainObject(byMember)) return null;
  const entries = Object.entries(byMember);
  if (entries.length > MAX_KEYS) return null;
  const clean = {};
  for (const [memberId, ids] of entries) {
    if (!isId(memberId)) return null;
    const cleanIds = cleanIdList(ids);
    if (!cleanIds) return null;
    clean[memberId] = cleanIds;
  }
  return clean;
}

function cleanPosition(position) {
  if (!isPlainObject(position)) return null;
  const { x, y } = position;
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 100) return null;
  if (typeof y !== 'number' || !Number.isFinite(y) || y < 0 || y > 100) return null;
  return { x, y };
}

function cleanRoomLayouts(layouts) {
  if (!isPlainObject(layouts)) return null;
  const entries = Object.entries(layouts);
  if (entries.length > MAX_KEYS) return null;
  const clean = {};
  for (const [memberId, layout] of entries) {
    if (!isId(memberId) || !isPlainObject(layout)) return null;
    const layoutEntries = Object.entries(layout);
    if (layoutEntries.length > MAX_ITEMS_PER_MEMBER) return null;
    const cleanLayout = {};
    for (const [itemId, position] of layoutEntries) {
      if (!isId(itemId)) return null;
      const cleanPos = cleanPosition(position);
      if (!cleanPos) return null;
      cleanLayout[itemId] = cleanPos;
    }
    clean[memberId] = cleanLayout;
  }
  return clean;
}

/**
 * A copy with exactly the allowed shape, or null if anything doesn't fit. Coins and
 * furniture are one record, same as the client's HomeInventory (App.tsx): persisting
 * only ownership would restore bought items after a reload while also refunding their
 * cost, so a save is all-or-nothing.
 */
export function cleanHomeInventory(input) {
  if (!isPlainObject(input)) return null;
  const coins = cleanCoins(input.coins);
  const soldItems = cleanIdList(input.soldItems);
  const purchasedItems = cleanItemsByMember(input.purchasedItems);
  const roomLayouts = cleanRoomLayouts(input.roomLayouts);
  if (!coins || !soldItems || !purchasedItems || !roomLayouts) return null;
  const clean = { coins, soldItems, purchasedItems, roomLayouts };
  if (JSON.stringify(clean).length > MAX_SERIALISED_BYTES) return null;
  return clean;
}
