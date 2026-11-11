export function IconShield({ size = 24, color = "var(--green)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" data-inner="full" width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M8 4h1v1h-1zM3 5h1v1h-1zM7 5h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM5 7h1v1h-1z" />
      <path className="px-hole-line" fill="none" d="M8 4H9V5H8ZM3 5H4V6H3ZM7 5H8V6H7ZM4 6H5V7H4ZM6 6H7V7H6ZM5 7H6V8H5Z" />
      <rect x={2} y={0} width={8} height={1} fill={color} />
      <rect x={1} y={1} width={10} height={1} fill={color} />
      <rect x={0} y={2} width={12} height={2} fill={color} />
      <rect x={0} y={4} width={8} height={1} fill={color} />
      <rect x={9} y={4} width={3} height={1} fill={color} />
      <rect x={0} y={5} width={3} height={1} fill={color} />
      <rect x={4} y={5} width={3} height={1} fill={color} />
      <rect x={8} y={5} width={4} height={1} fill={color} />
      <rect x={0} y={6} width={4} height={1} fill={color} />
      <rect x={5} y={6} width={1} height={1} fill={color} />
      <rect x={7} y={6} width={5} height={1} fill={color} />
      <rect x={0} y={7} width={5} height={1} fill={color} />
      <rect x={6} y={7} width={6} height={1} fill={color} />
      <rect x={1} y={8} width={10} height={2} fill={color} />
      <rect x={2} y={10} width={8} height={1} fill={color} />
      <rect x={4} y={11} width={4} height={2} fill={color} />
      <rect x={5} y={13} width={2} height={1} fill={color} />
    </svg>
  );
}
