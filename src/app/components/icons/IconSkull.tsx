export function IconSkull({ size = 24, color = "var(--red)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M2 3h3v1h-3zM7 3h3v1h-3zM2 4h1v1h-1zM4 4h1v1h-1zM7 4h1v1h-1zM9 4h1v1h-1zM2 5h3v1h-3zM7 5h3v1h-3z" />
      <path className="px-ink" fill="none" d="M2 3h3v1h-3zM7 3h3v1h-3zM2 4h1v1h-1zM4 4h1v1h-1zM7 4h1v1h-1zM9 4h1v1h-1zM2 5h3v1h-3zM7 5h3v1h-3z" />
      <rect x={3} y={0} width={6} height={1} fill={color} />
      <rect x={1} y={1} width={10} height={1} fill={color} />
      <rect x={0} y={2} width={12} height={1} fill={color} />
      <rect x={0} y={3} width={2} height={3} fill={color} />
      <rect x={5} y={3} width={2} height={3} fill={color} />
      <rect x={10} y={3} width={2} height={3} fill={color} />
      <rect x={3} y={4} width={1} height={1} fill={color} />
      <rect x={8} y={4} width={1} height={1} fill={color} />
      <rect x={0} y={6} width={12} height={1} fill={color} />
      <rect x={1} y={7} width={10} height={2} fill={color} />
      <rect x={2} y={9} width={2} height={3} fill={color} />
      <rect x={5} y={9} width={2} height={3} fill={color} />
      <rect x={8} y={9} width={2} height={3} fill={color} />
    </svg>
  );
}
