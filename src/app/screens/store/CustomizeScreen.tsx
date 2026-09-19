import type { ShopItem } from "../../types/store";

import { FAMILY_MEMBERS } from "../../data/familyMembers";
import { FURNITURE_STORE } from "../../data/furniture";
import { SHOP_CATALOGUE } from "../../data/shopCatalogue";

import { ShopFurnitureArt, WallpaperSwatch, FurnitureIcon } from "../../components/furniture";
import { IconCoin, IconWarning, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";

export function CustomizeScreen({ memberId, coins, purchasedItems, soldItems, onBack, onSell }: {
  memberId: string;
  coins: number;
  purchasedItems: string[];
  soldItems: string[];
  onBack: () => void;
  onSell: (memberId: string, itemId: string, value: number) => void;
}) {
  const member = FAMILY_MEMBERS.find(m => m.id === memberId) ?? FAMILY_MEMBERS[1];
  const memberItems = FURNITURE_STORE.filter(i => i.memberId === memberId);
  const isInDebt = coins < 0;

  const WALLPAPERS = [
    { id:"wp1", name:"DARK GRID",   color:"#0a0e1a", price: 50  },
    { id:"wp2", name:"NAVY STRIPE", color:"#1a2340", price: 80  },
    { id:"wp3", name:"PIXEL STARS", color:"#100c20", price: 120 },
  ];

  // Unified item shape for the merged furniture list.
  // Pre-owned items (FURNITURE_STORE) sell at their full sellValue.
  // Shop-bought items sell at half their original buy cost (rounded down).
  type UnifiedItem = {
    id: string;
    name: string;
    sellValue: number;
    art: React.ReactNode;
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

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: `4px solid ${member.primaryColor}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconX size={16} color="#6b8ba4" /></button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: member.primaryColor }}>CUSTOMIZE ROOM</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCoin size={12} color={coins < 0 ? "#ff2d55" : "#ffe66d"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: coins < 0 ? "#ff2d55" : "#ffe66d" }}>{coins < 0 ? "-" : ""}{Math.abs(coins)}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          {isInDebt && (
            <div style={{ backgroundColor: "rgba(255,45,85,0.08)", border: "3px solid #ff2d55", padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <IconWarning size={14} color="#ff2d55" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>In debt — sell furniture to recover coins</div>
            </div>
          )}

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4", letterSpacing: 2, marginBottom: 10 }}>FURNITURE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {unifiedItems.map(item => {
              const isSold = soldItems.includes(item.id);
              return (
                <div key={item.id} style={{ backgroundColor: "#111827", border: `3px solid ${isSold ? "#2a3a5c" : isInDebt ? "#ff6b35" : "#2a3a5c"}`, opacity: isSold ? 0.5 : 1, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0e1a", border: `2px solid ${isSold ? "#1a2340" : isInDebt ? "#ff6b35" : "#2a3a5c"}` }}>
                    {item.art}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: isSold ? "#6b8ba4" : "#e8f4f8" }}>{item.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4", marginTop: 4 }}>
                      {isSold ? "SOLD" : `SELL FOR ${item.sellValue} COINS`}
                    </div>
                  </div>
                  {!isSold && (
                    <button onClick={() => handleSell(item)} style={{ backgroundColor: isInDebt ? "#ff6b35" : "#2a3a5c", border: "none", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <IconCoin size={10} color={isInDebt ? "#0a0e1a" : "#ffe66d"} />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: isInDebt ? "#0a0e1a" : "#ffe66d" }}>SELL</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4", letterSpacing: 2, marginBottom: 10 }}>WALLPAPER SHOP</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {WALLPAPERS.map(wp => (
              <button key={wp.id} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <div style={{ border: "3px solid #2a3a5c", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ width: "100%", height: 64, overflow: "hidden" }}>
                    <WallpaperSwatch id={wp.id} />
                  </div>
                  <div style={{ backgroundColor: "#111827", padding: "6px 4px 5px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#e8f4f8", textAlign: "center" }}>{wp.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <IconCoin size={7} color="#ffe66d" />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d" }}>{wp.price}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK TO HOME</PixelButton>
        </div>
      </div>
    </div>
  );
}