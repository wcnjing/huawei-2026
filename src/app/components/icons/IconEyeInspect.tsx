export function IconEyeInspect({ size = 16, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={1} width={8} height={1} fill={color} />
      <rect x={1} y={2} width={3} height={4} fill={color} />
      <rect x={8} y={2} width={3} height={4} fill={color} />
      <rect x={5} y={3} width={2} height={2} fill={color} />
      <rect x={2} y={6} width={8} height={1} fill={color} />
    </svg>
  );
}
