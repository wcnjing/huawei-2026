export function XPBar({ current, max, color = "var(--green-fill)" }: { current: number; max: number; color?: string }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full" style={{ border: "3px solid var(--border)", backgroundColor: "var(--background)", height: 16 }}>
      <div style={{ width: `${pct}%`, backgroundColor: color, height: "100%", transition: "width 0.5s" }} />
    </div>
  );
}
