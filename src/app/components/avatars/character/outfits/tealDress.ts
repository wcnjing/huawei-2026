import type { OutfitDefinition } from "../types";
import { placeOutfit, shiftLeft } from "./map";

// The source sheet was one pixel right of the shared body; normalised here.
export const tealDress: OutfitDefinition = {
  palette: { a: "#4ecdc4", b: "#3b9b94", c: "#00ffe8" },
  map: placeOutfit(14, [
    ".......aaa..aaa.....", "........aaaaaa......", ".......aaaaaaaa.....", "......aaaaaaaaaa....",
    "......aaaaaaaaaa....", "......aaaaaaaaaa....", "......aaaaaaaaaa....", "......aaaaaaaaaa....",
    ".......bbbccbbb.....", "......aaaaaaaaaa....", ".....aabaaaaaabaa...", ".....aabaabaaabaa...",
    "....aaabaababaabaa..", "....aabaabaaaaabaa..", "...aabaaaaaaabaabaa.", "...aaaaabaaaaabaaaa.",
    ".....aaaaaaaaaaaa...", ".......ccc..ccc.....",
  ].map(shiftLeft)),
};
