import type { FamilyMember } from "../../types/family";
import { roomColors } from "../../types/roomStyle";

export function RoomHeading({ member, actions }: { member: FamilyMember; actions?: React.ReactNode }) {
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor);
  return <div className="room-heading">
    <div className="room-heading-primary">
      <div className="room-heading-name" style={{ color: colors.light }}>{member.roomName}</div>
      <div className="room-heading-details" style={{ fontSize: "var(--text-label)", color: "#a8bbcf" }}>
        <span>LVL {member.level} · {member.streak} STREAK</span>
      </div>
    </div>
    {actions && <div className="room-heading-actions">{actions}</div>}
  </div>;
}
