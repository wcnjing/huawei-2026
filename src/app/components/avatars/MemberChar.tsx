import { FamilyMember } from "../../types/family";
import { CharacterAvatar } from "./character";

// Everyone is drawn with their own avatar now — no more four hand-drawn relatives.
export function MemberChar({ member, size = 44 }: { member: Pick<FamilyMember, "avatar">; size?: number }) {
  return <CharacterAvatar size={size} animate config={member.avatar} title="House member character" />;
}
