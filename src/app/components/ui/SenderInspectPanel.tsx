import type { FamilyScenario } from "../../types/drills";
import { IconX, IconEyeInspect } from "../icons";
import { useT } from "../../i18n";

export function SenderInspectPanel({ scenario, onClose, showWarning = true }: { scenario: FamilyScenario; onClose: () => void; showWarning?: boolean }) {
  const t = useT();
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: "var(--card)", border: "4px solid var(--teal-line)", boxShadow: "0 -4px 0 var(--teal-line)", animation: "slideUp 0.25s ease-out" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid var(--border)" }}>
        <div className="flex items-center gap-2"><IconEyeInspect size={12} color="var(--teal)" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)" }}>{t("SENDER INFO")}</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="var(--muted-foreground)" /></button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginBottom: 3 }}>{t("DISPLAY NAME")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)" }}>{t(scenario.sender)}</div>
        </div>
        {scenario.senderEmail && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginBottom: 3 }}>{t("EMAIL ADDRESS")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)" }}>{scenario.senderEmail}</div>
          </div>
        )}
        {scenario.senderDomain && (
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginBottom: 3 }}>{t("DOMAIN")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: scenario.isScam ? "var(--red)" : "var(--green)" }}>{t(scenario.senderDomain)}</div>
          </div>
        )}
        {showWarning && scenario.senderWarning && (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 10%, transparent)", border: "2px solid var(--red-line)", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)", lineHeight: 1.8 }}>{t(scenario.senderWarning)}</div>
          </div>
        )}
        {showWarning && !scenario.isScam && (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--green-fill) 10%, transparent)", border: "2px solid var(--green-line)", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--green)", lineHeight: 1.8 }}>{t("DOMAIN APPEARS LEGITIMATE")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
