export function IconLock({ size = 16, color = "var(--muted-foreground)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" data-inner="full" width={size} height={size} viewBox="0 0 8 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M2 1h4v2h-4zM3 6h2v3h-2z" />
      <path className="px-hole-line" fill="none" d="M2 1H6V3H2ZM3 6H5V9H3Z" />
      <rect x={2} y={0} width={4} height={1} fill={color} />
      <rect x={1} y={1} width={1} height={2} fill={color} />
      <rect x={6} y={1} width={1} height={2} fill={color} />
      <rect x={1} y={3} width={6} height={1} fill={color} />
      <rect x={0} y={4} width={8} height={2} fill={color} />
      <rect x={0} y={6} width={3} height={3} fill={color} />
      <rect x={5} y={6} width={3} height={3} fill={color} />
      <rect x={0} y={9} width={8} height={1} fill={color} />
    </svg>
  );
}
