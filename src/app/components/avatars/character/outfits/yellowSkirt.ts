import type { OutfitDefinition } from "../types";
import { placeOutfit, shiftLeft } from "./map";

// The source sheet was one pixel right of the shared body; normalised here.
export const yellowSkirt: OutfitDefinition = {
  palette: { a: "#ffe66d", b: "#fff4c2", c: "#d5cca2", d: "#2b2528" },
  map: placeOutfit(13, [
    ".......aa....aa.....", ".......aaa..aaa.....", "........aaaaaa......", "........aaaaaa......",
    ".......aaaaaaaa.....", ".......aaaaaaaa.....", "......aaaaaaaaaa....", "......aaaaaaaaaa....",
    "......aaaaaaaaaa....", "......aaaaaaaaaa....", "......bbbbbbbbbb....", ".....bbcbbbbcbcbb...",
    ".....bbcbcbbbbcbb...", "....bbbbbcbbbbcbbb..", "...bbbcbbcbbcbbcbbb.", "...bbcbbcbbbbcbbcbb.",
    "....bbbbbbbbbbbbbb..", "......dddbbbbddd....", "......ddd....ddd....",
  ].map(shiftLeft)),
};
