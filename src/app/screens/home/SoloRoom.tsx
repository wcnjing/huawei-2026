import { useT } from "../../i18n";
import type { FamilyMember } from "../../types/family";
import type { RoomLayout } from "../../types/roomLayout";
import { PurchasedRoomFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { RoomBackdrop, RoomWanderer } from "../../components/room";
import { RoomTimeProvider, roomScope, useRoomTime } from "../../components/room/lighting";
import { roomColors } from "../../types/roomStyle";
import { ink } from "../../utils/color";
import { SafetyBadge } from "./SafetyBadge";
import { RoomHeading } from "./RoomHeading";
import { PixelButton } from "../../components/ui";

export function SoloRoom({ member, coins, purchasedItems, layout, inviteCode, onTap, onPlayWithOthers, onCustomize, onArrange, hasFurniture }: {
  member: FamilyMember; coins: number; purchasedItems: string[]; layout?: RoomLayout;
  inviteCode: string | null; onTap: () => void; onPlayWithOthers: () => void;
  onCustomize: () => void; onArrange: () => void; hasFurniture: boolean;
}) {
  const t = useT();
  // Day or night for whoever is looking (the room's Lighting and their theme).
  const time = useRoomTime(member.roomStyle);
  const colors = roomColors(member.roomStyle, member.roomBg, member.primaryColor, time);
  return (
    <RoomTimeProvider value={time}>
    <div data-tour="solo-room" className="solo-room" {...roomScope(time)} style={{ position: "relative", flex: 1, minHeight: 480, display: "flex", flexDirection: "column", backgroundColor: colors.wall }}>
      <RoomBackdrop style={member.roomStyle} background={member.roomBg} accent={member.primaryColor} time={time} />
      <div className="solo-room-heading">
        <RoomHeading member={member} coins={coins} actions={<div className="home-room-tools">
          <PixelButton onClick={onCustomize} color="var(--secondary)" textColor="var(--violet)" size="sm">{t("CUSTOMIZE")}</PixelButton>
          {hasFurniture && <PixelButton onClick={onArrange} color="var(--secondary)" textColor="var(--teal)" size="sm">{t("ARRANGE")}</PixelButton>}
        </div>} />
      </div>
      <div className="solo-room-invite-row">
        <PixelButton onClick={onPlayWithOthers} color="var(--secondary)" textColor="var(--teal)" size="sm">
          {inviteCode ? t("+ INVITE · {code}", { code: inviteCode }) : t("+ PLAY WITH OTHERS")}
        </PixelButton>
      </div>
      <button className="home-room-view solo-room-view" onClick={onTap} aria-label={t("View {name}'s room", { name: member.name })}>
        <PurchasedRoomFurniture itemIds={purchasedItems} accent={member.primaryColor} layout={layout} topInset={16} />
        <RoomWanderer
          back="16%" front="32px" minX={22} maxX={78}
          above={<div style={{ marginBottom: 6 }}><SafetyBadge safe={member.safeThisWeek} size={22} /></div>}
          character={<MemberChar member={member} size={160} />}
          below={<div className="room-player-name" style={{ color: ink(member.primaryColor), marginTop: 6, whiteSpace: "nowrap" }}>{member.name}</div>}
        />
        <div className="home-room-open-hint" aria-hidden="true">{t("TAP TO VIEW")}</div>
      </button>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)` }} />
    </div>
    </RoomTimeProvider>
  );
}
