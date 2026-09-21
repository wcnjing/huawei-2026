import { useState, useEffect } from "react";
import { IconBell, IconCheck, IconWarning, IconX } from "../../../components/icons";
import { PixelPhone } from "./PixelPhone";
import { Blink } from "../../../components/ui";

export function IncomingCallScreen({ onAccept, onDecline }: { activeMemberId: string; onAccept: () => void; onDecline: () => void }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(t);
  }, []);
  return (
      <div className="flex flex-col items-center justify-between flex-1 px-6 py-12" style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0d1526 50%, #0a0e1a 100%)" }}>
        <div className="flex flex-col items-center gap-2">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", letterSpacing: 2 }}>INCOMING CALL</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35", border: "2px solid #ff6b35", padding: "4px 8px", backgroundColor: "rgba(255,107,53,0.1)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconWarning size={12} color="#ff6b35" />
            UNKNOWN CALLER
          </div>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div style={{ opacity: pulse ? 1 : 0.6, transition: "opacity 0.4s" }}>
            <PixelPhone ringing />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-heading)", color: "#ffffff", textAlign: "center" }}>
            +1 (???)<br />???-????
          </div>
          <Blink ms={900}>
            <div className="flex items-center gap-2" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35" }}>
              <IconBell size={14} color="#ff6b35" />
              RINGING...
            </div>
          </Blink>
          <div style={{ backgroundColor: "rgba(255,45,85,0.1)", border: "3px solid #ff2d55", padding: "8px 12px", width: "100%" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", lineHeight: 1.5 }}>
              DRILL MODE ACTIVE — This is a simulated scam call. Can you hang tough?
            </div>
          </div>
        </div>
        <div className="flex gap-12 items-center">
          <div className="flex flex-col items-center gap-3">
            <button onClick={onDecline} onMouseDown={(e) => (e.currentTarget.style.transform = "translate(4px,4px)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} style={{ width: 72, height: 72, backgroundColor: "#ff2d55", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.05s" }}>
              <IconX size={32} color="#ffffff" />
            </button>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>DECLINE</div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={onAccept} onMouseDown={(e) => (e.currentTarget.style.transform = "translate(4px,4px)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} style={{ width: 72, height: 72, backgroundColor: "#00ff88", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.05s" }}>
              <IconCheck size={32} color="#0a0e1a" />
            </button>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#00ff88" }}>ACCEPT</div>
          </div>
        </div>
      </div>
  );
}
