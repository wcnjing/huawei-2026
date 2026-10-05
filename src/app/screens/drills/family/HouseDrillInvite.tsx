import { useEffect, useState } from "react";
import { PixelButton } from "../../../components/ui";
import { IconShield } from "../../../components/icons";
import { useT } from "../../../i18n";
import { respondToHouseDrill, type HouseDrill } from "../../../services/houseDrill";

const MONO = "'Share Tech Mono', monospace";

/**
 * Pops up anywhere in the app when a housemate opens a drill, and again when the game
 * starts or it becomes this player's turn while they're on another screen.
 */
export function HouseDrillInvite({ drill, selfId, suppressed, onApply, onOpen }: {
  drill: HouseDrill | null;
  selfId: string;
  suppressed: boolean;
  onApply: (drill: HouseDrill | null) => void;
  onOpen: () => void;
}) {
  const t = useT();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const me = drill?.players.find((p) => p.id === selfId);
  const hostName = drill?.players.find((p) => p.id === drill.hostId)?.name ?? t("A HOUSEMATE");
  const myTurn = drill?.status === "playing" && !drill.revealing && drill.turns[drill.currentTurn]?.playerId === selfId;
  const inviteOpen = drill?.status === "lobby" && me?.status === "invited"
    && new Date(drill.inviteExpiresAt).getTime() > now;
  const playingPrompt = drill?.status === "playing" && me?.status === "accepted";
  const key = !drill ? "" : inviteOpen ? `${drill.id}:invite` : myTurn ? `${drill.id}:turn:${drill.currentTurn}` : `${drill.id}:${drill.status}`;
  const visible = !suppressed && !!drill && (inviteOpen || playingPrompt) && !dismissed.has(key);

  useEffect(() => {
    if (!visible || !inviteOpen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visible, inviteOpen]);

  if (!visible || !drill) return null;
  const dismiss = () => setDismissed((prev) => new Set(prev).add(key));

  const respond = async (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await respondToHouseDrill(drill.id, accept);
    setBusy(false);
    if (!result.ok) {
      setError(result.data?.error ?? "Could not reach the server.");
      return;
    }
    onApply(result.data.drill);
    dismiss();
    if (accept) onOpen();
  };

  const secondsLeft = Math.max(0, Math.ceil((new Date(drill.inviteExpiresAt).getTime() - now) / 1000));
  const title = inviteOpen ? t("HOUSE DRILL INVITE") : myTurn ? t("IT'S YOUR TURN!") : t("HOUSE DRILL STARTED");
  const body = inviteOpen
    ? t("{name} wants to play a house drill — {count} questions each. Join in?", { name: hostName.toUpperCase(), count: drill.perPlayer })
    : myTurn ? t("Your question is waiting in the house drill.") : t("Your house drill is on. Head back to see whose turn it is.");

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="house-drill-invite-title" style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.78)" }}>
      <div style={{ width: "min(340px, 100%)", backgroundColor: "#0d1526", border: "4px solid #00ff88", boxShadow: "6px 6px 0 #006633", padding: "18px 16px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <IconShield size={16} color="#00ff88" />
          <div id="house-drill-invite-title" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "#00ff88", lineHeight: 1.5 }}>{title}</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, marginBottom: 8 }}>{body}</div>
        {inviteOpen && (
          <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 14 }}>
            {t("Invite closes in {time}", { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` })}
          </div>
        )}
        {error && <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#ff2d55", marginBottom: 10 }}>{t(error)}</div>}
        <div className="flex flex-col gap-3" style={{ marginTop: 6 }}>
          {inviteOpen ? (
            <>
              <PixelButton onClick={() => void respond(true)} disabled={busy} color="#00ff88" textColor="#0a0e1a" size="md" full>{t("[ JOIN ]")}</PixelButton>
              <PixelButton onClick={() => void respond(false)} disabled={busy} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ NOT NOW ]")}</PixelButton>
            </>
          ) : (
            <>
              <PixelButton onClick={() => { dismiss(); onOpen(); }} color="#00ff88" textColor="#0a0e1a" size="md" full>{t("[ GO TO DRILL ]")}</PixelButton>
              <PixelButton onClick={dismiss} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ LATER ]")}</PixelButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
