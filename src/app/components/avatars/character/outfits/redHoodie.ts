import type { OutfitDefinition } from "../types";
import { placeOutfit, shiftLeft } from "./map";

// The source sheet was one pixel right of the shared body; normalised here.
export const redHoodie: OutfitDefinition = {
  palette: { a: "#93362d", b: "#d25f54", c: "#5c1f19", d: "#112954", e: "#5a6b8b" },
  map: placeOutfit(12, [
    ".....aa........aa...", "....aaaab....baaaa..", ".....aaaba..abaaa...", "......aabaaaabaa....",
    ".....aaacaaaacaaa...", ".....aaacaaaacaaa...", ".....aaaaaaaaaaaa...", "....aaaaaaaaaaaaaa..",
    "....aaaaaaaaaaaaaa..", "....aaaaaaaaaaaaaa..", "......aaaaaaaaaa....", "......dedddddded....",
    "......dedddddded....", "......edddddddde....", "......dddddddddd....", "......dddd..dddd....",
    "......dddd..dddd....", "......dddd..dddd....", "......dddd..dddd....", "......dddd..dddd....",
  ].map(shiftLeft)),
};
