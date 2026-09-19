export function CharDad({ size = 52, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 12;
  const xo = frame < 2 ? u * 1 : -u * 1;
  const H = size * 1.55;
  const r = (x: number, y: number, w: number, h: number, c: string) =>
    <rect key={`${x}${y}${c}`} x={(x + xo) * u} y={y * u} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(3, 0, 6, 2, "#2a1a0a")}{r(2, 1, 8, 2, "#2a1a0a")}
      {r(2, 2, 8, 6, "#e8a060")}{r(1, 3, 10, 4, "#e8a060")}
      {r(3, 4, 2, 1, "#0a0e1a")}{r(7, 4, 2, 1, "#0a0e1a")}
      {r(2, 7, 8, 1, "#b06030")}
      {r(1, 8, 10, 5, "#1a4040")}{r(2, 8, 8, 5, "#4ecdc4")}
      {r(4, 8, 4, 1, "#ffffff")}
      {r(0, 8, 2, 5, "#e8a060")}{r(10, 8, 2, 5, "#e8a060")}
      {r(2, 13, 8, 1, "#0a0e1a")}
      {r(2, 14, 8, 3, "#2a3a4a")}
      {r(2, 16, 3, 1, "#2a3a4a")}{r(7, 16, 3, 1, "#2a3a4a")}
      {r(1, 17, 4, 1, "#1a2030")}{r(6, 17, 4, 1, "#1a2030")}
    </svg>
  );
}