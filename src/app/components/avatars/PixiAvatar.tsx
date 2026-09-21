export function PixiAvatar({ size = 32 }: { size?: number }) {
  const s = size / 16;
  const px = (n: number) => n * s;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      {/* Antenna */}
      <rect x={px(7)} y={px(0)} width={px(2)} height={px(1)} fill="#00d4ff" />
      <rect x={px(7)} y={px(1)} width={px(2)} height={px(1)} fill="#ffe66d" />
      {/* Head */}
      <rect x={px(4)} y={px(2)} width={px(8)} height={px(6)} fill="#00d4ff" />
      <rect x={px(3)} y={px(3)} width={px(1)} height={px(4)} fill="#00d4ff" />
      <rect x={px(12)} y={px(3)} width={px(1)} height={px(4)} fill="#00d4ff" />
      {/* Eye sockets (dark) with glowing centre pixels */}
      <rect x={px(5)} y={px(4)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(4)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(5)} y={px(4)} width={px(1)} height={px(1)} fill="#00ff88" />
      <rect x={px(10)} y={px(5)} width={px(1)} height={px(1)} fill="#00ff88" />
      {/* Mouth speaker grille */}
      <rect x={px(6)} y={px(6)} width={px(4)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(6)} width={px(1)} height={px(1)} fill="#00ff88" />
      <rect x={px(8)} y={px(6)} width={px(1)} height={px(1)} fill="#00ff88" />
      {/* Body */}
      <rect x={px(4)} y={px(8)} width={px(8)} height={px(6)} fill="#0099cc" />
      <rect x={px(5)} y={px(9)} width={px(6)} height={px(4)} fill="#0a0e1a" />
      {/* Chest indicator light */}
      <rect x={px(7)} y={px(10)} width={px(2)} height={px(2)} fill="#ffe66d" />
      <rect x={px(7)} y={px(10)} width={px(1)} height={px(1)} fill="#ffffff" opacity={0.7} />
      {/* Arms (angular, robotic) */}
      <rect x={px(1)} y={px(9)} width={px(3)} height={px(2)} fill="#00d4ff" />
      <rect x={px(12)} y={px(9)} width={px(3)} height={px(2)} fill="#00d4ff" />
      {/* Feet */}
      <rect x={px(5)} y={px(14)} width={px(2)} height={px(2)} fill="#00d4ff" />
      <rect x={px(9)} y={px(14)} width={px(2)} height={px(2)} fill="#00d4ff" />
    </svg>
  );
}
