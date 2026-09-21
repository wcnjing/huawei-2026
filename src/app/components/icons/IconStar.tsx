export function IconStar({ size = 16, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={2} fill={color} />
      <rect x={3} y={2} width={4} height={2} fill={color} />
      <rect x={0} y={3} width={10} height={2} fill={color} />
      <rect x={1} y={5} width={8} height={1} fill={color} />
      <rect x={0} y={6} width={4} height={1} fill={color} />
      <rect x={6} y={6} width={4} height={1} fill={color} />
      <rect x={0} y={7} width={3} height={1} fill={color} />
      <rect x={7} y={7} width={3} height={1} fill={color} />
      <rect x={2} y={8} width={2} height={2} fill={color} />
      <rect x={6} y={8} width={2} height={2} fill={color} />
    </svg>
  );
}
