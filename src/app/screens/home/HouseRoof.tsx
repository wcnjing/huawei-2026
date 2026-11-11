import type { RoomTime } from "../../types/roomStyle";

/** Night: the dark stepped roof. Day: a daylight sky with a pale roof and a dark outline. */
const ROOF = {
  night: { sky: "#0a0e1a", base: "#2a3a5c", steps: ["#1a2a3a", "#1a2a3a"], stepOpacity: 0.9, edge: "#2a3a5c", chimney: "#2a3a5c", chimneyEdge: undefined, cap: "#3a4a6c", smoke: "#4a5a7c", title: "#4ecdc4" },
  day: { sky: "#dff0fb", base: "#0f1a33", steps: ["#d6deeb", "#c9d4e5"], stepOpacity: 1, edge: "#0f1a33", chimney: "#f5f8fb", chimneyEdge: "#0f1a33", cap: "#c9d4e5", smoke: "#a3b3c9", title: "#0f1a33" },
};

export function HouseRoof({ title, time = "night" }: { title: string; time?: RoomTime }) {
  const c = ROOF[time];
  return (
    <div data-room-time={time} style={{ position: "relative", height: 48, flexShrink: 0, backgroundColor: c.sky, borderBottom: `4px solid ${c.base}`, overflow: "hidden" }}>
      <svg width="100%" height={48} viewBox="0 0 390 48" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, imageRendering: "pixelated" }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <rect key={i} x={i * 16} y={48 - ((12 - i) * 4)} width={(390 - i * 32)} height={(12 - i) * 4} fill={c.steps[i % 2]} opacity={c.stepOpacity} />
        ))}
        <polyline points="0,48 195,4 390,48" fill="none" stroke={c.edge} strokeWidth={3} />
        <rect x={280} y={10} width={20} height={24} fill={c.chimney} stroke={c.chimneyEdge} strokeWidth={c.chimneyEdge ? 2 : undefined} />
        <rect x={278} y={8} width={24} height={6} fill={c.cap} stroke={c.chimneyEdge} strokeWidth={c.chimneyEdge ? 2 : undefined} />
        <rect x={283} y={2} width={4} height={4} fill={c.smoke} opacity={0.5} />
      </svg>
      <div className="house-roof-title" style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: c.title, letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </div>
    </div>
  );
}
