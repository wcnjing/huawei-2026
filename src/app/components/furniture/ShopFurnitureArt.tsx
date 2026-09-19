import type { ShopItem } from "../../types/store";

export function ShopFurnitureArt({ art, size = 48 }: { art: ShopItem["art"]; size?: number }) {
  const s = size;
  switch (art) {
    case "sofa": return (
      <svg width={s} height={s * 0.75} viewBox="0 0 12 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={4} width={10} height={4} fill="#4ecdc4" />
        <rect x={0} y={3} width={2} height={6} fill="#4ecdc4" />
        <rect x={10} y={3} width={2} height={6} fill="#4ecdc4" />
        <rect x={1} y={2} width={10} height={3} fill="#4ecdc4" opacity={0.85} />
        <rect x={2} y={7} width={2} height={2} fill="#0a0e1a" />
        <rect x={8} y={7} width={2} height={2} fill="#0a0e1a" />
        <rect x={2} y={3} width={8} height={1} fill="#3aa8a0" />
      </svg>
    );
    case "lamp": return (
      <svg width={s * 0.66} height={s} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={6} height={4} fill="#ffe66d" />
        <rect x={0} y={1} width={8} height={2} fill="#ffe66d" />
        <rect x={2} y={4} width={4} height={1} fill="#ffe66d" opacity={0.7} />
        <rect x={2} y={2} width={4} height={2} fill="#fff3a0" opacity={0.7} />
        <rect x={3} y={5} width={2} height={5} fill="#8b5e3c" />
        <rect x={1} y={10} width={6} height={1} fill="#8b5e3c" />
        <rect x={0} y={11} width={8} height={1} fill="#6b4020" />
      </svg>
    );
    case "plant": return (
      <svg width={s} height={s} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={4} y={0} width={4} height={3} fill="#00ff88" />
        <rect x={2} y={2} width={8} height={4} fill="#00ff88" />
        <rect x={3} y={1} width={6} height={4} fill="#00cc66" />
        <rect x={5} y={5} width={2} height={2} fill="#006633" />
        <rect x={3} y={7} width={6} height={1} fill="#cd7f32" />
        <rect x={2} y={8} width={8} height={4} fill="#8b5e3c" />
        <rect x={3} y={8} width={6} height={3} fill="#a06840" />
        <rect x={3} y={11} width={6} height={1} fill="#5a3010" />
      </svg>
    );
    case "tv": return (
      <svg width={s} height={s * 0.75} viewBox="0 0 12 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={12} height={7} fill="#ff6b35" />
        <rect x={1} y={1} width={10} height={5} fill="#0a0e1a" />
        <rect x={2} y={2} width={4} height={2} fill="#4ecdc4" opacity={0.4} />
        <rect x={7} y={2} width={2} height={1} fill="#ffe66d" opacity={0.5} />
        <rect x={10} y={1} width={1} height={1} fill="#00ff88" />
        <rect x={5} y={7} width={2} height={1} fill="#ff6b35" />
        <rect x={3} y={8} width={6} height={1} fill="#ff6b35" />
      </svg>
    );
    case "rug": return (
      <svg width={s} height={s * 0.6} viewBox="0 0 12 7" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={10} height={7} fill="#ff6b35" />
        <rect x={0} y={1} width={12} height={5} fill="#ff6b35" />
        <rect x={2} y={2} width={8} height={3} fill="#ff8855" />
        <rect x={4} y={3} width={4} height={1} fill="#ffe66d" opacity={0.6} />
        <rect x={5} y={2} width={2} height={3} fill="#ffe66d" opacity={0.5} />
        <rect x={0} y={0} width={1} height={1} fill="#ffe66d" />
        <rect x={11} y={0} width={1} height={1} fill="#ffe66d" />
        <rect x={0} y={6} width={1} height={1} fill="#ffe66d" />
        <rect x={11} y={6} width={1} height={1} fill="#ffe66d" />
      </svg>
    );
    case "bookshelf": return (
      <svg width={s * 0.85} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={12} fill="#ff6b35" />
        <rect x={1} y={1} width={8} height={10} fill="#0a0e1a" />
        <rect x={0} y={4} width={10} height={1} fill="#ff6b35" />
        <rect x={0} y={7} width={10} height={1} fill="#ff6b35" />
        <rect x={1} y={1} width={2} height={3} fill="#4ecdc4" />
        <rect x={3} y={1} width={1} height={3} fill="#ffe66d" />
        <rect x={5} y={1} width={2} height={3} fill="#00ff88" />
        <rect x={7} y={1} width={2} height={3} fill="#c77dff" />
        <rect x={1} y={5} width={3} height={2} fill="#ffe66d" />
        <rect x={4} y={5} width={2} height={2} fill="#4ecdc4" />
        <rect x={6} y={5} width={3} height={2} fill="#ff2d55" opacity={0.7} />
        <rect x={1} y={8} width={2} height={3} fill="#00ff88" />
        <rect x={3} y={8} width={4} height={3} fill="#4ecdc4" opacity={0.6} />
        <rect x={7} y={8} width={2} height={3} fill="#ffe66d" />
      </svg>
    );
    case "bed": return (
      <svg width={s} height={s * 0.7} viewBox="0 0 12 8" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={2} width={12} height={5} fill="#4ecdc4" />
        <rect x={0} y={1} width={2} height={6} fill="#3aa8a0" />
        <rect x={10} y={1} width={2} height={6} fill="#3aa8a0" />
        <rect x={2} y={3} width={4} height={2} fill="#ffffff" opacity={0.7} />
        <rect x={6} y={3} width={4} height={3} fill="#4ecdc4" opacity={0.7} />
        <rect x={1} y={7} width={2} height={1} fill="#0a0e1a" />
        <rect x={9} y={7} width={2} height={1} fill="#0a0e1a" />
      </svg>
    );
    case "window": return (
      <svg width={s * 0.85} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={12} fill="#4ecdc4" />
        <rect x={1} y={1} width={8} height={10} fill="#0a0e1a" />
        <rect x={1} y={1} width={4} height={4} fill="#4ecdc4" opacity={0.35} />
        <rect x={5} y={1} width={4} height={4} fill="#4ecdc4" opacity={0.35} />
        <rect x={1} y={6} width={4} height={5} fill="#4ecdc4" opacity={0.35} />
        <rect x={5} y={6} width={4} height={5} fill="#4ecdc4" opacity={0.35} />
        <rect x={4} y={1} width={2} height={10} fill="#4ecdc4" />
        <rect x={1} y={5} width={8} height={1} fill="#4ecdc4" />
        <rect x={3} y={2} width={1} height={2} fill="#ffe66d" opacity={0.5} />
      </svg>
    );
  }
}