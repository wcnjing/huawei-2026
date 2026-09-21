import type { ShopItem } from "../../data/shopCatalogue";

export function ShopFurnitureArt({ art, size = 56 }: { art: ShopItem["art"]; size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}furniture/${art}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={(size * 48) / 56}
      style={{ display: "block", imageRendering: "pixelated", objectFit: "contain", maxWidth: "100%", maxHeight: "100%", flexShrink: 1 }}
    />
  );
}
