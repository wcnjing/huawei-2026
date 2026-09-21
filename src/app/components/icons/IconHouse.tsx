export function IconHouse({ size = 20, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={5} y={0} width={2} height={1} fill={color} />
      <rect x={4} y={1} width={4} height={1} fill={color} />
      <rect x={3} y={2} width={6} height={1} fill={color} />
      <rect x={2} y={3} width={8} height={1} fill={color} />
      <rect x={1} y={4} width={10} height={1} fill={color} />
      <rect x={1} y={5} width={10} height={7} fill={color} />
      <rect x={4} y={8} width={4} height={4} fill="#0a0e1a" />
      <rect x={2} y={6} width={2} height={2} fill="#0a0e1a" />
      <rect x={8} y={6} width={2} height={2} fill="#0a0e1a" />
    </svg>
  );
}
