import { useState } from "react";
import type { RoomLayout } from "../../types/roomLayout";
import { SHOP_CATALOGUE, SHOP_CATEGORIES, DECOR_TYPES, filterShopItems, type ShopItem, type ShopCategory, type DecorType } from "../../data/shopCatalogue";
import { ShopFurnitureArt, purchasedFurniture } from "../../components/furniture";
import { IconCoin, IconHouse } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { RoomBackdrop, RoomFurnitureLayer } from "../../components/room";
import { useMemberMap } from "../../hooks/useMembers";

export function ShopScreen({
  activeMemberId, coins, purchasedItems, layout, onBuy, onArrange,
}: {
  activeMemberId: string;
  coins: Record<string, number>;
  purchasedItems: Record<string, string[]>;
  onBuy: (memberId: string, itemId: string, cost: number) => void;
  layout?: RoomLayout;
  onArrange: () => void;
}) {
  const [filter, setFilter] = useState<"ALL" | "AFFORDABLE" | "OWNED">("ALL");
  const [category, setCategory] = useState<ShopCategory | 'all'>('all');
  const [decorType, setDecorType] = useState<DecorType | 'all'>('all');
  const [justBought, setJustBought] = useState<string | null>(null);

  const member = useMemberMap()[activeMemberId];
  const memberCoins = coins[activeMemberId] ?? 0;
  const owned = purchasedItems[activeMemberId] ?? [];
  if (!member) return null;

  const filtered = filterShopItems(category, decorType, filter, owned, memberCoins);

  const handleBuy = (item: ShopItem) => {
    if (owned.includes(item.id)) return;
    if (memberCoins < item.cost) return;
    onBuy(activeMemberId, item.id, item.cost);
    setJustBought(item.id);
    setTimeout(() => setJustBought(prev => prev === item.id ? null : prev), 1200);
  };

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "10px 12px", backgroundColor: "#0a0e1a", borderBottom: `4px solid ${member.primaryColor}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>YOUR COINS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoin size={12} color={memberCoins < 0 ? "#ff2d55" : "#ffe66d"} />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: memberCoins < 0 ? "#ff2d55" : "#ffe66d" }}>
              {memberCoins < 0 ? "-" : ""}{Math.abs(memberCoins)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "14px 14px 4px" }}>
          {/* Virtual house preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconHouse size={12} color={member.primaryColor} />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: member.primaryColor }}>
              {member.name}'S ROOM PREVIEW
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: 132,
              backgroundColor: member.roomBg,
              border: `3px solid ${member.primaryColor}`,
              boxShadow: `3px 3px 0 ${member.primaryColor}`,
              position: "relative",
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <RoomBackdrop style={member.roomStyle} background={member.roomBg} accent={member.primaryColor} />
            <div style={{ position: "absolute", inset: "24px 8px 8px", pointerEvents: "none" }}>
              <RoomFurnitureLayer items={purchasedFurniture(owned)} layout={layout} />
            </div>
            {owned.length === 0 && (
              <div style={{ position: "absolute", bottom: 28, left: 12, right: 12, textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>
                BUY FURNITURE TO FILL THIS ROOM
              </div>
            )}
            {/* Item count badge */}
            <div style={{ position: "absolute", top: 6, right: 6, backgroundColor: "#0a0e1a", border: `2px solid ${member.primaryColor}`, padding: "2px 5px" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: member.primaryColor }}>
                {owned.length} SHOP ITEM{owned.length === 1 ? "" : "S"}
              </div>
            </div>
          </div>

          {owned.length > 0 && <div style={{ marginBottom: 14 }}>
            <PixelButton onClick={onArrange} color="#4ecdc4" textColor="#0a0e1a" size="md" full>ARRANGE ROOM</PixelButton>
          </div>}
          <label htmlFor="shop-category" style={{ display: 'block', color: '#c77dff', fontSize: 'var(--text-label)', marginBottom: 8 }}>SHOP BY TYPE</label>
          <select id="shop-category" value={category} onChange={event => { setCategory(event.target.value as ShopCategory | 'all'); setDecorType('all'); }}
            style={{ width: '100%', minHeight: 48, background: '#111827', color: '#e8f4f8', border: '2px solid #506180', padding: '10px', fontFamily: 'inherit', fontSize: 'var(--text-body)', marginBottom: 14 }}>
            <option value="all">All furniture ({SHOP_CATALOGUE.length})</option>
            {SHOP_CATEGORIES.map(option => <option key={option.id} value={option.id}>{option.name} ({SHOP_CATALOGUE.filter(item => item.category === option.id).length})</option>)}
          </select>
          {category === 'decor' && <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px', minWidth: 0 }}>
            <legend style={{ color: '#a8bbcf', fontSize: 'var(--text-label)', marginBottom: 8 }}>Decor type</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[{ id: 'all', name: 'All decor' }, ...DECOR_TYPES].map(option => <button type="button" key={option.id}
                aria-pressed={decorType === option.id} onClick={() => setDecorType(option.id as DecorType | 'all')}
                style={{ minHeight: 44, padding: '8px 10px', font: 'inherit', fontSize: 'var(--text-label)', cursor: 'pointer', border: `2px solid ${decorType === option.id ? '#c77dff' : '#506180'}`, background: decorType === option.id ? '#39214e' : '#111827', color: '#e8f4f8' }}>
                {option.name}
              </button>)}
            </div>
          </fieldset>}
          {/* Availability combines with the selected furniture category. */}
          <div role="group" aria-label="Availability" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(["ALL", "AFFORDABLE", "OWNED"] as const).map(f => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  aria-pressed={active}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "6px 10px", minHeight: 44,
                    backgroundColor: active ? "#ffe66d" : "#111827",
                    border: `2px solid ${active ? "#ffe66d" : "#2a3a5c"}`,
                    boxShadow: active ? "2px 2px 0 #0a0e1a" : "none",
                    cursor: "pointer",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: "var(--text-caption)",
                    color: active ? "#0a0e1a" : "#a8bbcf",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>

          <div role="status" style={{ color: '#a8bbcf', fontSize: 'var(--text-label)', marginBottom: 12 }}>
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'} · {category === 'all' ? 'All furniture' : SHOP_CATEGORIES.find(option => option.id === category)?.name}
            {category === 'decor' && decorType !== 'all' && ` · ${DECOR_TYPES.find(option => option.id === decorType)?.name}`}
          </div>

          {/* Catalogue grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, paddingBottom: 16 }}>
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "24px 0", textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>
                <p>{category !== 'all' && !SHOP_CATALOGUE.some(item => item.category === category)
                  ? 'No furniture in this category yet.'
                  : filter === 'OWNED' ? 'You don’t own any furniture in this category yet.'
                  : filter === 'AFFORDABLE' ? 'No unowned items in this category fit your balance.' : 'No matching furniture.'}</p>
                <button onClick={() => { setCategory('all'); setDecorType('all'); setFilter('ALL'); }}
                  style={{ marginTop: 12, minHeight: 44, padding: '8px 12px', border: '2px solid #4ecdc4', background: '#111827', color: '#4ecdc4', font: 'inherit', cursor: 'pointer' }}>Browse all furniture</button>
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
                    <div style={{ alignSelf: "flex-end", backgroundColor: "#4ecdc4", padding: "2px 4px" }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#0a0e1a" }}>OWNED</div>
                    </div>
                  )}
                  <div style={{ height: 84, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShopFurnitureArt art={item.art} size={98} />
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#e8f4f8", textAlign: "center", lineHeight: 1.4 }}>
                    {item.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconCoin size={10} color={isOwned ? "#6b8ba4" : "#ffe66d"} />
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: isOwned ? "#6b8ba4" : "#ffe66d" }}>
                      {item.cost}
                    </div>
                  </div>
                  {isOwned ? (
                    <div style={{ width: "100%", padding: "5px 0", textAlign: "center", backgroundColor: "#0d1525", border: "2px solid #4ecdc4" }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4" }}>IN ROOM</div>
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
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: bought ? "#0a0e1a" : (affordable ? "#0a0e1a" : "#6b8ba4") }}>
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

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PROFILE — EDIT button lives inside profile card (per user edit)
