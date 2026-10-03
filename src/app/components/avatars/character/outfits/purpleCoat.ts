import type { OutfitDefinition } from "../types";
import { placeOutfit } from "./map";

export const purpleCoat: OutfitDefinition = {
  palette: { a: "#8b6b9a", b: "#5a2a71", c: "#2b2528" },
  map: placeOutfit(13, [
    ".....aaa....aaa.....", ".....bbba..abbb.....", "....bbbbbbbbbbbb....", "....bbbbbbbbbbbb....",
    "....bbbbbaabbbbb....", "...bbbbbbbbbbbbbb...", "..abbbbbbbbbbbbbba..", "...aabbbbaabbbbaa...",
    ".....bbbbbbbbbb.....", ".....bbbbbbbbbb.....", "....bbbbbaabbbbb....", "....bbbbbbbbbbbb....",
    "....bbbbbbbbbbbb....", "...bbbbbbbbbbbbbb...", "....baaaabbaaaab....", ".....aaaa..aaaa.....",
    ".....aaaa..aaaa.....", ".....aaaa..aaaa.....", "......ccc..ccc......",
  ]),
};
