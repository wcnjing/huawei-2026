export function IconFlame({ size = 24, color = "var(--orange)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={9} width={4} height={3} fill={color} />
      <rect x={2} y={8} width={6} height={2} fill={color} />
      <rect x={1} y={6} width={8} height={3} fill={color} />
      <rect x={2} y={4} width={6} height={3} fill={color} />
      <rect x={4} y={2} width={2} height={3} fill={color} />
      <rect x={3} y={1} width={4} height={2} fill={color} />
      <rect x={4} y={0} width={2} height={2} fill={color} />
      <rect x={3} y={7} width={4} height={2} fill="var(--yellow-fill)" />
      <rect x={4} y={5} width={2} height={3} fill="var(--yellow-fill)" />
    </svg>
  );
}
