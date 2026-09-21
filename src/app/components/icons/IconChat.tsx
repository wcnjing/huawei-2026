export function IconChat({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={0} width={10} height={1} fill={color} /><rect x={0} y={1} width={12} height={7} fill={color} />
      <rect x={1} y={8} width={10} height={1} fill={color} />
      <rect x={2} y={8} width={2} height={2} fill={color} /><rect x={2} y={10} width={2} height={2} fill={color} />
      <rect x={2} y={2} width={2} height={2} fill="#0a0e1a" /><rect x={5} y={2} width={2} height={2} fill="#0a0e1a" />
      <rect x={8} y={2} width={2} height={2} fill="#0a0e1a" />
      <rect x={2} y={5} width={8} height={1} fill="#0a0e1a" opacity="0.4" />
    </svg>
  );
}
