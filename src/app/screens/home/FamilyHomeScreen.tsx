import { useT } from "../../i18n";
import { useState } from "react";
import type { FamilyMember } from "../../types/family";
import type { RoomLayouts } from "../../types/roomLayout";
import type { HouseSummary, HouseView } from "../../services/house";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";
import { PixelButton } from "../../components/ui";
import { FamilySafetyBar } from "./FamilySafetyBar";
import { HouseRoofButton } from "./HouseRoofButton";
import { DollhouseRoom } from "./DollhouseRoom";
import { MemberProfileOverlay } from "./MemberProfileOverlay";
import { SoloRoom } from "./SoloRoom";

export function FamilyHomeScreen({ onPayday, paydayClaimedThisWeek, onCustomize, onArrange, coins, soldItems, purchasedItems, roomLayouts, house, houses, onSwitchHouse, onPlayWithOthers, onRemoveMember, houseLoading = false, houseFailed = false, onRetryHouse }: {
  onPayday: () => void;
  paydayClaimedThisWeek: boolean;
  onCustomize: (memberId: string) => void;
  onArrange: () => void;
  roomLayouts: RoomLayouts;
  coins: Record<string, number>;
  soldItems: string[];
  purchasedItems: Record<string, string[]>;
  house: HouseView | null;
  houses: HouseSummary[];
  onSwitchHouse: (houseId: string) => Promise<string | null>;
  onPlayWithOthers: () => void;
  onRemoveMember: (id: string) => void;
  /** The /api/house fetch is still in flight. */
  houseLoading?: boolean;
  /** The last /api/house fetch failed, so there is no player to draw. */
  houseFailed?: boolean;
  onRetryHouse?: () => void;
}) {
  const t = useT();
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const members = useMembers();
  const selfId = useSelfId();
  const self = members.find((m) => m.id === selfId);
  const homeMembers = self ? [self, ...members.filter((member) => member.id !== selfId)] : members;
  const together = members.length >= 2;
  const canRemove = !!selectedMember && !!house && house.ownerId === selfId && selectedMember.id !== selfId;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#2a3a5c,#3a4a6c,#2a3a5c)" }} />
        {together ? (
          <>
            <HouseRoofButton title={house?.name ?? t("YOUR HOUSE")} onOpen={onPlayWithOthers} houses={houses} onSwitch={onSwitchHouse} />
            {/* House safety and payday, right under the roof. */}
            <div data-tour="safety-bar"><FamilySafetyBar coins={coins} onPayday={onPayday} paydayClaimedThisWeek={paydayClaimedThisWeek} /></div>
            <div data-tour="family-rooms" style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
              {homeMembers.map((member) => <div key={member.id} data-tour={member.id === selfId ? "self-room" : undefined} className={member.id === selfId ? "home-self-room" : undefined}>
                <DollhouseRoom
                  member={member}
                  onTap={setSelectedMember}
                  soldItems={soldItems}
                  purchasedItems={member.id === selfId ? purchasedItems[selfId] ?? [] : []}
                  layout={member.id === selfId ? roomLayouts[selfId] : undefined}
                  onCustomize={member.id === selfId ? () => onCustomize(selfId) : undefined}
                  onArrange={member.id === selfId ? onArrange : undefined}
                />
              </div>)}
            </div>
          </>
        ) : self ? (
          <>
            {house && <HouseRoofButton title={house.name} onOpen={onPlayWithOthers} houses={houses} onSwitch={onSwitchHouse} />}
            <div data-tour="safety-bar"><FamilySafetyBar coins={coins} onPayday={onPayday} paydayClaimedThisWeek={paydayClaimedThisWeek} /></div>
            <div data-tour="family-rooms" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <SoloRoom
                member={self}
                purchasedItems={purchasedItems[selfId] ?? []}
                layout={roomLayouts[selfId]}
                inviteCode={house?.inviteCode ?? null}
                onTap={() => setSelectedMember(self)}
                onPlayWithOthers={onPlayWithOthers}
                onCustomize={() => onCustomize(selfId)}
                onArrange={onArrange}
                hasFurniture={(purchasedItems[selfId]?.length ?? 0) > 0}
              />
            </div>
          </>
        ) : (
          // No player data yet: say so instead of rendering an empty screen.
          <div role="status" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: houseFailed && !houseLoading ? "#ff6b35" : "#9bb0c8", lineHeight: 1.5 }}>
              {houseFailed && !houseLoading
                ? t("COULDN'T LOAD YOUR HOUSE. CHECK YOUR CONNECTION AND TRY AGAIN.")
                : t("LOADING YOUR HOUSE…")}
            </div>
            {houseFailed && !houseLoading && onRetryHouse && (
              <PixelButton onClick={onRetryHouse} color="#1a2340" textColor="#00ff88" size="sm">{t("[ RETRY ]")}</PixelButton>
            )}
          </div>
        )}
        <div style={{ height: 24, backgroundColor: "#1a2340", borderTop: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#2a3a5c", letterSpacing: 3 }}>████████████████████████████</div>
        </div>
      </div>
      {selectedMember && (
        <MemberProfileOverlay
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onCustomize={onCustomize}
          coins={coins[selectedMember.id] ?? 0}
          canRemove={canRemove}
          onRemove={() => onRemoveMember(selectedMember.id)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: INCOMING CALL
