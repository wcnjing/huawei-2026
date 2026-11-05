// Theme safety net:  npm run check:theme
// 1. Fails if a palette hex code (like #00ff88) is written straight into UI code, where it would
//    ignore the light theme. Use the tokens instead: var(--green), or ink()/fill()/tint() for
//    colours that come from content files. Art (characters, Pixi, rooms) is allowed below.
// 2. Checks that every light palette in src/styles/tokens.css keeps text readable (WCAG AA).
// The same script is on the website (drill-mode-site/scripts/check-theme.mjs) with its own ALLOW list.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(root, "src");

/** Files that may keep hex codes: art, content data, and the token/colour definitions. */
const ALLOW = [
  /^app\/components\/(avatars|furniture|icons)\//, /^app\/components\/room\/(RoomBackdrop|RoomEditor)\.tsx$/,
  /^app\/(types|data|i18n)\//, /^app\/utils\/color\.ts$/, /^styles\/(tokens|room-style)\.css$/,
  /^app\/screens\/home\/(HouseRoof|DollhouseRoom|SoloRoom)\.tsx$/, /^app\/screens\/title\//,
  /^app\/screens\/drills\/call\/PixelPhone\.tsx$/, /^app\/screens\/drills\/family\/(SmsMockCard|FamilyRoundScreen)\.tsx$/,
  /^app\/components\/ui\/InspectableLink\.tsx$/, /^app\/App\.tsx$/,
];
const PALETTE = ["#00ff88", "#ffe66d", "#4ecdc4", "#ff2d55", "#ff6b35", "#c77dff", "#00d4ff", "#ff71c5", "#0a0e1a", "#111827", "#1a2340", "#2a3a5c", "#e8f4f8", "#9bb0c8", "#6b8ba4"];

let failed = false;
const fail = (msg) => { failed = true; console.log(`  ✗ ${msg}`); };

console.log("\nHard-coded palette colours");
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts|css)$/.test(f)) files.push(p);
  }
})(SRC);
let hits = 0;
for (const file of files) {
  const rel = relative(SRC, file).replace(/\\/g, "/");
  if (ALLOW.some((re) => re.test(rel))) continue;
  readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g)) {
      if (PALETTE.includes(m[0].slice(0, 7).toLowerCase())) { hits++; fail(`${rel}:${i + 1}  ${m[0]}  (use a token)`); }
    }
  });
}
if (!hits) console.log("  ✓ no palette hex codes outside art and content");

console.log("\nReadability of each theme (WCAG contrast)");
const css = readFileSync(join(SRC, "styles", "tokens.css"), "utf8");
const block = (selector) => {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
};
const fills = block(":root,\n[data-theme]");
const dark = block(":root,\n[data-theme=\"dark\"]");
const mist = { ...dark, ...block("[data-theme=\"light\"]") };
const themes = {
  "Light · Mist": mist,
  "Light · Paper": { ...mist, ...block("[data-theme=\"light\"][data-palette=\"paper\"]") },
  "Light · Dusk": { ...mist, ...block("[data-theme=\"light\"][data-palette=\"dusk\"]") },
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const HUES = ["green", "yellow", "teal", "red", "orange", "violet", "cyan", "pink"];

for (const [name, t] of Object.entries(themes)) {
  const checks = [];
  for (const surface of ["background", "card"]) {
    for (const text of ["foreground", "soft-foreground", "muted-foreground", ...HUES]) checks.push([text, surface, 4.5]);
  }
  checks.push(["foreground", "secondary", 4.5], ["soft-foreground", "secondary", 4.5]);
  checks.push(["border-strong", "background", 3], ["sun", "background", 3]);
  for (const h of HUES) checks.push(["on-fill", `${h}-fill`, 4.5]);
  let worst = Infinity;
  for (const [a, b, min] of checks) {
    const fa = t[a] ?? fills[a], fb = t[b] ?? fills[b];
    if (!fa || !fb) { fail(`${name}: --${a} or --${b} isn't a hex code in tokens.css`); continue; }
    const r = ratio(fa, fb);
    worst = Math.min(worst, r / min);
    if (r < min) fail(`${name}: --${a} on --${b} is ${r.toFixed(2)}:1 (needs ${min}:1)`);
  }
  if (worst >= 1) console.log(`  ✓ ${name}: all ${checks.length} text/background pairs pass`);
}

console.log(failed ? "\nSome theme checks failed. See the ✗ lines above.\n" : "\nAll theme checks passed.\n");
process.exit(failed ? 1 : 0);
