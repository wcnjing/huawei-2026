import type { ReactElement } from "react";
import type { AccessoryId } from "../types";
import { HairBow } from "./hairBow";
import { Necklace } from "./necklace";
import { RoundGlasses } from "./roundGlasses";

type AccessoryDefinition = { slot: "neck" | "face" | "head"; Layer: () => ReactElement };

export const accessoryRegistry: Record<AccessoryId, AccessoryDefinition> = {
  "round-glasses": { slot: "face", Layer: RoundGlasses },
  "hair-bow": { slot: "head", Layer: HairBow },
  necklace: { slot: "neck", Layer: Necklace },
};
