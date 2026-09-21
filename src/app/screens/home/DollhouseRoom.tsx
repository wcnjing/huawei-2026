import type { FamilyMember } from "../../types/family";
import type { RoomLayout } from "../../types/roomLayout";
import { FurnitureIcon, PurchasedRoomFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { RoomBackdrop } from "../../components/room";
import { FURNITURE_STORE } from "../../data/furniture";
import { RoomHeading } from "./RoomHeading";
import { SafetyBadge } from "./SafetyBadge";
import { roomColors } from "../../types/roomStyle";

export function DollhouseRoom({ member, onTap, coins, soldItems, purchasedItems, layout }: { member: FamilyMember; onTap: (m: FamilyMember) => void; coins: number | null; soldItems: string[]; purchasedItems: string[]; layout?: RoomLayout }) {
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor);
  return (
    <button onClick={() => onTap(member)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "0", cursor: "pointer" }}>
      <div style={{ backgroundColor: colors.wall }}><RoomHeading member={member} coins={coins} /></div>
      <div style={{ backgroundColor: member.roomBg, position: "relative", height: 232, overflow: "hidden" }}>
        <RoomBackdrop style={member.roomStyle} background={member.roomBg} accent={member.primaryColor} />
        <div style={{ position: "absolute", top: 10, right: 16 }}>
          <svg width={28} height={32} viewBox="0 0 7 8" style={{ imageRendering: "pixelated" }}>
            <rect x={0} y={0} width={7} height={8} fill="#2a3a5c" />
            <rect x={1} y={1} width={2} height={3} fill={member.primaryColor} opacity={0.12} />
            <rect x={4} y={1} width={2} height={3} fill={member.primaryColor} opacity={0.08} />
            <rect x={1} y={5} width={2} height={2} fill="#1a2a4a" />
            <rect x={4} y={5} width={2} height={2} fill="#1a2a4a" />
          </svg>
        </div>
        <div style={{ position: "absolute", left: 8, bottom: 12, display: "flex", alignItems: "flex-end", gap: 3, maxWidth: 172 }}>
          {FURNITURE_STORE
            .filter(item => item.memberId === member.id && !soldItems.includes(item.id))
            .map(item => (
              <div key={item.id} title={item.name} style={{ width: 38, height: 42, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <FurnitureIcon itemId={item.id} size={36} />
              </div>
            ))}
        </div>
        {/* purchasedItems is the ownership source of truth; selling a shop item removes
            it there, while buying it again adds it back and should render it again. */}
        <PurchasedRoomFurniture itemIds={purchasedItems} accent={member.primaryColor} layout={layout} topInset={16} />
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <SafetyBadge safe={member.safeThisWeek} size={18} />
          <MemberChar member={member} size={44} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)`, borderTop: `2px solid ${member.primaryColor}44` }} />
      </div>
      <div style={{ padding: "8px 14px 12px", backgroundColor: colors.wall, borderBottom: "4px solid #2a3a5c" }}>
        <div className="room-player-name" style={{ color: member.primaryColor }}>{member.name}</div>
        <div className="room-tap-label" style={{ color: "#a8bbcf", marginTop: 4 }}>Tap to view</div>
      </div>
    </button>
  );
}
