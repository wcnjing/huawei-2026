/** Two grown-ups and a child: opens the house page. */
export function IconFamily({ size = 20, color = "#00d4ff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 12" style={{ imageRendering: "pixelated", display: "block" }}>
      {/* left adult */}
      <rect x={1} y={1} width={3} height={3} fill={color} />
      <rect x={0} y={5} width={5} height={4} fill={color} />
      <rect x={0} y={9} width={2} height={3} fill={color} />
      <rect x={3} y={9} width={2} height={3} fill={color} />
      {/* right adult */}
      <rect x={10} y={1} width={3} height={3} fill={color} />
      <rect x={9} y={5} width={5} height={4} fill={color} />
      <rect x={9} y={9} width={2} height={3} fill={color} />
      <rect x={12} y={9} width={2} height={3} fill={color} />
      {/* child */}
      <rect x={6} y={5} width={2} height={2} fill={color} />
      <rect x={5} y={8} width={4} height={2} fill={color} />
      <rect x={5} y={10} width={1} height={2} fill={color} />
      <rect x={8} y={10} width={1} height={2} fill={color} />
    </svg>
  );
}
