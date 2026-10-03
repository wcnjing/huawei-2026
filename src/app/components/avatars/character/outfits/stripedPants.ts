import type { OutfitDefinition } from "../types";
import { placeOutfit } from "./map";

export const stripedPants: OutfitDefinition = {
  palette: { a: "#d8e1f1", b: "#3c588a", c: "#b2b9c6", d: "#66738a" },
  map: placeOutfit(13, [
    "......aa....aa......", ".....aaaa..aaaa.....", "......aaaaaaaa......", "......aaaaaaaa......",
    "......ababbaba......", "......aabbbbaa......", ".....aaaabbaaaa.....", ".....aabbaabbaa.....",
    ".....aaaaaaaaaa.....", ".....aaaaaaaaaa.....", ".....cccccccccc.....", ".....dddddddddd.....",
    ".....cccccccccc.....", ".....dddddddddd.....", ".....cccc..cccc.....", ".....dddd..dddd.....",
    ".....cccc..cccc.....", ".....dddd..dddd.....", ".....cccc..cccc.....",
  ]),
};
