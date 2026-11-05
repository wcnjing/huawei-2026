export function IconChat({ size = 20, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={0} width={10} height={1} fill={color} />
      <rect x={0} y={1} width={12} height={1} fill={color} />
      <rect x={0} y={2} width={2} height={2} fill={color} />
      <rect x={4} y={2} width={1} height={2} fill={color} />
      <rect x={7} y={2} width={1} height={2} fill={color} />
      <rect x={10} y={2} width={2} height={2} fill={color} />
      <rect x={0} y={4} width={12} height={4} fill={color} />
      <rect x={1} y={8} width={10} height={1} fill={color} />
      <rect x={2} y={9} width={2} height={3} fill={color} />
      <rect x={2} y={5} width={8} height={1} fill="#0a0e1a" opacity="0.4" />
    </svg>
  );
}
