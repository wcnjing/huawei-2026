import type { FamilyMember } from "../../types/family";
import { roomColors } from "../../types/roomStyle";
import { IconCoin } from "../../components/icons";

export function RoomHeading({ member, coins }: { member: FamilyMember; coins: number | null }) {
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor);
  return <div className="room-heading">
    <div className="room-heading-name" style={{ color: colors.light }}>{member.roomName}</div>
    <div className="room-heading-details" style={{ fontSize: "var(--text-label)", color: "#a8bbcf" }}>
      <span>LVL {member.level} · {member.streak} STREAK</span>
      {coins !== null && <span style={{ color: "#ffe66d" }}><IconCoin size={14} color="#ffe66d" />{coins}</span>}
    </div>
  </div>;
}
