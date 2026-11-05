/*
 * Colours that come from content files or data (hex codes like "#00ff88") are mapped onto the
 * theme tokens in src/styles/tokens.css, so a neon becomes a readable darker shade in the light
 * theme. Any other colour passes through unchanged.
 * This file is identical in the website (drill-mode-site/src/lib/color.ts).
 */
const TOKENS: Record<string, string> = {
  "#00ff88": "green", "#ffe66d": "yellow", "#4ecdc4": "teal", "#ff2d55": "red",
  "#ff6b35": "orange", "#c77dff": "violet", "#00d4ff": "cyan", "#ff71c5": "pink",
};
const NEUTRALS: Record<string, string> = {
  "#e8f4f8": "foreground", "#ffffff": "foreground-strong", "#9bb0c8": "soft-foreground", "#6b8ba4": "muted-foreground",
  "#2a3a5c": "border", "#1a2340": "secondary", "#111827": "card", "#0a0e1a": "background",
};

const key = (color: string) => color.trim().toLowerCase();

/** Colour for text (and icons, which turn it back into the neon with an outline in light). */
export function ink(color: string) {
  const k = key(color);
  if (TOKENS[k]) return `var(--${TOKENS[k]})`;
  if (NEUTRALS[k]) return `var(--${NEUTRALS[k]})`;
  return color;
}

/** Colour for borders, lines and pixel shadows: brighter than ink() in the light theme. */
export function line(color: string) {
  const k = key(color);
  if (TOKENS[k]) return `var(--${TOKENS[k]}-line)`;
  if (NEUTRALS[k]) return `var(--${NEUTRALS[k]})`;
  return color;
}

/** Colour for solid fills (buttons, bars, badges): the neon itself, in both themes. */
export function fill(color: string) {
  const k = key(color);
  if (TOKENS[k]) return `var(--${TOKENS[k]}-fill)`;
  if (NEUTRALS[k]) return `var(--${NEUTRALS[k]})`;
  return color;
}

/** A see-through wash of a colour, e.g. a pale red panel: tint("#ff2d55", 12). */
export function tint(color: string, percent: number) {
  return `color-mix(in srgb, ${ink(color)} ${percent}%, transparent)`;
}

/** A neon glow that only shows in the dark theme: textShadow: glow("#00ff88", 8). */
export function glow(color: string, blur: number) {
  return `0 0 calc(${blur}px * var(--glow)) ${ink(color)}`;
}
