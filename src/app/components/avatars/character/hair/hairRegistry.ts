import type { HairStyleId, PixelMap } from "../types";

const empty = "....................";
const pad = (rows: string[]): PixelMap => [...rows, ...Array.from({ length: 32 - rows.length }, () => empty)];

export const hairRegistry: Record<HairStyleId, PixelMap> = {
  long: pad([
    empty, "........hhhh........", ".....hhhhhhhhhh.....", "....hhhhhhhhhhhh....", "....hhhhhhhhhhhh....",
    "....hhh......hhh....", "...hhh........hhh...", "...hhh........hhh...", "...hh..........hh...",
    "...hhh........hhh...", "..hhhh........hhhh..", "..hhhh........hhhh..", "...hhh........hhh...",
    ".....h........h.....",
  ]),
  pigtails: pad([
    empty, empty, ".......hhhhhhhh.....", ".....hhhhhhhhhhhh...", "....hhhhhhhhhhhhhh..",
    "....hhhh.hhhh.hhhh..", "....hhh........hhh..", "....hhh........hhh..", ".....hh........hh...",
    "....hh..........hh..", "...hh............hh.", "..hhh............hhh", "...h..............h.",
  ]),
  shoulder: pad([
    empty, empty, ".......hhhhhhhh.....", ".....hhhhhhhhhhhh...", "....hhhhhhhhhhhhhh..",
    "....hhhh..hh..hhhh..", "....hhh........hhh..", "....hhh........hhh..", ".....hh........hh...",
    ".....h..........h...", ".....h..........h...",
  ]),
  "side-part": pad([
    empty, empty, ".......hhhhhh.......", ".....hhhhhhhhhh.....", "....hhhhhhhhhhhh....",
    "...hhhhh....hhhhh...", "...hhh........hhh...", "...hh..........hh...", "...hh..........hh...",
    "...hh..........hh...", "....h..........h....",
  ]),
  cropped: pad([
    empty, empty, ".......hhhhhh.......", ".....hhhhhhhhhh.....", "....hhhhhhhhhhhh....",
    "....hhh......hhh....", ".....h........h.....",
  ]),
};

