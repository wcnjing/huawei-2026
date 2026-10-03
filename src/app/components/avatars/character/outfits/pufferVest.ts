import type { OutfitDefinition } from "../types";
import { placeOutfit } from "./map";

export const pufferVest: OutfitDefinition = {
  palette: { a: "#00cc6d", b: "#00ff88", c: "#2b2528" },
  map: placeOutfit(14, [
    "......aaa..aaa......", ".....aaaaaaaaaa.....", ".....aabbbbbbaa.....", ".....aaaaaaaaaa.....",
    ".....abbbbbbbba.....", ".....aaaaaaaaaa.....", ".....abbbbbbbba.....", ".....aaaaaaaaaa.....",
    ".....aaabbbbaaa.....", ".....aaaaaaaaaa.....", ".....cccccccccc.....", ".....cccccccccc.....",
    ".....cccccccccc.....", ".....cccc..cccc.....", ".....cccc..cccc.....", ".....cccc..cccc.....",
    ".....cccc..cccc.....", ".....cccc..cccc.....",
  ]),
};
