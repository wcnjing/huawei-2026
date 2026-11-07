import { useEffect, useState } from "react";
import { getResultContent } from "./getResultContent";
import { Stars } from "../../../components/layout";
import { PixelButton, PixelPanel, ScamReasonSection } from "../../../components/ui";
import { IconBulb, IconCoin, IconFlame, IconStar } from "../../../components/icons";
import { PixelMascot } from "../../../components/avatars";
import { useMemberMap } from "../../../hooks/useMembers";
import type { CallOutcome, DrillType, EmailOutcome, RealEmailScenario, SmsOutcome } from "../../../types/drills";
import { useT } from "../../../i18n";
import { realEmailDebriefFlags } from "../../../data/realEmailDebrief";
import { ink, tint } from "../../../utils/color";

export function ResultScreen({ win, drillType, smsOutcome, emailOutcome, callOutcome, realEmailScenario, profileName, activeMemberId, onPlayAgain, onGoHome, xpOverride }: { win: boolean; drillType: DrillType; smsOutcome: SmsOutcome | null; emailOutcome: EmailOutcome | null; callOutcome: CallOutcome | null; realEmailScenario?: RealEmailScenario | null; profileName: string; activeMemberId: string; onPlayAgain: () => void; onGoHome: () => void; xpOverride?: number | null }) {
  const t = useT();
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowDetails(true), 700); return () => clearTimeout(t); }, []);

  const { header, xp, feedback, flags } = getResultContent(t, win, drillType, smsOutcome, emailOutcome, callOutcome);
  // An AI-written email brings its own red flags (already in the app language); a
  // template email has a fixed set; anything else uses the generic flags.
  const lessonFlags = realEmailScenario?.flags?.length
    ? realEmailScenario.flags.map((name, i) => ({ id: `lesson-${i}`, name, explanation: realEmailScenario.advice ?? "" }))
    : null;
  const debriefFlags = lessonFlags ?? (realEmailScenario ? realEmailDebriefFlags(realEmailScenario.id) ?? flags : flags);
  const resultFeedback = drillType === "email" && realEmailScenario && emailOutcome
    ? emailOutcome === "reported"
      ? t("You reported the email from {sender}: {subject}.", { sender: realEmailScenario.sender, subject: realEmailScenario.subject })
      : t("You submitted details after opening the email from {sender}: {subject}.", { sender: realEmailScenario.sender, subject: realEmailScenario.subject })
    : feedback;
  const drillLabel = drillType === "call" ? t("CALL") : drillType === "sms" ? "SMS" : t("EMAIL");
  const member = useMemberMap()[activeMemberId];
  const resultName = drillType === "call" && callOutcome ? profileName : member?.name;
  const resultNameColor = drillType === "call" && callOutcome ? "var(--teal)" : member?.primaryColor && ink(member.primaryColor);
  // Missing a red flag is already the learning signal. Never take away a user's
  // furniture currency for being fooled during a training exercise.
  const coinReward = win
    ? (drillType === "call" ? 50 : drillType === "sms" ? 40 : 60)
    : (drillType === "call" ? -25 : drillType === "sms" ? -20 : -30);
  const displayedXp = xpOverride ?? xp;
  // Only show information recorded for this attempt; don't infer extra actions or
  // prescribe a generic next step when the result record doesn't contain that detail.
  const responseDetail = drillType === "call" && callOutcome
    ? ({
        hung_up: t("Hung up"),
        disengaged: t("Ended the call and verified independently"),
        caught_flag: t("Identified a red flag"),
        complied: t("Followed the caller's instruction"),
        shared_data: t("Shared sensitive information or payment details"),
        distress_offramp: t("Stopped the drill"),
        no_answer: t("Did not answer"),
        voicemail: t("Call reached voicemail"),
        unscored: t("Not scored"),
      } satisfies Record<CallOutcome, string>)[callOutcome]
    : drillType === "email" && emailOutcome
      ? ({
          reported: t("Reported the email"),
          "asked-family": t("Asked someone you trust"),
          "submitted-details": t("Entered details on the page"),
          "opened-attachment": t("Opened the attachment"),
          "cancelled-download": t("Cancelled the download"),
        } satisfies Record<EmailOutcome, string>)[emailOutcome]
      : null;

  return (
    <div style={{ position: "relative", height: "100%", overflowY: "auto", scrollbarWidth: "none" }}>
      <Stars />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "32px 20px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", letterSpacing: 2 }}>
            {win ? t("{type} DRILL — SUCCESS", { type: drillLabel }) : t("{type} DRILL — REVIEW", { type: drillLabel })}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: win ? 24 : 20, color: win ? "var(--green)" : "var(--red)", textShadow: win ? "4px 4px 0 color-mix(in srgb, var(--green) 40%, var(--background)), 0 0 calc(30px * var(--glow)) color-mix(in srgb, var(--green) 70%, transparent)" : "4px 4px 0 color-mix(in srgb, var(--red) 40%, var(--background)), 0 0 calc(30px * var(--glow)) color-mix(in srgb, var(--red) 70%, transparent)", textAlign: "center", lineHeight: 1.3 }}>
            {header}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-display)", color: win ? "var(--teal)" : "var(--orange)", textAlign: "center" }}>
            {win ? t("\"Great instinct!\"") : t("\"Let’s learn from this.\"")}
          </div>
          {resultName && resultNameColor && (
            <div style={{ marginTop: 4, padding: "4px 10px", border: `2px solid ${resultNameColor}`, backgroundColor: tint(resultNameColor, 7), display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{t("FOR:")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: resultNameColor }}>{resultName}</div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <PixelMascot size={96} animate />
          {win && (
            <div style={{ position: "absolute", top: -20, right: -20, animation: "spin 2s linear infinite" }}>
              <IconStar size={24} color="var(--yellow)" />
            </div>
          )}
        </div>
        {showDetails && (
          <div style={{ width: "100%" }}>
            <PixelPanel accent={win ? "var(--green)" : "var(--red)"} className="w-full">
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: win ? "var(--green)" : "var(--red)", marginBottom: 12, textAlign: "center" }}>
                {t("=== RESULTS ===")}
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("XP GAINED")}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: displayedXp >= 0 ? "var(--yellow)" : "var(--red)" }}>{displayedXp >= 0 ? "+" : ""}{displayedXp}</div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("COINS")}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconCoin size={12} color={coinReward >= 0 ? "var(--yellow)" : "var(--red)"} />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: coinReward >= 0 ? "var(--green)" : "var(--red)" }}>
                    {coinReward >= 0 ? `+${coinReward}` : coinReward}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("STREAK")}</div>
                <div className="flex items-center gap-2">
                  {win ? <IconFlame size={14} color="var(--orange)" /> : <IconBulb size={14} color="var(--yellow)" />}
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: win ? "var(--orange)" : "var(--red)" }}>
                    {win ? t("EXTENDED") : t("READY TO REBUILD")}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: win ? "var(--green)" : "var(--orange)", backgroundColor: win ? "color-mix(in srgb, var(--green-fill) 8%, transparent)" : "color-mix(in srgb, var(--red-fill) 8%, transparent)", border: `2px solid ${win ? "var(--green-line)" : "var(--red-line)"}`, padding: "8px 10px", lineHeight: 1.6 }}>
                {resultFeedback}
              </div>
            </PixelPanel>
          </div>
        )}
        {showDetails && drillType === "email" && realEmailScenario && (
          <div style={{ width: "100%", backgroundColor: "var(--card)", border: "2px solid var(--violet-line)", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--violet)", marginBottom: 5 }}>{t("EMAIL RECEIVED")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)" }}>{realEmailScenario.sender}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>{realEmailScenario.subject}</div>
          </div>
        )}
        {showDetails && responseDetail && (
          <div style={{ width: "100%", backgroundColor: "var(--card)", border: "2px solid var(--teal-line)", padding: "8px 10px", display: "flex", gap: 8, alignItems: "baseline" }}>
            <span style={{ flexShrink: 0, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)" }}>{t("YOUR ACTION")}</span>
            <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>{responseDetail}</span>
          </div>
        )}
        {showDetails && <ScamReasonSection flags={debriefFlags} />}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <PixelButton onClick={onPlayAgain} color={win ? "var(--green-fill)" : "var(--orange-fill)"} size="lg" full>{t("[ PLAY ANOTHER DRILL ]")}</PixelButton>
          <PixelButton onClick={onGoHome} color="var(--secondary)" textColor="var(--muted-foreground)" size="md" full>{t("BACK TO HOME")}</PixelButton>
        </div>
      </div>
    </div>
  );
}
