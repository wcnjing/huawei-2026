export function IconLock({ size = 16, color = "#6b8ba4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={4} height={1} fill={color} />
      <rect x={1} y={1} width={6} height={3} fill={color} />
      <rect x={0} y={4} width={8} height={6} fill={color} />
      <rect x={2} y={1} width={4} height={2} fill="#0a0e1a" />
      <rect x={3} y={6} width={2} height={2} fill="#0a0e1a" />
      <rect x={3} y={8} width={2} height={1} fill="#0a0e1a" />
    </svg>
  );
}