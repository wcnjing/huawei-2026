export function IconLink({ size = 16, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={2} width={2} height={1} fill={color} />
      <rect x={7} y={2} width={2} height={1} fill={color} />
      <rect x={0} y={3} width={2} height={4} fill={color} />
      <rect x={8} y={3} width={2} height={4} fill={color} />
      <rect x={3} y={4} width={4} height={2} fill={color} />
      <rect x={1} y={7} width={2} height={1} fill={color} />
      <rect x={7} y={7} width={2} height={1} fill={color} />
    </svg>
  );
}
