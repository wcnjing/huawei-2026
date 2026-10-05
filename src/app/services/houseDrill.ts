// The multi-device house drill: API calls plus useHouseDrill(), which keeps one copy of
// GET /api/house/drill fresh. It refetches when the house doorbell rings, on focus, and
// by polling — fast while this phone is in a live game, slower otherwise so invites
// still arrive when realtime is not configured.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiPost, handleApiAuth, sessionToken } from "./api";
import type { Avatar } from "./house";
import type { FamilyOutcome } from "../types/drills";

export type DrillPlayerStatus = "accepted" | "invited" | "declined" | "expired" | "left";
export type DrillPlayer = { id: string; name: string; avatar: Avatar | null; status: DrillPlayerStatus };
export type DrillTurn = { playerId: string; scenarioId: number };
export type DrillAnswer = {
  turn: number; playerId: string; scenarioId: number;
  action: string | null; outcome: FamilyOutcome | null; foundClues: number; skipped: boolean;
};
export type HouseDrill = {
  id: string; hostId: string | null;
  status: "lobby" | "playing" | "finished" | "cancelled";
  perPlayer: number;
  createdAt: string; updatedAt: string; inviteExpiresAt: string;
  startedAt: string | null; finishedAt: string | null;
  players: DrillPlayer[]; turns: DrillTurn[]; currentTurn: number;
  /** The current turn was answered; the game waits until everyone in `ready` continues. */
  revealing: boolean; ready: string[];
  answers: DrillAnswer[]; xp: Record<string, number> | null;
};
type DrillResponse = { drill: HouseDrill | null };

export const PER_PLAYER_OPTIONS = [2, 3, 4, 5] as const;
export const DEFAULT_PER_PLAYER = 3;

export const openHouseDrill = (perPlayer: number) =>
  apiPost<DrillResponse>("/api/house/drill", { perPlayer });
const drillPath = (id: string, action: string) => `/api/house/drill/${encodeURIComponent(id)}/${action}`;
export const respondToHouseDrill = (id: string, accept: boolean) =>
  apiPost<DrillResponse>(drillPath(id, "respond"), { accept });
export const startHouseDrill = (id: string, scenarioIds: number[]) =>
  apiPost<DrillResponse>(drillPath(id, "start"), { scenarioIds });
export const answerHouseDrill = (id: string, answer: { turn: number; action: string; outcome: FamilyOutcome; foundClues: number }) =>
  apiPost<DrillResponse>(drillPath(id, "answer"), answer);
/** Ready for the next turn. The host's `force` moves on without waiting for everyone. */
export const continueHouseDrill = (id: string, turn: number, force = false) =>
  apiPost<DrillResponse>(drillPath(id, "continue"), { turn, force });
export const skipHouseDrillTurn = (id: string, turn: number) =>
  apiPost<DrillResponse>(drillPath(id, "skip"), { turn });
export const leaveHouseDrill = (id: string) =>
  apiPost<DrillResponse>(drillPath(id, "leave"));

export function isLive(drill: HouseDrill | null): drill is HouseDrill {
  return !!drill && (drill.status === "lobby" || drill.status === "playing");
}

/** True while this player still has a part to play (or watch) in the game. */
export function isParticipant(drill: HouseDrill | null, selfId: string): boolean {
  const me = drill?.players.find((p) => p.id === selfId);
  return !!me && me.status === "accepted";
}

const ACTIVE_POLL_MS = 2000;
const IDLE_POLL_MS = 6000;

export function useHouseDrill({ enabled, houseId, selfId, changeRevision }: {
  enabled: boolean; houseId: string | null; selfId: string; changeRevision: number;
}) {
  const [drill, setDrill] = useState<HouseDrill | null>(null);
  const epoch = useRef(0);
  const inFlight = useRef(false);
  const active = enabled && !!houseId;

  const refresh = useCallback(async () => {
    const token = sessionToken();
    if (!active || !token || inFlight.current) return;
    inFlight.current = true;
    const requestEpoch = epoch.current;
    try {
      const response = await fetch("/api/house/drill", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      handleApiAuth(response);
      if (!response.ok) return;
      const next = (await response.json()) as DrillResponse;
      if (epoch.current === requestEpoch) setDrill(next.drill);
    } catch {
      // Offline: keep showing the last state; the next poll catches up.
    } finally {
      inFlight.current = false;
    }
  }, [active]);

  useEffect(() => {
    epoch.current += 1;
    setDrill(null);
    if (active) void refresh();
  }, [active, houseId, refresh]);

  useEffect(() => {
    if (active && changeRevision > 0) void refresh();
  }, [active, changeRevision, refresh]);

  const fast = isLive(drill) && (drill.status === "lobby" || isParticipant(drill, selfId));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, fast ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, fast, refresh]);

  /** Adopt the drill a write answered with, so the UI doesn't wait for the next poll. */
  const apply = useCallback((next: HouseDrill | null) => {
    epoch.current += 1;
    setDrill(next);
  }, []);

  return { drill, refresh, apply };
}
