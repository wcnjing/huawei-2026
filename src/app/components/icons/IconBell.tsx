export function IconBell({ size = 20, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={1} fill={color} />
      <rect x={3} y={1} width={4} height={2} fill={color} />
      <rect x={1} y={3} width={8} height={5} fill={color} />
      <rect x={0} y={5} width={10} height={3} fill={color} />
      <rect x={0} y={8} width={10} height={1} fill={color} />
      <rect x={3} y={9} width={4} height={2} fill={color} />
      <rect x={4} y={11} width={2} height={1} fill={color} />
    </svg>
  );
}