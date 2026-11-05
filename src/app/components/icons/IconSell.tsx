export function IconSell({ size = 14, color = "var(--orange)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={1} height={1} fill={color} />
      <rect x={2} y={0} width={4} height={1} fill={color} />
      <rect x={0} y={1} width={6} height={1} fill={color} />
      <rect x={0} y={2} width={2} height={2} fill={color} />
      <rect x={4} y={2} width={2} height={1} fill={color} />
      <rect x={7} y={2} width={3} height={1} fill={color} />
      <rect x={4} y={3} width={6} height={1} fill={color} />
      <rect x={0} y={4} width={10} height={2} fill={color} />
      <rect x={6} y={6} width={4} height={1} fill={color} />
      <rect x={7} y={7} width={3} height={1} fill={color} />
    </svg>
  );
}
