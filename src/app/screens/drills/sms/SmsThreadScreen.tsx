import { useState } from "react";
import type { DrillFlag } from "../../../types/drills";
import { FLAG_MAP } from "../../../data/scamFlags";
import { IconWarning } from "../../../components/icons";
import { FlagTooltip, AnnotatedMessage, PixelButton } from "../../../components/ui";
import { SMS_LINES } from "./smsScenario";

export function SMSThreadScreen({ onReport, onAskFamily, onTapLink, onBack }: { activeMemberId: string; onReport: () => void; onAskFamily: () => void; onTapLink: () => void; onBack: () => void }) {
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4" style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>{"<"}</div>
        </button>
        <div style={{ width: 32, height: 32, backgroundColor: "#ff2d55", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconWarning size={16} color="#ffffff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff2d55" }}>ParcelGo Alert</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 2 }}>Unknown sender</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff6b35" }}>DRILL ACTIVE</div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div className="flex flex-col gap-3" style={{ height: "100%", overflowY: "auto", padding: "16px", scrollbarWidth: "none" }}>
          <div className="flex justify-start">
            <div style={{ maxWidth: "80%", backgroundColor: "#1a2340", border: "3px solid #ff2d55", padding: "12px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.8 }}>
              {SMS_LINES.map((line, i) => (
                <div key={i}>
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                </div>
              ))}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <IconWarning size={9} color="#ff2d55" />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>TAP RED TEXT TO INSPECT</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div style={{ maxWidth: "75%", backgroundColor: "#0c1a10", border: "3px solid #00ff88", padding: "10px 12px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88", lineHeight: 1.5 }}>
              Something feels off. Inspect the message carefully before acting.
            </div>
          </div>
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-4 flex flex-col gap-3" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <PixelButton onClick={onReport} color="#00ff88" textColor="#0a0e1a" size="sm" full>REPORT + BLOCK</PixelButton>
          </div>
          <div style={{ flex: 1 }}>
            <PixelButton onClick={onAskFamily} color="#ffe66d" textColor="#0a0e1a" size="sm" full>ASK SOMEONE YOU TRUST</PixelButton>
          </div>
        </div>
        <PixelButton onClick={onTapLink} color="#ff2d55" textColor="#ffffff" size="sm" full>TAP LINK</PixelButton>
      </div>
    </div>
  );
}
