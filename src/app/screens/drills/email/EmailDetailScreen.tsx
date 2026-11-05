import { useState } from "react";
import type { DrillFlag, Highlight } from "../../../types/drills";
import { FLAG_MAP } from "../../../data/scamFlags";
import { IconAttachment, IconWarning,  } from "../../../components/icons";
import { FlagTooltip, AnnotatedMessage, PixelButton } from "../../../components/ui";
import { useT } from "../../../i18n";

const EMAIL_BODY_LINES: { text: string; highlights?: Highlight[] }[] = [
  { text: "Dear Student," },
  { text: "" },
  { text: "Congratulations! You have been selected to receive a $300 Digital Safety Reward for completing your campus cyber awareness profile.", highlights: [{ phrase: "$300 Digital Safety Reward", flagId: "email_reward" }] },
  { text: "" },
  { text: "This reward is only available for the next 30 minutes.", highlights: [{ phrase: "only available for the next 30 minutes", flagId: "email_urgency" }] },
  { text: "" },
  { text: "To claim your reward, verify your student account using the secure link below.", highlights: [{ phrase: "verify your student account", flagId: "email_verify" }] },
  { text: "" },
  { text: "[ CLAIM REWARD NOW ]", highlights: [{ phrase: "[ CLAIM REWARD NOW ]", flagId: "email_button" }] },
  { text: "" },
  { text: "If the button does not work, open the attached Reward_Verification_Form.zip and follow the instructions.", highlights: [{ phrase: "Reward_Verification_Form.zip", flagId: "email_attachment" }] },
  { text: "" },
  { text: "Failure to verify today may result in your reward being reassigned.", highlights: [{ phrase: "Failure to verify today", flagId: "email_threat" }] },
  { text: "" },
  { text: "Campus Rewards Office" },
];

export function EmailDetailScreen({ onReport, onAskFamily, onClaimReward, onOpenAttachment, onBack }: { activeMemberId: string; onReport: () => void; onAskFamily: () => void; onClaimReward: () => void; onOpenAttachment: () => void; onBack: () => void }) {
  const t = useT();
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);
  const [foundFlags, setFoundFlags] = useState<Set<string>>(new Set());

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setFoundFlags((prev) => new Set([...prev, flagId]));
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4" style={{ backgroundColor: "var(--card)", borderBottom: "4px solid var(--border)", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{"<"}</div>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--violet)" }}>{t("Campus Rewards Office")}</div>
          <div className="flex items-center gap-1 mt-1">
            <IconWarning size={8} color="var(--orange)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)" }}>rewards-office@campus-secure.example</div>
          </div>
        </div>
        <div style={{ backgroundColor: "var(--orange-fill)", padding: "2px 6px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)", flexShrink: 0 }}>{t("IMPORTANT")}</div>
      </div>
      <div className="px-4 py-3" style={{ borderBottom: "2px solid var(--secondary)", backgroundColor: "var(--surface)" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)", lineHeight: 1.5, marginBottom: 6 }}>
          {t("IMPORTANT: Claim Your $300 Digital Safety Reward")}
        </div>
        <div className="flex items-center justify-between">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{t("Tap red text to inspect")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: foundFlags.size > 0 ? "var(--orange)" : "var(--muted-foreground)" }}>
            {t("RED FLAGS: {found}/{total}", { found: foundFlags.size, total: 6 })}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div style={{ height: "100%", overflowY: "auto", padding: "16px", scrollbarWidth: "none" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 2 }}>
            {EMAIL_BODY_LINES.map((line, i) => (
              <div key={i} style={{ minHeight: line.text === "" ? 8 : "auto" }}>
                {line.highlights?.length ? (
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                ) : (
                  t(line.text)
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4" style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--violet)", padding: "8px 10px", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleFlagTap("email_attachment"); }}>
            <IconAttachment size={14} color="var(--violet)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--violet)" }}>Reward_Verification_Form.zip</div>
            <IconWarning size={10} color="var(--red)" />
          </div>
          <div style={{ height: 120 }} />
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: "4px solid var(--border)", backgroundColor: "var(--background)", flexShrink: 0 }}>
        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <PixelButton onClick={onReport} color="var(--green-fill)" textColor="var(--on-fill)" size="sm" full>{t("REPORT PHISHING")}</PixelButton>
          </div>
          <div style={{ flex: 1 }}>
            <PixelButton onClick={onAskFamily} color="var(--yellow-fill)" textColor="var(--on-fill)" size="sm" full>{t("ASK SOMEONE YOU TRUST")}</PixelButton>
          </div>
        </div>
        <PixelButton onClick={onClaimReward} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full>{t("CLAIM REWARD")}</PixelButton>
        <PixelButton onClick={onOpenAttachment} color="var(--secondary)" textColor="var(--violet)" size="sm" full>{t("OPEN ATTACHMENT")}</PixelButton>
      </div>
    </div>
  );
}

