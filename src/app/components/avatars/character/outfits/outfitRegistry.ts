import type { OutfitDefinition, OutfitId } from "../types";
import { blueTank } from "./blueTank";
import { jersey67 } from "./jersey67";
import { overalls } from "./overalls";
import { pinafore } from "./pinafore";
import { pufferVest } from "./pufferVest";
import { purpleCoat } from "./purpleCoat";
import { redHoodie } from "./redHoodie";
import { stripedPants } from "./stripedPants";
import { tealDress } from "./tealDress";
import { yellowSkirt } from "./yellowSkirt";

export const outfitRegistry: Record<OutfitId, OutfitDefinition> = {
  "purple-coat": purpleCoat,
  "red-hoodie": redHoodie,
  "blue-tank": blueTank,
  overalls,
  "puffer-vest": pufferVest,
  "jersey-67": jersey67,
  "yellow-skirt": yellowSkirt,
  "teal-dress": tealDress,
  pinafore,
  "striped-pants": stripedPants,
};
