import { useEffect, useRef, useState } from "react";
import type { FamilyOutcome } from "../../../types/drills";
import { IconShield } from "../../../components/icons";
import { PixelButton } from "../../../components/ui";
import { MemberChar, PixelMascot } from "../../../components/avatars";
import { useMemberMap, useMembers } from "../../../hooks/useMembers";
import { pickScenarios, scenarioById } from "../../../data/drillPool";
import { FAMILY_COINS } from "../../../data/familyData";
import { useT } from "../../../i18n";
import {
  DEFAULT_PER_PLAYER, PER_PLAYER_OPTIONS, answerHouseDrill, continueHouseDrill, leaveHouseDrill,
  openHouseDrill, respondToHouseDrill, skipHouseDrillTurn, startHouseDrill,
  type DrillPlayer, type HouseDrill,
} from "../../../services/houseDrill";
import type { ApiResult } from "../../../services/api";
import { CountPicker } from "./CountPicker";
import { FamilyRoundScreen } from "./FamilyRoundScreen";
import { FamilySummaryScreen } from "./FamilySummaryScreen";

const MONO = "'Share Tech Mono', monospace";
const OUTCOME_LABEL: Record<FamilyOutcome, [string, string]> = {
  correct: ["SAFE CHOICE!", "#00ff88"],
  cautious: ["CAUTIOUS — SMART", "#ffe66d"],
  wrong: ["LET'S REVIEW", "#ff6b35"],
};

type Send = { turn: number; action: string; outcome: FamilyOutcome; foundClues: number; state: "sending" | "failed" };

function Header({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
      <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#00ff88" }}>{title}</div>
      <div className="flex items-center gap-2">
        <IconShield size={14} color="#00ff88" />
        {right && <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#00ff88" }}>{right}</div>}
      </div>
    </div>
  );
}

function Panel({ children, color = "#2a3a5c" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ backgroundColor: "#111827", border: `3px solid ${color}`, padding: "12px 14px", marginBottom: 14 }}>{children}</div>;
}

function Caption({ children, color = "#4ecdc4" }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color, marginBottom: 8 }}>{children}</div>;
}

function Body({ children, color = "#e8f4f8", center = false }: { children: React.ReactNode; color?: string; center?: boolean }) {
  return <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color, lineHeight: 1.6, textAlign: center ? "center" : undefined }}>{children}</div>;
}

