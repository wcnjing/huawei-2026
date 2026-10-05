import { useState } from "react";
import { useT } from "../../i18n";
import { IconFamily } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import type { HouseSummary } from "../../services/house";
import { HouseRoof } from "./HouseRoof";

const MONO = "'Share Tech Mono', monospace";

/**
 * The roof: the family button (top-right) opens the house page; with 2+ houses, ‹ ›
 * either side of the name step to the previous / next house, and dots show which one
 * you're in.
 */
export function HouseRoofButton({ title, onOpen, houses = [], onSwitch }: {
  title: string;
  onOpen: () => void;
  houses?: HouseSummary[];
  onSwitch?: (houseId: string) => Promise<string | null>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const index = houses.findIndex((h) => h.active);
  const canSwitch = !!onSwitch && houses.length >= 2 && index >= 0;

  const step = async (delta: number) => {
    if (!canSwitch || busy) return;
    const next = houses[(index + delta + houses.length) % houses.length];
    setBusy(true);
    await onSwitch!(next.id);
    setBusy(false);
  };

  const arrow = (label: string, glyph: string, delta: number) => (
    <button
      type="button"
      onClick={() => { void step(delta); }}
      disabled={busy}
      aria-label={label}
      title={label}
      style={{
        width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
        background: "none", border: "none", cursor: busy ? "wait" : "pointer",
        fontFamily: MONO, fontSize: 22, lineHeight: 1, color: "#4ecdc4", flexShrink: 0,
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div className="house-title-row" style={{ position: "relative" }}>
      <HouseRoof title="" />
      <div style={{ position: "absolute", left: 52, right: 52, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {canSwitch && arrow(t("Previous house"), "‹", -1)}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 4 }}>
          {canSwitch && (
            <div aria-hidden style={{ display: "flex", gap: 4, marginBottom: 3 }}>
              {houses.map((h) => (
                <span key={h.id} style={{ width: 5, height: 5, backgroundColor: h.active ? "#4ecdc4" : "#2a3a5c" }} />
              ))}
            </div>
          )}
          <div
            className="house-roof-title"
            aria-live="polite"
            style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#4ecdc4", letterSpacing: 1, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {title}
          </div>
        </div>
        {canSwitch && arrow(t("Next house"), "›", 1)}
      </div>
      <div className="house-invite-overlay">
        <PixelButton onClick={onOpen} color="#1a2340" textColor="#00d4ff" size="sm" compact>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24 }} role="img" aria-label={t("House menu")} title={t("House menu")}>
            <IconFamily size={22} />
          </span>
        </PixelButton>
      </div>
    </div>
  );
}
