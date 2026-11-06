export function IconGear({ size = 16, color = "var(--muted-foreground)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M4 4h4v1h-4zM4 5h1v2h-1zM7 5h1v2h-1zM4 7h4v1h-4z" />
      <rect x={4} y={0} width={4} height={2} fill={color} />
      <rect x={2} y={2} width={8} height={2} fill={color} />
      <rect x={0} y={4} width={4} height={4} fill={color} />
      <rect x={8} y={4} width={4} height={4} fill={color} />
      <rect x={5} y={5} width={2} height={2} fill={color} />
      <rect x={2} y={8} width={8} height={2} fill={color} />
      <rect x={4} y={10} width={4} height={2} fill={color} />
    </svg>
  );
}
