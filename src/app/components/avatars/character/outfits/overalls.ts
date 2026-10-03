import type { OutfitDefinition } from "../types";
import { placeOutfit } from "./map";

export const overalls: OutfitDefinition = {
  palette: { a: "#6d515f", b: "#3c588a", c: "#d8c778", d: "#66738a" },
  map: placeOutfit(14, [
    "......aba..aba......", "....aaabaaaabaaa....", "....aaabaaaabaaa....", ".....aabaaaabaa.....",
    ".....aabbbbbbaa.....", ".....abcbbbbcba.....", ".....abbbbbbbba.....", ".....abbddddbba.....",
    ".....bbbddddbbb.....", ".....bbbbbbbbbb.....", ".....bdbbbbbbdb.....", ".....dbbbbbbbbd.....",
    ".....bbbbbbbbbb.....", ".....bbbb..bbbb.....", ".....bbbb..bbbb.....", ".....bbbd..dbbb.....",
    ".....bbdb..bdbb.....", ".....dddd..dddd.....",
  ]),
};
