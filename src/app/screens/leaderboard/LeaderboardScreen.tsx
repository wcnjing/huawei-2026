import { useState } from "react";
import { SAFETY_TIPS } from "../../data/safetyTips";
import { MemberChar, PixelMascot } from "../../components/avatars";
import { IconBulb, IconMedal, IconSkull, IconTrophy, IconWarning } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";

export function LeaderboardScreen({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const [tab, setTab] = useState<"fame" | "shame">("fame");
  return (
    <div className="flex flex-col h-full">
      <div className="flex" style={{ borderBottom: "4px solid #2a3a5c" }}>
        <button onClick={() => setTab("fame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "fame" ? "#1a3a2a" : "#0a0e1a", border: "none", borderBottom: tab === "fame" ? "4px solid #00ff88" : "4px solid transparent", cursor: "pointer" }}>
          <IconTrophy size={16} color={tab === "fame" ? "#00ff88" : "#2a3a5c"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: tab === "fame" ? "#00ff88" : "#2a3a5c" }}>HALL OF FAME</div>
        </button>
        <div style={{ width: 4, backgroundColor: "#2a3a5c" }} />
        <button onClick={() => setTab("shame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "shame" ? "#1a0a10" : "#0a0e1a", border: "none", borderBottom: tab === "shame" ? "4px solid #ff2d55" : "4px solid transparent", cursor: "pointer" }}>
          <IconSkull size={16} color={tab === "shame" ? "#ff2d55" : "#2a3a5c"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: tab === "shame" ? "#ff2d55" : "#2a3a5c" }}>HALL OF SHAME</div>
        </button>
      </div>
      {tab === "fame" ? <FameBoard onPlayWithOthers={onPlayWithOthers} /> : <ShameBoard onPlayWithOthers={onPlayWithOthers} />}
    </div>
  );
}

// A panel steering solo players toward a house — both boards end with it once there's
// no one else to compare against.
function PlayWithOthersPanel({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  return (
    <div className="px-3 py-4 flex flex-col items-center gap-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c" }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>PLAY WITH OTHERS TO COMPARE</div>
      <PixelButton onClick={onPlayWithOthers} color="#4ecdc4" textColor="#0a0e1a" size="sm">+ CREATE OR JOIN A HOUSE</PixelButton>
    </div>
  );
}

function FameBoard({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const members = useMembers();
  const board = [...members].sort((a, b) => b.level - a.level || b.xp - a.xp).map((m, i) => ({ rank: i + 1, member: m }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "rgba(0,255,136,0.08)", border: "3px solid #00ff88" }}>
        <PixelMascot size={28} />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#00ff88", marginBottom: 4 }}>TRAINING PROGRESS</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#8da4b8", lineHeight: 1.5 }}>Ranks celebrate safe practice in your house.</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {board.map(({ rank, member: m }) => (
          <div key={m.id} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: "#111827", border: `3px solid ${rank <= 3 ? ["#ffe66d", "#c0c0c0", "#cd7f32"][rank - 1] : "#2a3a5c"}`, boxShadow: rank <= 3 ? `3px 3px 0px ${["#ffe66d", "#c0c0c0", "#cd7f32"][rank - 1]}` : "none" }}>
            <div className="flex items-center justify-center" style={{ width: 28 }}>
              {rank <= 3 ? <IconMedal rank={rank} size={20} /> : <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>#{rank}</div>}
            </div>
            <MemberChar member={m} size={28} />
            <div className="flex-1">
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#e8f4f8" }}>{m.name}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 2 }}>{m.timesSafe} WINS · LVL {m.level}</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4" }}>{m.xp} XP</div>
          </div>
        ))}
        {members.length < 2 && <PlayWithOthersPanel onPlayWithOthers={onPlayWithOthers} />}
      </div>
    </div>
  );
}

function ShameBoard({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const members = useMembers();
  const selfId = useSelfId();
  const board = [...members].filter((m) => !m.safeThisWeek).sort((a, b) => b.timesScammed - a.timesScammed);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "rgba(255,45,85,0.08)", border: "3px solid #ff2d55" }}>
        <IconWarning size={12} color="#ff2d55" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>SCAMMED THIS WEEK</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {board.length === 0 && (
          <div className="py-8 text-center" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#00ff88" }}>
            NOBODY SCAMMED THIS WEEK. KEEP IT THAT WAY.
          </div>
        )}
        {board.map((m, i) => {
          const isYou = m.id === selfId;
          const shameColors = ["#ff2d55", "#ff2d55", "#ff2d55", "#ff6b35", "#ff6b35", "#ff6b35", "#ffe66d", "#ffe66d"];
          const rowColor = shameColors[i] ?? "#2a3a5c";
          return (
            <div key={m.id} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: isYou ? "rgba(255,107,53,0.08)" : "#111827", border: `3px solid ${isYou ? "#ff6b35" : rowColor}`, boxShadow: i < 3 ? `3px 3px 0px ${rowColor}` : "none" }}>
              <div className="flex items-center justify-center" style={{ width: 28 }}>
                {i < 3 ? <IconSkull size={18} color={rowColor} /> : <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>#{i + 1}</div>}
              </div>
              <MemberChar member={m} size={28} />
              <div className="flex-1">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isYou ? "#ff6b35" : "#e8f4f8" }}>{isYou ? "YOU" : m.name}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: rowColor }}>{m.timesScammed}x</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>SCAMMED</div>
              </div>
            </div>
          );
        })}
        {members.length < 2 && <PlayWithOthersPanel onPlayWithOthers={onPlayWithOthers} />}
      </div>
    </div>
  );
}

function LearningBoard() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35" }}>
        <IconBulb size={18} color="#ffe66d" />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35", marginBottom: 4 }}>SAFETY HABITS</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#8da4b8", lineHeight: 1.5 }}>A missed drill is private. Use it to practise the next response—never to rank or shame someone.</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {SAFETY_TIPS.map((tip) => (
          <div key={tip.title} className="flex items-start gap-3 px-3 py-3" style={{ backgroundColor: "#111827", border: `3px solid ${tip.color}` }}>
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: `${tip.color}18`, border: `2px solid ${tip.color}`, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: tip.color }}>
              {tip.num}
            </div>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: tip.color, marginBottom: 5 }}>{tip.title}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", lineHeight: 1.5 }}>{tip.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TOUR: coach-marks over the real UI, narrated by the mascot
// ─────────────────────────────────────────────────────────────────────────
// Targets are found at runtime via data-tour attributes rather than refs threaded
// through components — this file is huge and actively edited by others, so a lookup
// by attribute keeps the footprint to one attribute per target.
