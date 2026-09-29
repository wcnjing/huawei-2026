import { useState, useMemo, useEffect } from "react";
import type { FamilyScenario, FamilyClue, FamilyOutcome } from "../../../types/drills";
import { familyOutcome } from "./familyOutcome";
import { InspectableLink, PixelButton, ClueTooltip, SenderInspectPanel } from "../../../components/ui";
import { PixelMascot } from "../../../components/avatars";
import { IconBulb, IconCoin } from "../../../components/icons";
import { SmsMockCard } from "./SmsMockCard";
import { FAMILY_COINS, FAMILY_XP } from "../../../data/familyData";
import { useT } from "../../../i18n";

export function FamilyRoundScreen({ scenario, roundIndex, totalRounds, onComplete, onNext, onEnd, targetLabel, nextLabel, prompt, footerNote }: {
  scenario: FamilyScenario; roundIndex: number; totalRounds: number;
  onComplete: (action: string, foundClues: number[], outcome: FamilyOutcome) => void;
  onNext: () => void; onEnd?: () => void;
  targetLabel?: string; nextLabel?: string; prompt?: string; footerNote?: string | null;
}) {
  const t = useT();
  const [mode, setMode] = useState<"play" | "debrief">("play");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [lightbulbIdx, setLightbulbIdx] = useState(-1);
  const [activeClue, setActiveClue] = useState<FamilyClue | null>(null);
  const [showSenderPanel, setShowSenderPanel] = useState(false);
  const [foundCluesLocal, setFoundCluesLocal] = useState<number[]>([]);

  // The correct answer used to be authored first in every scenario's `actions`, so it
  // always landed top-left — players learned "just tap the first button". Shuffle the
  // display order per scenario (outcome is matched by label, not index, so this is safe).
  const displayActions = useMemo(() => {
    const a = [...scenario.actions];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [scenario.id]);

  useEffect(() => {
    setMode("play");
    setSelectedAction(null);
    setLightbulbIdx(-1);
    setActiveClue(null);
    setShowSenderPanel(false);
    setFoundCluesLocal([]);
  }, [scenario.id]);

  const color = "#4ecdc4";
  const typeLabels: Record<string, string> = { sms: "SMS", email: t("EMAIL"), notification: t("NOTIF") };

  const handleAction = (action: string) => {
    if (mode !== "play") return;
    setSelectedAction(action);
    setMode("debrief");
    onComplete(action, foundCluesLocal, familyOutcome(scenario, action));
  };

  const handleLightbulb = () => {
    const nextIdx = lightbulbIdx + 1;
    if (nextIdx < scenario.clues.length) {
      setLightbulbIdx(nextIdx);
      setFoundCluesLocal((prev) => (prev.includes(nextIdx) ? prev : [...prev, nextIdx]));
      setActiveClue(scenario.clues[nextIdx]);
    }
  };

  const inDebrief = mode === "debrief";
  const outcome = familyOutcome(scenario, selectedAction);

  const EmailCard = () => (
    <div style={{ border: `4px solid ${color}`, boxShadow: `4px 4px 0 ${color}` }}>
      <div style={{ backgroundColor: "#e8e8e8", borderBottom: "2px solid #ccc", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, backgroundColor: "#ff5f57", borderRadius: "50%" }} />
        <div style={{ width: 8, height: 8, backgroundColor: "#febc2e", borderRadius: "50%" }} />
        <div style={{ width: 8, height: 8, backgroundColor: "#28c840", borderRadius: "50%" }} />
        <div style={{ fontFamily: "monospace", fontSize: "var(--text-body)", color: "#555", marginLeft: 6 }}>{typeLabels[scenario.type]}</div>
      </div>
      <button onClick={() => setShowSenderPanel(true)} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#f9f9f9", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 32, height: 32, backgroundColor: scenario.isScam ? "#f4a261" : "#4ecdc4", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", flexShrink: 0 }}>
          <span style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: "bold", color: "#fff" }}>{t(scenario.sender)[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: 600, color: "#1a1a1a" }}>
            {t(scenario.sender)}
            {scenario.senderEmail && <span style={{ fontWeight: 400, color: "#888", fontSize: "var(--text-body)" }}> &lt;{scenario.senderEmail}&gt;</span>}
          </div>
          {scenario.subject && <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#555", fontWeight: 600, marginTop: 1 }}>{t(scenario.subject)}</div>}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", border: "1px solid #4ecdc4", padding: "2px 4px", flexShrink: 0 }}>{t("INSPECT")}</div>
      </button>
      <div style={{ padding: "12px 14px", backgroundColor: "#fff" }}>
        <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#1a1a1a", lineHeight: 1.6, marginBottom: 8 }}>{t(scenario.message)}</div>
        {scenario.invoiceDetails && (
          <div style={{ margin: "10px 0", backgroundColor: "#f8f8f8", border: "1px solid #ddd", padding: "12px" }}>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: 700, color: "#333", marginBottom: 8 }}>{t("Invoice details")}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#888", marginBottom: 2 }}>{t("Amount requested")}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: 700, color: "#333", marginBottom: 8 }}>{scenario.invoiceDetails.amount}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#888", marginBottom: 4 }}>{t("Note from seller")}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#c0392b", lineHeight: 1.5 }}>{t(scenario.invoiceDetails.noteFromSeller)}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#888", marginTop: 8 }}>{t("Invoice number")}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#333" }}>{scenario.invoiceDetails.invoiceNumber}</div>
          </div>
        )}
        {scenario.id === 6 && (
          <div style={{ margin: "10px 0", border: "1px solid #e0e0e0", backgroundColor: "#f9f9f9", padding: "10px" }}>
            <div className="flex items-center gap-2 mb-2">
              <div style={{ width: 18, height: 18, backgroundColor: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: "var(--text-body)", fontWeight: "bold" }}>D</span>
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: 600, color: "#333" }}>{t("2026 Department Budget")}</div>
            </div>
            <div style={{ height: 40, backgroundColor: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <span style={{ color: "#4285f4", fontSize: "var(--text-title)", fontWeight: "bold" }}>≡</span>
            </div>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#888" }}>{t("{name} is the owner · Last edited 1 hour ago", { name: "Luke Johnson" })}</div>
          </div>
        )}
        {scenario.buttonLabel && scenario.buttonUrl && (
          <div style={{ marginTop: 12 }}>
            <InspectableLink label={t(scenario.buttonLabel)} url={scenario.buttonUrl} showWarning={inDebrief} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ position: "relative", background: inDebrief ? (outcome === "wrong" ? "linear-gradient(180deg,#1a0a0f,#0a0e1a)" : "linear-gradient(180deg,#0a1a0f,#0a0e1a)") : undefined }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 48, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{t("ROUND {current}/{total}", { current: roundIndex + 1, total: totalRounds })}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d" }}>
          {inDebrief ? t("DEBRIEF") : t("{found}/{total} CLUES", { found: foundCluesLocal.length, total: scenario.clues.length })}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2" style={{ backgroundColor: "#111827", borderBottom: `4px solid ${color}`, flexShrink: 0 }}>
        <PixelMascot size={36} animate />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{t("TARGET:")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color }}>{targetLabel ?? t("A HOUSEMATE")}</div>
        </div>
        <div style={{ marginLeft: "auto", backgroundColor: "rgba(255,107,53,0.1)", border: `2px solid ${color}`, padding: "3px 7px" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color }}>{typeLabels[scenario.type] ?? t("MSG")}</div>
        </div>
      </div>
      {inDebrief && (() => {
        // Three states, so "ask family first" reads as cautious rather than scammed.
        const banner = {
          correct:  { title: t("SAFE CHOICE!"), color: "#00ff88", bg: "rgba(0,255,136,0.15)" },
          cautious: { title: t("CAUTIOUS — SMART"), color: "#ffe66d", bg: "rgba(255,230,109,0.15)" },
          wrong:    { title: t("LET'S REVIEW"), color: "#ff6b35", bg: "rgba(255,107,53,0.15)" },
        }[outcome];
        const coins = FAMILY_COINS[outcome];
        return (
        <div style={{ backgroundColor: banner.bg, borderBottom: `4px solid ${banner.color}`, padding: "10px 16px", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: banner.color, marginBottom: 4 }}>
            {banner.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d" }}>+{FAMILY_XP[outcome]} XP</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IconCoin size={9} color={coins > 0 ? "#ffe66d" : "#4ecdc4"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: coins > 0 ? "#00ff88" : "#4ecdc4" }}>{coins > 0 ? `+${coins}` : t("NO LOSS")}</div>
            </div>
            {outcome === "cautious" && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>
                {t("EVEN SAFER:")} <span style={{ color: "#00ff88" }}>{t(scenario.correctAction)}</span>
              </div>
            )}
            {outcome === "wrong" && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>
                {t("CORRECT:")} <span style={{ color: "#00ff88" }}>{t(scenario.correctAction)}</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
        {scenario.type === "sms"
          ? <SmsMockCard scenario={scenario} showWarning={inDebrief} onSenderTap={() => setShowSenderPanel(true)} />
          : <EmailCard />
        }
        {inDebrief && (
          <>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginTop: 14, marginBottom: 8 }}>
              {t("TAP CLUES TO EXPLORE")}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 }}>
              {scenario.clues.map((clue, i) => (
                <button key={i} onClick={() => setActiveClue(clue)} style={{ backgroundColor: "rgba(255,107,53,0.15)", border: "3px solid #ff6b35", padding: "7px 13px", cursor: "pointer" }}>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35" }}>{t(clue.label)}</div>
                </button>
              ))}
            </div>
            <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <IconBulb size={12} color="#ffe66d" />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d" }}>{t("WHY?")}</div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6 }}>{t(scenario.explanation)}</div>
            </div>
          </>
        )}
      </div>
      {!inDebrief ? (
        <div className="px-3 py-3" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={handleLightbulb}
              disabled={lightbulbIdx >= scenario.clues.length - 1}
              style={{ background: "none", border: `2px solid ${lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d"}`, cursor: lightbulbIdx >= scenario.clues.length - 1 ? "default" : "pointer", padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}
            >
              <IconBulb size={12} color={lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d" }}>
                {lightbulbIdx + 1 < scenario.clues.length ? t("HINT ({count})", { count: scenario.clues.length - lightbulbIdx - 1 }) : t("HINT")}
              </div>
            </button>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 6, textAlign: "center" }}>{prompt ?? t("WHAT SHOULD THE HOUSE DO?")}</div>
          <div className="grid grid-cols-2 gap-2">
            {displayActions.map((action) => (
              <button key={action} onClick={() => handleAction(action)} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "8px 6px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#e8f4f8", textAlign: "center", lineHeight: 1.5 }}>
                {t(action)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding: "12px", borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", flexShrink: 0 }}>
          {footerNote && (
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", textAlign: "center", marginBottom: 8 }}>{footerNote}</div>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><PixelButton onClick={onNext} color="#00ff88" textColor="#0a0e1a" size="sm" full>{nextLabel ?? t("NEXT MEMBER")}</PixelButton></div>
            {onEnd && <div style={{ flex: 1 }}><PixelButton onClick={onEnd} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("END DRILL")}</PixelButton></div>}
          </div>
        </div>
      )}
      {showSenderPanel && (
        <SenderInspectPanel scenario={scenario} onClose={() => setShowSenderPanel(false)} showWarning={inDebrief} />
      )}
      {activeClue && <ClueTooltip clue={activeClue} onClose={() => setActiveClue(null)} />}
    </div>
  );
}
