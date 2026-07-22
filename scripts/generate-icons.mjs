// Generates the PWA icons as pixel art, so they match the Press Start 2P /
// zero-radius look of the app instead of being a smoothly-scaled logo.
//
//   node scripts/generate-icons.mjs
//
// Everything is drawn on a 32x32 logical grid and scaled up by an integer
// factor with nearest-neighbour, which keeps the pixel edges hard. Output
// sizes are therefore all multiples of 32.
//
// No image library: PNG is simple enough to emit directly (zlib is built in),
// and adding sharp for four small files is not worth the install.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const GRID = 32;
const BG = [0x0a, 0x0e, 0x1a, 0xff]; // --background
const FG = [0x00, 0xff, 0x88, 0xff]; // --primary

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 = compression, filter, interlace — all 0

  // Each scanline is prefixed with filter type 0 (None).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    px.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Drawing ----------------------------------------------------------------

// `inset` shrinks the shield towards the centre. Maskable icons get a bigger
// inset because Android crops them to a circle and would otherwise clip the
// shield's shoulders.
function drawShield(inset) {
  const grid = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const cx = (GRID - 1) / 2;

  const top = 4 + inset;
  const shoulder = 17 - Math.floor(inset / 2);
  const tip = 28 - inset;
  const maxHw = 12 - inset;

  for (let r = top; r <= tip; r++) {
    let hw;
    if (r <= shoulder) hw = r === top ? maxHw - 1 : maxHw; // rounded top edge
    else hw = maxHw - ((r - shoulder) * maxHw) / (tip - shoulder);
    if (hw < 0.5) continue;
    for (let c = Math.ceil(cx - hw); c <= Math.floor(cx + hw); c++) {
      if (c >= 0 && c < GRID) grid[r][c] = true;
    }
  }
  return { grid, top, tip, maxHw, cx };
}

// Stamps a thick line by walking it and filling a disc at each step — simpler
// to reason about than a Bresenham variant, and precision is irrelevant at 32px.
function carveLine(grid, x0, y0, x1, y1, radius) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.hypot(dx, dy) > radius) continue;
        const c = Math.round(x + dx);
        const r = Math.round(y + dy);
        if (r >= 0 && r < GRID && c >= 0 && c < GRID) grid[r][c] = false;
      }
    }
  }
}

function buildGrid(inset) {
  const { grid, top, tip, maxHw, cx } = drawShield(inset);

  // A tick knocked out of the shield, sized off the shield so both insets look
  // the same rather than the tick drifting when the shield shrinks.
  const h = tip - top;
  const vx = cx - maxHw * 0.06;
  const vy = top + h * 0.66;
  carveLine(grid, cx - maxHw * 0.5, top + h * 0.42, vx, vy, 1.4);
  carveLine(grid, vx, vy, cx + maxHw * 0.62, top + h * 0.2, 1.4);

  return grid;
}

function render(grid, size) {
  const scale = size / GRID;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      const [r, g, b, a] = on ? FG : BG;
      const i = (y * size + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }
  return encodePng(px, size);
}

// --- Output -----------------------------------------------------------------

mkdirSync("public", { recursive: true });

const standard = buildGrid(0);
const maskable = buildGrid(3);

const files = [
  ["public/icon-192.png", standard, 192],
  ["public/icon-512.png", standard, 512],
  ["public/icon-maskable-512.png", maskable, 512],
  // iOS ignores the manifest and always crops to a rounded square, so it gets
  // the maskable artwork rather than the full-bleed one.
  ["public/apple-touch-icon.png", maskable, 192],
];

for (const [path, grid, size] of files) {
  if (size % GRID !== 0) throw new Error(`${size} is not a multiple of ${GRID}`);
  writeFileSync(path, render(grid, size));
  console.log(`wrote ${path} (${size}x${size})`);
}
