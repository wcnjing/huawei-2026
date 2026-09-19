export function IconBrowserWindow({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={14} height={12} fill={color} />
      <rect x={1} y={3} width={12} height={8} fill="#111827" />
      <rect x={1} y={1} width={2} height={2} fill="#ff2d55" />
      <rect x={4} y={1} width={2} height={2} fill="#ffe66d" />
      <rect x={7} y={1} width={2} height={2} fill="#00ff88" />
      <rect x={10} y={1} width={3} height={2} fill="#0a0e1a" opacity={0.5} />
      <rect x={2} y={5} width={8} height={1} fill={color} opacity={0.3} />
      <rect x={2} y={7} width={10} height={1} fill={color} opacity={0.3} />
      <rect x={2} y={9} width={6} height={1} fill={color} opacity={0.3} />
    </svg>
  );
}