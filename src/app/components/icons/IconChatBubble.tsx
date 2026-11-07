export function IconChatBubble({ size = 20, color = "var(--teal)" }: { size?: number; color?: string }) {
  return (
    <svg className="px-icon" width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M2 1h8v2h-8zM2 3h1v2h-1zM5 3h1v2h-1zM8 3h1v2h-1zM2 5h8v2h-8z" />
      <rect x={1} y={0} width={10} height={1} fill={color} />
      <rect x={0} y={1} width={2} height={6} fill={color} />
      <rect x={10} y={1} width={2} height={2} fill={color} />
      <rect x={3} y={3} width={2} height={2} fill={color} />
      <rect x={6} y={3} width={2} height={2} fill={color} />
      <rect x={9} y={3} width={3} height={2} fill={color} />
      <rect x={10} y={5} width={2} height={2} fill={color} />
      <rect x={1} y={7} width={10} height={1} fill={color} />
      <rect x={2} y={8} width={2} height={1} fill={color} />
      <rect x={2} y={9} width={1} height={2} fill={color} />
    </svg>
  );
}
