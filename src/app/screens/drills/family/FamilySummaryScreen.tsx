import type { FamilyOutcome } from "../../../types/drills";
import { FAMILY_SCENARIOS } from "../../../data/familyScenarios";
import { FAMILY_COINS, FAMILY_XP } from "../../../data/familyData";
import { IconBadge } from "../../../components/icons";
import { PixelButton } from "../../../components/ui";

export function FamilySummaryScreen({ answers, serverXp, onPlayAgain, onIndividual, onHome }: {
  answers: { scenarioId: number; action: string; outcome: FamilyOutcome; foundClues: number[] }[];
  serverXp: number | null | "pending";
  onPlayAgain: () => void; onIndividual: () => void; onHome: () => void;
}) {
  const correctCount = answers.filter((a) => a.outcome === "correct").length;
  const totalClues = FAMILY_SCENARIOS.reduce((sum, s) => sum + s.clues.length, 0);
  const foundCluesCount = answers.reduce((sum, a) => sum + a.foundClues.length, 0);
  const totalCoins = answers.reduce((sum, a) => sum + FAMILY_COINS[a.outcome], 0);

  const header = correctCount >= 5 ? "HOUSE SAFE!" : correctCount >= 3 ? "GOOD TRAINING!" : "MORE PRACTICE NEEDED!";
  const headerColor = correctCount >= 5 ? "#00ff88" : correctCount >= 3 ? "#ffe66d" : "#ff2d55";
  const xpDisplay = serverXp === "pending" ? "SAVING…" : serverXp === null ? "NOT SAVED — CHECK YOUR CONNECTION" : serverXp > 0 ? `+${serverXp} XP` : "XP ALREADY EARNED THIS WEEK";

  const badges = [
    { name: "LINK INSPECTOR", desc: "Revealed hidden URLs", earned: answers.some((a) => a.foundClues.length >= 2) },
    { name: "HOUSE SHIELD", desc: "Protected all members", earned: correctCount >= 5 },
    { name: "PHISH FINDER", desc: "Found 8+ clues", earned: foundCluesCount >= 8 },
    { name: "NO PANIC BONUS", desc: "Stayed calm under pressure", earned: correctCount >= 4 },
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
              { label: "CORRECT", value: `${correctCount}/6`, color: "#00ff88" },
              { label: "CLUES FOUND", value: `${foundCluesCount}/${totalClues}`, color: "#4ecdc4" },
              { label: "HOUSE XP", value: xpDisplay, color: "#ffe66d" },
              { label: "COINS EARNED", value: `${totalCoins >= 0 ? "+" : ""}${totalCoins}`, color: totalCoins >= 0 ? "#ffe66d" : "#ff2d55" },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d", marginBottom: 8 }}>BADGES</div>
        <div className="grid grid-cols-2 gap-2 mb-14">
          {badges.map((b) => (
            <div key={b.name} style={{ backgroundColor: b.earned ? "#111827" : "#0a0e1a", border: `2px solid ${b.earned ? "#ffe66d" : "#1a2340"}`, padding: "8px 10px", opacity: b.earned ? 1 : 0.4 }}>
              <IconBadge size={18} color={b.earned ? "#ffe66d" : "#2a3a5c"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: b.earned ? "#ffe66d" : "#2a3a5c", marginTop: 4, lineHeight: 1.5 }}>{b.name}</div>
              {!b.earned && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#1a2340", marginTop: 2 }}>LOCKED</div>}
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginBottom: 8 }}>TOP LESSONS</div>
          {["Always inspect the sender.", "Hover or long-press links before opening.", "Be careful with urgent messages.", "Never share passwords, OTPs, or card details.", "Ask someone you trust before acting on suspicious messages."].map((l, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 5, height: 5, backgroundColor: "#4ecdc4", flexShrink: 0, marginTop: 5 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pb-4">
          <PixelButton onClick={onPlayAgain} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ PLAY HOUSE DRILL AGAIN ]</PixelButton>
          <PixelButton onClick={onIndividual} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>[ TRY INDIVIDUAL DRILL ]</PixelButton>
          <PixelButton onClick={onHome} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK HOME ]</PixelButton>
        </div>
      </div>
    </div>
  );
}
