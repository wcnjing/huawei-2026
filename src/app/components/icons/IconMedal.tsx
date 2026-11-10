export function IconMedal({ rank = 1, size = 20 }: { rank: number; size?: number }) {
  const colors = ["#ffe66d", "#c0c0c0", "#cd7f32"];
  const c = colors[rank - 1] ?? "#6b8ba4";
  return (
    <svg className="px-icon px-edge" data-inner="full" width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <path className="px-hole" fill="none" d="M4 6h2v1h-2zM3 7h4v2h-4zM4 9h2v1h-2z" />
      <path className="px-hole-line" fill="none" d="M4 6H6V7H7V9H6V10H4V9H3V7H4Z" />
      <rect x={1} y={4} width={8} height={1} fill={c} />
      <rect x={0} y={5} width={10} height={1} fill={c} />
      <rect x={0} y={6} width={4} height={1} fill={c} />
      <rect x={6} y={6} width={4} height={1} fill={c} />
      <rect x={0} y={7} width={3} height={2} fill={c} />
      <rect x={7} y={7} width={3} height={2} fill={c} />
      <rect x={0} y={9} width={4} height={1} fill={c} />
      <rect x={6} y={9} width={4} height={1} fill={c} />
      <rect x={0} y={10} width={10} height={1} fill={c} />
      <rect x={1} y={11} width={8} height={1} fill={c} />
      <rect x={3} y={0} width={4} height={4} fill={c} opacity="0.6" />
      <rect x={4} y={0} width={2} height={5} fill={c} opacity="0.8" />
    </svg>
  );
}
