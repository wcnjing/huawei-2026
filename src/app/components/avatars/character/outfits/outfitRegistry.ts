import type { OutfitId, PixelMap, PixelPalette } from "../types";

type OutfitDefinition = { map: PixelMap; palette: PixelPalette };
const empty = "....................";
const padTop = (rows: string[]): PixelMap => [...Array.from({ length: 32 - rows.length }, () => empty), ...rows];

// Traced directly from the five front-facing characters in character sheet 3.png.
export const outfitRegistry: Record<OutfitId, OutfitDefinition> = {
  sailor: {
    palette: { p: "#d8e1f1", s: "#b2b9c6", b: "#66738a", a: "#3c588a" },
    map: padTop([
      "......pp....pp......", ".....pppp..pppp.....", "......pppppppp......", "......pppppppp......",
      "......papaapap......", "......ppaaaapp......", ".....ppppaapppp.....", ".....ppaappaapp.....",
      ".....pppppppppp.....", ".....pppppppppp.....", ".....ssssssssss.....", ".....bbbbbbbbbb.....",
      ".....ssssssssss.....", ".....bbbbbbbbbb.....", ".....ssss..ssss.....", ".....bbbb..bbbb.....",
      ".....ssss..ssss.....", ".....bbbb..bbbb.....", ".....ssss..ssss.....",
    ]),
  },
  "yellow-dress": {
    palette: { p: "#ffe66d", s: "#fff4c2", a: "#d5cca2", b: "#2b2528" },
    map: padTop([
      ".......pp....pp.....", ".......ppp..ppp.....", "........pppppp......", "........pppppp......",
      ".......pppppppp.....", ".......pppppppp.....", "......pppppppppp....", "......pppppppppp....",
      "......pppppppppp....", "......pppppppppp....", "......ssssssssss....", ".....ssassssasass...",
      ".....ssasassssass...", "....sssssassssasss..", "...sssassassassasss.", "...ssassassssassass.",
      "....ssssssssssssss..", "......bbbssssbbb....", "......bbb....bbb....",
    ]),
  },
  "blue-shirt-pants": {
    palette: { p: "#3c588a", b: "#2b2528" },
    map: padTop([
      ".......pp....pp.....", ".......ppp..ppp.....", "........pppppp......", "........pppppp......",
      ".......pppppppp.....", ".......pppppppp.....", "......pppppppppp....", "......pppppppppp....",
      "......pppppppppp....", "......pppppppppp....", ".....pppppppppppp...", "......bbbbbbbbbb....",
      "......bbbbbbbbbb....", "......bbbbbbbbbb....", "......bbbb..bbbb....", "......bbbb..bbbb....",
      "......bbbb..bbbb....", "......bbbb..bbbb....", "......bbbb..bbbb....",
    ]),
  },
  overalls: {
    palette: { p: "#6d515f", s: "#3c588a", a: "#66738a", d: "#d8c778" },
    map: padTop([
      "......psp..psp......", "....pppsppppsppp....", "....pppsppppsppp....", ".....ppsppppspp.....",
      ".....ppsssssspp.....", ".....psdssssdsp.....", ".....pssssssssp.....", ".....pssaaaassp.....",
      ".....sssaaaasss.....", ".....ssssssssss.....", ".....sassssssas.....", ".....assssssssa.....",
      ".....ssssssssss.....", ".....ssss..ssss.....", ".....ssss..ssss.....", ".....sssa..asss.....",
      ".....ssas..sass.....", ".....aaaa..aaaa.....",
    ]),
  },
  "green-sweater": {
    palette: { p: "#00cc6d", a: "#00ff88", b: "#2b2528" },
    map: padTop([
      "......ppp..ppp......", ".....pppppppppp.....", ".....ppaaaaaapp.....", ".....pppppppppp.....",
      ".....paaaaaaaap.....", ".....pppppppppp.....", ".....paaaaaaaap.....", ".....pppppppppp.....",
      ".....pppaaaappp.....", ".....pppppppppp.....", ".....bbbbbbbbbb.....", ".....bbbbbbbbbb.....",
      ".....bbbbbbbbbb.....", ".....bbbb..bbbb.....", ".....bbbb..bbbb.....", ".....bbbb..bbbb.....",
      ".....bbbb..bbbb.....", ".....bbbb..bbbb.....",
    ]),
  },
};

