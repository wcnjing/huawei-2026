export function IconTelegram({ size = 20, color = "#00d4ff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={4} width={2} height={2} fill={color} />
      <rect x={2} y={3} width={2} height={4} fill={color} />
      <rect x={4} y={2} width={2} height={6} fill={color} />
      <rect x={6} y={1} width={2} height={8} fill={color} />
      <rect x={8} y={0} width={2} height={10} fill={color} />
      <rect x={10} y={2} width={2} height={6} fill={color} />
      <rect x={4} y={5} width={2} height={3} fill="#0a0e1a" opacity={0.4} />
      <rect x={6} y={6} width={2} height={3} fill="#0a0e1a" opacity={0.3} />
      <rect x={2} y={9} width={4} height={1} fill={color} opacity={0.6} />
      <rect x={3} y={10} width={2} height={1} fill={color} opacity={0.4} />
    </svg>
  );
}
