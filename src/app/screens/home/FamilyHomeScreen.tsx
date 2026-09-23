import { useState } from "react";
import type { FamilyMember } from "../../types/family";
import type { RoomLayouts } from "../../types/roomLayout";
import type { HouseView } from "../../services/house";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";
import { PixelButton } from "../../components/ui";
import { IconTree } from "../../components/icons";
import { FamilySafetyBar } from "./FamilySafetyBar";
import { HouseRoof } from "./HouseRoof";
import { DollhouseRoom } from "./DollhouseRoom";
import { MemberProfileOverlay } from "./MemberProfileOverlay";
import { SoloRoom } from "./SoloRoom";

export function FamilyHomeScreen({ onDrillSelect, onFamilyDrill, onPayday, onCustomize, onArrange, onTutorial, coins, soldItems, purchasedItems, roomLayouts, house, onPlayWithOthers, onRemoveMember, onFamilyTree }: {
  onDrillSelect: () => void; onFamilyDrill: () => void;
  onPayday: () => void;
  onCustomize: (memberId: string) => void;
  onArrange: () => void;
  roomLayouts: RoomLayouts;
  onTutorial: () => void;
  coins: Record<string, number>;
  soldItems: string[];
  purchasedItems: Record<string, string[]>;
  house: HouseView | null;
  onPlayWithOthers: () => void;
  onRemoveMember: (id: string) => void;
  onFamilyTree: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const members = useMembers();
  const selfId = useSelfId();
  const self = members.find((m) => m.id === selfId);
  const together = members.length >= 2;
  const canRemove = !!selectedMember && !!house && house.ownerId === selfId && selectedMember.id !== selfId;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#2a3a5c,#3a4a6c,#2a3a5c)" }} />
        {!together && self ? (
          <div data-tour="family-rooms" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <SoloRoom
              member={self}
              coins={coins[selfId] ?? 0}
              purchasedItems={purchasedItems[selfId] ?? []}
              layout={roomLayouts[selfId]}
              inviteCode={house?.inviteCode ?? null}
              onTap={() => setSelectedMember(self)}
              onPlayWithOthers={onPlayWithOthers}
            />
          </div>
        ) : (
          <>
            <div data-tour="safety-bar"><FamilySafetyBar coins={coins} /></div>
            <HouseRoof title={house?.name ?? "YOUR HOUSE"} />
            <div style={{ padding: "8px 16px 0", backgroundColor: "#0a0e1a", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <PixelButton onClick={onFamilyTree} color="#1a2340" textColor="#00ff88" size="sm">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label="Family tree">
                  <IconTree size={16} /> FAMILY TREE
                </span>
              </PixelButton>
              <PixelButton onClick={onPlayWithOthers} color="#1a2340" textColor="#4ecdc4" size="sm">+ INVITE</PixelButton>
            </div>
            <div data-tour="family-rooms" style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
              {members.map((member) => (
                <DollhouseRoom
                  key={member.id}
                  member={member}
                  onTap={setSelectedMember}
                  coins={member.id === selfId ? coins[selfId] ?? 0 : null}
                  soldItems={soldItems}
                  purchasedItems={member.id === selfId ? purchasedItems[selfId] ?? [] : []}
                  layout={member.id === selfId ? roomLayouts[selfId] : undefined}
                />
              ))}
            </div>
          </>
        )}
        <div style={{ height: 24, backgroundColor: "#1a2340", borderTop: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#2a3a5c", letterSpacing: 3 }}>████████████████████████████</div>
        </div>
        {self && <div style={{ padding: "12px 16px 0", backgroundColor: "#0a0e1a" }}>
          <PixelButton onClick={() => onCustomize(selfId)} color="#1a2340" textColor="#c77dff" size="md" full>CUSTOMIZE ROOM</PixelButton>
        </div>}
        {self && (purchasedItems[selfId]?.length ?? 0) > 0 && (
          <div style={{ padding: "12px 16px", backgroundColor: "#0a0e1a" }}>
            <PixelButton onClick={onArrange} color="#1a2340" textColor="#4ecdc4" size="md" full>ARRANGE ROOM</PixelButton>
          </div>
        )}
        <div style={{ padding: "16px 16px 8px", backgroundColor: "#0a0e1a" }}>
          <div data-tour="start-drill"><PixelButton onClick={onFamilyDrill} color="#00ff88" size="lg" full>START HOUSE DRILL</PixelButton></div>
        </div>
        <div style={{ padding: "0 16px 20px", backgroundColor: "#0a0e1a" }}>
          {/* Payday pays the signed-in member, so it stays hidden until they load. */}
          {members.length > 0 && (<>
            <PixelButton onClick={onPayday} color="#ffe66d" textColor="#0a0e1a" size="md" full>PAYDAY SUNDAY</PixelButton>
            <div style={{ height: 10 }} />
          </>)}
          <div data-tour="opt-in">
            <PixelButton onClick={onDrillSelect} color="#00ff88" textColor="#0a0e1a" size="md" full>✓ OPTED IN — RUN A REAL DRILL</PixelButton>
          </div>
          <div style={{ height: 10 }} />
          <PixelButton onClick={onTutorial} color="#1a2340" textColor="#6b8ba4" size="sm" full>HOW TO PLAY</PixelButton>
        </div>
        <div style={{ padding: "0 16px 24px", backgroundColor: "#0a0e1a", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", textAlign: "center" }}>
          Train together. Protect the whole house.
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
