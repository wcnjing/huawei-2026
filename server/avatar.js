// The mascot a player designs. Values must match AvatarCustomisationScreen in
// src/app/App.tsx; anything else is rejected so stored JSON stays predictable.
export const AVATAR_PALETTE = ['#4ecdc4', '#ff6b35', '#c77dff', '#ffe66d', '#ff2d55', '#00ff88'];
export const AVATAR_OPTIONS = {
  color: AVATAR_PALETTE,
  glow: AVATAR_PALETTE,
  hat: ['None', 'Cap', 'Helmet', 'Crown'],
  eyes: ['Default', 'Shades', 'Visor', 'Goggles'],
  outfit: ['Standard', 'Camo', 'Neon', 'Stealth'],
};
export const DEFAULT_AVATAR = { color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard' };

/** A copy with exactly the allowed keys, or null if any value is not allowed. */
export function cleanAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const avatar = {};
  for (const [key, allowed] of Object.entries(AVATAR_OPTIONS)) {
    if (!allowed.includes(input[key])) return null;
    avatar[key] = input[key];
  }
  return avatar;
}
