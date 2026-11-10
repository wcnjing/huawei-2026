// A round smiley face: the house chat's emoji button. The eyes and smile are cut-outs, dark in
// both themes (see the px-hole / px-ink notes in styles/tokens.css, like the skull's eyes).
export function IconSmiley({ size = 20, color = "var(--yellow)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M4 3h1v2h-1zM7 3h1v2h-1zM2 7h1v1h-1zM9 7h1v1h-1zM3 8h6v1h-6z" />
      <path className="px-hole-line" fill="none" d="M4 3H5V5H4ZM7 3H8V5H7ZM2 7H3V8H9V7H10V8H9V9H3V8H2Z" />
      <path className="px-ink" fill="none" d="M4 3h1v2h-1zM7 3h1v2h-1zM2 7h1v1h-1zM9 7h1v1h-1zM3 8h6v1h-6z" />
      <rect x={4} y={0} width={4} height={1} fill={color} />
      <rect x={2} y={1} width={8} height={1} fill={color} />
      <rect x={1} y={2} width={10} height={1} fill={color} />
      <rect x={1} y={3} width={3} height={1} fill={color} />
      <rect x={5} y={3} width={2} height={1} fill={color} />
      <rect x={8} y={3} width={3} height={1} fill={color} />
      <rect x={0} y={4} width={4} height={1} fill={color} />
      <rect x={5} y={4} width={2} height={1} fill={color} />
      <rect x={8} y={4} width={4} height={1} fill={color} />
      <rect x={0} y={5} width={12} height={2} fill={color} />
      <rect x={0} y={7} width={2} height={1} fill={color} />
      <rect x={3} y={7} width={6} height={1} fill={color} />
      <rect x={10} y={7} width={2} height={1} fill={color} />
      <rect x={1} y={8} width={2} height={1} fill={color} />
      <rect x={9} y={8} width={2} height={1} fill={color} />
      <rect x={1} y={9} width={10} height={1} fill={color} />
      <rect x={2} y={10} width={8} height={1} fill={color} />
      <rect x={4} y={11} width={4} height={1} fill={color} />
    </svg>
  );
}
