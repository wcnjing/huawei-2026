import { useState, useEffect } from "react";
import { IconShield, IconSkull, IconWarning } from "../../../components/icons";
import { Blink, PixelButton } from "../../../components/ui";

export function EmailBrowserScreen({ onClose, onSubmit }: { activeMemberId: string; onClose: () => void; onSubmit: () => void }) {
  const [showUrlTip, setShowUrlTip] = useState(false);
  const [showBreach, setShowBreach] = useState(false);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 90); }, 3000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = () => {
    setShowBreach(true);
    setTimeout(() => onSubmit(), 2200);
  };

  if (showBreach) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6" style={{ backgroundColor: "#1a0000" }}>
        <div style={{ filter: "drop-shadow(0 0 20px rgba(255,45,85,0.9))" }}>
          <IconSkull size={80} color="#ff2d55" />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff2d55", textAlign: "center", lineHeight: 1.6, textShadow: "0 0 20px #ff2d55" }}>
          DETAILS<br />CAPTURED
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", textAlign: "center" }}>Redirecting to result...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #ff2d55", padding: "10px 12px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, backgroundColor: "#ff2d55" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#ffe66d" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#00ff88" }} />
        </div>
        <button onClick={() => setShowUrlTip(!showUrlTip)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", backgroundColor: "rgba(255,45,85,0.08)", border: "2px solid #ff2d55", padding: "6px 8px", cursor: "pointer" }}>
          <IconWarning size={10} color="#ff2d55" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", flex: 1, textAlign: "left" }}>campus-secure-rewards.example</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>UNVERIFIED SITE</div>
        </button>
        {showUrlTip && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.12)", border: "2px solid #ff2d55", padding: "8px", marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
            The domain is suspicious. Scammers often use official-sounding fake domains.
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "#111827" }}>
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center", filter: glitch ? "hue-rotate(200deg) brightness(1.2)" : "none", transition: "filter 0.05s" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#c77dff", marginBottom: 6 }}>Digital Safety Reward Portal</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8" }}>Verify your identity to receive $300.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#1a2340", border: `2px solid ${glitch ? "#ff2d55" : "#2a3a5c"}`, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6, transition: "border-color 0.05s" }}>
              <IconShield size={12} color={glitch ? "#ff2d55" : "#2a3a5c"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: glitch ? "#ff2d55" : "#2a3a5c" }}>SECURE VERIFIED</div>
            </div>
          </div>
          {["Student Email", "Password", "NRIC / ID Number", "Phone Number", "OTP Code"].map((label) => (
            <div key={label}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 4 }}>{label}</div>
              <div style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "10px", height: 36, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#1a2340" }}>▋</div>
            </div>
          ))}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55", textAlign: "center" }}>
            <Blink ms={700}>UNSECURED — DO NOT SUBMIT REAL DATA</Blink>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-4 py-4" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={handleSubmit} color="#ff2d55" textColor="#ffffff" size="sm" full>SUBMIT DETAILS</PixelButton>
        </div>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={onClose} color="#00ff88" textColor="#0a0e1a" size="sm" full>CLOSE + REPORT</PixelButton>
        </div>
      </div>
    </div>
  );
}
