export function IconPhone({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={4} height={4} fill={color} />
      <rect x={1} y={1} width={2} height={2} fill="#0a0e1a" />
      <rect x={3} y={2} width={7} height={2} fill={color} />
      <rect x={7} y={2} width={3} height={8} fill={color} />
      <rect x={6} y={7} width={2} height={3} fill={color} />
      <rect x={4} y={8} width={4} height={2} fill={color} />
    </svg>
  );
}
