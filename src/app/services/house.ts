// House data for the app: API calls plus useHouse(), which keeps one copy of
// GET /api/house fresh. It refetches when the house's doorbell rings (a content-free
// Supabase Realtime broadcast), when the app regains focus, and every five minutes.
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiPost, handleApiAuth, sessionToken } from "./api";

export type Avatar = { color: string; glow: string; hat: string; eyes: string; outfit: string };
export type WeekRun = { correct: number; cautious: number; wrong: number };
export const FAMILY_ROLES = [
  "GRANDPA", "GRANDMA", "DAD", "MUM", "SON", "DAUGHTER", "BROTHER", "SISTER",
  "UNCLE", "AUNTIE", "COUSIN", "HUSBAND", "WIFE", "PARTNER", "GUARDIAN", "OTHER",
] as const;
export type FamilyRole = typeof FAMILY_ROLES[number];
/** One member's own placement in the family tree. Ids are other members of the house. */
export type FamilyGender = "male" | "female";
export type FamilyLink = {
  role: FamilyRole | null; gender: FamilyGender | null;
  parentIds: string[]; partnerId: string | null; childIds: string[];
};
export type MemberView = {
  id: string; name: string; avatar: Avatar | null;
  level: number; xp: number; xpMax: number; streak: number;
  timesSafe: number; timesScammed: number; badgeCount: number; badgeTotal: number;
  recentDrillResult: "WON" | "LOST" | null;
  isOwner: boolean; activeThisWeek: boolean; safeThisWeek: boolean; weekRun: WeekRun | null;
  /** Null when solo, or when this member hasn't placed themself yet. */
  family?: FamilyLink | null;
};
export type HouseView = {
  id: string; name: string; ownerId: string;
  inviteCode: string | null; inviteExpiresAt: string | null;
  doorbell: string; members: MemberView[];
};
// `self` is undefined, not null, if a server ever answers with a house the caller is
// not in — so every guard on it must be a truthiness check, never `!== null`.
export type HouseState = { self: MemberView | null | undefined; house: HouseView | null };

export const createHouse = (name: string) => apiPost<HouseState>("/api/house", { name });
export const joinHouse = (code: string) => apiPost<HouseState>("/api/house/join", { code });
export const regenerateCode = () => apiPost<HouseState>("/api/house/code");
export const renameHouse = (name: string) => apiPost<HouseState>("/api/house/name", { name });
export const removeMember = (id: string) =>
  apiPost<HouseState>(`/api/house/members/${encodeURIComponent(id)}/remove`);
export const setFamilyLink = (family: FamilyLink) => apiPost<HouseState>("/api/house/family", { family });
export const leaveHouse = () => apiPost<HouseState>("/api/house/leave");
export const saveAvatar = (avatar: Avatar) => apiPost<{ user: unknown }>("/api/me/avatar", { avatar });
export const postHouseRun = (run: { clientKey: string } & WeekRun) =>
  apiPost<{ status: string; run: { xpGained: number } }>("/api/drills/house-run", run);

/** Upper-case, drop anything outside the code alphabet, and add the dash: "k7p3q" → "K7P-3Q". */
export function formatCodeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "").slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

// Invite links look like /?house=K7P3QX. The code waits in storage through sign-up
// and pre-fills the join box; nothing joins until the player taps JOIN.
const INVITE_KEY = "safespace_pending_invite";
export function captureInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("house");
    if (!code) return;
    localStorage.setItem(INVITE_KEY, formatCodeInput(code));
    url.searchParams.delete("house");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch { /* storage blocked: the player can type the code */ }
}
export function peekPendingInvite(): string | null {
  try { return localStorage.getItem(INVITE_KEY); } catch { return null; }
}
export function takePendingInvite(): string | null {
  const code = peekPendingInvite();
  try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
  return code;
}

let realtime: SupabaseClient | null | undefined;
function realtimeClient(): SupabaseClient | null {
  if (realtime !== undefined) return realtime;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  realtime = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return realtime;
}

const BACKUP_REFRESH_MS = 5 * 60 * 1000;

const EMPTY_HOUSE_STATE: HouseState = { self: null, house: null };

export function useHouse(enabled: boolean, sessionIdentity = "") {
  const [ownedState, setOwnedState] = useState<{ identity: string; state: HouseState }>(() => ({
    identity: sessionIdentity,
    state: EMPTY_HOUSE_STATE,
  }));
  const [loading, setLoading] = useState(enabled);
  const epoch = useRef(0);
  const currentIdentity = useRef(sessionIdentity);
  currentIdentity.current = sessionIdentity;
  const inFlight = useRef<{ identity: string; promise: Promise<void>; controller: AbortController } | null>(null);
  const state = ownedState.identity === sessionIdentity ? ownedState.state : EMPTY_HOUSE_STATE;

  const refresh = useCallback(async () => {
    const token = sessionToken();
    if (!enabled || !token) { setLoading(false); return; }
    if (inFlight.current?.identity === sessionIdentity) return inFlight.current.promise;
    const requestEpoch = epoch.current;
    const controller = new AbortController();
    const current = {
      identity: sessionIdentity,
      controller,
      promise: (async () => {
        try {
          const response = await fetch("/api/house", {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
            signal: controller.signal,
          });
          if (sessionToken() === token) handleApiAuth(response);
          if (!response.ok) return;
          const next = await response.json() as HouseState;
          if (epoch.current === requestEpoch && sessionToken() === token) {
            setOwnedState({ identity: sessionIdentity, state: next });
          }
        } catch (error) {
          if (!(error instanceof Error && error.name === "AbortError")) return;
        } finally {
          if (epoch.current === requestEpoch) setLoading(false);
        }
      })(),
    };
    inFlight.current = current;
    void current.promise.finally(() => {
      if (inFlight.current === current) inFlight.current = null;
    });
    return current.promise;
  }, [enabled, sessionIdentity]);

  useEffect(() => {
    epoch.current += 1;
    inFlight.current?.controller.abort();
    inFlight.current = null;
    setOwnedState({ identity: sessionIdentity, state: EMPTY_HOUSE_STATE });
    setLoading(enabled);
  }, [enabled, sessionIdentity]);

  // Runs once per false→true transition of `enabled` (a stable `refresh` identity keeps this
  // effect from re-firing on every focus/interval refresh). Sign-in flips `enabled` on a
  // mounted App.tsx without remounting this hook, so `loading`'s initial value alone can't
  // reflect that — set it explicitly here before the fetch lands.
  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void refresh(), BACKUP_REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  const doorbell = state.house?.doorbell ?? null;
  const [changeRevision, setChangeRevision] = useState(0);
  useEffect(() => {
    const client = realtimeClient();
    if (!enabled || !doorbell || !client) return;
    let current = true;
    const notify = () => {
      if (!current) return;
      setChangeRevision(value => value + 1);
      void refresh();
    };
    const channel = client
      .channel(doorbell)
      .on("broadcast", { event: "changed" }, notify)
      .subscribe(status => { if (status === "SUBSCRIBED") notify(); });
    return () => {
      current = false;
      void client.removeChannel(channel);
    };
  }, [enabled, doorbell, refresh]);

  const apply = useCallback((next: HouseState, targetIdentity = sessionIdentity) => {
    if (currentIdentity.current !== targetIdentity) return false;
    setOwnedState({ identity: targetIdentity, state: next });
    return true;
  }, [sessionIdentity]);

  return { state, loading, changeRevision, refresh, apply };
}
