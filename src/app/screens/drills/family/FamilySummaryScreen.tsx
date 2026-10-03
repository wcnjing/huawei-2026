import type { FamilyOutcome } from "../../../types/drills";
import { scenarioById } from "../../../data/drillPool";
import { IconBadge } from "../../../components/icons";
import { PixelButton } from "../../../components/ui";
import { useT } from "../../../i18n";

export type SummaryAnswer = { scenarioId: number; outcome: FamilyOutcome; foundClues: number };
export type SummaryPlayer = { id: string; name: string; correct: number; answered: number; xp: number | null; isSelf: boolean };

export function FamilySummaryScreen({ mode, answers, total, coins, serverXp, players, onPlayAgain, onSwitchMode, onHome }: {
  mode: "solo" | "family";
  answers: SummaryAnswer[];
  total: number;
  coins: number;
  serverXp: number | null | "pending";
  players?: SummaryPlayer[];
  onPlayAgain: () => void; onSwitchMode: () => void; onHome: () => void;
}) {
  const t = useT();
  const correctCount = answers.filter((a) => a.outcome === "correct").length;
  const totalClues = answers.reduce((sum, a) => sum + (scenarioById(a.scenarioId)?.clues.length ?? 0), 0);
  const foundCluesCount = answers.reduce((sum, a) => sum + a.foundClues, 0);

  // Thresholds scale with the game length; at 6 questions they match the original 5/3/8/4.
  const n = Math.max(total, 1);
  const safeAt = Math.ceil((n * 5) / 6);
  const header = correctCount >= safeAt ? t("HOUSE SAFE!") : correctCount >= n / 2 ? t("GOOD TRAINING!") : t("MORE PRACTICE NEEDED!");
  const headerColor = correctCount >= safeAt ? "#00ff88" : correctCount >= n / 2 ? "#ffe66d" : "#ff2d55";
  const xpDisplay = serverXp === "pending" ? t("SAVING…") : serverXp === null ? t("NOT SAVED — CHECK YOUR CONNECTION") : serverXp > 0 ? `+${serverXp} XP` : t("XP ALREADY EARNED THIS WEEK");

  const badges = [
    { name: t("LINK INSPECTOR"), desc: t("Revealed hidden URLs"), earned: answers.some((a) => a.foundClues >= 2) },
    { name: t("HOUSE SHIELD"), desc: t("Protected all members"), earned: correctCount >= safeAt },
    { name: t("PHISH FINDER"), desc: t("Found {count}+ clues", { count: Math.ceil((n * 4) / 3) }), earned: foundCluesCount >= Math.ceil((n * 4) / 3) },
    { name: t("NO PANIC BONUS"), desc: t("Stayed calm under pressure"), earned: correctCount >= Math.ceil((n * 2) / 3) },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 52, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: headerColor }}>{header}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#111827", border: `4px solid ${headerColor}`, boxShadow: `4px 4px 0 ${headerColor}`, padding: "14px", marginBottom: 14 }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: mode === "family" ? t("HOUSE CORRECT") : t("CORRECT"), value: `${correctCount}/${total}`, color: "#00ff88" },
              { label: t("CLUES FOUND"), value: `${foundCluesCount}/${totalClues}`, color: "#4ecdc4" },
              { label: t("YOUR XP"), value: xpDisplay, color: "#ffe66d" },
              { label: t("COINS EARNED"), value: `+${coins}`, color: "#ffe66d" },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        {players && players.length > 0 && (
          <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "10px 12px", marginBottom: 14 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginBottom: 8 }}>{t("PLAYERS")}</div>
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between" style={{ padding: "5px 0", borderTop: "1px solid #1a2340" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: p.isSelf ? "#00ff88" : "#e8f4f8" }}>
                  {p.name.toUpperCase()}{p.isSelf ? ` (${t("YOU")})` : ""}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d" }}>
                  {t("{correct}/{total} CORRECT", { correct: p.correct, total: p.answered })}
                  {p.xp ? ` · +${p.xp} XP` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d", marginBottom: 8 }}>{t("BADGES")}</div>
        <div className="grid grid-cols-2 gap-2 mb-14">
          {badges.map((b) => (
            <div key={b.name} style={{ backgroundColor: b.earned ? "#111827" : "#0a0e1a", border: `2px solid ${b.earned ? "#ffe66d" : "#1a2340"}`, padding: "8px 10px", opacity: b.earned ? 1 : 0.4 }}>
              <IconBadge size={18} color={b.earned ? "#ffe66d" : "#2a3a5c"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: b.earned ? "#ffe66d" : "#2a3a5c", marginTop: 4, lineHeight: 1.5 }}>{b.name}</div>
              {!b.earned && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#1a2340", marginTop: 2 }}>{t("LOCKED")}</div>}
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginBottom: 8 }}>{t("TOP LESSONS")}</div>
          {["Always inspect the sender.", "Hover or long-press links before opening.", "Be careful with urgent messages.", "Never share passwords, OTPs, or card details.", "Ask someone you trust before acting on suspicious messages."].map((l, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 5, height: 5, backgroundColor: "#4ecdc4", flexShrink: 0, marginTop: 5 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>{t(l)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pb-4">
          <PixelButton onClick={onPlayAgain} color="#00ff88" textColor="#0a0e1a" size="lg" full>
            {mode === "family" ? t("[ PLAY HOUSE DRILL AGAIN ]") : t("[ PLAY AGAIN ]")}
          </PixelButton>
          <PixelButton onClick={onSwitchMode} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>
            {mode === "family" ? t("[ TRY INDIVIDUAL DRILL ]") : t("[ TRY HOUSE DRILL ]")}
          </PixelButton>
          <PixelButton onClick={onHome} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ BACK HOME ]")}</PixelButton>
        </div>
      </div>
    </div>
  );
}
