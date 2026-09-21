import { SHOP_CATALOGUE } from "../../data/shopCatalogue";
import type { ShopItem } from "../../types/store";
import { furnitureAnchor, type RoomLayout } from "../../types/roomLayout";
import { RoomFurnitureLayer } from "../room";
import { ShopFurnitureArt } from "./ShopFurnitureArt";

function memberShadowColor(accent: string) {
  return accent === "#ffe66d" ? "#6b4f00" : "#0a0e1a";
}

export function purchasedFurniture(itemIds: string[]) {
  return itemIds.map(id => SHOP_CATALOGUE.find(item => item.id === id))
    .filter((item): item is ShopItem => !!item)
    .map(item => ({
      id: item.id,
      name: item.name,
      art: <ShopFurnitureArt art={item.art} size={64} anchor={furnitureAnchor(item.id)} />,
    }));
}

export function PurchasedRoomFurniture({ itemIds, accent, layout, topInset }: { itemIds: string[]; accent: string; layout?: RoomLayout; topInset: number }) {
  if (!itemIds.length) return null;
  return <div data-room-purchased-items={itemIds.length} aria-label={`${itemIds.length} purchased furniture items in room`}
    style={{ position: "absolute", inset: `${topInset}px 10px 12px`, pointerEvents: "none", filter: `drop-shadow(1px 1px 0 ${memberShadowColor(accent)})` }}>
    <RoomFurnitureLayer items={purchasedFurniture(itemIds)} layout={layout} />
  </div>;
}
