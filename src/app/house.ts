// House data for the app: API calls plus useHouse(), which keeps one copy of
// GET /api/house fresh. It refetches when the house's doorbell rings (a content-free
// Supabase Realtime broadcast), when the app regains focus, and every five minutes.
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiGet, apiPost, sessionToken } from "./api";

export type Avatar = { color: string; glow: string; hat: string; eyes: string; outfit: string };
export type WeekRun = { correct: number; cautious: number; wrong: number };
export type MemberView = {
  id: string; name: string; avatar: Avatar | null;
  level: number; xp: number; xpMax: number; streak: number;
  timesSafe: number; timesScammed: number; badgeCount: number; badgeTotal: number;
  recentDrillResult: "WON" | "LOST" | null;
  isOwner: boolean; activeThisWeek: boolean; safeThisWeek: boolean; weekRun: WeekRun | null;
};
export type HouseView = {
  id: string; name: string; ownerId: string;
  inviteCode: string | null; inviteExpiresAt: string | null;
  doorbell: string; members: MemberView[];
};
export type HouseState = { self: MemberView | null; house: HouseView | null };

export const createHouse = (name: string) => apiPost<HouseState>("/api/house", { name });
export const joinHouse = (code: string) => apiPost<HouseState>("/api/house/join", { code });
export const regenerateCode = () => apiPost<HouseState>("/api/house/code");
export const renameHouse = (name: string) => apiPost<HouseState>("/api/house/name", { name });
export const removeMember = (id: string) =>
  apiPost<HouseState>(`/api/house/members/${encodeURIComponent(id)}/remove`);
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

export function useHouse(enabled: boolean) {
  const [state, setState] = useState<HouseState>({ self: null, house: null });
  const [loading, setLoading] = useState(enabled);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionToken()) return;
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      const next = await apiGet<HouseState>("/api/house");
      if (next) setState(next);
      setLoading(false);
    })().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, []);

  useEffect(() => {
    if (!enabled) return;
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
  useEffect(() => {
    const client = realtimeClient();
    if (!enabled || !doorbell || !client) return;
    const channel = client
      .channel(doorbell)
      .on("broadcast", { event: "changed" }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [enabled, doorbell, refresh]);

  return { state, loading, refresh, apply: setState };
}
