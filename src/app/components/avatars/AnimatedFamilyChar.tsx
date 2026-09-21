import { useIdleFrame } from "../../hooks/useIdleFrame";
import { FamilyChar } from "./FamilyChar";

export function AnimatedFamilyChar({ name, size = 60 }: { name: string; size?: number }) {
  const frame = useIdleFrame(2);
  const idMap: Record<string, string> = { Grandma: "grandma", Mum: "mum", Dad: "dad", Kid: "kid" };
  const id = idMap[name] ?? "mum";
  return <FamilyChar id={id} size={size} frame={frame} />;
}
