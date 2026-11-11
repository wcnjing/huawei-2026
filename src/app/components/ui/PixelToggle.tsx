import { useT } from "../../i18n";

export function PixelToggle({ on, onToggle, color = "var(--green-fill)" }: { on: boolean; onToggle: () => void; color?: string }) {
  const t = useT();
  return (
    <button onClick={onToggle} aria-pressed={on} style={{ width: 88, height: 44, backgroundColor: on ? color : "var(--border)", border: `3px solid ${on ? "var(--outline)" : "var(--secondary)"}`, boxShadow: on ? `3px 3px 0 var(--outline)` : "2px 2px 0 var(--shadow-pixel)", cursor: "pointer", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 8, left: on ? 55 : 4, width: 22, height: 22, backgroundColor: on ? "var(--background)" : "var(--muted-foreground)", transition: "left 0.15s" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: on ? "flex-start" : "flex-end", padding: "0 8px" }}>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: on ? "var(--on-fill)" : "var(--foreground)" }}>{on ? t("ON") : t("OFF")}</span>
      </div>
    </button>
  );
}
