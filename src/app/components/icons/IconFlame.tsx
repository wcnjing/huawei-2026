export function IconFlame({ size = 24, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={9} width={4} height={3} fill={color} />
      <rect x={2} y={8} width={6} height={2} fill={color} />
      <rect x={1} y={6} width={8} height={3} fill={color} />
      <rect x={2} y={4} width={6} height={3} fill={color} />
      <rect x={4} y={2} width={2} height={3} fill={color} />
      <rect x={3} y={1} width={4} height={2} fill={color} />
      <rect x={4} y={0} width={2} height={2} fill={color} />
      <rect x={3} y={7} width={4} height={2} fill="#ffe66d" />
      <rect x={4} y={5} width={2} height={3} fill="#ffe66d" />
    </svg>
  );
}
