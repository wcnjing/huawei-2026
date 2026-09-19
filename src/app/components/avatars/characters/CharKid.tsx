export function CharKid({ size = 40, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 10;
  const yo = (frame === 0 || frame === 2) ? -u * 1.2 : u * 0.4;
  const H = size * 1.6;
  const r = (x: number, y: number, w: number, h: number, c: string) =>
    <rect key={`${x}${y}${c}`} x={x * u} y={(y * u) + yo} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(2, 0, 1, 3, "#b8900a")}{r(4, 0, 1, 2, "#b8900a")}{r(6, 0, 1, 3, "#b8900a")}{r(8, 0, 1, 2, "#b8900a")}
      {r(1, 1, 8, 2, "#ffe66d")}
      {r(2, 2, 6, 5, "#f4c060")}{r(1, 3, 8, 3, "#f4c060")}
      {r(3, 4, 1, 2, "#0a0e1a")}{r(6, 4, 1, 2, "#0a0e1a")}
      {r(3, 4, 1, 1, "#ffffff")}{r(6, 4, 1, 1, "#ffffff")}
      {r(3, 6, 4, 1, "#c8704a")}{r(3, 7, 1, 1, "#c8704a")}{r(6, 7, 1, 1, "#c8704a")}
      {r(2, 7, 6, 4, "#aa9900")}{r(1, 8, 8, 3, "#ffe66d")}
      {r(4, 9, 2, 1, "#aa9900")}{r(3, 10, 4, 1, "#aa9900")}
      {r(0, 8, 2, 3, "#f4c060")}{r(8, 8, 2, 3, "#f4c060")}
      {r(2, 11, 6, 2, "#2a4aa4")}
      {r(2, 13, 2, 3, "#f4c060")}{r(6, 13, 2, 3, "#f4c060")}
      {r(1, 15, 3, 1, "#ffffff")}{r(5, 15, 3, 1, "#ffffff")}
      {r(1, 16, 4, 1, "#ff2d55")}{r(5, 16, 4, 1, "#ff2d55")}
    </svg>
  );
}