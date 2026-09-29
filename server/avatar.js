// Server-side allowlist for the layered 20x32 human character. Keep in sync with
// src/app/components/avatars/character/config.ts so profile JSON stays predictable.
export const AVATAR_PALETTE = ['#4ecdc4', '#ff6b35', '#c77dff', '#ffe66d', '#ff2d55', '#00ff88'];
export const AVATAR_OPTIONS = {
  color: AVATAR_PALETTE,
  glow: AVATAR_PALETTE,
  skinTone: ['peach', 'golden', 'brown', 'deep'],
  hairStyle: ['long', 'pigtails', 'shoulder', 'side-part', 'cropped'],
  hairColor: ['midnight', 'brown', 'auburn', 'gold', 'silver'],
  outfit: ['sailor', 'yellow-dress', 'blue-shirt-pants', 'overalls', 'green-sweater'],
};
export const AVATAR_ACCESSORIES = ['round-glasses', 'hair-bow', 'necklace'];
export const DEFAULT_AVATAR = {
  color: '#4ecdc4',
  glow: '#00ff88',
  skinTone: 'peach',
  hairStyle: 'long',
  hairColor: 'midnight',
  outfit: 'blue-shirt-pants',
  accessories: [],
};

const LEGACY_OPTIONS = {
  hat: ['None', 'Cap', 'Helmet', 'Crown'],
  eyes: ['Default', 'Shades', 'Visor', 'Goggles'],
  outfit: ['Standard', 'Camo', 'Neon', 'Stealth'],
};

function legacyAvatar(input) {
  return AVATAR_PALETTE.includes(input.color)
    && AVATAR_PALETTE.includes(input.glow)
    && LEGACY_OPTIONS.hat.includes(input.hat)
    && LEGACY_OPTIONS.eyes.includes(input.eyes)
    && LEGACY_OPTIONS.outfit.includes(input.outfit);
}

/** A copy with exactly the allowed keys, or null if any value is not allowed. */
export function cleanAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  // Preserve old records byte-for-byte until that player saves a human character.
  // Current clients normalise this legacy shape to the clothed default for display.
  if (legacyAvatar(input)) {
    return {
      color: input.color,
      glow: input.glow,
      hat: input.hat,
      eyes: input.eyes,
      outfit: input.outfit,
    };
  }

  const avatar = {};
  for (const [key, allowed] of Object.entries(AVATAR_OPTIONS)) {
    if (!allowed.includes(input[key])) return null;
    avatar[key] = input[key];
  }
  if (!Array.isArray(input.accessories)
    || input.accessories.length > AVATAR_ACCESSORIES.length
    || new Set(input.accessories).size !== input.accessories.length
    || input.accessories.some((item) => !AVATAR_ACCESSORIES.includes(item))) return null;
  avatar.accessories = [...input.accessories];
  return avatar;
}
