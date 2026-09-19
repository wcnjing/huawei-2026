import { useState, useEffect } from "react";

// ── Pixel Mascot ──────────────────────────────────────────────────────────
// Outfit → body/limb/accent colours. `Standard` reproduces the original mascot so
// every existing call site (headers, home, etc.) is untouched when no outfit is passed.
const MASCOT_OUTFITS: Record<string, { body: string; accent: string }> = {
  Standard: { body: "#00ff88", accent: "#00ff88" },
  Camo:     { body: "#5a7a3a", accent: "#3a5a2a" },
  Neon:     { body: "#ff2d55", accent: "#c77dff" },
  Stealth:  { body: "#2a3a5c", accent: "#4ecdc4" },
};

export function PixelMascot({
  size = 64, animate = false,
  color = "#4ecdc4", hat = "None", eyes = "Default", outfit = "Standard",
}: {
  size?: number; animate?: boolean;
  color?: string; hat?: string; eyes?: string; outfit?: string;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % 2), 500);
    return () => clearInterval(t);
  }, [animate]);

  const s = size / 16;
  const px = (n: number) => n * s;
  const bodyY = frame === 0 ? 0 : s;
  const fit = MASCOT_OUTFITS[outfit] ?? MASCOT_OUTFITS.Standard;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      {/* Head + limbs take the chosen avatar colour. */}
      <rect x={px(4)} y={px(1)} width={px(8)} height={px(7)} fill={color} />

      {/* Eyes — Default draws the plain sockets; the others overlay a style. */}
      {eyes === "Default" && (<>
        <rect x={px(5)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
        <rect x={px(9)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
        <rect x={px(6)} y={px(3)} width={px(1)} height={px(1)} fill="#ffffff" />
        <rect x={px(10)} y={px(3)} width={px(1)} height={px(1)} fill="#ffffff" />
      </>)}
      {eyes === "Shades" && (<>
        <rect x={px(4)} y={px(3)} width={px(8)} height={px(2)} fill="#0a0e1a" />
        <rect x={px(7)} y={px(3)} width={px(2)} height={px(1)} fill="#2a3a5c" />
      </>)}
      {eyes === "Visor" && (<>
        <rect x={px(4)} y={px(3)} width={px(8)} height={px(2)} fill="#4ecdc4" opacity={0.75} />
        <rect x={px(4)} y={px(3)} width={px(8)} height={px(1)} fill="#ffffff" opacity={0.4} />
      </>)}
      {eyes === "Goggles" && (<>
        <rect x={px(4)} y={px(3)} width={px(8)} height={px(1)} fill="#ffe66d" />
        <rect x={px(5)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
        <rect x={px(9)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
        <rect x={px(6)} y={px(4)} width={px(1)} height={px(1)} fill="#4ecdc4" />
        <rect x={px(10)} y={px(4)} width={px(1)} height={px(1)} fill="#4ecdc4" />
      </>)}

      {/* Mouth */}
      <rect x={px(6)} y={px(6)} width={px(1)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(7)} y={px(7)} width={px(2)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(6)} width={px(1)} height={px(1)} fill="#0a0e1a" />

      {/* Hat — drawn over the top of the head. */}
      {hat === "Cap" && (<>
        <rect x={px(4)} y={px(0)} width={px(8)} height={px(1)} fill="#ff2d55" />
        <rect x={px(4)} y={px(1)} width={px(8)} height={px(1)} fill="#ff2d55" />
        <rect x={px(1)} y={px(1)} width={px(3)} height={px(1)} fill="#ff2d55" />
      </>)}
      {hat === "Helmet" && (<>
        <rect x={px(3)} y={px(0)} width={px(10)} height={px(2)} fill="#6b8ba4" />
        <rect x={px(7)} y={px(0)} width={px(2)} height={px(2)} fill="#ffe66d" />
      </>)}
      {hat === "Crown" && (<>
        <rect x={px(4)} y={px(1)} width={px(8)} height={px(1)} fill="#ffe66d" />
        <rect x={px(4)} y={px(0)} width={px(1)} height={px(1)} fill="#ffe66d" />
        <rect x={px(6)} y={px(0)} width={px(1)} height={px(1)} fill="#ffe66d" />
        <rect x={px(8)} y={px(0)} width={px(1)} height={px(1)} fill="#ffe66d" />
        <rect x={px(10)} y={px(0)} width={px(1)} height={px(1)} fill="#ffe66d" />
      </>)}

      {/* Body (outfit) + limbs (avatar colour) */}
      <rect x={px(4)} y={px(8) + bodyY} width={px(8)} height={px(6)} fill={fit.body} />
      <rect x={px(5)} y={px(9) + bodyY} width={px(6)} height={px(4)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(10) + bodyY} width={px(4)} height={px(2)} fill={fit.accent} />
      <rect x={px(1)} y={px(9) + bodyY} width={px(3)} height={px(2)} fill={color} />
      <rect x={px(12)} y={px(9) + bodyY} width={px(3)} height={px(2)} fill={color} />
      <rect x={px(5)} y={px(14) + bodyY} width={px(2)} height={px(2)} fill={color} />
      <rect x={px(9)} y={px(14) + bodyY} width={px(2)} height={px(2)} fill={color} />
    </svg>
  );
}