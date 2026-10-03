import type { OutfitDefinition } from "../types";
import { placeOutfit } from "./map";

export const pinafore: OutfitDefinition = {
  palette: { a: "#9b4dca", b: "#7a3a9a" },
  map: placeOutfit(14, [
    ".......aa..aa.......", ".......aaaaaa.......", ".......aaaaaa.......", "......bbaaaabb......",
    ".....aabbaabbaa.....", ".....aaabbbbaaa.....", ".....aaaabbaaaa.....", ".....aaabbbbaaa.....",
    ".....aabbaabbaa.....", ".....abbaaaabba.....", "....abbaaaaaabba....", "....bbaaaaaaaabb....",
    "....baaaaaaaaaab....", "...bbaaaaaaaaaabb...", "...baaaaaaaaaaaab...", "....aaaaaaaaaaaa....",
    ".....aaaaaaaaaa.....", "......bbb..bbb......",
  ]),
};
