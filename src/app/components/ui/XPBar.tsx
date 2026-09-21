export function XPBar({ current, max, color = "#00ff88" }: { current: number; max: number; color?: string }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full" style={{ border: "3px solid #2a3a5c", backgroundColor: "#0a0e1a", height: 16 }}>
      <div style={{ width: `${pct}%`, backgroundColor: color, height: "100%", transition: "width 0.5s" }} />
    </div>
  );
}
