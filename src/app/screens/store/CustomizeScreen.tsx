import { useT } from "../../i18n";
import type { ReactNode } from "react";
import { furnitureAnchor, type RoomLayout } from "../../types/roomLayout";
import type { RoomStyle } from "../../types/roomStyle";
import { FURNITURE_STORE } from "../../data/furniture";
import { SHOP_CATALOGUE, type ShopItem } from "../../data/shopCatalogue";
import { FurnitureIcon, ShopFurnitureArt, purchasedFurniture } from "../../components/furniture";
import { MemberChar } from "../../components/avatars";
import { IconCoin, IconWarning, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { RoomStyleEditor } from "../../components/room";
import { useMemberMap } from "../../hooks/useMembers";
import { ink, line } from "../../utils/color";

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
  const t = useT();
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
        art: <ShopFurnitureArt art={item.art} size={30} anchor={furnitureAnchor(item.id)} />,
      })),
  ];

  const handleSell = (item: UnifiedItem) => {
    if (soldItems.includes(item.id)) return;
    onSell(memberId, item.id, item.sellValue);
  };

  if (!member) return null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "var(--background)", borderBottom: `4px solid ${line(member.primaryColor)}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} aria-label={t("Back to home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, minHeight: 44 }}><IconX size={16} color="var(--muted-foreground)" /></button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: ink(member.primaryColor) }}>{t("CUSTOMIZE ROOM")}</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCoin size={12} color={coins < 0 ? "var(--red)" : "var(--yellow)"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: coins < 0 ? "var(--red)" : "var(--yellow)" }}>{coins < 0 ? "-" : ""}{Math.abs(coins)}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          {isInDebt && (
            <div style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 8%, transparent)", border: "3px solid var(--red-line)", padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <IconWarning size={14} color="var(--red)" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", lineHeight: 1.5 }}>{t("In debt — sell furniture to recover coins")}</div>
            </div>
          )}

          {purchasedItems.length > 0 && <div style={{ marginBottom: 18 }}>
            <PixelButton onClick={onArrange} color="var(--teal-fill)" textColor="var(--on-fill)" size="md" full>{t("ARRANGE ROOM")}</PixelButton>
          </div>}
          <RoomStyleEditor key={memberId} value={member.roomStyle} background={member.roomBg}
            accent={member.primaryColor} defaultName={t("{name}'S ROOM", { name: member.name })}
            items={purchasedFurniture(purchasedItems)} layout={layout}
            avatar={<MemberChar member={member} size={104} />} onSave={onStyleSave} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", letterSpacing: 2, marginBottom: 10 }}>{t("FURNITURE")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {unifiedItems.map(item => {
              const isSold = soldItems.includes(item.id);
              return (
                <div key={item.id} style={{ backgroundColor: "var(--card)", border: `3px solid ${isSold ? "var(--border)" : isInDebt ? "var(--orange-line)" : "var(--border)"}`, opacity: isSold ? 0.5 : 1, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--background)", border: `2px solid ${isSold ? "var(--secondary)" : isInDebt ? "var(--orange-line)" : "var(--border)"}` }}>
                    {item.art}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isSold ? "var(--muted-foreground)" : "var(--foreground)" }}>{t(item.name)}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 4 }}>
                      {isSold ? t("SOLD") : t("SELL FOR {amount} COINS", { amount: item.sellValue })}
                    </div>
                  </div>
                  {!isSold && (
                    <button onClick={() => handleSell(item)} style={{ backgroundColor: isInDebt ? "var(--orange-fill)" : "var(--border)", border: "none", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <IconCoin size={10} color={isInDebt ? "var(--on-fill)" : "var(--yellow)"} />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: isInDebt ? "var(--on-fill)" : "var(--yellow)" }}>{t("SELL")}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <PixelButton onClick={onBack} color="var(--secondary)" textColor="var(--muted-foreground)" size="md" full>{t("BACK TO HOME")}</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: NOTIFICATIONS (list view)
