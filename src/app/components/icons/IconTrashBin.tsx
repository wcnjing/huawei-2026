export function IconTrashBin({ size = 16, color = "#ff2d55" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={2} fill={color} />
      <rect x={0} y={2} width={10} height={2} fill={color} />
      <rect x={1} y={4} width={8} height={8} fill={color} />
      <rect x={3} y={5} width={1} height={5} fill="#0a0e1a" />
      <rect x={5} y={5} width={1} height={5} fill="#0a0e1a" />
      <rect x={7} y={5} width={1} height={5} fill="#0a0e1a" />
    </svg>
  );
}