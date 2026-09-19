import { useState } from "react";
import type { FamilyMember } from "../../types/family";
import { sessionToken } from "../../services/session";
import { FAMILY_MEMBERS } from "../../data/familyMembers";
import { PixelButton } from "../../components/ui";
import { FamilySafetyBar } from "./FamilySafetyBar";
import { HouseRoof } from "./HouseRoof";
import { DollhouseRoom } from "./DollhouseRoom";
import { MemberProfileOverlay } from "./MemberProfileOverlay";

export function FamilyHomeScreen({ onDrillSelect, onFamilyDrill, onPayday, onCustomize, onRegister, onTutorial, coins, soldItems, purchasedItems }: {
  onDrillSelect: () => void; onFamilyDrill: () => void;
  onPayday: () => void;
  onCustomize: (memberId: string) => void;
  onRegister: () => void;
  onTutorial: () => void;
  coins: Record<string, number>;
  soldItems: string[];
  purchasedItems: Record<string, string[]>;
}) {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const registered = !!sessionToken();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#2a3a5c,#3a4a6c,#2a3a5c)" }} />
        <div data-tour="safety-bar"><FamilySafetyBar coins={coins} /></div>
        <HouseRoof />
        <div data-tour="family-rooms" style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
          {FAMILY_MEMBERS.map((member) => (
            <DollhouseRoom
              key={member.id}
              member={member}
              onTap={setSelectedMember}
              coins={coins[member.id] ?? member.coins}
              soldItems={soldItems}
              purchasedItems={purchasedItems[member.id] ?? []}
            />
          ))}
        </div>
        <div style={{ height: 24, backgroundColor: "#1a2340", borderTop: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div aria-hidden="true" style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-micro)", color: "#2a3a5c", letterSpacing: 3 }}>████████████████████████████</div>
        </div>
        <div style={{ padding: "16px 16px 8px", backgroundColor: "#0a0e1a" }}>
          <div data-tour="start-drill"><PixelButton onClick={onFamilyDrill} color="#00ff88" size="lg" full>[ START FAMILY DRILL ]</PixelButton></div>
        </div>
        <div style={{ padding: "0 16px 20px", backgroundColor: "#0a0e1a" }}>
          <PixelButton onClick={onPayday} color="#ffe66d" textColor="#0a0e1a" size="md" full>PAYDAY SUNDAY</PixelButton>
          <div style={{ height: 10 }} />
          <div data-tour="opt-in">{registered ? (
            <PixelButton onClick={onDrillSelect} color="#00ff88" textColor="#0a0e1a" size="md" full>[ ✓ OPTED IN — RUN A REAL DRILL ]</PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="md" full>[ OPT IN TO REAL CALL DRILLS ]</PixelButton>
          )}</div>
          <div style={{ height: 10 }} />
          <PixelButton onClick={onTutorial} color="#1a2340" textColor="#6b8ba4" size="sm" full>HOW TO PLAY</PixelButton>
        </div>
        <div style={{ padding: "0 16px 24px", backgroundColor: "#0a0e1a", fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-caption)", color: "#6b8ba4", textAlign: "center", lineHeight: 1.5, }}>
          Train together. Protect the whole household.
        </div>
      </div>
     {selectedMember && (
        <MemberProfileOverlay
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onCustomize={onCustomize}
          coins={coins[selectedMember.id] ?? selectedMember.coins}
        />
      )}
    </div>
  );
}