export function PixelToggle({ on, onToggle, color = "#00ff88" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} aria-pressed={on} style={{ width: 88, height: 44, backgroundColor: on ? color : "#2a3a5c", border: `3px solid ${on ? "#0a0e1a" : "#1a2340"}`, boxShadow: on ? `3px 3px 0 #0a0e1a` : "2px 2px 0 #111", cursor: "pointer", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 8, left: on ? 55 : 4, width: 22, height: 22, backgroundColor: on ? "#0a0e1a" : "#6b8ba4", transition: "left 0.15s" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: on ? "flex-start" : "flex-end", padding: "0 8px" }}>
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: on ? "#0a0e1a" : "#e8f4f8" }}>{on ? "ON" : "OFF"}</span>
      </div>
    </button>
  );
}
