import type { OutfitDefinition } from "../types";
import { placeOutfit, shiftLeft } from "./map";

// The source sheet was one pixel right of the shared body; normalised here.
export const blueTank: OutfitDefinition = {
  palette: { a: "#3c588a", b: "#2b2528" },
  map: placeOutfit(13, [
    ".......aa....aa.....", ".......aaa..aaa.....", "........aaaaaa......", "........aaaaaa......",
    ".......aaaaaaaa.....", ".......aaaaaaaa.....", "......aaaaaaaaaa....", "......aaaaaaaaaa....",
    "......aaaaaaaaaa....", "......aaaaaaaaaa....", ".....aaaaaaaaaaaa...", "......bbbbbbbbbb....",
    "......bbbbbbbbbb....", "......bbbbbbbbbb....", "......bbbb..bbbb....", "......bbbb..bbbb....",
    "......bbbb..bbbb....", "......bbbb..bbbb....", "......bbbb..bbbb....",
  ].map(shiftLeft)),
};
