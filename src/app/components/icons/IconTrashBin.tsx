export function IconTrashBin({ size = 16, color = "var(--red)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={2} fill={color} />
      <rect x={0} y={2} width={10} height={2} fill={color} />
      <rect x={1} y={4} width={8} height={1} fill={color} />
      <rect x={1} y={5} width={2} height={5} fill={color} />
      <rect x={4} y={5} width={1} height={5} fill={color} />
      <rect x={6} y={5} width={1} height={5} fill={color} />
      <rect x={8} y={5} width={1} height={5} fill={color} />
      <rect x={1} y={10} width={8} height={2} fill={color} />
    </svg>
  );
}
