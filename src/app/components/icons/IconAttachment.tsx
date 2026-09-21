export function IconAttachment({ size = 16, color = "#c77dff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={2} width={6} height={10} fill={color} />
      <rect x={2} y={0} width={6} height={10} fill={color} />
      <rect x={0} y={2} width={2} height={2} fill="#0a0e1a" opacity={0.5} />
      <rect x={3} y={4} width={4} height={1} fill="#0a0e1a" opacity={0.4} />
      <rect x={3} y={6} width={4} height={1} fill="#0a0e1a" opacity={0.4} />
      <rect x={3} y={8} width={3} height={1} fill="#0a0e1a" opacity={0.4} />
    </svg>
  );
}
