export function IconSpeaker({ size = 16, muted = false, color = "#6b8ba4" }: { size?: number; muted?: boolean; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      {/* speaker cone */}
      <rect x={1} y={4} width={2} height={4} fill={color} />
      <rect x={3} y={3} width={1} height={6} fill={color} />
      <rect x={4} y={2} width={1} height={8} fill={color} />
      <rect x={2} y={4} width={3} height={4} fill={color} />
      {muted ? (
        // red X to the right of the cone
        <>
          <rect x={7} y={3} width={1} height={1} fill="#ff2d55" />
          <rect x={8} y={4} width={1} height={1} fill="#ff2d55" />
          <rect x={9} y={5} width={1} height={1} fill="#ff2d55" />
          <rect x={10} y={6} width={1} height={1} fill="#ff2d55" />
          <rect x={10} y={3} width={1} height={1} fill="#ff2d55" />
          <rect x={9} y={4} width={1} height={1} fill="#ff2d55" />
          <rect x={8} y={6} width={1} height={1} fill="#ff2d55" />
          <rect x={7} y={7} width={1} height={1} fill="#ff2d55" />
        </>
      ) : (
        // two sound waves
        <>
          <rect x={7} y={4} width={1} height={4} fill={color} />
          <rect x={9} y={2} width={1} height={8} fill={color} />
        </>
      )}
    </svg>
  );
}
