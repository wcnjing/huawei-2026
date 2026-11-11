import type { HouseDrill } from "../../../services/houseDrill";
import { RACE_WIN_COINS } from "../../../data/economy";
import { useT } from "../../../i18n";

const MONO = "'Share Tech Mono', monospace";
// Gold, silver and bronze (darker shades in the light theme so they stay readable).
const PLACE_COLORS = ["var(--yellow)", "light-dark(#5b6b80, #c0d0e0)", "light-dark(#8a4b14, #e0a060)"];

export function formatRaceTime(ms: number) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Crown({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 8 6" aria-hidden="true" style={{ imageRendering: "pixelated", flexShrink: 0 }} shapeRendering="crispEdges">
      <rect x={0} y={1} width={1} height={4} fill="var(--yellow)" />
      <rect x={7} y={1} width={1} height={4} fill="var(--yellow)" />
      <rect x={3} y={0} width={2} height={5} fill="var(--yellow)" />
      <rect x={1} y={3} width={6} height={3} fill="var(--yellow)" />
      <rect x={3} y={4} width={2} height={1} fill="var(--red)" />
    </svg>
  );
}

/** The final standings of a house race, winner first with a crown. */
export function RaceResults({ drill, selfId }: { drill: HouseDrill; selfId: string }) {
  const t = useT();
  const nameOf = (id: string) => drill.players.find((p) => p.id === id)?.name ?? t("A HOUSEMATE");
  const ranking = drill.ranking ?? [];
  return (
    <div style={{ backgroundColor: "var(--card)", border: "4px solid var(--yellow-line)", boxShadow: "4px 4px 0 var(--yellow-line)", padding: "12px 14px", marginBottom: 14 }}>
      <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "var(--yellow)", marginBottom: 8 }}>{t("RACE RESULTS")}</div>
      {ranking.map((r, i) => {
        const winner = r.playerId === drill.winnerId;
        const self = r.playerId === selfId;
        return (
          <div key={r.playerId} className="flex items-center gap-3" style={{ padding: "8px 0", borderTop: i ? "1px solid var(--secondary)" : undefined }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: PLACE_COLORS[i] ?? "var(--muted-foreground)", width: 28 }}>#{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center gap-2" style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: self ? "var(--green)" : "var(--foreground)" }}>
                {winner && <Crown />}
                <span>{nameOf(r.playerId).toUpperCase()}{self ? ` (${t("YOU")})` : ""}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>
                {t("{correct}/{total} CORRECT", { correct: r.correct, total: drill.turns.length })}
                {" · "}
                {r.timeMs === null ? t("DID NOT FINISH") : formatRaceTime(r.timeMs)}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "var(--yellow)" }}>{t("{score} PTS", { score: r.score })}</div>
          </div>
        );
      })}
      {drill.winnerId === selfId && (
        <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "var(--green)", marginTop: 8 }}>
          {t("WINNER'S BONUS: +{coins} COINS", { coins: RACE_WIN_COINS })}
        </div>
      )}
    </div>
  );
}
