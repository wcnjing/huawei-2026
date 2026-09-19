export function IconEyeInspect({ size = 16, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={1} width={8} height={1} fill={color} />
      <rect x={1} y={2} width={10} height={4} fill={color} />
      <rect x={2} y={6} width={8} height={1} fill={color} />
      <rect x={4} y={2} width={4} height={4} fill="#111827" />
      <rect x={5} y={3} width={2} height={2} fill={color} />
    </svg>
  );
}