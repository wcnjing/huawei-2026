import {
  IconChatBubble, IconPhone,
  IconRealEmail, IconShield, IconTelegram
} from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { SafetyHabitsDropdown } from "./SafetyHabitsDropdown";

export function DrillSelectScreen({
  onRealisticPhone, onRealisticSms, onTelegram, onRealisticEmail, onFamily,
}: {
  onRealisticPhone: () => void;
  onRealisticSms: () => void;
  onTelegram: () => void;
  onRealisticEmail: () => void;
  onFamily: () => void;
  onBack: () => void;
}) {
  const realisticDrills = [
    {
      id: "phone",
      title: "SCAM CALL",
      eyebrow: "PHONE · LIVE",
      description: "Receive a simulated scam call on your verified phone.",
      action: "SET UP CALL",
      color: "#c77dff",
      icon: <IconPhone size={24} color="#c77dff" />,
      onClick: onRealisticPhone,
    },
    {
      id: "sms",
      title: "SCAM TEXT",
      eyebrow: "SMS · LIVE",
      description: "Get a realistic scam text and practise spotting its red flags.",
      action: "SET UP SMS",
      color: "#4ecdc4",
      icon: <IconChatBubble size={24} color="#4ecdc4" />,
      onClick: onRealisticSms,
    },
    {
      id: "telegram",
      title: "TELEGRAM BOT",
      eyebrow: "CHAT · LIVE",
      description: "Practise safely in a guided conversation with our training bot.",
      action: "OPEN TELEGRAM",
      color: "#00d4ff",
      icon: <IconTelegram size={24} color="#00d4ff" />,
      onClick: onTelegram,
    },
    {
      id: "email",
      title: "PHISHING EMAIL",
      eyebrow: "EMAIL · LIVE",
      description: "Receive a simulated phishing message in your registered inbox.",
      action: "SET UP EMAIL",
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
            CHOOSE YOUR<br /><span style={{ color: "#00ff88" }}>TRAINING</span>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#8da4b8", lineHeight: 1.5 }}>
            Choose a House Drill or practise with Scam Call, Text, Telegram, or Phishing Email.
          </div>
        </div>

        <div data-tour="family-drill" style={{ backgroundColor: "#111b2e", border: "3px solid #00ff88", boxShadow: "4px 4px 0 #006633", padding: 16 }}>
          <div className="flex items-start gap-3">
            <div style={{ width: 44, height: 44, flexShrink: 0, backgroundColor: "rgba(0,255,136,0.1)", border: "2px solid #00ff88", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconShield size={24} color="#00ff88" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#72a58a", letterSpacing: 1, marginBottom: 5 }}>QUICK PLAY · 6 ROUNDS</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "#00ff88", lineHeight: 1.4 }}>HOUSE DRILL</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", margin: "13px 0 14px", lineHeight: 1.5 }}>
            Decide what is safe, uncover clues, and protect every member of the household.
          </div>
          <PixelButton onClick={onFamily} color="#00ff88" textColor="#0a0e1a" size="md" full>START HOUSE DRILL</PixelButton>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#8da4b8", letterSpacing: 2 }}>LIVE CHANNELS</div>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8", textAlign: "center", marginTop: -6, lineHeight: 1.45 }}>
          Sent to your verified channels. Registration required.
        </div>

        {realisticDrills.map((drill) => (
          <div key={drill.id} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", borderLeft: `5px solid ${drill.color}`, padding: 14 }}>
            <div className="flex items-start gap-3">
              <div style={{ width: 42, height: 42, flexShrink: 0, backgroundColor: "#0a0e1a", border: `2px solid ${drill.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {drill.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", letterSpacing: 1, marginBottom: 5 }}>{drill.eyebrow}</div>
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
