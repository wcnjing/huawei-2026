import { IconChevron, IconWarning } from "../icons";
import { useState } from "react";
import type { DrillFlag } from "../../types/drills";
import { useT } from "../../i18n";

export function ScamReasonSection({ flags }: { flags: DrillFlag[] }) {
  const t = useT();
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "3px solid var(--red-line)" }}>
        <IconWarning size={16} color="var(--red)" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)", letterSpacing: 1 }}>{t("WHY IT WAS A SCAM")}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((flag, i) => {
          const isOpen = expanded === flag.id;
          return (
            <button key={flag.id} type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : flag.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", padding: 0, border: "none", cursor: "pointer" }}>
              <div style={{ backgroundColor: isOpen ? "color-mix(in srgb, var(--red-fill) 10%, transparent)" : "var(--card)", border: `3px solid ${isOpen ? "var(--red-line)" : "var(--border)"}`, boxShadow: isOpen ? "3px 3px 0 var(--red-line)" : "none", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, backgroundColor: "var(--red-fill)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--on-fill)" }}>{i + 1}</span>
                  </div>
                  <IconWarning size={14} color={isOpen ? "var(--red)" : "var(--muted-foreground)"} />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isOpen ? "var(--red)" : "var(--foreground)", flex: 1 }}>{t(flag.name)}</div>
                  <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <IconChevron size={12} color={isOpen ? "var(--red)" : "var(--muted-foreground)"} />
                  </div>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "2px solid color-mix(in srgb, var(--red-line) 30%, transparent)", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6 }}>
                    {t(flag.explanation)}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
