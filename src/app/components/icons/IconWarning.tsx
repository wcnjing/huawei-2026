export function IconWarning({ size = 16, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={1} fill={color} />
      <rect x={3} y={1} width={4} height={1} fill={color} />
      <rect x={2} y={2} width={6} height={1} fill={color} />
      <rect x={1} y={3} width={8} height={1} fill={color} />
      <rect x={0} y={4} width={10} height={5} fill={color} />
      <rect x={4} y={5} width={2} height={2} fill="#0a0e1a" />
      <rect x={4} y={8} width={2} height={1} fill="#0a0e1a" />
    </svg>
  );
}
