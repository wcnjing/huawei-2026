import type { ShopItem } from "../../data/shopCatalogue";
import { useRoomTimeContext } from "../room/lighting";

/** Window pieces with a day-sky twin (public/furniture/<art>-day.svg, notes/tooling/rooms/day-windows.mjs). */
const DAY_ART = new Set(["08-city-window", "09-curtained-window", "34-skylight"]);

// `size` only sets the fallback intrinsic box before the image loads; once it has a
// place to sit it fills that box. Top-anchored art (for example hanging lights) keeps
// any unused contain-space below the asset instead of appearing detached from the wall.
// Inside a day room (RoomTimeProvider) the windows show a day sky.
export function ShopFurnitureArt({ art, size = 56, anchor = "bottom" }: { art: ShopItem["art"]; size?: number; anchor?: "top" | "bottom" }) {
  const day = useRoomTimeContext() === "day" && DAY_ART.has(art);
  return (
    <img
      src={`${import.meta.env.BASE_URL}furniture/${art}${day ? "-day" : ""}.svg`}
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
