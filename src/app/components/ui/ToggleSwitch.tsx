export function ToggleSwitchB({ on, onToggle, color = "#00ff88" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} style={{ width: 44, height: 24, backgroundColor: on ? color : "#2a3a5c", border: "3px solid #0a0e1a", boxShadow: "3px 3px 0 #0a0e1a", cursor: "pointer", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 14, backgroundColor: on ? "#0a0e1a" : "#6b8ba4", transition: "left 0.15s" }} />
    </button>
  );
}