import type { ShopItem } from "../../types/store";

import { FAMILY_MEMBERS, MEMBER_MAP } from "../../data/familyMembers";
import { SHOP_CATALOGUE } from "../../data/shopCatalogue";

import { FamilyChar } from "../../components/avatars";
import { ShopFurnitureArt } from "../../components/furniture";
import { IconCoin, IconHouse } from "../../components/icons";

import { useState } from "react";

export function ShopScreen({
  activeMemberId, onSelectMember, coins, purchasedItems, onBuy,
}: {
  activeMemberId: string;
  onSelectMember: (memberId: string) => void;
  coins: Record<string, number>;
  purchasedItems: Record<string, string[]>;
  onBuy: (memberId: string, itemId: string, cost: number) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | "AFFORDABLE" | "OWNED">("ALL");
  const [justBought, setJustBought] = useState<string | null>(null);

  const member = MEMBER_MAP[activeMemberId] ?? FAMILY_MEMBERS[1];
  const memberCoins = coins[activeMemberId] ?? 0;
  const owned = purchasedItems[activeMemberId] ?? [];

  const filtered = SHOP_CATALOGUE.filter(item => {
    const isOwned = owned.includes(item.id);
    if (filter === "OWNED") return isOwned;
    if (filter === "AFFORDABLE") return !isOwned && memberCoins >= item.cost;
    return true;
  });

  const handleBuy = (item: ShopItem) => {
    if (owned.includes(item.id)) return;
    if (memberCoins < item.cost) return;
    onBuy(activeMemberId, item.id, item.cost);
    setJustBought(item.id);
    setTimeout(() => setJustBought(prev => prev === item.id ? null : prev), 1200);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Member picker strip — always visible */}
      <div style={{ padding: "10px 12px", backgroundColor: "#0a0e1a", borderBottom: `4px solid ${member.primaryColor}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>SHOPPING FOR</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoin size={12} color={memberCoins < 0 ? "#ff2d55" : "#ffe66d"} />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: memberCoins < 0 ? "#ff2d55" : "#ffe66d" }}>
              {memberCoins < 0 ? "-" : ""}{Math.abs(memberCoins)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {FAMILY_MEMBERS.map(m => {
            const active = m.id === activeMemberId;
            const mCoins = coins[m.id] ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMember(m.id)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  backgroundColor: active ? m.primaryColor : "#111827",
                  border: `2px solid ${active ? "#0a0e1a" : m.primaryColor}`,
                  boxShadow: active ? "2px 2px 0 #0a0e1a" : "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <FamilyChar id={m.id} size={24} frame={0} />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: active ? "#0a0e1a" : m.primaryColor }}>
                  {m.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "14px 14px 4px" }}>
          {/* Virtual house preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconHouse size={12} color={member.primaryColor} />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: member.primaryColor }}>
              {member.name}'S ROOM PREVIEW
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: 100,
              backgroundColor: member.roomBg,
              border: `3px solid ${member.primaryColor}`,
              boxShadow: `3px 3px 0 ${member.primaryColor}`,
              position: "relative",
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            {/* Wall stripes */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 76, background: `repeating-linear-gradient(90deg, ${member.roomBg} 0px, ${member.roomBg} 18px, ${member.primaryColor}0a 18px, ${member.primaryColor}0a 36px)` }} />
            {/* Floor */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 24, background: `repeating-linear-gradient(90deg, #1a2a3a 0px, #1a2a3a 20px, ${member.roomBg} 20px, ${member.roomBg} 40px)`, borderTop: `2px solid ${member.primaryColor}55` }} />
            {/* Placed shop items (first 5) */}
            <div style={{ position: "absolute", bottom: 22, left: 6, display: "flex", alignItems: "flex-end", gap: 6 }}>
              {owned.slice(0, 5).map(id => {
                const item = SHOP_CATALOGUE.find(i => i.id === id);
                if (!item) return null;
                return <div key={id}><ShopFurnitureArt art={item.art} size={40} /></div>;
              })}
            </div>
            {owned.length === 0 && (
              <div style={{ position: "absolute", bottom: 34, left: 0, right: 0, textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4" }}>
                BUY FURNITURE TO FILL THIS ROOM
              </div>
            )}
            {/* Item count badge */}
            <div style={{ position: "absolute", top: 6, right: 6, backgroundColor: "#0a0e1a", border: `2px solid ${member.primaryColor}`, padding: "2px 5px" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: member.primaryColor }}>
                {owned.length} SHOP ITEM{owned.length === 1 ? "" : "S"}
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["ALL", "AFFORDABLE", "OWNED"] as const).map(f => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "6px 10px",
                    backgroundColor: active ? "#ffe66d" : "#111827",
                    border: `2px solid ${active ? "#ffe66d" : "#2a3a5c"}`,
                    boxShadow: active ? "2px 2px 0 #0a0e1a" : "none",
                    cursor: "pointer",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 8,
                    color: active ? "#0a0e1a" : "#6b8ba4",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>

          {/* Catalogue grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 16 }}>
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "24px 0", textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4" }}>
                No items in this filter.
              </div>
            )}
            {filtered.map(item => {
              const isOwned = owned.includes(item.id);
              const affordable = memberCoins >= item.cost;
              const bought = justBought === item.id;
              const borderColor = isOwned ? "#4ecdc4" : (affordable ? "#ffe66d" : "#2a3a5c");
              return (
                <div
                  key={item.id}
                  data-shop-item={item.id}
                  style={{
                    backgroundColor: "#111827",
                    border: `3px solid ${borderColor}`,
                    boxShadow: isOwned ? "3px 3px 0 #4ecdc4" : (affordable ? "3px 3px 0 #ffe66d" : "none"),
                    padding: "12px 10px",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isOwned && (
                    <div style={{ position: "absolute", top: 4, right: 4, backgroundColor: "#4ecdc4", padding: "2px 4px" }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#0a0e1a" }}>OWNED</div>
                    </div>
                  )}
                  <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShopFurnitureArt art={item.art} size={48} />
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#e8f4f8", textAlign: "center", lineHeight: 1.4 }}>
                    {item.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconCoin size={10} color={isOwned ? "#6b8ba4" : "#ffe66d"} />
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: isOwned ? "#6b8ba4" : "#ffe66d" }}>
                      {item.cost}
                    </div>
                  </div>
                  {isOwned ? (
                    <div style={{ width: "100%", padding: "5px 0", textAlign: "center", backgroundColor: "#0d1525", border: "2px solid #4ecdc4" }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#4ecdc4" }}>IN ROOM</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={!affordable}
                      style={{
                        width: "100%",
                        padding: "5px 0",
                        cursor: affordable ? "pointer" : "not-allowed",
                        backgroundColor: bought ? "#00ff88" : (affordable ? "#ffe66d" : "#0d1525"),
                        border: `2px solid ${affordable ? "#ffe66d" : "#2a3a5c"}`,
                        boxShadow: affordable && !bought ? "2px 2px 0 #0a0e1a" : "none",
                      }}
                    >
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: bought ? "#0a0e1a" : (affordable ? "#0a0e1a" : "#6b8ba4") }}>
                        {bought ? "BOUGHT!" : (affordable ? "BUY" : "NOT ENOUGH")}
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}