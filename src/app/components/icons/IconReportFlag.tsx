export function IconReportFlag({ size = 16, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={2} height={12} fill={color} opacity={0.6} />
      <rect x={2} y={0} width={6} height={5} fill={color} />
      <rect x={2} y={2} width={4} height={1} fill="#0a0e1a" opacity={0.4} />
    </svg>
  );
}
