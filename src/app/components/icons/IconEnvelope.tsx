export function IconEnvelope({ size = 20, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" data-inner="full" width={size} height={size} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M2 1h8v1h-8zM1 2h1v1h-1zM3 2h6v1h-6zM10 2h1v1h-1zM1 3h2v1h-2zM4 3h4v1h-4zM9 3h2v1h-2zM1 4h3v1h-3zM5 4h2v1h-2zM8 4h3v1h-3zM1 5h4v1h-4zM7 5h4v1h-4zM1 6h10v2h-10z" />
      <path className="px-hole-line" fill="none" d="M2 1H10V2H9V3H8V4H7V5H5V4H4V3H3V2H2ZM1 2H2V3H3V4H4V5H5V6H7V5H8V4H9V3H10V2H11V8H1Z" />
      <rect x={0} y={0} width={12} height={1} fill={color} />
      <rect x={0} y={1} width={2} height={1} fill={color} />
      <rect x={10} y={1} width={2} height={1} fill={color} />
      <rect x={0} y={2} width={1} height={6} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={9} y={2} width={1} height={1} fill={color} />
      <rect x={11} y={2} width={1} height={6} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={8} y={3} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={7} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={2} height={1} fill={color} />
      <rect x={0} y={8} width={12} height={2} fill={color} />
    </svg>
  );
}
