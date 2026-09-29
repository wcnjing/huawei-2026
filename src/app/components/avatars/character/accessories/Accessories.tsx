import type { ReactElement } from "react";
import type { AccessoryId } from "../types";

type AccessoryDefinition = { slot: "neck" | "face" | "head"; Layer: () => ReactElement };

const RoundGlasses = () => (
  <g data-character-layer="accessory-round-glasses" fill="none" stroke="#6b8ba4" strokeWidth={1}>
    <rect x={6} y={7} width={4} height={3} /><rect x={11} y={7} width={4} height={3} />
    <path d="M10 8h1" />
  </g>
);

const HairBow = () => (
  <g data-character-layer="accessory-hair-bow">
    <rect x={12} y={2} width={3} height={3} fill="#ff2d55" />
    <rect x={16} y={2} width={3} height={3} fill="#ff2d55" />
    <rect x={15} y={3} width={1} height={1} fill="#ffe66d" />
  </g>
);

const Necklace = () => (
  <g data-character-layer="accessory-necklace" fill="#ffe66d">
    <rect x={8} y={15} width={4} height={1} /><rect x={9} y={16} width={2} height={2} />
  </g>
);

export const accessoryRegistry: Record<AccessoryId, AccessoryDefinition> = {
  "round-glasses": { slot: "face", Layer: RoundGlasses },
  "hair-bow": { slot: "head", Layer: HairBow },
  necklace: { slot: "neck", Layer: Necklace },
};

