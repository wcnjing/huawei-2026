import type { FamilyMember } from "../../types/family";
import type { RoomLayout } from "../../types/roomLayout";
import { PurchasedRoomFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { RoomBackdrop } from "../../components/room";
import { SafetyBadge } from "./SafetyBadge";
import { RoomHeading } from "./RoomHeading";

export function SoloRoom({ member, coins, purchasedItems, layout, inviteCode, onTap, onPlayWithOthers }: {
  member: FamilyMember; coins: number; purchasedItems: string[]; layout?: RoomLayout;
  inviteCode: string | null; onTap: () => void; onPlayWithOthers: () => void;
}) {
  return (
    <div style={{ position: "relative", flex: 1, minHeight: 420, display: "flex", flexDirection: "column", backgroundColor: member.roomBg }}>
      <RoomBackdrop style={member.roomStyle} background={member.roomBg} accent={member.primaryColor} />
      <RoomHeading member={member} coins={coins} />
      <button className="room-invite"
        onClick={onPlayWithOthers}
        style={{ backgroundColor: "#0a0e1a", border: "3px solid #4ecdc4", padding: "6px 8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4" }}
      >
        {inviteCode ? `+ INVITE · ${inviteCode}` : "+ PLAY WITH OTHERS"}
      </button>
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        <PurchasedRoomFurniture itemIds={purchasedItems} accent={member.primaryColor} layout={layout} topInset={16} />
        <button className="room-player" onClick={onTap} style={{ position: "relative", zIndex: 3, alignSelf: "center", marginTop: "auto", marginBottom: 40, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <SafetyBadge safe={member.safeThisWeek} size={22} />
          <MemberChar member={member} size={112} />
          <div className="room-player-name" style={{ color: member.primaryColor }}>{member.name}</div>
        </button>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)` }} />
    </div>
  );
}
