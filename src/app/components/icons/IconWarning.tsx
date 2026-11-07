export function IconWarning({ size = 16, color = "var(--orange)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M4 5h2v2h-2z" />
      <path className="px-ink" fill="none" d="M4 5h2v2h-2zM4 8h2v1h-2z" />
      <rect x={4} y={0} width={2} height={1} fill={color} />
      <rect x={3} y={1} width={4} height={1} fill={color} />
      <rect x={2} y={2} width={6} height={1} fill={color} />
      <rect x={1} y={3} width={8} height={1} fill={color} />
      <rect x={0} y={4} width={10} height={1} fill={color} />
      <rect x={0} y={5} width={4} height={2} fill={color} />
      <rect x={6} y={5} width={4} height={2} fill={color} />
      <rect x={0} y={7} width={10} height={1} fill={color} />
      <rect x={0} y={8} width={4} height={1} fill={color} />
      <rect x={6} y={8} width={4} height={1} fill={color} />
    </svg>
  );
}
