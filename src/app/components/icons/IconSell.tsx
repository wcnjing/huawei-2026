export function IconSell({ size = 14, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={6} height={6} fill={color} />
      <rect x={1} y={0} width={1} height={1} fill="#0a0e1a" />
      <rect x={7} y={2} width={3} height={6} fill={color} /><rect x={6} y={3} width={4} height={4} fill={color} />
      <rect x={5} y={4} width={5} height={2} fill={color} />
      <rect x={2} y={2} width={2} height={2} fill="#0a0e1a" />
    </svg>
  );
}