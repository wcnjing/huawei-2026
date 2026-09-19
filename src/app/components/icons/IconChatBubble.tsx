export function IconChatBubble({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={0} width={10} height={8} fill={color} />
      <rect x={0} y={1} width={12} height={6} fill={color} />
      <rect x={2} y={1} width={8} height={6} fill="#111827" />
      <rect x={2} y={8} width={2} height={1} fill={color} />
      <rect x={2} y={9} width={1} height={1} fill={color} />
      <rect x={2} y={10} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={2} height={2} fill={color} />
      <rect x={6} y={3} width={2} height={2} fill={color} />
      <rect x={9} y={3} width={1} height={2} fill={color} />
    </svg>
  );
}