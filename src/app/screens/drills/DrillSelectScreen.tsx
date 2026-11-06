import {
  IconChatBubble, IconPerson, IconPhone,
  IconRealEmail, IconShield, IconTelegram
} from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { SafetyHabitsDropdown } from "./SafetyHabitsDropdown";
import { useT } from "../../i18n";
import { line } from "../../utils/color";
import { sessionToken } from "../../services/session";

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
  // A verified phone is what turns these cards from "set this up" into "run it now".
  const verified = !!sessionToken();
  const realisticDrills = [
    {
      id: "phone",
      title: t("SCAM CALL"),
      eyebrow: t("PHONE · LIVE"),
      description: t("Receive a simulated scam call on your verified phone."),
      action: verified ? t("START CALL DRILL") : t("SET UP CALL"),
      color: "var(--violet)",
      icon: <IconPhone size={24} color="var(--violet)" />,
      onClick: onRealisticPhone,
    },
    {
      id: "sms",
      title: t("SCAM TEXT"),
      eyebrow: t("SMS · LIVE"),
      description: t("Get a realistic scam text and practise spotting its red flags."),
      action: verified ? t("START SMS DRILL") : t("SET UP SMS"),
      color: "var(--teal)",
      icon: <IconChatBubble size={24} color="var(--teal)" />,
      onClick: onRealisticSms,
    },
    {
      id: "telegram",
      title: t("TELEGRAM BOT"),
      eyebrow: t("CHAT · LIVE"),
      description: t("Practise safely in a guided conversation with our training bot."),
      action: t("OPEN TELEGRAM"),
      color: "var(--cyan)",
      icon: <IconTelegram size={24} color="var(--cyan)" />,
      onClick: onTelegram,
    },
    {
      id: "email",
      title: t("PHISHING EMAIL"),
      eyebrow: t("EMAIL · LIVE"),
      description: t("Receive a simulated phishing message in your registered inbox."),
      action: verified ? t("START EMAIL DRILL") : t("SET UP EMAIL"),
      color: "var(--orange)",
      icon: <IconRealEmail size={24} color="var(--orange)" />,
      onClick: onRealisticEmail,
    },
  ];

  return (
    <div data-tour="drill-page" className="h-full overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "var(--surface)" }}>
      <div className="flex flex-col gap-4 px-4 py-5">
        <div style={{ padding: "2px 2px 4px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5, marginBottom: 8 }}>
            {t("CHOOSE YOUR")}<br /><span style={{ color: "var(--green)" }}>{t("TRAINING")}</span>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.5 }}>
            {t("Play on your own or with your house, or practise with Scam Call, Text, Telegram, or Phishing Email.")}
          </div>
        </div>

        {[
          {
            key: "individual", tour: undefined, color: "var(--teal)", shadow: "color-mix(in srgb, var(--teal) 40%, var(--background))", eyebrowColor: "light-dark(#2f6f6a, #6fb3ae)",
            icon: <IconPerson size={24} color="var(--teal)" />,
            eyebrow: t("SOLO · 5–10 QUESTIONS"), title: t("INDIVIDUAL DRILL"),
            description: t("Practise on your own. Spot the scams, choose how many questions."),
            action: t("START INDIVIDUAL DRILL"), onClick: onIndividual,
          },
          {
            key: "house", tour: "family-drill", color: "var(--green)", shadow: "color-mix(in srgb, var(--green) 40%, var(--background))", eyebrowColor: "light-dark(#3b6b52, #72a58a)",
            icon: <IconShield size={24} color="var(--green)" />,
            eyebrow: inHouse ? t("FAMILY · TAKE TURNS") : t("FAMILY · HOUSE NEEDED"), title: t("HOUSE DRILL"),
            description: t("Everyone plays on their own phone and takes turns protecting the household."),
            action: inHouse ? t("START HOUSE DRILL") : t("SET UP A HOUSE"), onClick: onFamily,
          },
        ].map((card) => (
          <div key={card.key} data-tour={card.tour} style={{ backgroundColor: "var(--secondary)", border: `3px solid ${line(card.color)}`, boxShadow: `4px 4px 0 ${card.shadow}`, padding: 16 }}>
            <div className="flex items-start gap-3">
              <div style={{ width: 44, height: 44, flexShrink: 0, backgroundColor: "color-mix(in srgb, var(--green-fill) 10%, transparent)", border: `2px solid ${line(card.color)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {card.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: card.eyebrowColor, letterSpacing: 1, marginBottom: 5 }}>{card.eyebrow}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: card.color, lineHeight: 1.4 }}>{card.title}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", margin: "13px 0 14px", lineHeight: 1.5 }}>
              {card.description}
            </div>
            <PixelButton onClick={card.onClick} color={card.color} textColor="var(--on-fill)" size="md" full>{card.action}</PixelButton>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: "var(--border)" }} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", letterSpacing: 2 }}>{t("LIVE CHANNELS")}</div>
          <div style={{ flex: 1, height: 2, backgroundColor: "var(--border)" }} />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", textAlign: "center", marginTop: -6, lineHeight: 1.45 }}>
          {t("Sent to your verified channels. Registration required.")}
        </div>

        {[...realisticDrills].sort((a, b) => preferredChannels && preferredChannels.length < 3
          ? Number(preferredChannels.includes(b.id === "phone" ? "call" : b.id)) - Number(preferredChannels.includes(a.id === "phone" ? "call" : a.id))
          : 0).map((drill) => (
          <div key={drill.id} style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", borderLeft: `5px solid ${line(drill.color)}`, padding: 14 }}>
            <div className="flex items-start gap-3">
              <div style={{ width: 42, height: 42, flexShrink: 0, backgroundColor: "var(--background)", border: `2px solid ${line(drill.color)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {drill.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", letterSpacing: 1, marginBottom: 5 }}>{drill.eyebrow}{preferredChannels && preferredChannels.length < 3 && preferredChannels.includes(drill.id === "phone" ? "call" : drill.id) ? ` · ${t("YOUR CHOICE")}` : ""}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-label)", color: drill.color, lineHeight: 1.4 }}>{drill.title}</div>
              </div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", margin: "12px 0 13px", lineHeight: 1.5 }}>
              {drill.description}
            </div>
            <PixelButton onClick={drill.onClick} color={drill.color} textColor="var(--on-fill)" size="md" full>{drill.action}</PixelButton>
          </div>
        ))}

        <SafetyHabitsDropdown />

        <div style={{ height: 4 }} />
      </div>
    </div>
  );
}
