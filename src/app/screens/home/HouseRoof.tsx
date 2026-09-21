export function HouseRoof({ title }: { title: string }) {
  return (
    <div style={{ position: "relative", height: 48, flexShrink: 0, backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", overflow: "hidden" }}>
      <svg width="100%" height={48} viewBox="0 0 390 48" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, imageRendering: "pixelated" }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <rect key={i} x={i * 16} y={48 - ((12 - i) * 4)} width={(390 - i * 32)} height={(12 - i) * 4} fill="#1a2a3a" opacity={0.9} />
        ))}
        <polyline points="0,48 195,4 390,48" fill="none" stroke="#2a3a5c" strokeWidth={3} />
        <rect x={280} y={10} width={20} height={24} fill="#2a3a5c" />
        <rect x={278} y={8} width={24} height={6} fill="#3a4a6c" />
        <rect x={283} y={2} width={4} height={4} fill="#4a5a7c" opacity={0.5} />
      </svg>
      <div className="house-roof-title" style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </div>
    </div>
  );
}
