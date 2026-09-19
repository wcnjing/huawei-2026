import { useEffect, useState } from "react";

export function PixelPhone({ ringing = false }: { ringing?: boolean }) {
  const [tilt, setTilt] = useState(0);
  useEffect(() => {
    if (!ringing) return;
    const t = setInterval(() => setTilt((v) => (v === 0 ? -4 : v === -4 ? 4 : 0)), 150);
    return () => clearInterval(t);
  }, [ringing]);
  return (
    <div style={{ transform: `rotate(${tilt}deg)`, transition: "transform 0.1s", display: "inline-block" }}>
      <svg width={80} height={80} viewBox="0 0 80 80" style={{ imageRendering: "pixelated" }}>
        <rect x={16} y={8} width={48} height={64} fill="#2a3a5c" />
        <rect x={20} y={12} width={40} height={56} fill="#111827" />
        <rect x={24} y={16} width={32} height={40} fill="#1a2340" />
        <rect x={28} y={60} width={24} height={4} fill="#2a3a5c" />
        <rect x={34} y={62} width={12} height={2} fill="#4ecdc4" />
        {ringing && (
          <>
            <rect x={8} y={24} width={4} height={4} fill="#ffe66d" />
            <rect x={68} y={24} width={4} height={4} fill="#ffe66d" />
            <rect x={8} y={32} width={4} height={4} fill="#ffe66d" />
            <rect x={68} y={32} width={4} height={4} fill="#ffe66d" />
          </>
        )}
      </svg>
    </div>
  );
}