export function FamilyDrillScreen({ drill, selfId, inHouse, onApply, onRefresh, onRoundResult, onFinished, onExit, onIndividual, onSetUpHouse }: {
  drill: HouseDrill | null;
  selfId: string;
  inHouse: boolean;
  onApply: (drill: HouseDrill | null) => void;
  onRefresh: () => void;
  onRoundResult: (outcome: FamilyOutcome) => void;
  onFinished: (drill: HouseDrill) => void;
  onExit: () => void;
  onIndividual: () => void;
  onSetUpHouse: () => void;
}) {
  const t = useT();
  const members = useMembers();
  const memberMap = useMemberMap();
  const [perPlayer, setPerPlayer] = useState<number>(DEFAULT_PER_PLAYER);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [send, setSend] = useState<Send | null>(null);
  // The turn this phone tapped Continue on, so it reads as ready before the server answers.
  const [readyTurn, setReadyTurn] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(new Set<string>());

  const shown = drill && drill.id !== dismissedId ? drill : null;
  const me = shown?.players.find((p) => p.id === selfId) ?? null;
  const isHost = !!shown && shown.hostId === selfId;
  const nameOf = (id: string | null | undefined) =>
    shown?.players.find((p) => p.id === id)?.name ?? memberMap[id ?? ""]?.name ?? t("A HOUSEMATE");

  useEffect(() => {
    if (shown?.status !== "lobby") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [shown?.status]);

  useEffect(() => {
    if (shown?.status === "finished" && !notified.current.has(shown.id)) {
      notified.current.add(shown.id);
      onFinished(shown);
    }
  }, [shown, onFinished]);

  // A new game (or a game that ended without us) drops any leftover local turn state.
  useEffect(() => { setReviewing(null); setSend(null); setReadyTurn(null); setConfirmLeave(false); }, [shown?.id]);

  const run = async (request: () => Promise<ApiResult<{ drill: HouseDrill | null }>>) => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    const result = await request();
    setBusy(false);
    if (result.ok) onApply(result.data.drill);
    else {
      setError(result.data?.error ?? "Could not reach the server.");
      onRefresh();
    }
    return result.ok;
  };

  /** Mark this player ready for the next turn; the host's `force` moves everyone on. */
  const tapContinue = async (turn: number, force = false) => {
    if (!shown) return;
    if (!force) setReadyTurn(turn);
    const ok = await run(() => continueHouseDrill(shown.id, turn, force));
    if (!ok && !force) setReadyTurn(null);
  };

  const postAnswer = async (answer: Omit<Send, "state">) => {
    if (!shown) return;
    setSend({ ...answer, state: "sending" });
    const result = await answerHouseDrill(shown.id, answer);
    if (result.ok) {
      setSend(null);
      onApply(result.data.drill);
      return;
    }
    // The game moved on without this answer (skipped, or ended): nothing to retry.
    if (result.data?.code === "NOT_YOUR_TURN" || result.data?.code === "DRILL_OVER") {
      setSend(null);
      onRefresh();
      return;
    }
    setSend({ ...answer, state: "failed" });
  };

  const back = (
    <PixelButton onClick={onExit} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ BACK ]")}</PixelButton>
  );
  const errorLine = error && <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#ff2d55", marginBottom: 10, textAlign: "center" }}>{t(error)}</div>;

  // ── Not in a house ──────────────────────────────────────────────────────────
  if (!inHouse) {
    return (
      <div className="flex flex-col h-full">
        <Header title={t("HOUSE DRILL")} />
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          <Panel color="#ffe66d">
            <Caption color="#ffe66d">{t("NO HOUSE YET")}</Caption>
            <Body>{t("House drills are played with your family, each on their own phone. Create or join a house to invite them.")}</Body>
          </Panel>
          <div className="flex flex-col gap-3">
            <PixelButton onClick={onSetUpHouse} color="#00ff88" textColor="#0a0e1a" size="md" full>{t("[ SET UP A HOUSE ]")}</PixelButton>
            <PixelButton onClick={onIndividual} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>{t("[ TRY INDIVIDUAL DRILL ]")}</PixelButton>
            {back}
          </div>
        </div>
      </div>
    );
  }

  // ── My turn (or reviewing the answer I just gave) ───────────────────────────
  const turnToShow = reviewing ?? (shown?.status === "playing" && !shown.revealing && shown.turns[shown.currentTurn]?.playerId === selfId && me?.status === "accepted" ? shown.currentTurn : null);
  if (shown && turnToShow !== null && shown.turns[turnToShow]) {
    const scenario = scenarioById(shown.turns[turnToShow].scenarioId);
    if (scenario) {
      const note = send?.state === "sending" ? t("SENDING YOUR ANSWER…")
        : send?.state === "failed" ? t("ANSWER NOT SENT — TAP CONTINUE TO RETRY") : null;
      return (
        <FamilyRoundScreen
          key={`${shown.id}:${turnToShow}`}
          scenario={scenario}
          roundIndex={turnToShow}
          totalRounds={shown.turns.length}
          targetLabel={t("YOU")}
          prompt={t("WHAT SHOULD YOU DO?")}
          nextLabel={t("CONTINUE")}
          footerNote={note}
          onComplete={(action, foundClues, outcome) => {
            setReviewing(turnToShow);
            onRoundResult(outcome);
            void postAnswer({ turn: turnToShow, action, outcome, foundClues: foundClues.length });
          }}
          onNext={() => {
            if (send?.state === "failed") { void postAnswer(send); return; }
            if (send?.state === "sending") return;
            setReviewing(null);
            void tapContinue(turnToShow);
          }}
        />
      );
    }
  }

  // ── Finished ────────────────────────────────────────────────────────────────
  if (shown?.status === "finished" && me && (me.status === "accepted" || me.status === "left")) {
    const answered = shown.answers.filter((a) => !a.skipped && a.outcome);
    const players = shown.players
      .filter((p) => shown.turns.some((turn) => turn.playerId === p.id))
      .map((p) => {
        const mine = answered.filter((a) => a.playerId === p.id);
        return {
          id: p.id, name: p.name, isSelf: p.id === selfId,
          answered: mine.length, correct: mine.filter((a) => a.outcome === "correct").length,
          xp: shown.xp?.[p.id] ?? null,
        };
      });
    const coins = answered.filter((a) => a.playerId === selfId).reduce((sum, a) => sum + FAMILY_COINS[a.outcome!], 0);
    return (
      <FamilySummaryScreen
        mode="family"
        answers={answered.map((a) => ({ scenarioId: a.scenarioId, outcome: a.outcome!, foundClues: a.foundClues }))}
        total={answered.length}
        coins={coins}
        serverXp={shown.xp ? (shown.xp[selfId] ?? 0) : null}
        players={players}
        onPlayAgain={() => setDismissedId(shown.id)}
        onSwitchMode={onIndividual}
        onHome={onExit}
      />
    );
  }

  const leaveButton = shown && (
    <PixelButton onClick={() => setConfirmLeave(true)} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>
      {isHost ? t("[ END DRILL FOR EVERYONE ]") : t("[ LEAVE DRILL ]")}
    </PixelButton>
  );
  const leaveDialog = shown && confirmLeave && (
    <div role="dialog" aria-modal="true" style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ backgroundColor: "#111827", border: "4px solid #ff6b35", width: "100%", padding: 16 }}>
        <Body>{isHost ? t("End the drill for everyone? Answers so far still count.") : t("Leave the drill? Your remaining turns will be skipped.")}</Body>
        <div className="flex gap-3" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}><PixelButton onClick={() => { setConfirmLeave(false); void run(() => leaveHouseDrill(shown.id)); }} color="#ff6b35" size="sm" full>{isHost ? t("END") : t("LEAVE")}</PixelButton></div>
          <div style={{ flex: 1 }}><PixelButton onClick={() => setConfirmLeave(false)} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("STAY")}</PixelButton></div>
        </div>
      </div>
    </div>
  );

  // ── Playing: an answer is on screen, waiting for everyone to continue ───────
  if (shown?.status === "playing" && me?.status === "accepted" && shown.revealing) {
    const turn = shown.currentTurn;
    const current = shown.turns[turn];
    const answer = shown.answers.find((a) => a.turn === turn && !a.skipped && a.outcome);
    const scenario = current ? scenarioById(current.scenarioId) : null;
    const byMe = current?.playerId === selfId;
    const playing = shown.players.filter((p) => p.status === "accepted");
    const isReady = (id: string) => shown.ready.includes(id) || (id === selfId && readyTurn === turn);
    const waitingFor = playing.filter((p) => !isReady(p.id));
    const amReady = isReady(selfId);
    const [label, color] = answer?.outcome ? OUTCOME_LABEL[answer.outcome] : ["SKIPPED", "#6b8ba4"];
    const progress = Math.round(((turn + 1) / Math.max(shown.turns.length, 1)) * 100);
    return (
      <div className="flex flex-col h-full" style={{ position: "relative" }}>
        <Header title={t("HOUSE DRILL")} right={t("QUESTION {current}/{total}", { current: turn + 1, total: shown.turns.length })} />
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          <div style={{ height: 8, backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", marginBottom: 18 }}>
            <div style={{ height: "100%", width: `${progress}%`, backgroundColor: "#00ff88" }} />
          </div>
          <Panel color={color}>
            <Caption color="#9bb0c8">{byMe ? t("YOU ANSWERED") : t("{name} ANSWERED", { name: nameOf(current?.playerId).toUpperCase() })}</Caption>
            <div aria-live="polite" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color, lineHeight: 1.6, marginBottom: 8 }}>{t(label)}</div>
            {answer?.action && <Body>{t("CHOSE:")} <span style={{ color }}>{t(answer.action)}</span></Body>}
            {scenario && answer?.outcome !== "correct" && (
              <Body color="#9bb0c8">{t("CORRECT:")} <span style={{ color: "#00ff88" }}>{t(scenario.correctAction)}</span></Body>
            )}
          </Panel>
          {scenario && (
            <>
              <Panel>
                <Caption>{t("THE MESSAGE")}</Caption>
                <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8", marginBottom: 4 }}>{t(scenario.sender)}</div>
                <Body>{t(scenario.message)}</Body>
              </Panel>
              <Panel color="#4ecdc4">
                <Caption color="#ffe66d">{t("WHY?")}</Caption>
                <Body>{t(scenario.explanation)}</Body>
              </Panel>
            </>
          )}
          <Panel>
            <Caption>{t("WHO'S READY")}</Caption>
            {playing.map((p) => {
              const member = memberMap[p.id];
              const ready = isReady(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3" style={{ padding: "6px 0", borderTop: "1px solid #1a2340" }}>
                  {member ? <MemberChar member={member} size={32} /> : <PixelMascot size={32} />}
                  <div style={{ flex: 1, fontFamily: MONO, fontSize: "var(--text-body)", color: p.id === selfId ? "#00ff88" : "#e8f4f8" }}>{p.name.toUpperCase()}</div>
                  <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: ready ? "#00ff88" : "#ffe66d" }}>{ready ? `✓ ${t("READY")}` : t("WAITING…")}</div>
                </div>
              );
            })}
          </Panel>
          {errorLine}
          <div className="flex flex-col gap-3">
            {amReady ? (
              <Body color="#ffe66d" center>{t("Waiting for {names}…", { names: waitingFor.map((p) => p.name.toUpperCase()).join(", ") })}</Body>
            ) : (
              <>
                <Body color="#9bb0c8" center>{t("Talk it over together, then tap Continue.")}</Body>
                <PixelButton onClick={() => void tapContinue(turn)} disabled={busy} color="#00ff88" textColor="#0a0e1a" size="lg" full>{t("[ CONTINUE ]")}</PixelButton>
              </>
            )}
            {isHost && waitingFor.some((p) => p.id !== selfId) && (
              <PixelButton onClick={() => void tapContinue(turn, true)} disabled={busy} color="#ffe66d" textColor="#0a0e1a" size="sm" full>
                {t("[ MOVE ON WITHOUT THEM ]")}
              </PixelButton>
            )}
            {leaveButton}
          </div>
        </div>
        {leaveDialog}
      </div>
    );
  }

  // ── Playing, someone else's turn ────────────────────────────────────────────
  if (shown?.status === "playing" && me?.status === "accepted") {
    const current = shown.turns[shown.currentTurn];
    const currentName = nameOf(current?.playerId);
    const currentMember = memberMap[current?.playerId ?? ""];
    const nextMine = shown.turns.findIndex((turn, i) => i > shown.currentTurn && turn.playerId === selfId);
    const recent = [...shown.answers].reverse().slice(0, 5);
    const progress = Math.round((shown.currentTurn / Math.max(shown.turns.length, 1)) * 100);
    return (
      <div className="flex flex-col h-full" style={{ position: "relative" }}>
        <Header title={t("HOUSE DRILL")} right={t("QUESTION {current}/{total}", { current: shown.currentTurn + 1, total: shown.turns.length })} />
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          <div style={{ height: 8, backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", marginBottom: 18 }}>
            <div style={{ height: "100%", width: `${progress}%`, backgroundColor: "#00ff88" }} />
          </div>
          <div className="flex flex-col items-center" style={{ marginBottom: 18 }}>
            {currentMember ? <MemberChar member={currentMember} size={72} /> : <PixelMascot size={72} animate />}
            <div aria-live="polite" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "#ffe66d", marginTop: 12, textAlign: "center", lineHeight: 1.6 }}>
              {t("IT'S {name}'S TURN", { name: currentName.toUpperCase() })}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 8, textAlign: "center" }}>
              {nextMine === -1 ? t("YOU'VE HAD ALL YOUR TURNS") : nextMine === shown.currentTurn + 1 ? t("YOU'RE NEXT") : t("YOUR TURN IN {count}", { count: nextMine - shown.currentTurn })}
            </div>
          </div>
          {send?.state === "failed" && (
            <Panel color="#ff2d55">
              <Body color="#ff2d55">{t("Your last answer wasn't sent.")}</Body>
              <div style={{ marginTop: 8 }}><PixelButton onClick={() => void postAnswer(send)} color="#ff2d55" size="sm" full>{t("[ RETRY ]")}</PixelButton></div>
            </Panel>
          )}
          {recent.length > 0 && (
            <Panel>
              <Caption>{t("LATEST ANSWERS")}</Caption>
              {recent.map((a) => {
                const [label, color] = a.skipped || !a.outcome ? ["SKIPPED", "#6b8ba4"] : OUTCOME_LABEL[a.outcome];
                return (
                  <div key={a.turn} className="flex items-center justify-between" style={{ padding: "4px 0", borderTop: "1px solid #1a2340" }}>
                    <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: a.playerId === selfId ? "#00ff88" : "#e8f4f8" }}>{nameOf(a.playerId).toUpperCase()}</div>
                    <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color }}>{t(label)}</div>
                  </div>
                );
              })}
            </Panel>
          )}
          {errorLine}
          <div className="flex flex-col gap-3">
            {isHost && current && (
              <PixelButton onClick={() => run(() => skipHouseDrillTurn(shown.id, shown.currentTurn))} disabled={busy} color="#ffe66d" textColor="#0a0e1a" size="sm" full>
                {t("[ SKIP {name}'S TURN ]", { name: currentName.toUpperCase() })}
              </PixelButton>
            )}
            {leaveButton}
          </div>
        </div>
        {leaveDialog}
      </div>
    );
  }

  // ── Lobby ───────────────────────────────────────────────────────────────────
  if (shown?.status === "lobby" && me) {
    const accepted = shown.players.filter((p) => p.status === "accepted");
    const secondsLeft = Math.max(0, Math.ceil((new Date(shown.inviteExpiresAt).getTime() - now) / 1000));
    const statusText: Record<DrillPlayer["status"], [string, string]> = {
      accepted: ["READY", "#00ff88"], invited: ["INVITED…", "#ffe66d"], declined: ["NOT PLAYING", "#6b8ba4"],
      expired: ["NO REPLY", "#6b8ba4"], left: ["LEFT", "#6b8ba4"],
    };
    return (
      <div className="flex flex-col h-full">
        <Header title={t("HOUSE DRILL")} right={t("{count} READY", { count: accepted.length })} />
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          <Panel color="#00ff88">
            <Caption color="#00ff88">{t("{count} QUESTIONS EACH", { count: shown.perPlayer })} · {t("{count} TOTAL", { count: accepted.length * shown.perPlayer })}</Caption>
            <Body color="#9bb0c8">
              {secondsLeft > 0
                ? t("Invites close in {time}", { time: `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` })
                : t("Invites have closed")}
            </Body>
          </Panel>
          <Panel>
            <Caption>{t("PLAYERS")}</Caption>
            {shown.players.map((p) => {
              const member = memberMap[p.id];
              const [label, color] = statusText[p.status];
              return (
                <div key={p.id} className="flex items-center gap-3" style={{ padding: "6px 0", borderTop: "1px solid #1a2340" }}>
                  {member ? <MemberChar member={member} size={32} /> : <PixelMascot size={32} />}
                  <div style={{ flex: 1, fontFamily: MONO, fontSize: "var(--text-body)", color: p.id === selfId ? "#00ff88" : "#e8f4f8" }}>
                    {p.name.toUpperCase()}{p.id === shown.hostId ? ` · ${t("HOST")}` : ""}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color }}>{t(label)}</div>
                </div>
              );
            })}
          </Panel>
          {errorLine}
          <div className="flex flex-col gap-3">
            {isHost ? (
              <>
                <PixelButton
                  onClick={() => run(() => startHouseDrill(shown.id, pickScenarios(accepted.length * shown.perPlayer).map((s) => s.id)))}
                  disabled={busy}
                  color="#00ff88" textColor="#0a0e1a" size="lg" full
                >
                  {accepted.length > 1 ? t("[ START WITH {count} PLAYERS ]", { count: accepted.length }) : t("[ START ON MY OWN ]")}
                </PixelButton>
                <PixelButton onClick={() => run(() => leaveHouseDrill(shown.id))} disabled={busy} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ CANCEL DRILL ]")}</PixelButton>
              </>
            ) : me.status === "accepted" ? (
              <>
                <Body color="#ffe66d" center>{t("Waiting for {name} to start…", { name: nameOf(shown.hostId) })}</Body>
                <PixelButton onClick={() => run(() => leaveHouseDrill(shown.id))} disabled={busy} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ LEAVE DRILL ]")}</PixelButton>
              </>
            ) : me.status === "invited" ? (
              <>
                <PixelButton onClick={() => run(() => respondToHouseDrill(shown.id, true))} disabled={busy} color="#00ff88" textColor="#0a0e1a" size="lg" full>{t("[ JOIN ]")}</PixelButton>
                <PixelButton onClick={() => { void run(() => respondToHouseDrill(shown.id, false)); onExit(); }} disabled={busy} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ NOT NOW ]")}</PixelButton>
              </>
            ) : (
              <>
                <Body color="#9bb0c8" center>{t("You're not playing in this drill.")}</Body>
                {back}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── A game that ended without us, or was cancelled ──────────────────────────
  if (shown && (shown.status === "cancelled" || shown.status === "playing" || shown.status === "finished")) {
    return (
      <div className="flex flex-col h-full">
        <Header title={t("HOUSE DRILL")} />
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          <Panel>
            <Body>{shown.status === "cancelled" ? t("This house drill was cancelled.") : t("You're not playing in this drill.")}</Body>
          </Panel>
          <div className="flex flex-col gap-3">
            {shown.status === "cancelled" && (
              <PixelButton onClick={() => setDismissedId(shown.id)} color="#00ff88" textColor="#0a0e1a" size="md" full>{t("[ START A NEW DRILL ]")}</PixelButton>
            )}
            {back}
          </div>
        </div>
      </div>
    );
  }

  // ── Set up a new game ───────────────────────────────────────────────────────
  const others = members.filter((m) => m.id !== selfId);
  return (
    <div className="flex flex-col h-full">
      <Header title={t("HOUSE DRILL")} right={t("{count} IN HOUSE", { count: members.length })} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {members.slice(0, 6).map((m) => (
            <div key={m.id} className="flex flex-col items-center gap-1" style={{ flex: "0 1 96px", minWidth: 0, textAlign: "center" }}>
              <MemberChar member={m} size={40} />
              <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: m.id === selfId ? "#00ff88" : "#4ecdc4" }}>{m.name.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <Panel color="#00ff88">
          <Caption color="#00ff88">{t("QUESTIONS PER PERSON")}</Caption>
          <CountPicker options={PER_PLAYER_OPTIONS} value={perPlayer} onChange={setPerPlayer} label={t("QUESTIONS PER PERSON")} />
          <div style={{ marginTop: 10 }}>
            <Body color="#9bb0c8">{t("Up to {count} questions if everyone joins.", { count: members.length * perPlayer })}</Body>
          </div>
        </Panel>
        <Panel>
          <Caption>{t("HOW IT WORKS")}</Caption>
          {[
            "Everyone in your house gets an invite on their phone.",
            "Players take turns — your question appears on your screen.",
            "While others play, you'll see whose turn it is.",
            "After each answer, everyone sees it and taps Continue to move on together.",
            "Start whenever you're ready; only those who join will play.",
          ].map((line) => (
            <div key={line} className="flex items-start gap-2 mb-2">
              <div style={{ width: 6, height: 6, backgroundColor: "#00ff88", flexShrink: 0, marginTop: 6 }} />
              <Body>{t(line)}</Body>
            </div>
          ))}
        </Panel>
        {others.length === 0 && (
          <Panel color="#ffe66d">
            <Body color="#ffe66d">{t("You're the only one in your house. Share your house code so family can join.")}</Body>
          </Panel>
        )}
        {errorLine}
        <div className="flex flex-col gap-3">
          <PixelButton onClick={() => run(() => openHouseDrill(perPlayer))} disabled={busy || others.length === 0} color="#00ff88" textColor="#0a0e1a" size="lg" full>
            {t("[ INVITE MY HOUSE ]")}
          </PixelButton>
          {others.length === 0 && (
            <PixelButton onClick={onSetUpHouse} color="#ffe66d" textColor="#0a0e1a" size="sm" full>{t("[ INVITE FAMILY ]")}</PixelButton>
          )}
          <PixelButton onClick={onIndividual} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>{t("[ TRY INDIVIDUAL DRILL ]")}</PixelButton>
          {back}
        </div>
      </div>
    </div>
  );
}
