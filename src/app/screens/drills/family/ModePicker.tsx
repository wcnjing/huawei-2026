import type { DrillMode } from "../../../services/houseDrill";
import { useT } from "../../../i18n";
import { tint } from "../../../utils/color";

const MODES: { id: DrillMode; title: string; desc: string }[] = [
  { id: "turns", title: "TAKE TURNS", desc: "Team up and outsmart the scammers together." },
  { id: "race", title: "RACE", desc: "Head-to-head! Best score takes the crown." },
];

export function ModePicker({ value, onChange }: { value: DrillMode; onChange: (mode: DrillMode) => void }) {
  const t = useT();
  return (
    <div role="radiogroup" aria-label={t("GAME MODE")} className="grid grid-cols-2 gap-2">
      {MODES.map((mode) => {
        const on = mode.id === value;
        const color = mode.id === "race" ? "var(--orange)" : "var(--green)";
        return (
          <button
            key={mode.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(mode.id)}
            style={{
              minHeight: 44, padding: "8px 10px", cursor: "pointer", textAlign: "left",
              display: "flex", flexDirection: "column", justifyContent: "flex-start",
              backgroundColor: on ? tint(color, 13) : "var(--background)",
              border: `3px solid ${on ? color : "var(--border)"}`,
            }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: on ? color : "var(--foreground)", marginBottom: 4 }}>
              {t(mode.title)}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", lineHeight: 1.5 }}>
              {t(mode.desc)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
