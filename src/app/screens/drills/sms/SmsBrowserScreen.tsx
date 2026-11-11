import { useEffect, useState } from "react";
import { IconChevron, IconWarning } from "../../../components/icons";
import { Blink, PixelButton } from "../../../components/ui";
import { useT } from "../../../i18n";

export function SMSBrowserScreen({ onClose, onSubmit }: { activeMemberId: string; onClose: () => void; onSubmit: () => void }) {
  const t = useT();
  const [showUrlTip, setShowUrlTip] = useState(false);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 80); }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "var(--card)", borderBottom: "4px solid var(--red-line)", padding: "10px 12px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, backgroundColor: "var(--red-fill)" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "var(--yellow-fill)" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "var(--green-fill)" }} />
        </div>
        <button onClick={() => setShowUrlTip(!showUrlTip)} aria-expanded={showUrlTip} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "color-mix(in srgb, var(--red-fill) 8%, transparent)", border: "2px solid var(--red-line)", padding: "6px 8px", cursor: "pointer" }}>
          <IconWarning size={10} color="var(--red)" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", flex: 1, textAlign: "left" }}>parcelgo-redeliver.example</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>{t("UNSECURED")}</div>
          <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, transform: showUrlTip ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <IconChevron size={10} color="var(--red)" />
          </div>
        </button>
        {showUrlTip && (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 12%, transparent)", border: "2px solid var(--red-line)", padding: "8px", marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
            {t("Check the URL carefully. Fake domains often look similar to real services.")}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "var(--card)" }}>
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center", filter: glitch ? "hue-rotate(180deg)" : "none", transition: "filter 0.05s" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", marginBottom: 6 }}>{t("Redelivery Payment")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)" }}>{t("Enter your details to reschedule your parcel.")}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--red-line)", padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <IconWarning size={10} color="var(--red)" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>
                <Blink ms={400}>{t("SECURE VERIFIED")}</Blink>
              </div>
            </div>
          </div>
          {["Full Name", "Home Address", "Card Number", "CVV", "OTP Code"].map((label) => (
            <div key={label}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginBottom: 4 }}>{t(label)}</div>
              <div style={{ backgroundColor: "var(--background)", border: "2px solid var(--border)", padding: "10px", height: 36, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--secondary)" }}>▋</div>
            </div>
          ))}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)", textAlign: "center" }}>
            <Blink ms={800}>{t("UNSECURED PAGE — DO NOT ENTER DETAILS")}</Blink>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-4 py-4" style={{ borderTop: "4px solid var(--border)", backgroundColor: "var(--background)" }}>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={onSubmit} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full>{t("SUBMIT PAYMENT")}</PixelButton>
        </div>
        <div style={{ flex: 1 }}>
          <PixelButton onClick={onClose} color="var(--green-fill)" textColor="var(--on-fill)" size="sm" full>{t("CLOSE PAGE")}</PixelButton>
        </div>
      </div>
    </div>
  );
}
