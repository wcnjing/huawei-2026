import { useEffect, useState } from "react";
import { getResultContent } from "./getResultContent";
import { Stars } from "../../../components/layout";
import { PixelButton, PixelPanel, ScamReasonSection } from "../../../components/ui";
import { IconBulb, IconCoin, IconFlame, IconStar } from "../../../components/icons";
import { PixelMascot } from "../../../components/avatars";
import { useMemberMap } from "../../../hooks/useMembers";
import type { CallOutcome, DrillType, EmailOutcome, SmsOutcome } from "../../../types/drills";

export function ResultScreen({ win, drillType, smsOutcome, emailOutcome, callOutcome, profileName, activeMemberId, onPlayAgain, onGoHome, xpOverride }: { win: boolean; drillType: DrillType; smsOutcome: SmsOutcome | null; emailOutcome: EmailOutcome | null; callOutcome: CallOutcome | null; profileName: string; activeMemberId: string; onPlayAgain: () => void; onGoHome: () => void; xpOverride?: number | null }) {
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowDetails(true), 700); return () => clearTimeout(t); }, []);

  const { header, xp, feedback, flags } = getResultContent(win, drillType, smsOutcome, emailOutcome, callOutcome);
  const drillLabel = drillType === "call" ? "CALL" : drillType === "sms" ? "SMS" : "EMAIL";
  const member = useMemberMap()[activeMemberId];
  const resultName = drillType === "call" && callOutcome ? profileName : member?.name;
  const resultNameColor = drillType === "call" && callOutcome ? "#4ecdc4" : member?.primaryColor;
  // Missing a red flag is already the learning signal. Never take away a user's
  // furniture currency for being fooled during a training exercise.
  const coinReward = win
    ? (drillType === "call" ? 50 : drillType === "sms" ? 40 : 60)
    : (drillType === "call" ? -25 : drillType === "sms" ? -20 : -30);
  const displayedXp = xpOverride ?? xp;

  return (
    <div style={{ position: "relative", height: "100%", overflowY: "auto", scrollbarWidth: "none" }}>
      <Stars />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "32px 20px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", letterSpacing: 2 }}>
            {drillLabel} DRILL — {win ? "SUCCESS" : "REVIEW"}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: win ? 24 : 20, color: win ? "#00ff88" : "#ff2d55", textShadow: win ? "4px 4px 0 #006633, 0 0 30px rgba(0,255,136,0.7)" : "4px 4px 0 #660011, 0 0 30px rgba(255,45,85,0.7)", textAlign: "center", lineHeight: 1.3 }}>
            {header}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-display)", color: win ? "#4ecdc4" : "#ff6b35", textAlign: "center" }}>
            {win ? '"Great instinct!"' : '"Let’s learn from this."'}
          </div>
          {resultName && resultNameColor && (
            <div style={{ marginTop: 4, padding: "4px 10px", border: `2px solid ${resultNameColor}`, backgroundColor: `${resultNameColor}11`, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>FOR:</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: resultNameColor }}>{resultName}</div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <PixelMascot size={96} animate />
          {win && (
            <div style={{ position: "absolute", top: -20, right: -20, animation: "spin 2s linear infinite" }}>
              <IconStar size={24} color="#ffe66d" />
            </div>
          )}
        </div>
        {showDetails && (
          <div style={{ width: "100%" }}>
            <PixelPanel accent={win ? "#00ff88" : "#ff2d55"} className="w-full">
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: win ? "#00ff88" : "#ff2d55", marginBottom: 12, textAlign: "center" }}>
                === RESULTS ===
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>XP GAINED</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: displayedXp >= 0 ? "#ffe66d" : "#ff2d55" }}>{displayedXp >= 0 ? "+" : ""}{displayedXp}</div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>COINS</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconCoin size={12} color={coinReward >= 0 ? "#ffe66d" : "#ff2d55"} />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: coinReward >= 0 ? "#00ff88" : "#ff2d55" }}>
                    {coinReward >= 0 ? `+${coinReward}` : coinReward}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>STREAK</div>
                <div className="flex items-center gap-2">
                  {win ? <IconFlame size={14} color="#ff6b35" /> : <IconBulb size={14} color="#ffe66d" />}
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: win ? "#ff6b35" : "#ff2d55" }}>
                    {win ? "EXTENDED" : "READY TO REBUILD"}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: win ? "#00ff88" : "#ff6b35", backgroundColor: win ? "rgba(0,255,136,0.08)" : "rgba(255,45,85,0.08)", border: `2px solid ${win ? "#00ff88" : "#ff2d55"}`, padding: "8px 10px", lineHeight: 1.6 }}>
                {feedback}
              </div>
            </PixelPanel>
          </div>
        )}
        {showDetails && <ScamReasonSection flags={flags} />}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <PixelButton onClick={onPlayAgain} color={win ? "#00ff88" : "#ff6b35"} size="lg" full>[ PLAY ANOTHER DRILL ]</PixelButton>
          <PixelButton onClick={onGoHome} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK TO HOME</PixelButton>
        </div>
      </div>
    </div>
  );
}
