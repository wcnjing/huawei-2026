import type { FamilyMember } from "../../types/family";
import type { RoomLayout } from "../../types/roomLayout";
import { PurchasedRoomFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { RoomBackdrop } from "../../components/room";
import { SafetyBadge } from "./SafetyBadge";
import { RoomHeading } from "./RoomHeading";
import { PixelButton } from "../../components/ui";

export function SoloRoom({ member, coins, purchasedItems, layout, inviteCode, onTap, onPlayWithOthers, onCustomize, onArrange, hasFurniture }: {
  member: FamilyMember; coins: number; purchasedItems: string[]; layout?: RoomLayout;
  inviteCode: string | null; onTap: () => void; onPlayWithOthers: () => void;
  onCustomize: () => void; onArrange: () => void; hasFurniture: boolean;
}) {
  return (
    <div className="solo-room" style={{ position: "relative", flex: 1, minHeight: 420, display: "flex", flexDirection: "column", backgroundColor: member.roomBg }}>
      <RoomBackdrop style={member.roomStyle} background={member.roomBg} accent={member.primaryColor} />
      <RoomHeading member={member} coins={coins} actions={<div className="home-room-tools">
        <PixelButton onClick={onCustomize} color="#1a2340" textColor="#c77dff" size="sm">CUSTOMIZE</PixelButton>
        {hasFurniture && <PixelButton onClick={onArrange} color="#1a2340" textColor="#4ecdc4" size="sm">ARRANGE</PixelButton>}
      </div>} />
      <div className="solo-room-invite-row">
        <PixelButton onClick={onPlayWithOthers} color="#1a2340" textColor="#4ecdc4" size="sm">
          {inviteCode ? `+ INVITE · ${inviteCode}` : "+ PLAY WITH OTHERS"}
        </PixelButton>
      </div>
      <button className="home-room-view solo-room-view" onClick={onTap} aria-label={`View ${member.name}'s room`}>
        <PurchasedRoomFurniture itemIds={purchasedItems} accent={member.primaryColor} layout={layout} topInset={16} />
        <div className="room-player" style={{ position: "relative", zIndex: 3, alignSelf: "center", marginTop: "auto", marginBottom: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <SafetyBadge safe={member.safeThisWeek} size={22} />
          <MemberChar member={member} size={112} />
          <div className="room-player-name" style={{ color: member.primaryColor }}>{member.name}</div>
        </div>
        <div className="home-room-open-hint" aria-hidden="true">TAP TO VIEW</div>
      </button>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)` }} />
    </div>
  );
}
