export function CharMum({ size = 48, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 12;
  const yo = (frame === 1 || frame === 3) ? -u * 0.8 : 0;
  const H = size * 1.5;
  const r = (x: number, y: number, w: number, h: number, c: string) =>
    <rect key={`${x}${y}${c}`} x={x * u} y={(y * u) + yo} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(5, 0, 2, 1, "#3a2a1a")}{r(4, 1, 4, 1, "#3a2a1a")}
      {r(2, 3, 2, 3, "#3a2a1a")}{r(8, 3, 2, 3, "#3a2a1a")}
      {r(3, 2, 6, 5, "#f4b880")}{r(2, 3, 8, 3, "#f4b880")}
      {r(4, 4, 1, 1, "#0a0e1a")}{r(7, 4, 1, 1, "#0a0e1a")}
      {r(4, 6, 4, 1, "#c8704a")}{r(5, 7, 2, 1, "#c8704a")}
      {r(5, 7, 2, 1, "#f4b880")}
      {r(2, 8, 8, 4, "#006633")}{r(3, 8, 6, 4, "#00ff88")}
      {r(1, 8, 2, 4, "#f4b880")}{r(9, 8, 2, 4, "#f4b880")}
      {r(4, 9, 4, 2, "#00cc66")}
      {r(3, 12, 6, 3, "#1a3a2a")}
      {r(3, 15, 2, 2, "#1a3a2a")}{r(7, 15, 2, 2, "#1a3a2a")}
      {r(2, 16, 3, 1, "#0a1a12")}{r(6, 16, 3, 1, "#0a1a12")}
    </svg>
  );
}