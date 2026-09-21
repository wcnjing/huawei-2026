import type { ReactNode } from "react";
import type { RoomLayout } from "../../types/roomLayout";
import type { RoomStyle } from "../../types/roomStyle";
import { FURNITURE_STORE } from "../../data/furniture";
import { SHOP_CATALOGUE, type ShopItem } from "../../data/shopCatalogue";
import { FurnitureIcon, ShopFurnitureArt, purchasedFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { IconCoin, IconWarning, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { RoomStyleEditor } from "../../components/room";
import { useMemberMap } from "../../hooks/useMembers";

export function CustomizeScreen({ memberId, coins, purchasedItems, soldItems, layout, onStyleSave, onBack, onSell, onArrange }: {
  memberId: string;
  coins: number;
  purchasedItems: string[];
  soldItems: string[];
  layout?: RoomLayout;
  onStyleSave: (style: RoomStyle) => boolean;
  onBack: () => void;
  onSell: (memberId: string, itemId: string, value: number) => void;
  onArrange: () => void;
}) {
  const member = useMemberMap()[memberId];
  const memberItems = FURNITURE_STORE.filter(i => i.memberId === memberId);
  const isInDebt = coins < 0;

  // Unified item shape for the merged furniture list.
  // Pre-owned items (FURNITURE_STORE) sell at their full sellValue.
  // Shop-bought items sell at half their original buy cost (rounded down).
  type UnifiedItem = {
    id: string;
    name: string;
    sellValue: number;
    art: ReactNode;
  };

  const unifiedItems: UnifiedItem[] = [
    ...memberItems
      .filter(item => !soldItems.includes(item.id))
      .map<UnifiedItem>(item => ({
      id: item.id,
      name: item.name,
      sellValue: item.sellValue,
      art: <FurnitureIcon itemId={item.id} size={32} />,
      })),
    ...purchasedItems
      .map(id => SHOP_CATALOGUE.find(i => i.id === id))
      .filter((i): i is ShopItem => !!i)
      .map<UnifiedItem>(item => ({
        id: item.id,
        name: item.name,
        sellValue: Math.floor(item.cost * 0.75),
        art: <ShopFurnitureArt art={item.art} size={30} />,
      })),
  ];

  const handleSell = (item: UnifiedItem) => {
    if (soldItems.includes(item.id)) return;
    onSell(memberId, item.id, item.sellValue);
  };

  if (!member) return null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: `4px solid ${member.primaryColor}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} aria-label="Back to home" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, minHeight: 44 }}><IconX size={16} color="#6b8ba4" /></button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: member.primaryColor }}>CUSTOMIZE ROOM</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCoin size={12} color={coins < 0 ? "#ff2d55" : "#ffe66d"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: coins < 0 ? "#ff2d55" : "#ffe66d" }}>{coins < 0 ? "-" : ""}{Math.abs(coins)}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          {isInDebt && (
            <div style={{ backgroundColor: "rgba(255,45,85,0.08)", border: "3px solid #ff2d55", padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <IconWarning size={14} color="#ff2d55" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", lineHeight: 1.5 }}>In debt — sell furniture to recover coins</div>
            </div>
          )}

          {purchasedItems.length > 0 && <div style={{ marginBottom: 18 }}>
            <PixelButton onClick={onArrange} color="#4ecdc4" textColor="#0a0e1a" size="md" full>ARRANGE ROOM</PixelButton>
          </div>}
          <RoomStyleEditor key={memberId} value={member.roomStyle} background={member.roomBg}
            accent={member.primaryColor} defaultName={`${member.name}'S ROOM`}
            items={purchasedFurniture(purchasedItems)} layout={layout}
            avatar={<MemberChar member={member} size={48} />} onSave={onStyleSave} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", letterSpacing: 2, marginBottom: 10 }}>FURNITURE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {unifiedItems.map(item => {
              const isSold = soldItems.includes(item.id);
              return (
                <div key={item.id} style={{ backgroundColor: "#111827", border: `3px solid ${isSold ? "#2a3a5c" : isInDebt ? "#ff6b35" : "#2a3a5c"}`, opacity: isSold ? 0.5 : 1, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0e1a", border: `2px solid ${isSold ? "#1a2340" : isInDebt ? "#ff6b35" : "#2a3a5c"}` }}>
                    {item.art}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isSold ? "#6b8ba4" : "#e8f4f8" }}>{item.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 4 }}>
                      {isSold ? "SOLD" : `SELL FOR ${item.sellValue} COINS`}
                    </div>
                  </div>
                  {!isSold && (
                    <button onClick={() => handleSell(item)} style={{ backgroundColor: isInDebt ? "#ff6b35" : "#2a3a5c", border: "none", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <IconCoin size={10} color={isInDebt ? "#0a0e1a" : "#ffe66d"} />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: isInDebt ? "#0a0e1a" : "#ffe66d" }}>SELL</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK TO HOME</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: NOTIFICATIONS (list view)
