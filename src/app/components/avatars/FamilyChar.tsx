import { CharDad } from "./characters/CharDad";
import { CharGrandma } from "./characters/CharGrandma";
import { CharKid } from "./characters/CharKid";
import { CharMum } from "./characters/CharMum";

export function FamilyChar({ id, size, frame }: { id: string; size?: number; frame?: number }) {
  if (id === "grandma") return <CharGrandma size={size} frame={frame} />;
  if (id === "mum") return <CharMum size={size} frame={frame} />;
  if (id === "dad") return <CharDad size={size} frame={frame} />;
  return <CharKid size={size} frame={frame} />;
}