import { useEffect, useState } from "react";
import { IconWarning } from "../../../components/icons";
import { Blink, PixelButton } from "../../../components/ui";

export function SMSBrowserScreen({ onClose, onSubmit }: { activeMemberId: string; onClose: () => void; onSubmit: () => void }) {
  const [showUrlTip, setShowUrlTip] = useState(false);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 80); }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #ff2d55", padding: "10px 12px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, backgroundColor: "#ff2d55" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#ffe66d" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#00ff88" }} />
        </div>
        <button onClick={() => setShowUrlTip(!showUrlTip)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "rgba(255,45,85,0.08)", border: "2px solid #ff2d55", padding: "6px 8px", cursor: "pointer" }}>
          <IconWarning size={10} color="#ff2d55" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", flex: 1, textAlign: "left" }}>parcelgo-redeliver.example</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>UNSECURED</div>
        </button>
        {showUrlTip && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.12)", border: "2px solid #ff2d55", padding: "8px", marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
            Check the URL carefully. Fake domains often look similar to real services.
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "#111827" }}>
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center", filter: glitch ? "hue-rotate(180deg)" : "none", transition: "filter 0.05s" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", marginBottom: 6 }}>Redelivery Payment</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8" }}>Enter your details to reschedule your parcel.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#1a2340", border: "2px solid #ff2d55", padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <IconWarning size={10} color="#ff2d55" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>
                <Blink ms={400}>SECURE VERIFIED</Blink>
              </div>
            </div>
          </div>
          {["Full Name", "Home Address", "Card Number", "CVV", "OTP Code"].map((label) => (
            <div key={label}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 4 }}>{label}</div>
              <div style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "10px", height: 36, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#1a2340" }}>▋</div>
            </div>
          ))}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55", textAlign: "center" }}>
            <Blink ms={800}>UNSECURED PAGE — DO NOT ENTER DETAILS</Blink>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-4 py-4" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={onSubmit} color="#ff2d55" textColor="#ffffff" size="sm" full>SUBMIT PAYMENT</PixelButton>
        </div>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={onClose} color="#00ff88" textColor="#0a0e1a" size="sm" full>CLOSE PAGE</PixelButton>
        </div>
      </div>
    </div>
  );
}
