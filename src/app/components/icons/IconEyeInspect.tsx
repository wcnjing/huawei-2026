export function IconEyeInspect({ size = 16, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" data-inner="full" width={size} height={size} viewBox="0 0 12 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M4 2h4v1h-4zM4 3h1v2h-1zM7 3h1v2h-1zM4 5h4v1h-4z" />
      <path className="px-hole-line" fill="none" d="M4 2H8V6H4ZM6 3H5V5H7V3Z" />
      <rect x={2} y={1} width={8} height={1} fill={color} />
      <rect x={1} y={2} width={3} height={4} fill={color} />
      <rect x={8} y={2} width={3} height={4} fill={color} />
      <rect x={5} y={3} width={2} height={2} fill={color} />
      <rect x={2} y={6} width={8} height={1} fill={color} />
    </svg>
  );
}
