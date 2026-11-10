export function IconHouse({ size = 20, color = "var(--green)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" data-inner="thin" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M2 6h2v2h-2zM8 6h2v2h-2z" />
      <path className="px-hole-line" fill="none" d="M2 6H4V8H2ZM8 6H10V8H8Z" />
      <rect x={5} y={0} width={2} height={1} fill={color} />
      <rect x={4} y={1} width={4} height={1} fill={color} />
      <rect x={3} y={2} width={6} height={1} fill={color} />
      <rect x={2} y={3} width={8} height={1} fill={color} />
      <rect x={1} y={4} width={10} height={2} fill={color} />
      <rect x={1} y={6} width={1} height={2} fill={color} />
      <rect x={4} y={6} width={4} height={2} fill={color} />
      <rect x={10} y={6} width={1} height={2} fill={color} />
      <rect x={1} y={8} width={3} height={4} fill={color} />
      <rect x={8} y={8} width={3} height={4} fill={color} />
    </svg>
  );
}
