export function IconSun({ size = 16, color = "var(--sun)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={5} y={0} width={2} height={2} fill={color} />
      <rect x={1} y={1} width={1} height={1} fill={color} />
      <rect x={10} y={1} width={1} height={1} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={9} y={2} width={1} height={1} fill={color} />
      <rect x={4} y={3} width={4} height={1} fill={color} />
      <rect x={3} y={4} width={6} height={4} fill={color} />
      <rect x={0} y={5} width={2} height={2} fill={color} />
      <rect x={10} y={5} width={2} height={2} fill={color} />
      <rect x={4} y={8} width={4} height={1} fill={color} />
      <rect x={2} y={9} width={1} height={1} fill={color} />
      <rect x={9} y={9} width={1} height={1} fill={color} />
      <rect x={1} y={10} width={1} height={1} fill={color} />
      <rect x={10} y={10} width={1} height={1} fill={color} />
      <rect x={5} y={10} width={2} height={2} fill={color} />
    </svg>
  );
}
