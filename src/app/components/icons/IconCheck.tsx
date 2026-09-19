export function IconCheck({ size = 16, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={4} width={1} height={1} fill={color} />
      <rect x={2} y={5} width={1} height={1} fill={color} />
      <rect x={3} y={6} width={1} height={1} fill={color} />
      <rect x={4} y={5} width={1} height={1} fill={color} />
      <rect x={5} y={4} width={1} height={1} fill={color} />
      <rect x={6} y={3} width={1} height={1} fill={color} />
      <rect x={7} y={2} width={1} height={1} fill={color} />
    </svg>
  );
}