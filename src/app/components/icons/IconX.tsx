export function IconX({ size = 16, color = "#ff2d55" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={1} width={1} height={1} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={1} height={1} fill={color} />
      <rect x={6} y={6} width={1} height={1} fill={color} />
      <rect x={6} y={1} width={1} height={1} fill={color} />
      <rect x={5} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={4} width={1} height={1} fill={color} />
      <rect x={2} y={5} width={1} height={1} fill={color} />
      <rect x={1} y={6} width={1} height={1} fill={color} />
    </svg>
  );
}
