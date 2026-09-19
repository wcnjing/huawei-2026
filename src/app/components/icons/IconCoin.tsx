export function IconCoin({ size = 16, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={1} fill={color} /><rect x={1} y={1} width={8} height={2} fill={color} />
      <rect x={0} y={3} width={10} height={4} fill={color} /><rect x={1} y={7} width={8} height={2} fill={color} />
      <rect x={3} y={9} width={4} height={1} fill={color} />
      <rect x={4} y={2} width={2} height={1} fill="#aa8800" /><rect x={3} y={3} width={4} height={1} fill="#aa8800" />
      <rect x={3} y={5} width={4} height={1} fill="#aa8800" /><rect x={4} y={6} width={2} height={1} fill="#aa8800" />
    </svg>
  );
}