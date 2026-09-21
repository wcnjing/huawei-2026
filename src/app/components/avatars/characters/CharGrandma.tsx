export function CharGrandma({ size = 48, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 12;
  const yo = (frame === 1 || frame === 3) ? u * 0.5 : 0;
  const xo = (frame === 1 || frame === 2) ? u * 0.3 : -(u * 0.3);
  const H = size * 1.5;
  const r = (x: number, y: number, w: number, h: number, c: string, ox = 0, oy = 0) =>
    <rect key={`${x}${y}${c}`} x={(x + ox) * u} y={(y + oy) * u} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(4, 0, 4, 1, "#e0e0e0", xo, yo)}{r(3, 1, 6, 1, "#e0e0e0", xo, yo)}
      {r(3, 2, 6, 4, "#f4b880", xo, yo)}{r(2, 3, 8, 2, "#f4b880", xo, yo)}
      {r(4, 3, 1, 1, "#0a0e1a", xo, yo)}{r(7, 3, 1, 1, "#0a0e1a", xo, yo)}
      {r(4, 5, 1, 1, "#c8704a", xo, yo)}{r(5, 6, 2, 1, "#c8704a", xo, yo)}{r(7, 5, 1, 1, "#c8704a", xo, yo)}
      <rect x={(3 + xo) * u} y={(3 + yo) * u} width={2 * u} height={2 * u} fill="none" stroke="#2a3a5c" strokeWidth={u * 0.4} key="gl1" />
      <rect x={(7 + xo) * u} y={(3 + yo) * u} width={2 * u} height={2 * u} fill="none" stroke="#2a3a5c" strokeWidth={u * 0.4} key="gl2" />
      {r(3, 7, 6, 1, "#c77dff", xo, yo)}
      {r(2, 8, 8, 5, "#9b4dca", xo, yo)}{r(3, 8, 6, 5, "#c77dff", xo, yo)}
      {r(1, 11, 10, 3, "#9b4dca", xo, yo)}{r(2, 11, 8, 3, "#c77dff", xo, yo)}
      {r(1, 8, 2, 3, "#f4b880", xo, yo)}{r(9, 8, 2, 3, "#f4b880", xo, yo)}
      {r(10, 9, 1, 8, "#8b5e3c")}{r(9, 16, 3, 1, "#8b5e3c")}
      {r(4, 14, 2, 3, "#7a3a9a", xo, yo)}{r(7, 14, 2, 3, "#7a3a9a", xo, yo)}
      {r(3, 16, 3, 1, "#5a2a7a", xo, yo)}{r(6, 16, 3, 1, "#5a2a7a", xo, yo)}
    </svg>
  );
}
