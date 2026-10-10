import { useEffect, useState } from "react";

/**
 * Pixi, drawn as the app icon's face (public/pixi-icon.png, cropped from icon-512.png).
 * `animate` bobs it one pixel-step up and down, like the old mascot.
 */
export function PixiAvatar({ size = 32, animate = false }: { size?: number; animate?: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 500);
    return () => clearInterval(timer);
  }, [animate]);

  return (
    <img
      src="/pixi-icon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
      style={{
        display: "block",
        width: size,
        height: size,
        imageRendering: "pixelated",
        transform: frame === 1 ? `translateY(${Math.max(1, Math.round(size / 16))}px)` : undefined,
      }}
    />
  );
}
