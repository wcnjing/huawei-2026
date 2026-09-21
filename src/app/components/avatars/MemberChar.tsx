import { FamilyMember } from "../../types/family";
import { PixelMascot } from "./PixelMascot";

// Everyone is drawn with their own avatar now — no more four hand-drawn relatives.
export function MemberChar({ member, size = 44 }: { member: Pick<FamilyMember, "avatar">; size?: number }) {
  const a = member.avatar;
  return <PixelMascot size={size} animate color={a.color} hat={a.hat} eyes={a.eyes} outfit={a.outfit} />;
}
