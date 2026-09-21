import { useEffect, useRef, useState } from "react";
import { IconAttachment, IconDownload, IconSkull } from "../../../components/icons";
import { Blink, PixelButton } from "../../../components/ui";

export function EmailDownloadScreen({ onCancel, onComplete }: { activeMemberId: string; onCancel: () => void; onComplete: () => void }) {
  const [phase, setPhase] = useState<"downloading" | "opening" | "malware">("downloading");
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => { if (p >= 100) { clearInterval(interval); return 100; } return p + 1; });
    }, 32);
    const t1 = setTimeout(() => setPhase("opening"), 3500);
    const t2 = setTimeout(() => setPhase("malware"), 5500);
    const t3 = setTimeout(() => { doneRef.current = true; onComplete(); }, 7500);
    return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleCancel = () => { if (!doneRef.current) onCancel(); };

  if (phase === "malware") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6" style={{ backgroundColor: "#1a0000" }}>
        <div style={{ filter: "drop-shadow(0 0 20px rgba(255,45,85,0.9))" }}>
          <IconSkull size={72} color="#ff2d55" />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff2d55", textAlign: "center", lineHeight: 1.8, textShadow: "0 0 20px #ff2d55" }}>
          MALWARE SIMULATION<br />DETECTED
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35", textAlign: "center", lineHeight: 2 }}>
          DEVICE COMPROMISED<br />PASSWORDS AT RISK
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8" }}>Returning to result...</div>
      </div>
    );
  }

  return (
      <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6">
        <div style={{ filter: "drop-shadow(0 0 8px rgba(199,125,255,0.6))" }}>
          <IconDownload size={48} color="#c77dff" />
        </div>
        <div style={{ width: "100%", backgroundColor: "#111827", border: "3px solid #c77dff", padding: "16px" }}>
          <div className="flex items-center gap-3 mb-4">
            <IconAttachment size={20} color="#c77dff" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#c77dff" }}>Reward_Verification_Form.zip</div>
          </div>
          <div style={{ width: "100%", backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", height: 20, marginBottom: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", backgroundColor: phase === "opening" ? "#ff6b35" : "#c77dff", width: `${progress}%`, transition: "width 0.1s" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffffff", mixBlendMode: "difference" }}>
                {phase === "downloading" ? `${progress}%` : "100%"}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: phase === "opening" ? "#ff6b35" : "#c77dff", textAlign: "center" }}>
            {phase === "downloading" ? "DOWNLOADING..." : "OPENING FILE..."}
          </div>
        </div>
        <PixelButton onClick={handleCancel} color="#00ff88" textColor="#0a0e1a" size="md" full>CANCEL DOWNLOAD</PixelButton>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55", textAlign: "center", lineHeight: 2 }}>
          <Blink ms={500}>WARNING — SIMULATED MALWARE DETECTED</Blink>
        </div>
      </div>
  );
}
