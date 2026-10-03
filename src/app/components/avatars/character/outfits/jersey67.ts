import type { OutfitDefinition } from "../types";
import { placeOutfit } from "./map";

export const jersey67: OutfitDefinition = {
  palette: { a: "#fff4e7", b: "#f85b4c", c: "#5c1f19", d: "#39130f", e: "#ffe66d" },
  map: placeOutfit(14, [
    "......aab..baa......", ".....aaabbbbaaa.....", "....aaaaaaaaaaaa....", "...aaaaacacccaaaa...",
    "...bbaacaaaaacabb...", ".....acaaaaaaca.....", ".....acccaaacaa.....", ".....acaacaacaa.....",
    ".....aaccaacaaa.....", ".....aaaaaaaaaa.....", ".....ddddeedddd.....", ".....cccccccccc.....",
    ".....cccccccccc.....", ".....cccccccccc.....", ".....cccc..cccc.....", ".....cccc..cccc.....",
    ".....cccc..cccc.....", "......ddd..ddd......",
  ]),
};
