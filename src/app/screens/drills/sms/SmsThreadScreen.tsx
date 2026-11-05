import { useState } from "react";
import type { DrillFlag } from "../../../types/drills";
import { FLAG_MAP } from "../../../data/scamFlags";
import { IconWarning } from "../../../components/icons";
import { FlagTooltip, AnnotatedMessage, PixelButton } from "../../../components/ui";
import { SMS_LINES } from "./smsScenario";
import { useT } from "../../../i18n";

export function SMSThreadScreen({ onReport, onAskFamily, onTapLink, onBack }: { activeMemberId: string; onReport: () => void; onAskFamily: () => void; onTapLink: () => void; onBack: () => void }) {
  const t = useT();
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4" style={{ backgroundColor: "var(--card)", borderBottom: "4px solid var(--border)", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{"<"}</div>
        </button>
        <div style={{ width: 32, height: 32, backgroundColor: "var(--red-fill)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconWarning size={16} color="var(--foreground-strong)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)" }}>ParcelGo Alert</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 2 }}>{t("Unknown sender")}</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--orange)" }}>{t("DRILL ACTIVE")}</div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div className="flex flex-col gap-3" style={{ height: "100%", overflowY: "auto", padding: "16px", scrollbarWidth: "none" }}>
          <div className="flex justify-start">
            <div style={{ maxWidth: "80%", backgroundColor: "var(--secondary)", border: "3px solid var(--red)", padding: "12px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.8 }}>
              {SMS_LINES.map((line, i) => (
                <div key={i}>
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                </div>
              ))}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <IconWarning size={9} color="var(--red)" />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>{t("TAP RED TEXT TO INSPECT")}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div style={{ maxWidth: "75%", backgroundColor: "color-mix(in srgb, var(--green) 8%, var(--background))", border: "3px solid var(--green)", padding: "10px 12px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--green)", lineHeight: 1.5 }}>
              {t("Something feels off. Inspect the message carefully before acting.")}
            </div>
          </div>
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-4 flex flex-col gap-3" style={{ borderTop: "4px solid var(--border)", backgroundColor: "var(--background)" }}>
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <PixelButton onClick={onReport} color="var(--green-fill)" textColor="var(--on-fill)" size="sm" full>{t("REPORT + BLOCK")}</PixelButton>
          </div>
          <div style={{ flex: 1 }}>
            <PixelButton onClick={onAskFamily} color="var(--yellow-fill)" textColor="var(--on-fill)" size="sm" full>{t("ASK SOMEONE YOU TRUST")}</PixelButton>
          </div>
        </div>
        <PixelButton onClick={onTapLink} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full>{t("TAP LINK")}</PixelButton>
      </div>
    </div>
  );
}
