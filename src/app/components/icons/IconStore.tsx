export function IconStore({ size = 20, color = "#c77dff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={12} height={3} fill={color} />
      <rect x={1} y={1} width={2} height={1} fill="#ffffff" opacity={0.3} />
      <rect x={5} y={1} width={2} height={1} fill="#ffffff" opacity={0.3} />
      <rect x={9} y={1} width={2} height={1} fill="#ffffff" opacity={0.3} />
      <rect x={0} y={3} width={12} height={1} fill="#0a0e1a" opacity={0.4} />
      <rect x={0} y={4} width={12} height={8} fill={color} opacity={0.7} />
      <rect x={1} y={4} width={10} height={8} fill={color} />
      <rect x={4} y={6} width={4} height={6} fill="#0a0e1a" />
      <rect x={5} y={8} width={1} height={1} fill={color} />
      <rect x={1} y={5} width={2} height={2} fill="#0a0e1a" opacity={0.4} />
      <rect x={9} y={5} width={2} height={2} fill="#0a0e1a" opacity={0.4} />
    </svg>
  );
}
