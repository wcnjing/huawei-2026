export function IconRealEmail({ size = 20, color = "var(--orange)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M2 1h7v1h-7zM1 2h1v1h-1zM3 2h6v1h-6zM1 3h2v1h-2zM4 3h4v1h-4zM9 3h2v1h-2zM1 4h3v1h-3zM5 4h2v1h-2zM8 4h3v1h-3zM1 5h4v1h-4zM7 5h4v1h-4zM1 6h10v2h-10z" />
      <rect x={0} y={0} width={9} height={1} fill={color} />
      <rect x={0} y={1} width={2} height={1} fill={color} />
      <rect x={0} y={2} width={1} height={6} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={8} y={3} width={1} height={1} fill={color} />
      <rect x={11} y={3} width={1} height={5} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={7} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={2} height={1} fill={color} />
      <rect x={0} y={8} width={12} height={2} fill={color} />
      <rect x={9} y={0} width={3} height={3} fill="var(--red-fill)" />
      <rect x={10} y={1} width={1} height={1} fill="#ffffff" opacity={0.7} />
    </svg>
  );
}
