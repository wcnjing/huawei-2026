import type { FamilyMember } from "../../types/family";
import { roomColors } from "../../types/roomStyle";
import { IconCoin } from "../../components/icons";
import { useRoomTimeContext } from "../../components/room/lighting";
import { ink } from "../../utils/color";

export function RoomHeading({ member, coins = member.coins, actions }: { member: FamilyMember; coins?: number; actions?: React.ReactNode }) {
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor, useRoomTimeContext() ?? "night");
  return <div className="room-heading">
    <div className="room-heading-primary">
      {/* ink(): the neon in a night room, its readable dark shade on a day wall. */}
      <div className="room-heading-name" style={{ color: ink(colors.light) }}>{member.roomName}</div>
      <div className="room-heading-details" style={{ fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--yellow)" }}>
          <IconCoin size={14} color="var(--yellow)" />{coins.toLocaleString()}
        </span>
      </div>
    </div>
    {actions && <div className="room-heading-actions">{actions}</div>}
  </div>;
}
