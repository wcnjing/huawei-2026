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
const HUES = new Set(Object.values(TOKENS));
/** "teal" for "var(--teal)", the hue's text token; otherwise undefined. */
const hueToken = (color: string) => {
  const name = key(color).match(/^var\(--([a-z]+)\)$/)?.[1];
  return name && HUES.has(name) ? name : undefined;
};

/** Colour for text (and icons, which turn it back into the neon with an outline in light). */
export function ink(color: string) {
  const k = key(color);
  if (TOKENS[k]) return `var(--${TOKENS[k]})`;
  if (NEUTRALS[k]) return `var(--${NEUTRALS[k]})`;
  return color;
}

/** Colour for borders, lines and pixel shadows: brighter than ink() in the light theme.
 *  Also takes a hue's text token: line("var(--teal)") is var(--teal-line). */
export function line(color: string) {
  const k = key(color);
  if (TOKENS[k]) return `var(--${TOKENS[k]}-line)`;
  const hue = hueToken(color);
  if (hue) return `var(--${hue}-line)`;
  if (NEUTRALS[k]) return `var(--${NEUTRALS[k]})`;
  return color;
}

/** Colour for solid fills (buttons, bars, badges): the neon itself, in both themes.
 *  Also takes a hue's text token: fill("var(--teal)") is var(--teal-fill). */
export function fill(color: string) {
  const k = key(color);
  if (TOKENS[k]) return `var(--${TOKENS[k]}-fill)`;
  const hue = hueToken(color);
  if (hue) return `var(--${hue}-fill)`;
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
