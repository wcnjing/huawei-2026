import {
  IconChatBubble, IconPerson, IconPhone,
  IconRealEmail, IconShield, IconTelegram
} from "../../components/icons";
import { SafetyHabitsDropdown } from "./SafetyHabitsDropdown";
import { useT } from "../../i18n";
import { ink, line } from "../../utils/color";
import { sessionToken } from "../../services/session";

type Tile = {
  id: string; title: string; tag: string; color: string; icon: React.ReactNode;
  onClick: () => void; note?: string | null; tour?: string;
};

/** One drill as a small square-ish tile; tapping it opens that drill's own setup screen. */
function DrillTile({ tile }: { tile: Tile }) {
  return (
    <button
      data-tour={tile.tour}
      onClick={tile.onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, minHeight: 100, padding: 10,
        textAlign: "left", cursor: "pointer", backgroundColor: "var(--secondary)",
        border: `3px solid ${line(tile.color)}`, boxShadow: `3px 3px 0 color-mix(in srgb, ${line(tile.color)} 35%, transparent)`,
      }}
    >
      <div style={{ display: "flex", width: "100%", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <div style={{ width: 32, height: 32, flexShrink: 0, backgroundColor: "var(--background)", border: `2px solid ${line(tile.color)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {tile.icon}
        </div>
        {tile.note && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)", border: "1px solid var(--yellow-line)", padding: "1px 4px", lineHeight: 1.3, textAlign: "right" }}>{tile.note}</div>
        )}
      </div>
      <div style={{ marginTop: "auto" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: ink(tile.color), lineHeight: 1.6, overflowWrap: "normal", wordBreak: "keep-all" }}>{tile.title}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", letterSpacing: 1, marginTop: 4 }}>{tile.tag}</div>
      </div>
    </button>
  );
}

function Section({ title, subtitle, tiles }: { title: string; subtitle?: string; tiles: Tile[] }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)", letterSpacing: 2 }}>{title}</div>
        {subtitle && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--muted-foreground)", textAlign: "right" }}>{subtitle}</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {tiles.map((tile) => <DrillTile key={tile.id} tile={tile} />)}
      </div>
    </section>
  );
}

export function DrillSelectScreen({
  onRealisticPhone, onRealisticSms, onTelegram, onRealisticEmail, onFamily, onIndividual, inHouse, preferredChannels,
}: {
  onRealisticPhone: () => void;
  onRealisticSms: () => void;
  onTelegram: () => void;
  onRealisticEmail: () => void;
  onFamily: () => void;
  onIndividual: () => void;
  inHouse: boolean;
  preferredChannels?: string[];
  onBack: () => void;
}) {
  const t = useT();
  // A verified phone is what turns the live channels from "set this up" into "run it now".
  const verified = !!sessionToken();
  // Channels the player picked in their preferences come first and get a star.
  const picked = (id: string) => !!preferredChannels && preferredChannels.length < 3 && preferredChannels.includes(id === "phone" ? "call" : id);
  const setup = verified ? null : t("SETUP NEEDED");

  const practice: Tile[] = [
    { id: "individual", title: t("INDIVIDUAL DRILL"), tag: t("ON YOUR OWN"), color: "#4ecdc4", icon: <IconPerson size={18} color={ink("#4ecdc4")} />, onClick: onIndividual },
    { id: "house", tour: "family-drill", title: t("HOUSE DRILL"), tag: inHouse ? t("TAKE TURNS") : t("HOUSE NEEDED"), color: "#00ff88", icon: <IconShield size={18} color={ink("#00ff88")} />, onClick: onFamily },
  ];
  const live: Tile[] = [
    { id: "phone", title: t("SCAM CALL"), tag: t("PHONE · LIVE"), color: "#c77dff", icon: <IconPhone size={18} color={ink("#c77dff")} />, onClick: onRealisticPhone, note: setup },
    { id: "sms", title: t("SCAM TEXT"), tag: t("SMS · LIVE"), color: "#4ecdc4", icon: <IconChatBubble size={18} color={ink("#4ecdc4")} />, onClick: onRealisticSms, note: setup },
    { id: "telegram", title: t("TELEGRAM BOT"), tag: t("CHAT · LIVE"), color: "#00d4ff", icon: <IconTelegram size={18} color={ink("#00d4ff")} />, onClick: onTelegram },
    { id: "email", title: t("PHISHING EMAIL"), tag: t("EMAIL · LIVE"), color: "#ff6b35", icon: <IconRealEmail size={18} color={ink("#ff6b35")} />, onClick: onRealisticEmail, note: setup },
  ]
    .map((tile) => (picked(tile.id) && !tile.note ? { ...tile, note: `★ ${t("YOUR CHOICE")}` } : tile))
    .sort((a, b) => Number(picked(b.id)) - Number(picked(a.id)));

  return (
    <div data-tour="drill-page" className="h-full overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "var(--surface)" }}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5, padding: "2px 2px 0" }}>
          {t("CHOOSE YOUR")} <span style={{ color: "var(--green)" }}>{t("TRAINING")}</span>
        </div>
        <Section title={t("PRACTISE IN THE APP")} tiles={practice} />
        <Section title={t("LIVE CHANNELS")} subtitle={t("ON YOUR OWN PHONE")} tiles={live} />
        <SafetyHabitsDropdown />
        <div style={{ height: 4 }} />
      </div>
    </div>
  );
}
