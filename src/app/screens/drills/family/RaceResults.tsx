import type { HouseDrill } from "../../../services/houseDrill";
import { RACE_WIN_COINS } from "../../../data/economy";
import { useT } from "../../../i18n";

const MONO = "'Share Tech Mono', monospace";
const PLACE_COLORS = ["#ffe66d", "#c0d0e0", "#e0a060"];

export function formatRaceTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Crown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 8 6" aria-hidden="true" style={{ imageRendering: "pixelated", flexShrink: 0 }} shapeRendering="crispEdges">
      <rect x={0} y={1} width={1} height={4} fill="#ffe66d" />
      <rect x={7} y={1} width={1} height={4} fill="#ffe66d" />
      <rect x={3} y={0} width={2} height={5} fill="#ffe66d" />
      <rect x={1} y={3} width={6} height={3} fill="#ffe66d" />
      <rect x={3} y={4} width={2} height={1} fill="#ff2d55" />
    </svg>
  );
}

/** The final standings of a house race, winner first with a crown. */
export function RaceResults({ drill, selfId }: { drill: HouseDrill; selfId: string }) {
  const t = useT();
  const nameOf = (id: string) => drill.players.find((p) => p.id === id)?.name ?? t("A HOUSEMATE");
  const ranking = drill.ranking ?? [];
  return (
    <div style={{ backgroundColor: "#111827", border: "4px solid #ffe66d", boxShadow: "4px 4px 0 #ffe66d", padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 8 }}>{t("RACE RESULTS")}</div>
      {ranking.map((r, i) => {
        const winner = r.playerId === drill.winnerId;
        const self = r.playerId === selfId;
        return (
          <div key={r.playerId} className="flex items-center gap-3" style={{ padding: "8px 0", borderTop: i ? "1px solid #1a2340" : undefined }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: PLACE_COLORS[i] ?? "#6b8ba4", width: 28 }}>#{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2" style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: self ? "#00ff88" : "#e8f4f8" }}>
                {winner && <Crown />}
                <span>{nameOf(r.playerId).toUpperCase()}{self ? ` (${t("YOU")})` : ""}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8" }}>
                {t("{correct}/{total} CORRECT", { correct: r.correct, total: drill.turns.length })}
                {" · "}
                {r.timeMs === null ? t("DID NOT FINISH") : formatRaceTime(r.timeMs)}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#ffe66d" }}>{t("{score} PTS", { score: r.score })}</div>
          </div>
        );
      })}
      {drill.winnerId === selfId && (
        <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#00ff88", marginTop: 8 }}>
          {t("WINNER'S BONUS: +{coins} COINS", { coins: RACE_WIN_COINS })}
        </div>
      )}
    </div>
  );
}
