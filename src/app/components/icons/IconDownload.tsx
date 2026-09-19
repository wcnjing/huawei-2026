export function IconDownload({ size = 16, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={6} fill={color} />
      <rect x={2} y={5} width={6} height={2} fill={color} />
      <rect x={3} y={6} width={4} height={2} fill={color} />
      <rect x={4} y={7} width={2} height={2} fill={color} />
      <rect x={0} y={10} width={10} height={2} fill={color} />
    </svg>
  );
}
