export function IconMoon({ size = 16, color = "var(--violet)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={1} fill={color} />
      <rect x={2} y={1} width={3} height={1} fill={color} />
      <rect x={1} y={2} width={3} height={2} fill={color} />
      <rect x={8} y={2} width={1} height={3} fill={color} />
      <rect x={7} y={3} width={1} height={1} fill={color} />
      <rect x={9} y={3} width={1} height={1} fill={color} />
      <rect x={0} y={4} width={4} height={1} fill={color} />
      <rect x={0} y={5} width={5} height={2} fill={color} />
      <rect x={11} y={6} width={1} height={1} fill={color} />
      <rect x={0} y={7} width={7} height={1} fill={color} />
      <rect x={10} y={7} width={2} height={1} fill={color} />
      <rect x={1} y={8} width={10} height={2} fill={color} />
      <rect x={2} y={10} width={8} height={1} fill={color} />
      <rect x={4} y={11} width={4} height={1} fill={color} />
    </svg>
  );
}
