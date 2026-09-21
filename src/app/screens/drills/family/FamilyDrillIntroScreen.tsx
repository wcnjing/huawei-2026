import { IconBulb, IconCoin, IconShield, IconX } from "../../../components/icons";
import { PixelButton } from "../../../components/ui";
import { MemberChar } from "../../../components/avatars";
import { useMembers } from "../../../hooks/useMembers";
import { useState } from "react";

export function FamilyDrillIntroScreen({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const [showHowTo, setShowHowTo] = useState(false);
  const members = useMembers();
  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88" }}>HOUSE DRILL</div>
        <div className="flex items-center gap-2"><IconShield size={14} color="#00ff88" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#00ff88" }}>{members.length} READY</div></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>
        <div style={{ margin: "14px 0", backgroundColor: "#111827", border: "3px solid #00ff88", padding: "10px 14px" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><IconShield size={14} color="#00ff88" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#00ff88" }}>HOUSE TRUST</div></div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d" }}>100%</div>
          </div>
          <div style={{ height: 8, backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c" }}>
            <div style={{ height: "100%", width: "100%", backgroundColor: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {members.slice(0, 6).map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1" style={{ flex: "0 1 132px", minWidth: 0, textAlign: "center" }}>
              <MemberChar member={m} size={44} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4" }}>{m.name.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffffff", textAlign: "center", marginBottom: 12, lineHeight: 1.8 }}>
          Protect the whole household from scams.
        </div>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginBottom: 8 }}>HOW IT WORKS</div>
          {["Each house member faces a suspicious message.", "Inspect links and senders before deciding.", "Some messages are safe — read carefully!", "Wrong choices teach you what to watch for."].map((line, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 6, height: 6, backgroundColor: "#00ff88", flexShrink: 0, marginTop: 4 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>{line}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "6px 8px", backgroundColor: "rgba(255,230,109,0.08)", border: "2px solid #ffe66d", display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoin size={10} color="#ffe66d" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d" }}>+30 COINS PER CORRECT · -10 PER WRONG</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <PixelButton onClick={onStart} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ START HOUSE DRILL ]</PixelButton>
          <PixelButton onClick={() => setShowHowTo(true)} color="#ffe66d" textColor="#0a0e1a" size="sm" full>[ HOW TO PLAY ]</PixelButton>
          <PixelButton onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK HOME ]</PixelButton>
        </div>
      </div>
      {showHowTo && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.88)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
          <div style={{ backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "4px 4px 0 #4ecdc4", width: "100%" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4" }}>HOW TO PLAY</div>
              <button onClick={() => setShowHowTo(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              {[["TAP SENDER", "Inspect sender identity and domain."], ["LONG-PRESS LINKS", "Reveal the actual URL before opening."], ["TAP CLUE TAGS", "Uncover red flags in the message."], ["READ CAREFULLY", "Not every message is a scam."], ["CHOOSE SAFELY", "Pick the best action for the house."]].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <IconBulb size={12} color="#ffe66d" />
                  <div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 2 }}>{title}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.4 }}>{desc}</div></div>
                </div>
              ))}
              <PixelButton onClick={() => setShowHowTo(false)} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>GOT IT</PixelButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
