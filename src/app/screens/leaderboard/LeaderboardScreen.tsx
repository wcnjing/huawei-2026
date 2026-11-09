import { useT } from "../../i18n";
import { useState } from "react";
import { SAFETY_TIPS } from "../../data/safetyTips";
import { MemberChar, PixelMascot } from "../../components/avatars";
import { IconBulb, IconMedal, IconSkull, IconTrophy, IconWarning } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";
import { ink, tint, line } from "../../utils/color";
import { rankMembers, totalXp } from "../../utils/progress";

export function LeaderboardScreen({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<"fame" | "shame">("fame");
  return (
    <div data-tour="ranks-page" className="flex flex-col h-full">
      <div className="flex" style={{ borderBottom: "4px solid var(--border)" }}>
        <button onClick={() => setTab("fame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "fame" ? "color-mix(in srgb, var(--green) 18%, var(--background))" : "var(--background)", border: "none", borderBottom: tab === "fame" ? "4px solid var(--green-line)" : "4px solid transparent", cursor: "pointer" }}>
          <IconTrophy size={16} color={tab === "fame" ? "var(--green)" : "var(--border)"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: tab === "fame" ? "var(--green)" : "var(--border)" }}>{t("HALL OF FAME")}</div>
        </button>
        <div style={{ width: 4, backgroundColor: "var(--border)" }} />
        <button data-tour="ranks-shame" aria-pressed={tab === "shame"} onClick={() => setTab("shame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "shame" ? "color-mix(in srgb, var(--red) 8%, var(--background))" : "var(--background)", border: "none", borderBottom: tab === "shame" ? "4px solid var(--red-line)" : "4px solid transparent", cursor: "pointer" }}>
          <IconSkull size={16} color={tab === "shame" ? "var(--red)" : "var(--border)"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: tab === "shame" ? "var(--red)" : "var(--border)" }}>{t("HALL OF SHAME")}</div>
        </button>
      </div>
      {tab === "fame" ? <FameBoard onPlayWithOthers={onPlayWithOthers} /> : <ShameBoard onPlayWithOthers={onPlayWithOthers} />}
    </div>
  );
}

// A panel steering solo players toward a house — both boards end with it once there's
// no one else to compare against.
function PlayWithOthersPanel({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const t = useT();
  return (
    <div className="px-3 py-4 flex flex-col items-center gap-3" style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)" }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{t("PLAY WITH OTHERS TO COMPARE")}</div>
      <PixelButton onClick={onPlayWithOthers} color="var(--teal-fill)" textColor="var(--on-fill)" size="sm">{t("+ CREATE OR JOIN A HOUSE")}</PixelButton>
    </div>
  );
}

// Gold, silver and bronze row borders. Plain silver (#c0c0c0) is only 1.7:1 on a light card,
// so light uses darker silver and bronze (about 3:1 or more); dark keeps the originals.
const PODIUM_LINES = ["var(--yellow-line)", "light-dark(#7f8b9b, #c0c0c0)", "light-dark(#b06a2c, #cd7f32)"];

function FameBoard({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const t = useT();
  const members = useMembers();
  const board = rankMembers(members).map((m, i) => ({ rank: i + 1, member: m }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "color-mix(in srgb, var(--green-fill) 8%, transparent)", border: "3px solid var(--green-line)" }}>
        <PixelMascot size={28} />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--green)", marginBottom: 4 }}>{t("TRAINING PROGRESS")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", lineHeight: 1.5 }}>{t("Ranked by total XP earned from drills.")}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {board.map(({ rank, member: m }) => (
          <div key={m.id} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: "var(--card)", border: `3px solid ${rank <= 3 ? PODIUM_LINES[rank - 1] : "var(--border)"}`, boxShadow: rank <= 3 ? `3px 3px 0px ${PODIUM_LINES[rank - 1]}` : "none" }}>
            <div className="flex items-center justify-center" style={{ width: 28 }}>
              {rank <= 3 ? <IconMedal rank={rank} size={20} /> : <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>#{rank}</div>}
            </div>
            <MemberChar member={m} size={28} />
            <div className="flex-1">
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)" }}>{m.name}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 2 }}>{t("{wins} WINS · LVL {level}", { wins: m.timesSafe, level: m.level })}</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)" }}>{totalXp(m.level, m.xp).toLocaleString()} XP</div>
          </div>
        ))}
        {members.length < 2 && <PlayWithOthersPanel onPlayWithOthers={onPlayWithOthers} />}
      </div>
    </div>
  );
}

function ShameBoard({ onPlayWithOthers }: { onPlayWithOthers: () => void }) {
  const t = useT();
  const members = useMembers();
  const selfId = useSelfId();
  const board = [...members].filter((m) => !m.safeThisWeek).sort((a, b) => b.timesScammed - a.timesScammed);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 8%, transparent)", border: "3px solid var(--red-line)" }}>
        <IconWarning size={12} color="var(--red)" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>{t("SCAMMED THIS WEEK")}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {board.length === 0 && (
          <div className="py-8 text-center" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--green)" }}>
            {t("NOBODY SCAMMED THIS WEEK. KEEP IT THAT WAY.")}
          </div>
        )}
        {board.map((m, i) => {
          const isYou = m.id === selfId;
          const shameHues = ["red", "red", "red", "orange", "orange", "orange", "yellow", "yellow"];
          const hue = shameHues[i];
          // rowColor is for the count text and skull; rowLine (brighter in light) for the border.
          const rowColor = hue ? `var(--${hue})` : "var(--border)";
          const rowLine = hue ? `var(--${hue}-line)` : "var(--border)";
          return (
            <div key={m.id} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: isYou ? "color-mix(in srgb, var(--orange-fill) 8%, transparent)" : "var(--card)", border: `3px solid ${isYou ? "var(--orange-line)" : rowLine}`, boxShadow: i < 3 ? `3px 3px 0px ${rowLine}` : "none" }}>
              <div className="flex items-center justify-center" style={{ width: 28 }}>
                {i < 3 ? <IconSkull size={18} color={rowColor} /> : <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>#{i + 1}</div>}
              </div>
              <MemberChar member={m} size={28} />
              <div className="flex-1">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isYou ? "var(--orange)" : "var(--foreground)" }}>{isYou ? t("YOU") : m.name}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: rowColor }}>{m.timesScammed}x</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{t("SCAMMED")}</div>
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
  const t = useT();
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 8%, transparent)", border: "3px solid var(--orange-line)" }}>
        <IconBulb size={18} color="var(--yellow)" />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)", marginBottom: 4 }}>{t("SAFETY HABITS")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", lineHeight: 1.5 }}>{t("A missed drill is private. Use it to practise the next response—never to rank or shame someone.")}</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {SAFETY_TIPS.map((tip) => (
          <div key={tip.title} className="flex items-start gap-3 px-3 py-3" style={{ backgroundColor: "var(--card)", border: `3px solid ${line(tip.color)}` }}>
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: `${tint(tip.color, 9)}`, border: `2px solid ${line(tip.color)}`, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: ink(tip.color) }}>
              {tip.num}
            </div>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: ink(tip.color), marginBottom: 5 }}>{t(tip.title)}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.5 }}>{t(tip.text)}</div>
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
