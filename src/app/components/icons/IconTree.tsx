export function IconTree({ size = 20, color = "#00ff88", trunk = "#c77d4a" }: { size?: number; color?: string; trunk?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={4} height={1} fill={color} />
      <rect x={2} y={1} width={8} height={1} fill={color} />
      <rect x={1} y={2} width={10} height={3} fill={color} />
      <rect x={0} y={3} width={12} height={2} fill={color} />
      <rect x={1} y={5} width={10} height={2} fill={color} />
      <rect x={3} y={7} width={6} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill="#0a0e1a" opacity={0.35} />
      <rect x={8} y={2} width={1} height={1} fill="#0a0e1a" opacity={0.35} />
      <rect x={6} y={5} width={1} height={1} fill="#0a0e1a" opacity={0.35} />
      <rect x={5} y={7} width={2} height={4} fill={trunk} />
      <rect x={3} y={11} width={6} height={1} fill={trunk} />
    </svg>
  );
}
