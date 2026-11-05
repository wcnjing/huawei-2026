import { useEffect, useRef, useState } from "react";
import { IconAttachment, IconDownload, IconSkull } from "../../../components/icons";
import { Blink, PixelButton } from "../../../components/ui";
import { useT } from "../../../i18n";

export function EmailDownloadScreen({ onCancel, onComplete }: { activeMemberId: string; onCancel: () => void; onComplete: () => void }) {
  const t = useT();
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
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6" style={{ backgroundColor: "color-mix(in srgb, var(--red) 8%, var(--background))" }}>
        <div style={{ filter: "drop-shadow(0 0 calc(20px * var(--glow)) color-mix(in srgb, var(--red) 90%, transparent))" }}>
          <IconSkull size={72} color="var(--red)" />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--red)", textAlign: "center", lineHeight: 1.8, textShadow: "0 0 calc(20px * var(--glow)) var(--red)" }}>
          {t("MALWARE SIMULATION")}<br />{t("DETECTED")}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)", textAlign: "center", lineHeight: 2 }}>
          {t("DEVICE COMPROMISED")}<br />{t("PASSWORDS AT RISK")}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)" }}>{t("Returning to result...")}</div>
      </div>
    );
  }

  return (
      <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6">
        <div style={{ filter: "drop-shadow(0 0 calc(8px * var(--glow)) color-mix(in srgb, var(--violet) 60%, transparent))" }}>
          <IconDownload size={48} color="var(--violet)" />
        </div>
        <div style={{ width: "100%", backgroundColor: "var(--card)", border: "3px solid var(--violet)", padding: "16px" }}>
          <div className="flex items-center gap-3 mb-4">
            <IconAttachment size={20} color="var(--violet)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--violet)" }}>Reward_Verification_Form.zip</div>
          </div>
          <div style={{ width: "100%", backgroundColor: "var(--background)", border: "2px solid var(--border)", height: 20, marginBottom: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", backgroundColor: phase === "opening" ? "var(--orange-fill)" : "var(--violet-fill)", width: `${progress}%`, transition: "width 0.1s" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--foreground-strong)", mixBlendMode: "difference" }}>
                {phase === "downloading" ? `${progress}%` : "100%"}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: phase === "opening" ? "var(--orange)" : "var(--violet)", textAlign: "center" }}>
            {phase === "downloading" ? t("DOWNLOADING...") : t("OPENING FILE...")}
          </div>
        </div>
        <PixelButton onClick={handleCancel} color="var(--green-fill)" textColor="var(--on-fill)" size="md" full>{t("CANCEL DOWNLOAD")}</PixelButton>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)", textAlign: "center", lineHeight: 2 }}>
          <Blink ms={500}>{t("WARNING — SIMULATED MALWARE DETECTED")}</Blink>
        </div>
      </div>
  );
}
