export function IconRealEmail({ size = 20, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={12} height={10} fill={color} />
      <rect x={1} y={1} width={10} height={8} fill="#111827" />
      <rect x={0} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={1} width={1} height={1} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={2} height={1} fill={color} />
      <rect x={7} y={4} width={1} height={1} fill={color} />
      <rect x={8} y={3} width={1} height={1} fill={color} />
      <rect x={9} y={2} width={1} height={1} fill={color} />
      <rect x={10} y={1} width={1} height={1} fill={color} />
      <rect x={11} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={8} width={10} height={1} fill={color} />
      <rect x={9} y={0} width={3} height={3} fill="#ff2d55" />
      <rect x={10} y={1} width={1} height={1} fill="#ffffff" opacity={0.7} />
    </svg>
  );
}