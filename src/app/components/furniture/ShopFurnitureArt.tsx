import type { ShopItem } from "../../data/shopCatalogue";

// `size` only sets the fallback intrinsic box before the image loads; once it has a
// place to sit it fills that box. Top-anchored art (for example hanging lights) keeps
// any unused contain-space below the asset instead of appearing detached from the wall.
export function ShopFurnitureArt({ art, size = 56, anchor = "bottom" }: { art: ShopItem["art"]; size?: number; anchor?: "top" | "bottom" }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}furniture/${art}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={(size * 48) / 56}
      style={{
        display: "block",
        imageRendering: "pixelated",
        width: "100%",
        height: "100%",
        objectFit: "contain",
        objectPosition: anchor === "top" ? "center top" : "center bottom",
        flexShrink: 1,
      }}
    />
  );
}
