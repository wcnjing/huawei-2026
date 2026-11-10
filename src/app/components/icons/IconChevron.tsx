export function IconChevron({ size = 16, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={2} width={2} height={2} fill={color} />
      <rect x={8} y={2} width={2} height={2} fill={color} />
      <rect x={2} y={4} width={2} height={2} fill={color} />
      <rect x={6} y={4} width={2} height={2} fill={color} />
      <rect x={4} y={6} width={2} height={2} fill={color} />
    </svg>
  );
}
