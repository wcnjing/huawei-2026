export function IconBulb({ size = 16, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={4} height={1} fill={color} />
      <rect x={1} y={1} width={6} height={4} fill={color} />
      <rect x={0} y={2} width={8} height={3} fill={color} />
      <rect x={1} y={5} width={6} height={2} fill={color} />
      <rect x={2} y={7} width={4} height={2} fill={color} />
      <rect x={3} y={9} width={2} height={1} fill={color} />
    </svg>
  );
}
