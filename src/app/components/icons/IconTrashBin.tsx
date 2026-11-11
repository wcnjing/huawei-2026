export function IconTrashBin({ size = 16, color = "var(--red)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" data-inner="full" width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M3 5h1v5h-1zM5 5h1v5h-1zM7 5h1v5h-1z" />
      <path className="px-hole-line" fill="none" d="M3 5H4V10H3ZM5 5H6V10H5ZM7 5H8V10H7Z" />
      <rect x={3} y={0} width={4} height={2} fill={color} />
      <rect x={0} y={2} width={10} height={2} fill={color} />
      <rect x={1} y={4} width={8} height={1} fill={color} />
      <rect x={1} y={5} width={2} height={5} fill={color} />
      <rect x={4} y={5} width={1} height={5} fill={color} />
      <rect x={6} y={5} width={1} height={5} fill={color} />
      <rect x={8} y={5} width={1} height={5} fill={color} />
      <rect x={1} y={10} width={8} height={2} fill={color} />
    </svg>
  );
}
