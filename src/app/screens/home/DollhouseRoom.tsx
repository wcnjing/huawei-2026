import { useT } from "../../i18n";
import type { FamilyMember } from "../../types/family";
import type { RoomLayout } from "../../types/roomLayout";
import { FurnitureIcon, PurchasedRoomFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { RoomBackdrop, RoomWanderer } from "../../components/room";
import { FURNITURE_STORE } from "../../data/furniture";
import { RoomHeading } from "./RoomHeading";
import { SafetyBadge } from "./SafetyBadge";
import { roomColors } from "../../types/roomStyle";
import { PixelButton } from "../../components/ui";

export function DollhouseRoom({ member, coins, onTap, soldItems, purchasedItems, layout, onCustomize, onArrange }: { member: FamilyMember; coins: number; onTap: (m: FamilyMember) => void; soldItems: string[]; purchasedItems: string[]; layout?: RoomLayout; onCustomize?: () => void; onArrange?: () => void }) {
  const t = useT();
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor);
  return (
    <div className="home-room-card">
      <div className="home-room-header" style={{ backgroundColor: colors.wall }}>
        <RoomHeading
          member={member}
          coins={coins}
          actions={onCustomize && <div className="home-room-tools">
            <PixelButton onClick={onCustomize} color="#1a2340" textColor="#c77dff" size="sm">{t("CUSTOMIZE")}</PixelButton>
            {onArrange && purchasedItems.length > 0 && <PixelButton onClick={onArrange} color="#1a2340" textColor="#4ecdc4" size="sm">{t("ARRANGE")}</PixelButton>}
          </div>}
        />
      </div>
      <button className="home-room-view" onClick={() => onTap(member)} aria-label={t("View {name}'s room", { name: member.name })}>
      <div style={{ backgroundColor: member.roomBg, position: "relative", height: 252, overflow: "hidden" }}>
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
              <div key={item.id} title={t(item.name)} style={{ width: 38, height: 42, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <FurnitureIcon itemId={item.id} size={36} />
              </div>
            ))}
        </div>
        {/* purchasedItems is the ownership source of truth; selling a shop item removes
            it there, while buying it again adds it back and should render it again. */}
        <PurchasedRoomFurniture itemIds={purchasedItems} accent={member.primaryColor} layout={layout} topInset={16} />
        <RoomWanderer
          back="34%" front="12px" minX={14} maxX={86}
          above={<div style={{ marginBottom: 4 }}><SafetyBadge safe={member.safeThisWeek} size={18} /></div>}
          character={<MemberChar member={member} size={80} />}
        />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)`, borderTop: `2px solid ${member.primaryColor}44` }} />
        <div className="home-room-open-hint">{t("TAP TO VIEW")}</div>
      </div>
      </button>
    </div>
  );
}
