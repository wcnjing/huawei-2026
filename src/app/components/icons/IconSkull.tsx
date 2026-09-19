export function IconSkull({ size = 24, color = "#ff2d55" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={6} height={2} fill={color} />
      <rect x={1} y={1} width={10} height={2} fill={color} />
      <rect x={0} y={2} width={12} height={5} fill={color} />
      <rect x={1} y={7} width={10} height={2} fill={color} />
      <rect x={2} y={9} width={2} height={3} fill={color} />
      <rect x={5} y={9} width={2} height={3} fill={color} />
      <rect x={8} y={9} width={2} height={3} fill={color} />
      <rect x={2} y={3} width={3} height={3} fill="#0a0e1a" />
      <rect x={7} y={3} width={3} height={3} fill="#0a0e1a" />
      <rect x={3} y={4} width={1} height={1} fill={color} />
      <rect x={8} y={4} width={1} height={1} fill={color} />
    </svg>
  );
}
