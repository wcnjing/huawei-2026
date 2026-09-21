export function LegacyWallpaperSwatch({ id }: { id: string }) {
  if (id === "wp1") return (
    <svg width="100%" height="100%" viewBox="0 0 14 14" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect width={14} height={14} fill="#0a0e1a"/>
      <rect x={0} y={4} width={14} height={1} fill="#2a3a5c" opacity={0.7}/>
      <rect x={0} y={8} width={14} height={1} fill="#2a3a5c" opacity={0.7}/>
      <rect x={0} y={12} width={14} height={1} fill="#2a3a5c" opacity={0.7}/>
      <rect x={4} y={0} width={1} height={14} fill="#2a3a5c" opacity={0.7}/>
      <rect x={8} y={0} width={1} height={14} fill="#2a3a5c" opacity={0.7}/>
      <rect x={12} y={0} width={1} height={14} fill="#2a3a5c" opacity={0.7}/>
      <rect x={4} y={4} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={8} y={4} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={12} y={4} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={4} y={8} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={8} y={8} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={12} y={8} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={4} y={12} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={8} y={12} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
    </svg>
  );
  if (id === "wp2") return (
    <svg width="100%" height="100%" viewBox="0 0 14 14" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect width={14} height={14} fill="#1a2340"/>
      <rect x={0} y={0} width={14} height={3} fill="#0a0e1a"/>
      <rect x={0} y={5} width={14} height={3} fill="#0a0e1a"/>
      <rect x={0} y={10} width={14} height={3} fill="#0a0e1a"/>
      <rect x={0} y={3} width={14} height={1} fill="#4ecdc4" opacity={0.22}/>
      <rect x={0} y={8} width={14} height={1} fill="#4ecdc4" opacity={0.22}/>
      <rect x={0} y={13} width={14} height={1} fill="#4ecdc4" opacity={0.22}/>
    </svg>
  );
  return (
    <svg width="100%" height="100%" viewBox="0 0 14 14" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect width={14} height={14} fill="#100c20"/>
      <rect x={2} y={1} width={1} height={3} fill="#ffffff" opacity={0.85}/>
      <rect x={1} y={2} width={3} height={1} fill="#ffffff" opacity={0.85}/>
      <rect x={7} y={4} width={1} height={1} fill="#ffffff" opacity={0.9}/>
      <rect x={11} y={1} width={1} height={3} fill="#c77dff" opacity={0.75}/>
      <rect x={10} y={2} width={3} height={1} fill="#c77dff" opacity={0.75}/>
      <rect x={4} y={7} width={1} height={1} fill="#ffffff" opacity={0.6}/>
      <rect x={9} y={6} width={1} height={1} fill="#ffe66d" opacity={0.75}/>
      <rect x={12} y={9} width={1} height={1} fill="#ffffff" opacity={0.5}/>
      <rect x={1} y={11} width={1} height={1} fill="#c77dff" opacity={0.65}/>
      <rect x={6} y={11} width={1} height={3} fill="#ffffff" opacity={0.5}/>
      <rect x={5} y={12} width={3} height={1} fill="#ffffff" opacity={0.5}/>
      <rect x={10} y={12} width={1} height={1} fill="#ffe66d" opacity={0.6}/>
    </svg>
  );
}
