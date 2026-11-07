import { useState, useEffect } from "react";
import { IconChevron, IconShield, IconSkull, IconWarning } from "../../../components/icons";
import { Blink, PixelButton } from "../../../components/ui";
import { useT } from "../../../i18n";

export function EmailBrowserScreen({ onClose, onSubmit }: { activeMemberId: string; onClose: () => void; onSubmit: () => void }) {
  const t = useT();
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
      <div className="flex flex-col items-center justify-center h-full gap-6" style={{ backgroundColor: "color-mix(in srgb, var(--red) 8%, var(--background))" }}>
        <div style={{ filter: "drop-shadow(0 0 calc(20px * var(--glow)) color-mix(in srgb, var(--red) 90%, transparent))" }}>
          <IconSkull size={80} color="var(--red)" />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--red)", textAlign: "center", lineHeight: 1.6, textShadow: "0 0 calc(20px * var(--glow)) var(--red)" }}>
          {t("DETAILS")}<br />{t("CAPTURED")}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", textAlign: "center" }}>{t("Redirecting to result...")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--card)", borderBottom: "4px solid var(--red-line)", padding: "10px 12px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, backgroundColor: "var(--red-fill)" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "var(--yellow-fill)" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "var(--green-fill)" }} />
        </div>
        <button onClick={() => setShowUrlTip(!showUrlTip)} aria-expanded={showUrlTip} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", backgroundColor: "color-mix(in srgb, var(--red-fill) 8%, transparent)", border: "2px solid var(--red-line)", padding: "6px 8px", cursor: "pointer" }}>
          <IconWarning size={10} color="var(--red)" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", flex: 1, textAlign: "left" }}>campus-secure-rewards.example</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>{t("UNVERIFIED SITE")}</div>
          <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, transform: showUrlTip ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <IconChevron size={10} color="var(--red)" />
          </div>
        </button>
        {showUrlTip && (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 12%, transparent)", border: "2px solid var(--red-line)", padding: "8px", marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
            {t("The domain is suspicious. Scammers often use official-sounding fake domains.")}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "var(--card)" }}>
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center", filter: glitch ? "hue-rotate(200deg) brightness(1.2)" : "none", transition: "filter 0.05s" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--violet)", marginBottom: 6 }}>{t("Digital Safety Reward Portal")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)" }}>{t("Verify your identity to receive $300.")}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ backgroundColor: "var(--secondary)", border: `2px solid ${glitch ? "var(--red-line)" : "var(--border)"}`, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6, transition: "border-color 0.05s" }}>
              <IconShield size={12} color={glitch ? "var(--red)" : "var(--border)"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: glitch ? "var(--red)" : "var(--border)" }}>{t("SECURE VERIFIED")}</div>
            </div>
          </div>
          {["Student Email", "Password", "NRIC / ID Number", "Phone Number", "OTP Code"].map((label) => (
            <div key={label}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginBottom: 4 }}>{t(label)}</div>
              <div style={{ backgroundColor: "var(--background)", border: "2px solid var(--border)", padding: "10px", height: 36, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--secondary)" }}>▋</div>
            </div>
          ))}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)", textAlign: "center" }}>
            <Blink ms={700}>{t("UNSECURED — DO NOT SUBMIT REAL DATA")}</Blink>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-4 py-4" style={{ borderTop: "4px solid var(--border)", backgroundColor: "var(--background)" }}>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={handleSubmit} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full>{t("SUBMIT DETAILS")}</PixelButton>
        </div>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={onClose} color="var(--green-fill)" textColor="var(--on-fill)" size="sm" full>{t("CLOSE + REPORT")}</PixelButton>
        </div>
      </div>
    </div>
  );
}
