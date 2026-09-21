import type { FamilyScenario } from "../../types/drills";
import { IconX, IconEyeInspect } from "../icons";

export function SenderInspectPanel({ scenario, onClose, showWarning = true }: { scenario: FamilyScenario; onClose: () => void; showWarning?: boolean }) {
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "0 -4px 0 #4ecdc4", animation: "slideUp 0.25s ease-out" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
        <div className="flex items-center gap-2"><IconEyeInspect size={12} color="#4ecdc4" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4" }}>SENDER INFO</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 3 }}>DISPLAY NAME</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8" }}>{scenario.sender}</div>
        </div>
        {scenario.senderEmail && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 3 }}>EMAIL ADDRESS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35" }}>{scenario.senderEmail}</div>
          </div>
        )}
        {scenario.senderDomain && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 3 }}>DOMAIN</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: scenario.isScam ? "#ff2d55" : "#00ff88" }}>{scenario.senderDomain}</div>
          </div>
        )}
        {showWarning && scenario.senderWarning && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.1)", border: "2px solid #ff2d55", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55", lineHeight: 1.8 }}>{scenario.senderWarning}</div>
          </div>
        )}
        {showWarning && !scenario.isScam && (
          <div style={{ backgroundColor: "rgba(0,255,136,0.1)", border: "2px solid #00ff88", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#00ff88", lineHeight: 1.8 }}>DOMAIN APPEARS LEGITIMATE</div>
          </div>
        )}
      </div>
    </div>
  );
}
