export function IconTrophy({ size = 24, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={8} height={6} fill={color} />
      <rect x={1} y={1} width={10} height={4} fill={color} />
      <rect x={0} y={1} width={2} height={3} fill={color} />
      <rect x={10} y={1} width={2} height={3} fill={color} />
      <rect x={4} y={6} width={4} height={3} fill={color} />
      <rect x={2} y={9} width={8} height={2} fill={color} />
      <rect x={1} y={11} width={10} height={2} fill={color} />
      <rect x={3} y={1} width={1} height={3} fill="#ffffff" opacity="0.4" />
    </svg>
  );
}
