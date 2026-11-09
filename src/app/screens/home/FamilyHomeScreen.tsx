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
import { HouseGrid } from "./HouseGrid";

type HomeView = "rooms" | "grid";
const HOME_VIEW_KEY = "safespace_home_view";

function loadHomeView(): HomeView {
  try { return localStorage.getItem(HOME_VIEW_KEY) === "grid" ? "grid" : "rooms"; } catch { return "rooms"; }
}

/** Pixel glyphs for the two views: rooms stacked down the house, and a 2×2 call grid. */
function ViewGlyph({ view, color }: { view: HomeView; color: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 6 6" aria-hidden="true" style={{ imageRendering: "pixelated", flexShrink: 0 }}>
      {view === "rooms"
        ? <><rect x={0} y={0} width={6} height={2} fill={color} /><rect x={0} y={4} width={6} height={2} fill={color} /></>
        : <><rect x={0} y={0} width={2} height={2} fill={color} /><rect x={4} y={0} width={2} height={2} fill={color} />
            <rect x={0} y={4} width={2} height={2} fill={color} /><rect x={4} y={4} width={2} height={2} fill={color} /></>}
    </svg>
  );
}

/** Switch between full-size rooms stacked down the house and everyone on one screen. */
function HomeViewToggle({ view, onChange, count }: { view: HomeView; onChange: (v: HomeView) => void; count: number }) {
  const t = useT();
  const options: { id: HomeView; label: string }[] = [
    { id: "rooms", label: t("ROOMS") },
    { id: "grid", label: t("EVERYONE") },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px 2px" }}>
      <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--muted-foreground)", letterSpacing: 1 }}>
        {t("{count} IN THE HOUSE", { count })}
      </div>
      <div role="radiogroup" aria-label={t("Home view")} style={{ flexShrink: 0, display: "flex", gap: 4, padding: 3, backgroundColor: "var(--background)", border: "2px solid var(--secondary)" }}>
        {options.map((o) => {
          const on = view === o.id;
          const color = on ? "var(--teal)" : "var(--muted-foreground)";
          return (
            <button
              key={o.id}
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, minHeight: 30, padding: "0 8px", cursor: "pointer", whiteSpace: "nowrap",
                backgroundColor: on ? "color-mix(in srgb, var(--teal) 15%, transparent)" : "transparent",
                border: `2px solid ${on ? "var(--teal-line)" : "transparent"}`,
                boxShadow: on ? "2px 2px 0 color-mix(in srgb, var(--teal-line) 40%, transparent)" : "none",
                color, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", letterSpacing: 1,
              }}
            >
              <ViewGlyph view={o.id} color={color} />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [view, setView] = useState<HomeView>(loadHomeView);
  const changeView = (next: HomeView) => {
    setView(next);
    try { localStorage.setItem(HOME_VIEW_KEY, next); } catch { /* keep it for this visit only */ }
  };
  const members = useMembers();
  const selfId = useSelfId();
  const self = members.find((m) => m.id === selfId);
  const homeMembers = self ? [self, ...members.filter((member) => member.id !== selfId)] : members;
  const together = members.length >= 2;
  const canRemove = !!selectedMember && !!house && house.ownerId === selfId && selectedMember.id !== selfId;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,var(--border),var(--border-strong),var(--border))" }} />
        {together ? (
          <>
            <HouseRoofButton title={house?.name ?? t("YOUR HOUSE")} onOpen={onPlayWithOthers} houses={houses} onSwitch={onSwitchHouse} />
            {/* House safety and payday, right under the roof. */}
            <div data-tour="safety-bar"><FamilySafetyBar onPayday={onPayday} paydayClaimedThisWeek={paydayClaimedThisWeek} /></div>
            <HomeViewToggle view={view} onChange={changeView} count={homeMembers.length} />
            {view === "grid" ? (
              <div data-tour="family-rooms">
                <HouseGrid
                  members={homeMembers}
                  selfId={selfId}
                  coinsFor={(member) => (member.id === selfId ? coins[selfId] ?? member.coins : member.coins)}
                  onTap={setSelectedMember}
                />
              </div>
            ) : (
            <div data-tour="family-rooms" style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: "var(--border)", backgroundImage: "repeating-linear-gradient(0deg,color-mix(in srgb, var(--border) 60%, var(--background)),color-mix(in srgb, var(--border) 60%, var(--background)) 4px,var(--border) 4px,var(--border) 8px)" }} />
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, backgroundColor: "var(--border)", backgroundImage: "repeating-linear-gradient(0deg,color-mix(in srgb, var(--border) 60%, var(--background)),color-mix(in srgb, var(--border) 60%, var(--background)) 4px,var(--border) 4px,var(--border) 8px)" }} />
              {homeMembers.map((member) => <div key={member.id} data-tour={member.id === selfId ? "self-room" : undefined} className={member.id === selfId ? "home-self-room" : undefined}>
                <DollhouseRoom
                  member={member}
                  coins={member.id === selfId ? coins[selfId] ?? member.coins : member.coins}
                  onTap={setSelectedMember}
                  soldItems={soldItems}
                  purchasedItems={member.id === selfId ? purchasedItems[selfId] ?? [] : member.roomItems}
                  layout={member.id === selfId ? roomLayouts[selfId] : member.roomLayout}
                  onCustomize={member.id === selfId ? () => onCustomize(selfId) : undefined}
                  onArrange={member.id === selfId ? onArrange : undefined}
                />
              </div>)}
            </div>
            )}
          </>
        ) : self ? (
          <>
            {house && <HouseRoofButton title={house.name} onOpen={onPlayWithOthers} houses={houses} onSwitch={onSwitchHouse} />}
            <div data-tour="safety-bar"><FamilySafetyBar onPayday={onPayday} paydayClaimedThisWeek={paydayClaimedThisWeek} /></div>
            <div data-tour="family-rooms" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <SoloRoom
                member={self}
                coins={coins[selfId] ?? self.coins}
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
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: houseFailed && !houseLoading ? "var(--orange)" : "var(--soft-foreground)", lineHeight: 1.5 }}>
              {houseFailed && !houseLoading
                ? t("COULDN'T LOAD YOUR HOUSE. CHECK YOUR CONNECTION AND TRY AGAIN.")
                : t("LOADING YOUR HOUSE…")}
            </div>
            {houseFailed && !houseLoading && onRetryHouse && (
              <PixelButton onClick={onRetryHouse} color="var(--secondary)" textColor="var(--green)" size="sm">{t("[ RETRY ]")}</PixelButton>
            )}
          </div>
        )}
        <div style={{ height: 24, backgroundColor: "var(--secondary)", borderTop: "4px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--border)", letterSpacing: 3 }}>████████████████████████████</div>
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
