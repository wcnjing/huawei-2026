import type { FamilyClue } from "../../types/drills";
import { IconX, IconBulb } from "../icons";
import { useT } from "../../i18n";

export function ClueTooltip({ clue, onClose }: { clue: FamilyClue; onClose: () => void }) {
  const t = useT();
  return (
    <div style={{ position: "absolute", top: "25%", left: 12, right: 12, zIndex: 60, backgroundColor: "var(--card)", border: "4px solid var(--yellow-line)", boxShadow: "4px 4px 0 var(--yellow-line)", animation: "slideUp 0.2s ease-out" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid var(--border)" }}>
        <div className="flex items-center gap-2"><IconBulb size={12} color="var(--yellow)" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--yellow)" }}>{t("CLUE")}</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="var(--muted-foreground)" /></button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)" }}>{t(clue.label)}</div>
        <div style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 15%, transparent)", border: "2px solid var(--orange-line)", padding: "6px 8px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)" }}>"{t(clue.text)}"</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6 }}>{t(clue.explanation)}</div>
      </div>
    </div>
  );
}
