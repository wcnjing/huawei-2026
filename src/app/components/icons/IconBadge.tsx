export function IconBadge({ size = 24, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M5 3h2v1h-2zM4 4h4v1h-4zM3 5h6v1h-6zM4 6h4v1h-4zM5 7h2v1h-2z" />
      <rect x={3} y={0} width={6} height={1} fill={color} />
      <rect x={1} y={1} width={10} height={1} fill={color} />
      <rect x={0} y={2} width={12} height={1} fill={color} />
      <rect x={0} y={3} width={5} height={1} fill={color} />
      <rect x={7} y={3} width={5} height={1} fill={color} />
      <rect x={0} y={4} width={4} height={1} fill={color} />
      <rect x={8} y={4} width={4} height={1} fill={color} />
      <rect x={0} y={5} width={3} height={1} fill={color} />
      <rect x={9} y={5} width={3} height={1} fill={color} />
      <rect x={0} y={6} width={4} height={1} fill={color} />
      <rect x={8} y={6} width={4} height={1} fill={color} />
      <rect x={0} y={7} width={5} height={1} fill={color} />
      <rect x={7} y={7} width={5} height={1} fill={color} />
      <rect x={1} y={8} width={10} height={2} fill={color} />
      <rect x={3} y={10} width={6} height={1} fill={color} />
    </svg>
  );
}
