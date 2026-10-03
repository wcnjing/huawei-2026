import type { HairStyleId, PixelMap } from "../types";
import { bob } from "./bob";
import { bowl } from "./bowl";
import { crewCut } from "./crewCut";
import { fluffy } from "./fluffy";
import { long } from "./long";
import { pigtails } from "./pigtails";
import { short } from "./short";
import { tousled } from "./tousled";
import { twinBuns } from "./twinBuns";
import { wavy } from "./wavy";

export const hairRegistry: Record<Exclude<HairStyleId, "none">, PixelMap> = {
  bowl,
  tousled,
  fluffy,
  short,
  "crew-cut": crewCut,
  "twin-buns": twinBuns,
  pigtails,
  wavy,
  long,
  bob,
};
