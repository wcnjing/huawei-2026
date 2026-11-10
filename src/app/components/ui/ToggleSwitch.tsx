export function ToggleSwitchB({ on, onToggle, color = "var(--green-fill)" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} style={{ width: 44, height: 24, backgroundColor: on ? color : "var(--border)", border: "3px solid var(--outline)", boxShadow: "3px 3px 0 var(--outline)", cursor: "pointer", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 14, backgroundColor: on ? "var(--background)" : "var(--muted-foreground)", transition: "left 0.15s" }} />
    </button>
  );
}
