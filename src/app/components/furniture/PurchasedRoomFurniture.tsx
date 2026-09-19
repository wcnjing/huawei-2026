import { FURNITURE_STORE } from "../../data/furniture";
import { SHOP_CATALOGUE } from "../../data/shopCatalogue";
import type { ShopItem } from "../../types/store";
import { ShopFurnitureArt } from "./ShopFurnitureArt";

function memberShadowColor(accent: string) {
  return accent === "#ffe66d" ? "#6b4f00" : "#0a0e1a";
}

export function PurchasedRoomFurniture({ itemIds, accent }: { itemIds: string[]; accent: string }) {
  const items = itemIds
    .map(id => SHOP_CATALOGUE.find(item => item.id === id))
    .filter((item): item is ShopItem => !!item);
  if (items.length === 0) return null;

  const visible = items.slice(0, 8);
  const hiddenCount = items.length - visible.length;
  const itemSize = items.length <= 2 ? 40 : items.length <= 4 ? 32 : 24;
  const columns = Math.min(items.length, 4);
  const gap = 4;
  return (
    <div
      data-room-purchased-items={items.length}
      aria-label={`${items.length} purchased furniture item${items.length === 1 ? "" : "s"} in room`}
      style={{
        position: "absolute",
        right: 38,
        bottom: 12,
        width: columns * itemSize + Math.max(0, columns - 1) * gap,
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, ${itemSize}px)`,
        alignItems: "end",
        justifyContent: "end",
        gap,
      }}
    >
      {visible.map(item => (
        <div
          key={item.id}
          title={item.name}
          style={{
            width: itemSize,
            height: itemSize,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            filter: `drop-shadow(1px 1px 0 ${memberShadowColor(accent)})`,
          }}
        >
          <ShopFurnitureArt art={item.art} size={itemSize - 2} />
        </div>
      ))}
      {hiddenCount > 0 && (
        <div style={{ position: "absolute", right: 0, bottom: -16, backgroundColor: "#0a0e1a", border: `2px solid ${accent}`, padding: "1px 4px", fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: accent }}>
          +{hiddenCount}
        </div>
      )}
    </div>
  );
}