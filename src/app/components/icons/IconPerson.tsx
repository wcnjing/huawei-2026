export function IconPerson({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={4} fill={color} />
      <rect x={2} y={1} width={6} height={3} fill={color} />
      <rect x={2} y={4} width={6} height={4} fill={color} />
      <rect x={1} y={5} width={8} height={2} fill={color} />
      <rect x={2} y={8} width={2} height={2} fill={color} />
      <rect x={6} y={8} width={2} height={2} fill={color} />
    </svg>
  );
}