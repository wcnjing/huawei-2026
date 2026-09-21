export function IconShield({ size = 24, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={8} height={2} fill={color} />
      <rect x={1} y={1} width={10} height={2} fill={color} />
      <rect x={0} y={2} width={12} height={6} fill={color} />
      <rect x={1} y={8} width={10} height={2} fill={color} />
      <rect x={2} y={9} width={8} height={2} fill={color} />
      <rect x={4} y={11} width={4} height={2} fill={color} />
      <rect x={5} y={12} width={2} height={2} fill={color} />
      <rect x={3} y={5} width={1} height={1} fill="#0a0e1a" />
      <rect x={4} y={6} width={1} height={1} fill="#0a0e1a" />
      <rect x={5} y={7} width={1} height={1} fill="#0a0e1a" />
      <rect x={6} y={6} width={1} height={1} fill="#0a0e1a" />
      <rect x={7} y={5} width={1} height={1} fill="#0a0e1a" />
      <rect x={8} y={4} width={1} height={1} fill="#0a0e1a" />
    </svg>
  );
}
