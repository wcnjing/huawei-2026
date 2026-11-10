import type { DrillFlag } from "../../types/drills";
import { IconX, IconWarning } from "../icons";
import { useT } from "../../i18n";

export function FlagTooltip({ flag, onClose }: { flag: DrillFlag; onClose: () => void }) {
  const t = useT();
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        backgroundColor: "color-mix(in srgb, var(--background) 95%, transparent)",
        borderTop: "3px solid var(--red-line)",
        padding: "12px 16px 16px",
        backdropFilter: "blur(4px)",
        animation: "slideUp 0.15s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <IconWarning size={16} color="var(--red)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)", marginBottom: 6, letterSpacing: 1 }}>
            {t(flag.name)}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
            {t(flag.explanation)}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4 }}>
          <IconX size={12} color="var(--muted-foreground)" />
        </button>
      </div>
    </div>
  );
}
