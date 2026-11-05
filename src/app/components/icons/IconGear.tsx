export function IconGear({ size = 16, color = "var(--muted-foreground)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={4} height={2} fill={color} />
      <rect x={2} y={2} width={8} height={2} fill={color} />
      <rect x={0} y={4} width={4} height={4} fill={color} />
      <rect x={8} y={4} width={4} height={4} fill={color} />
      <rect x={5} y={5} width={2} height={2} fill={color} />
      <rect x={2} y={8} width={8} height={2} fill={color} />
      <rect x={4} y={10} width={4} height={2} fill={color} />
    </svg>
  );
}
