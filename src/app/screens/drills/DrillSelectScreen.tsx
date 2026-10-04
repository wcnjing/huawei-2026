import {
  IconChatBubble, IconPerson, IconPhone,
  IconRealEmail, IconShield, IconTelegram
} from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { SafetyHabitsDropdown } from "./SafetyHabitsDropdown";
import { useT } from "../../i18n";

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
  const realisticDrills = [
    {
      id: "phone",
      title: t("SCAM CALL"),
      eyebrow: t("PHONE · LIVE"),
      description: t("Receive a simulated scam call on your verified phone."),
      action: t("SET UP CALL"),
      color: "#c77dff",
      icon: <IconPhone size={24} color="#c77dff" />,
      onClick: onRealisticPhone,
    },
    {
      id: "sms",
      title: t("SCAM TEXT"),
      eyebrow: t("SMS · LIVE"),
      description: t("Get a realistic scam text and practise spotting its red flags."),
      action: t("SET UP SMS"),
      color: "#4ecdc4",
      icon: <IconChatBubble size={24} color="#4ecdc4" />,
      onClick: onRealisticSms,
    },
    {
      id: "telegram",
      title: t("TELEGRAM BOT"),
      eyebrow: t("CHAT · LIVE"),
      description: t("Practise safely in a guided conversation with our training bot."),
      action: t("OPEN TELEGRAM"),
      color: "#00d4ff",
      icon: <IconTelegram size={24} color="#00d4ff" />,
      onClick: onTelegram,
    },
    {
      id: "email",
      title: t("PHISHING EMAIL"),
      eyebrow: t("EMAIL · LIVE"),
      description: t("Receive a simulated phishing message in your registered inbox."),
      action: t("SET UP EMAIL"),
      color: "#ff6b35",
      icon: <IconRealEmail size={24} color="#ff6b35" />,
      onClick: onRealisticEmail,
    },
  ];

  return (
    <div data-tour="drill-page" className="h-full overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "#0d1324" }}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <div style={{ padding: "2px 2px 4px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5, marginBottom: 8 }}>
            {t("CHOOSE YOUR")}<br /><span style={{ color: "#00ff88" }}>{t("TRAINING")}</span>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#8da4b8", lineHeight: 1.5 }}>
            {t("Play on your own or with your house, or practise with Scam Call, Text, Telegram, or Phishing Email.")}
          </div>
        </div>

        {[
          {
            key: "individual", tour: undefined, color: "#4ecdc4", shadow: "#1f5f5b", eyebrowColor: "#6fb3ae",
            icon: <IconPerson size={24} color="#4ecdc4" />,
            eyebrow: t("SOLO · 5–10 QUESTIONS"), title: t("INDIVIDUAL DRILL"),
            description: t("Practise on your own. Spot the scams, choose how many questions."),
            action: t("START INDIVIDUAL DRILL"), onClick: onIndividual,
          },
          {
            key: "house", tour: "family-drill", color: "#00ff88", shadow: "#006633", eyebrowColor: "#72a58a",
            icon: <IconShield size={24} color="#00ff88" />,
            eyebrow: inHouse ? t("FAMILY · TAKE TURNS") : t("FAMILY · HOUSE NEEDED"), title: t("HOUSE DRILL"),
            description: t("Everyone plays on their own phone and takes turns protecting the household."),
            action: inHouse ? t("START HOUSE DRILL") : t("SET UP A HOUSE"), onClick: onFamily,
          },
        ].map((card) => (
          <div key={card.key} data-tour={card.tour} style={{ backgroundColor: "#111b2e", border: `3px solid ${card.color}`, boxShadow: `4px 4px 0 ${card.shadow}`, padding: 16 }}>
            <div className="flex items-start gap-3">
              <div style={{ width: 44, height: 44, flexShrink: 0, backgroundColor: "rgba(0,255,136,0.1)", border: `2px solid ${card.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {card.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: card.eyebrowColor, letterSpacing: 1, marginBottom: 5 }}>{card.eyebrow}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: card.color, lineHeight: 1.4 }}>{card.title}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", margin: "13px 0 14px", lineHeight: 1.5 }}>
              {card.description}
            </div>
            <PixelButton onClick={card.onClick} color={card.color} textColor="#0a0e1a" size="md" full>{card.action}</PixelButton>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#8da4b8", letterSpacing: 2 }}>{t("LIVE CHANNELS")}</div>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8", textAlign: "center", marginTop: -6, lineHeight: 1.45 }}>
          {t("Sent to your verified channels. Registration required.")}
        </div>

        {[...realisticDrills].sort((a, b) => preferredChannels && preferredChannels.length < 3
          ? Number(preferredChannels.includes(b.id === "phone" ? "call" : b.id)) - Number(preferredChannels.includes(a.id === "phone" ? "call" : a.id))
          : 0).map((drill) => (
          <div key={drill.id} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", borderLeft: `5px solid ${drill.color}`, padding: 14 }}>
            <div className="flex items-start gap-3">
              <div style={{ width: 42, height: 42, flexShrink: 0, backgroundColor: "#0a0e1a", border: `2px solid ${drill.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {drill.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", letterSpacing: 1, marginBottom: 5 }}>{drill.eyebrow}{preferredChannels && preferredChannels.length < 3 && preferredChannels.includes(drill.id === "phone" ? "call" : drill.id) ? ` · ${t("YOUR CHOICE")}` : ""}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-label)", color: drill.color, lineHeight: 1.4 }}>{drill.title}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", margin: "12px 0 13px", lineHeight: 1.5 }}>
              {drill.description}
            </div>
            <PixelButton onClick={drill.onClick} color={drill.color} textColor="#0a0e1a" size="md" full>{drill.action}</PixelButton>
          </div>
        ))}

        <SafetyHabitsDropdown />

        <div style={{ height: 4 }} />
      </div>
    </div>
  );
}
