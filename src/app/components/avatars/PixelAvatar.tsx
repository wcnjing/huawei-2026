export function PixelAvatar({ rank = 1, size = 40 }: { rank?: number; size?: number }) {
  const colors = ["#00ff88", "#ff6b35", "#4ecdc4", "#ffe66d", "#ff2d55", "#c77dff", "#4ecdc4", "#ff6b35", "#6b8ba4"];
  const c = colors[(rank - 1) % colors.length];
  const s = size / 16;
  const px = (n: number) => n * s;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      <rect x={px(4)} y={px(1)} width={px(8)} height={px(7)} fill={c} />
      <rect x={px(5)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(6)} width={px(4)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(4)} y={px(8)} width={px(8)} height={px(5)} fill={c} />
      <rect x={px(2)} y={px(9)} width={px(2)} height={px(2)} fill={c} />
      <rect x={px(12)} y={px(9)} width={px(2)} height={px(2)} fill={c} />
      <rect x={px(5)} y={px(13)} width={px(2)} height={px(3)} fill={c} />
      <rect x={px(9)} y={px(13)} width={px(2)} height={px(3)} fill={c} />
    </svg>
  );
}
