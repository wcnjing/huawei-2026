import type { FamilyMember } from "../../types/family";
import { roomColors } from "../../types/roomStyle";
import { IconCoin } from "../../components/icons";

export function RoomHeading({ member, coins = member.coins, actions }: { member: FamilyMember; coins?: number; actions?: React.ReactNode }) {
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor);
  return <div className="room-heading">
    <div className="room-heading-primary">
      <div className="room-heading-name" style={{ color: colors.light }}>{member.roomName}</div>
      <div className="room-heading-details" style={{ fontSize: "var(--text-label)", color: "#a8bbcf" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#ffe66d" }}>
          <IconCoin size={14} color="#ffe66d" />{coins.toLocaleString()}
        </span>
      </div>
    </div>
    {actions && <div className="room-heading-actions">{actions}</div>}
  </div>;
}
