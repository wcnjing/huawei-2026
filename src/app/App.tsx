import { useState, useEffect, useRef } from "react";

// ─── Backend API helpers ──────────────────────────────────────────────────
// These keep the richer Figma UI connected to the existing demo backend, while
// still allowing the prototype to run with mock data when the backend is down.
// Session token issued by the server after phone verification. The server derives WHO
// we are from this token — the client never asserts a user id, because a drill places a
// real phone call and a client-supplied id would let anyone target anyone.
// Anonymous visitors simply have no token and act as the shared demo account.
const TOKEN_KEY = "safespace_session_token";
function sessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setSessionToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode: stay anonymous */ }
}
function authHeaders(): Record<string, string> {
  const t = sessionToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

// First-run tutorial. Shown once, then replayable from Home — people forget, and a
// tutorial you can't get back to is worse than none.
const TUTORIAL_KEY = "safespace_tutorial_seen";
function hasSeenTutorial(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === "1"; } catch { return false; }
}
function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* private mode: show it again, harmless */ }
}

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(path, { headers: authHeaders() });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function reportOutcome(outcome: string, channel: DrillType): Promise<number | null> {
  try {
    const r = await fetch("/api/drills/practice-result", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ outcome, channel }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.record?.xpGained ?? null;
  } catch {
    return null;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
type Screen =
  | "title"
  | "home"
  | "drill-select"
  | "incoming"
  | "call"
  | "result-win"
  | "result-lose"
  | "leaderboard"
  | "store"
  | "profile"
  | "register"
  | "sms-inbox"
  | "sms-thread"
  | "sms-browser"
  | "email-inbox"
  | "email-detail"
  | "email-browser"
  | "email-download"
  | "family-drill-intro"
  | "family-round"
  | "family-answer"
  | "family-summary"
  | "settings"
  | "account-settings"
  | "privacy-settings"
  | "accessibility-settings"
  | "about-settings"
  | "profile-edit"
  | "avatar-customisation"
  | "customize"
  | "family-chat"
  | "payday"
  | "notifications"
  | "notification-detail"
  | "realistic-phone-intro"
  | "telegram-intro"
  | "realistic-email-intro";

type Tab = "home" | "leaderboard" | "store" | "profile";

interface AppSettings {
  drillFrequency: string;
  familyDrillEnabled: boolean;
  notificationsEnabled: boolean;
  difficulty: string;
  includeSafeMessages: boolean;
  autoExplain: boolean;
  requireLinkInspection: boolean;
  realismMode: boolean;
}

interface FamilyClue {
  label: string;
  text: string;
  explanation: string;
}

interface FamilyScenario {
  id: number;
  targetMember: string;
  type: "sms" | "email" | "notification";
  isScam: boolean;
  sender: string;
  senderEmail?: string;
  senderDomain?: string;
  senderWarning?: string;
  subject?: string;
  timestamp: string;
  message: string;
  invoiceDetails?: { amount: string; noteFromSeller: string; invoiceNumber: string };
  buttonLabel?: string;
  buttonUrl?: string;
  correctAction: string;
  actions: string[];
  clues: FamilyClue[];
  explanation: string;
}
type DrillType = "call" | "sms" | "email";
type SmsOutcome = "reported" | "asked-family" | "clicked-link" | "closed-page";
type EmailOutcome = "reported" | "asked-family" | "submitted-details" | "opened-attachment" | "cancelled-download";

type LeaderboardRow = { rank: number; name: string; score: number; wins?: number; area?: string };

type FurnitureItem = { id: string; name: string; sellValue: number; memberId: string };
type ChatMsg = {
  memberId: string;
  text: string;
  time: string;
  isPlayer?: boolean;
  isPixi?: boolean;
  incidentRef?: {
    memberId: string;
    kind: "drill-win" | "drill-lose" | "family-round" | "payday";
  };
};

// ── Phase 2: Coin ledger types ─────────────────────────────────────────────
type CoinTxReason =
  | "drill-win-call" | "drill-win-sms" | "drill-win-email"
  | "drill-lose-call" | "drill-lose-sms" | "drill-lose-email"
  | "family-drill-correct" | "family-drill-wrong"
  | "sell-furniture" | "buy-furniture"
  | "daily-reward"
  | "payday-base" | "payday-bonus" | "payday-penalty";

type CoinTx = {
  id: string;
  memberId: string;
  delta: number;
  reason: CoinTxReason;
  label: string;
  timestamp: number;
};

const LEDGER_CAP = 50;
const DAILY_REWARD_AMOUNT = 10;

// ── Phase 6: Notification types ────────────────────────────────────────────
type NotificationKind =
  | "drill-win-call" | "drill-win-sms" | "drill-win-email"
  | "drill-lose-call" | "drill-lose-sms" | "drill-lose-email"
  | "family-drill-complete"
  | "payday"
  | "daily-reward";

type Notification = {
  id: string;
  kind: NotificationKind;
  memberId: string; // "family" for household-wide events
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
};

const NOTIFICATIONS_CAP = 30;

function makeNotifId() {
  return "n_" + Math.random().toString(36).slice(2, 10);
}

function makeTxId() {
  return Math.random().toString(36).slice(2, 10);
}

// ─────────────────────────────────────────────────────────────────────────
// PIXEL ICONS
// ─────────────────────────────────────────────────────────────────────────

function IconCheck({ size = 16, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={4} width={1} height={1} fill={color} />
      <rect x={2} y={5} width={1} height={1} fill={color} />
      <rect x={3} y={6} width={1} height={1} fill={color} />
      <rect x={4} y={5} width={1} height={1} fill={color} />
      <rect x={5} y={4} width={1} height={1} fill={color} />
      <rect x={6} y={3} width={1} height={1} fill={color} />
      <rect x={7} y={2} width={1} height={1} fill={color} />
    </svg>
  );
}

function IconX({ size = 16, color = "#ff2d55" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={1} width={1} height={1} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={1} height={1} fill={color} />
      <rect x={6} y={6} width={1} height={1} fill={color} />
      <rect x={6} y={1} width={1} height={1} fill={color} />
      <rect x={5} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={4} width={1} height={1} fill={color} />
      <rect x={2} y={5} width={1} height={1} fill={color} />
      <rect x={1} y={6} width={1} height={1} fill={color} />
    </svg>
  );
}

function IconFlame({ size = 24, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={9} width={4} height={3} fill={color} />
      <rect x={2} y={8} width={6} height={2} fill={color} />
      <rect x={1} y={6} width={8} height={3} fill={color} />
      <rect x={2} y={4} width={6} height={3} fill={color} />
      <rect x={4} y={2} width={2} height={3} fill={color} />
      <rect x={3} y={1} width={4} height={2} fill={color} />
      <rect x={4} y={0} width={2} height={2} fill={color} />
      <rect x={3} y={7} width={4} height={2} fill="#ffe66d" />
      <rect x={4} y={5} width={2} height={3} fill="#ffe66d" />
    </svg>
  );
}

function IconShield({ size = 24, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={8} height={2} fill={color} />
      <rect x={1} y={1} width={10} height={2} fill={color} />
      <rect x={0} y={2} width={12} height={6} fill={color} />
      <rect x={1} y={8} width={10} height={2} fill={color} />
      <rect x={2} y={9} width={8} height={2} fill={color} />
      <rect x={4} y={11} width={4} height={2} fill={color} />
      <rect x={5} y={12} width={2} height={2} fill={color} />
      <rect x={3} y={5} width={1} height={1} fill="#0a0e1a" />
      <rect x={4} y={6} width={1} height={1} fill="#0a0e1a" />
      <rect x={5} y={7} width={1} height={1} fill="#0a0e1a" />
      <rect x={6} y={6} width={1} height={1} fill="#0a0e1a" />
      <rect x={7} y={5} width={1} height={1} fill="#0a0e1a" />
      <rect x={8} y={4} width={1} height={1} fill="#0a0e1a" />
    </svg>
  );
}

function IconSkull({ size = 24, color = "#ff2d55" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={6} height={2} fill={color} />
      <rect x={1} y={1} width={10} height={2} fill={color} />
      <rect x={0} y={2} width={12} height={5} fill={color} />
      <rect x={1} y={7} width={10} height={2} fill={color} />
      <rect x={2} y={9} width={2} height={3} fill={color} />
      <rect x={5} y={9} width={2} height={3} fill={color} />
      <rect x={8} y={9} width={2} height={3} fill={color} />
      <rect x={2} y={3} width={3} height={3} fill="#0a0e1a" />
      <rect x={7} y={3} width={3} height={3} fill="#0a0e1a" />
      <rect x={3} y={4} width={1} height={1} fill={color} />
      <rect x={8} y={4} width={1} height={1} fill={color} />
    </svg>
  );
}

function IconTrophy({ size = 24, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 14" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={8} height={6} fill={color} />
      <rect x={1} y={1} width={10} height={4} fill={color} />
      <rect x={0} y={1} width={2} height={3} fill={color} />
      <rect x={10} y={1} width={2} height={3} fill={color} />
      <rect x={4} y={6} width={4} height={3} fill={color} />
      <rect x={2} y={9} width={8} height={2} fill={color} />
      <rect x={1} y={11} width={10} height={2} fill={color} />
      <rect x={3} y={1} width={1} height={3} fill="#ffffff" opacity="0.4" />
    </svg>
  );
}

function IconStar({ size = 16, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={2} fill={color} />
      <rect x={3} y={2} width={4} height={2} fill={color} />
      <rect x={0} y={3} width={10} height={2} fill={color} />
      <rect x={1} y={5} width={8} height={1} fill={color} />
      <rect x={0} y={6} width={4} height={1} fill={color} />
      <rect x={6} y={6} width={4} height={1} fill={color} />
      <rect x={0} y={7} width={3} height={1} fill={color} />
      <rect x={7} y={7} width={3} height={1} fill={color} />
      <rect x={2} y={8} width={2} height={2} fill={color} />
      <rect x={6} y={8} width={2} height={2} fill={color} />
    </svg>
  );
}

function IconMedal({ rank = 1, size = 20 }: { rank: number; size?: number }) {
  const colors = ["#ffe66d", "#c0c0c0", "#cd7f32"];
  const c = colors[rank - 1] ?? "#6b8ba4";
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={4} fill={c} opacity="0.6" />
      <rect x={4} y={0} width={2} height={5} fill={c} opacity="0.8" />
      <rect x={1} y={4} width={8} height={8} fill={c} />
      <rect x={0} y={5} width={10} height={6} fill={c} />
      <rect x={2} y={4} width={6} height={8} fill={c} />
      <rect x={4} y={6} width={2} height={4} fill="#0a0e1a" />
      <rect x={3} y={7} width={4} height={2} fill="#0a0e1a" />
    </svg>
  );
}

function IconPerson({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={4} fill={color} />
      <rect x={2} y={1} width={6} height={3} fill={color} />
      <rect x={2} y={4} width={6} height={4} fill={color} />
      <rect x={1} y={5} width={8} height={2} fill={color} />
      <rect x={2} y={8} width={2} height={2} fill={color} />
      <rect x={6} y={8} width={2} height={2} fill={color} />
    </svg>
  );
}

function IconLock({ size = 16, color = "#6b8ba4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={4} height={1} fill={color} />
      <rect x={1} y={1} width={6} height={3} fill={color} />
      <rect x={0} y={4} width={8} height={6} fill={color} />
      <rect x={2} y={1} width={4} height={2} fill="#0a0e1a" />
      <rect x={3} y={6} width={2} height={2} fill="#0a0e1a" />
      <rect x={3} y={8} width={2} height={1} fill="#0a0e1a" />
    </svg>
  );
}

function IconBell({ size = 20, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={1} fill={color} />
      <rect x={3} y={1} width={4} height={2} fill={color} />
      <rect x={1} y={3} width={8} height={5} fill={color} />
      <rect x={0} y={5} width={10} height={3} fill={color} />
      <rect x={0} y={8} width={10} height={1} fill={color} />
      <rect x={3} y={9} width={4} height={2} fill={color} />
      <rect x={4} y={11} width={2} height={1} fill={color} />
    </svg>
  );
}

function IconWarning({ size = 16, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={1} fill={color} />
      <rect x={3} y={1} width={4} height={1} fill={color} />
      <rect x={2} y={2} width={6} height={1} fill={color} />
      <rect x={1} y={3} width={8} height={1} fill={color} />
      <rect x={0} y={4} width={10} height={5} fill={color} />
      <rect x={4} y={5} width={2} height={2} fill="#0a0e1a" />
      <rect x={4} y={8} width={2} height={1} fill="#0a0e1a" />
    </svg>
  );
}

function IconBulb({ size = 16, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={0} width={4} height={1} fill={color} />
      <rect x={1} y={1} width={6} height={4} fill={color} />
      <rect x={0} y={2} width={8} height={3} fill={color} />
      <rect x={1} y={5} width={6} height={2} fill={color} />
      <rect x={2} y={7} width={4} height={2} fill={color} />
      <rect x={3} y={9} width={2} height={1} fill={color} />
    </svg>
  );
}

function IconPhone({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={4} height={4} fill={color} />
      <rect x={1} y={1} width={2} height={2} fill="#0a0e1a" />
      <rect x={3} y={2} width={7} height={2} fill={color} />
      <rect x={7} y={2} width={3} height={8} fill={color} />
      <rect x={6} y={7} width={2} height={3} fill={color} />
      <rect x={4} y={8} width={4} height={2} fill={color} />
    </svg>
  );
}

function IconHouse({ size = 20, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={5} y={0} width={2} height={1} fill={color} />
      <rect x={4} y={1} width={4} height={1} fill={color} />
      <rect x={3} y={2} width={6} height={1} fill={color} />
      <rect x={2} y={3} width={8} height={1} fill={color} />
      <rect x={1} y={4} width={10} height={1} fill={color} />
      <rect x={1} y={5} width={10} height={7} fill={color} />
      <rect x={4} y={8} width={4} height={4} fill="#0a0e1a" />
      <rect x={2} y={6} width={2} height={2} fill="#0a0e1a" />
      <rect x={8} y={6} width={2} height={2} fill="#0a0e1a" />
    </svg>
  );
}

function IconBadge({ size = 24, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={6} height={2} fill={color} />
      <rect x={1} y={1} width={10} height={2} fill={color} />
      <rect x={0} y={2} width={12} height={6} fill={color} />
      <rect x={1} y={8} width={10} height={2} fill={color} />
      <rect x={3} y={9} width={6} height={2} fill={color} />
      <rect x={5} y={3} width={2} height={1} fill="#0a0e1a" />
      <rect x={4} y={4} width={4} height={1} fill="#0a0e1a" />
      <rect x={3} y={5} width={6} height={1} fill="#0a0e1a" />
      <rect x={4} y={6} width={4} height={1} fill="#0a0e1a" />
      <rect x={5} y={7} width={2} height={1} fill="#0a0e1a" />
    </svg>
  );
}

function IconEnvelope({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={12} height={10} fill={color} />
      <rect x={1} y={1} width={10} height={8} fill="#111827" />
      <rect x={0} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={1} width={1} height={1} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={2} height={1} fill={color} />
      <rect x={7} y={4} width={1} height={1} fill={color} />
      <rect x={8} y={3} width={1} height={1} fill={color} />
      <rect x={9} y={2} width={1} height={1} fill={color} />
      <rect x={10} y={1} width={1} height={1} fill={color} />
      <rect x={11} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={8} width={10} height={1} fill={color} />
    </svg>
  );
}

function IconChatBubble({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={0} width={10} height={8} fill={color} />
      <rect x={0} y={1} width={12} height={6} fill={color} />
      <rect x={2} y={1} width={8} height={6} fill="#111827" />
      <rect x={2} y={8} width={2} height={1} fill={color} />
      <rect x={2} y={9} width={1} height={1} fill={color} />
      <rect x={2} y={10} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={2} height={2} fill={color} />
      <rect x={6} y={3} width={2} height={2} fill={color} />
      <rect x={9} y={3} width={1} height={2} fill={color} />
    </svg>
  );
}

function IconTelegram({ size = 20, color = "#00d4ff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={4} width={2} height={2} fill={color} />
      <rect x={2} y={3} width={2} height={4} fill={color} />
      <rect x={4} y={2} width={2} height={6} fill={color} />
      <rect x={6} y={1} width={2} height={8} fill={color} />
      <rect x={8} y={0} width={2} height={10} fill={color} />
      <rect x={10} y={2} width={2} height={6} fill={color} />
      <rect x={4} y={5} width={2} height={3} fill="#0a0e1a" opacity={0.4} />
      <rect x={6} y={6} width={2} height={3} fill="#0a0e1a" opacity={0.3} />
      <rect x={2} y={9} width={4} height={1} fill={color} opacity={0.6} />
      <rect x={3} y={10} width={2} height={1} fill={color} opacity={0.4} />
    </svg>
  );
}

function IconRealEmail({ size = 20, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={12} height={10} fill={color} />
      <rect x={1} y={1} width={10} height={8} fill="#111827" />
      <rect x={0} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={1} width={1} height={1} fill={color} />
      <rect x={2} y={2} width={1} height={1} fill={color} />
      <rect x={3} y={3} width={1} height={1} fill={color} />
      <rect x={4} y={4} width={1} height={1} fill={color} />
      <rect x={5} y={5} width={2} height={1} fill={color} />
      <rect x={7} y={4} width={1} height={1} fill={color} />
      <rect x={8} y={3} width={1} height={1} fill={color} />
      <rect x={9} y={2} width={1} height={1} fill={color} />
      <rect x={10} y={1} width={1} height={1} fill={color} />
      <rect x={11} y={0} width={1} height={1} fill={color} />
      <rect x={1} y={8} width={10} height={1} fill={color} />
      <rect x={9} y={0} width={3} height={3} fill="#ff2d55" />
      <rect x={10} y={1} width={1} height={1} fill="#ffffff" opacity={0.7} />
    </svg>
  );
}

function IconLink({ size = 16, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={3} width={2} height={4} fill={color} />
      <rect x={1} y={2} width={2} height={1} fill={color} />
      <rect x={1} y={7} width={2} height={1} fill={color} />
      <rect x={2} y={4} width={1} height={2} fill="#111827" />
      <rect x={3} y={4} width={4} height={2} fill={color} />
      <rect x={8} y={3} width={2} height={4} fill={color} />
      <rect x={7} y={2} width={2} height={1} fill={color} />
      <rect x={7} y={7} width={2} height={1} fill={color} />
      <rect x={7} y={4} width={1} height={2} fill="#111827" />
    </svg>
  );
}

function IconAttachment({ size = 16, color = "#c77dff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={2} width={6} height={10} fill={color} />
      <rect x={2} y={0} width={6} height={10} fill={color} />
      <rect x={0} y={2} width={2} height={2} fill="#0a0e1a" opacity={0.5} />
      <rect x={3} y={4} width={4} height={1} fill="#0a0e1a" opacity={0.4} />
      <rect x={3} y={6} width={4} height={1} fill="#0a0e1a" opacity={0.4} />
      <rect x={3} y={8} width={3} height={1} fill="#0a0e1a" opacity={0.4} />
    </svg>
  );
}

function IconDownload({ size = 16, color = "#00ff88" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={2} height={6} fill={color} />
      <rect x={2} y={5} width={6} height={2} fill={color} />
      <rect x={3} y={6} width={4} height={2} fill={color} />
      <rect x={4} y={7} width={2} height={2} fill={color} />
      <rect x={0} y={10} width={10} height={2} fill={color} />
    </svg>
  );
}

function IconBrowserWindow({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={14} height={12} fill={color} />
      <rect x={1} y={3} width={12} height={8} fill="#111827" />
      <rect x={1} y={1} width={2} height={2} fill="#ff2d55" />
      <rect x={4} y={1} width={2} height={2} fill="#ffe66d" />
      <rect x={7} y={1} width={2} height={2} fill="#00ff88" />
      <rect x={10} y={1} width={3} height={2} fill="#0a0e1a" opacity={0.5} />
      <rect x={2} y={5} width={8} height={1} fill={color} opacity={0.3} />
      <rect x={2} y={7} width={10} height={1} fill={color} opacity={0.3} />
      <rect x={2} y={9} width={6} height={1} fill={color} opacity={0.3} />
    </svg>
  );
}

function IconReportFlag({ size = 16, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={2} height={12} fill={color} opacity={0.6} />
      <rect x={2} y={0} width={6} height={5} fill={color} />
      <rect x={2} y={2} width={4} height={1} fill="#0a0e1a" opacity={0.4} />
    </svg>
  );
}

function IconEyeInspect({ size = 16, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 8" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={2} y={1} width={8} height={1} fill={color} />
      <rect x={1} y={2} width={10} height={4} fill={color} />
      <rect x={2} y={6} width={8} height={1} fill={color} />
      <rect x={4} y={2} width={4} height={4} fill="#111827" />
      <rect x={5} y={3} width={2} height={2} fill={color} />
    </svg>
  );
}

function IconTrashBin({ size = 16, color = "#ff2d55" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={2} fill={color} />
      <rect x={0} y={2} width={10} height={2} fill={color} />
      <rect x={1} y={4} width={8} height={8} fill={color} />
      <rect x={3} y={5} width={1} height={5} fill="#0a0e1a" />
      <rect x={5} y={5} width={1} height={5} fill="#0a0e1a" />
      <rect x={7} y={5} width={1} height={5} fill="#0a0e1a" />
    </svg>
  );
}

function IconCoin({ size = 16, color = "#ffe66d" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={3} y={0} width={4} height={1} fill={color} /><rect x={1} y={1} width={8} height={2} fill={color} />
      <rect x={0} y={3} width={10} height={4} fill={color} /><rect x={1} y={7} width={8} height={2} fill={color} />
      <rect x={3} y={9} width={4} height={1} fill={color} />
      <rect x={4} y={2} width={2} height={1} fill="#aa8800" /><rect x={3} y={3} width={4} height={1} fill="#aa8800" />
      <rect x={3} y={5} width={4} height={1} fill="#aa8800" /><rect x={4} y={6} width={2} height={1} fill="#aa8800" />
    </svg>
  );
}

function IconChat({ size = 20, color = "#4ecdc4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={1} y={0} width={10} height={1} fill={color} /><rect x={0} y={1} width={12} height={7} fill={color} />
      <rect x={1} y={8} width={10} height={1} fill={color} />
      <rect x={2} y={8} width={2} height={2} fill={color} /><rect x={2} y={10} width={2} height={2} fill={color} />
      <rect x={2} y={2} width={2} height={2} fill="#0a0e1a" /><rect x={5} y={2} width={2} height={2} fill="#0a0e1a" />
      <rect x={8} y={2} width={2} height={2} fill="#0a0e1a" />
      <rect x={2} y={5} width={8} height={1} fill="#0a0e1a" opacity="0.4" />
    </svg>
  );
}

function IconSell({ size = 14, color = "#ff6b35" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={6} height={6} fill={color} />
      <rect x={1} y={0} width={1} height={1} fill="#0a0e1a" />
      <rect x={7} y={2} width={3} height={6} fill={color} /><rect x={6} y={3} width={4} height={4} fill={color} />
      <rect x={5} y={4} width={5} height={2} fill={color} />
      <rect x={2} y={2} width={2} height={2} fill="#0a0e1a" />
    </svg>
  );
}

function IconStore({ size = 20, color = "#c77dff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={0} y={0} width={12} height={3} fill={color} />
      <rect x={1} y={1} width={2} height={1} fill="#ffffff" opacity={0.3} />
      <rect x={5} y={1} width={2} height={1} fill="#ffffff" opacity={0.3} />
      <rect x={9} y={1} width={2} height={1} fill="#ffffff" opacity={0.3} />
      <rect x={0} y={3} width={12} height={1} fill="#0a0e1a" opacity={0.4} />
      <rect x={0} y={4} width={12} height={8} fill={color} opacity={0.7} />
      <rect x={1} y={4} width={10} height={8} fill={color} />
      <rect x={4} y={6} width={4} height={6} fill="#0a0e1a" />
      <rect x={5} y={8} width={1} height={1} fill={color} />
      <rect x={1} y={5} width={2} height={2} fill="#0a0e1a" opacity={0.4} />
      <rect x={9} y={5} width={2} height={2} fill="#0a0e1a" opacity={0.4} />
    </svg>
  );
}

// ── Per-item pixel-art furniture icons ───────────────────────────────────
function FurnitureIcon({ itemId, size = 36 }: { itemId: string; size?: number }) {
  const s = size;
  switch (itemId) {
    case "grandma-chair": return (
      <svg width={s} height={s} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={2} y={0} width={6} height={6} fill="#7a3a9a"/>
        <rect x={3} y={1} width={4} height={4} fill="#9b4dca"/>
        <rect x={0} y={4} width={2} height={5} fill="#5a2a7a"/>
        <rect x={8} y={4} width={2} height={5} fill="#5a2a7a"/>
        <rect x={1} y={6} width={8} height={3} fill="#9b4dca"/>
        <rect x={2} y={7} width={6} height={1} fill="#c77dff" opacity={0.5}/>
        <rect x={1} y={9} width={2} height={1} fill="#3a1a5a"/>
        <rect x={7} y={9} width={2} height={1} fill="#3a1a5a"/>
      </svg>
    );
    case "grandma-shelf": return (
      <svg width={s} height={s} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={10} fill="#5a3010"/>
        <rect x={1} y={0} width={8} height={10} fill="#0a0e1a"/>
        <rect x={0} y={4} width={10} height={1} fill="#5a3010"/>
        <rect x={1} y={0} width={2} height={4} fill="#ff2d55"/>
        <rect x={4} y={1} width={1} height={3} fill="#00ff88"/>
        <rect x={6} y={0} width={1} height={4} fill="#ffe66d"/>
        <rect x={8} y={1} width={1} height={3} fill="#c77dff"/>
        <rect x={1} y={5} width={3} height={4} fill="#4ecdc4"/>
        <rect x={5} y={5} width={1} height={4} fill="#ff6b35"/>
        <rect x={7} y={6} width={2} height={3} fill="#ffe66d"/>
        <rect x={9} y={5} width={1} height={4} fill="#5a3010"/>
      </svg>
    );
    case "grandma-lamp": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={2} y={0} width={6} height={1} fill="#ffe66d"/>
        <rect x={1} y={1} width={8} height={1} fill="#ffe66d"/>
        <rect x={0} y={2} width={10} height={2} fill="#ffe66d"/>
        <rect x={1} y={1} width={8} height={3} fill="#ffe66d" opacity={0.35}/>
        <rect x={4} y={4} width={2} height={6} fill="#8b5e3c"/>
        <rect x={2} y={9} width={6} height={2} fill="#8b5e3c"/>
        <rect x={1} y={10} width={8} height={1} fill="#6b4020"/>
        <rect x={4} y={3} width={2} height={1} fill="#ffffff" opacity={0.7}/>
      </svg>
    );
    case "grandma-frame": return (
      <svg width={s} height={s} viewBox="0 0 10 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={9} fill="#8b5e3c"/>
        <rect x={1} y={1} width={8} height={7} fill="#6b4020"/>
        <rect x={2} y={2} width={6} height={5} fill="#1a3a5a"/>
        <rect x={2} y={2} width={6} height={2} fill="#1a2a6a"/>
        <rect x={2} y={4} width={6} height={3} fill="#1a4a2a"/>
        <rect x={3} y={2} width={2} height={2} fill="#ffe66d" opacity={0.9}/>
        <rect x={3} y={2} width={1} height={1} fill="#ffffff" opacity={0.6}/>
        <rect x={7} y={3} width={1} height={4} fill="#0a2a0a"/>
        <rect x={6} y={2} width={3} height={3} fill="#0a2a0a"/>
      </svg>
    );
    case "mum-plant": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={4} y={0} width={2} height={1} fill="#00cc66"/>
        <rect x={3} y={1} width={4} height={1} fill="#00ff88"/>
        <rect x={1} y={2} width={8} height={2} fill="#00cc66"/>
        <rect x={2} y={1} width={6} height={3} fill="#00ff88"/>
        <rect x={1} y={2} width={3} height={2} fill="#00cc66" opacity={0.6}/>
        <rect x={2} y={2} width={2} height={1} fill="#4ecdc4" opacity={0.25}/>
        <rect x={4} y={4} width={2} height={2} fill="#006633"/>
        <rect x={2} y={6} width={6} height={1} fill="#cd7f32"/>
        <rect x={3} y={7} width={4} height={4} fill="#cd7f32"/>
        <rect x={2} y={7} width={6} height={3} fill="#b05a20"/>
        <rect x={3} y={7} width={2} height={2} fill="#cd7f32" opacity={0.5}/>
        <rect x={3} y={10} width={4} height={1} fill="#8b3a10"/>
      </svg>
    );
    case "mum-desk": return (
      <svg width={s} height={s} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={3} y={0} width={7} height={4} fill="#1a2340"/>
        <rect x={4} y={1} width={5} height={2} fill="#0a0e1a"/>
        <rect x={5} y={1} width={3} height={1} fill="#4ecdc4" opacity={0.4}/>
        <rect x={5} y={2} width={1} height={1} fill="#00ff88" opacity={0.7}/>
        <rect x={6} y={4} width={2} height={1} fill="#2a3a5c"/>
        <rect x={0} y={5} width={12} height={2} fill="#8b5e3c"/>
        <rect x={0} y={5} width={12} height={1} fill="#aa7040"/>
        <rect x={1} y={7} width={2} height={3} fill="#6b4020"/>
        <rect x={9} y={7} width={2} height={3} fill="#6b4020"/>
        <rect x={5} y={6} width={2} height={1} fill="#6b4020"/>
      </svg>
    );
    case "mum-laptop": return (
      <svg width={s} height={s} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={10} height={6} fill="#1a2340"/>
        <rect x={2} y={1} width={8} height={4} fill="#0a0e1a"/>
        <rect x={3} y={1} width={6} height={3} fill="#4ecdc4" opacity={0.12}/>
        <rect x={4} y={2} width={4} height={1} fill="#00ff88" opacity={0.25}/>
        <rect x={5} y={3} width={2} height={1} fill="#4ecdc4" opacity={0.5}/>
        <rect x={6} y={0} width={1} height={1} fill="#ff2d55" opacity={0.8}/>
        <rect x={1} y={6} width={10} height={1} fill="#2a3a5c"/>
        <rect x={0} y={7} width={12} height={3} fill="#1a2a3c"/>
        <rect x={1} y={7} width={10} height={2} fill="#2a3a5c"/>
        <rect x={2} y={8} width={1} height={1} fill="#3a4a6c"/><rect x={4} y={8} width={1} height={1} fill="#3a4a6c"/>
        <rect x={6} y={8} width={1} height={1} fill="#3a4a6c"/><rect x={8} y={8} width={1} height={1} fill="#3a4a6c"/>
        <rect x={3} y={9} width={6} height={1} fill="#3a4a6c"/>
      </svg>
    );
    case "mum-phone": return (
      <svg width={s} height={s} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={6} height={12} fill="#2a3a5c"/>
        <rect x={0} y={1} width={8} height={10} fill="#2a3a5c"/>
        <rect x={2} y={1} width={4} height={7} fill="#0a0e1a"/>
        <rect x={2} y={1} width={4} height={6} fill="#1a2a4a"/>
        <rect x={3} y={2} width={2} height={1} fill="#4ecdc4" opacity={0.7}/>
        <rect x={2} y={4} width={4} height={1} fill="#6b8ba4" opacity={0.5}/>
        <rect x={2} y={5} width={3} height={1} fill="#6b8ba4" opacity={0.4}/>
        <rect x={3} y={0} width={2} height={1} fill="#1a2340"/>
        <rect x={3} y={0} width={1} height={1} fill="#111827"/>
        <rect x={3} y={9} width={2} height={1} fill="#2a3a5c"/>
      </svg>
    );
    case "dad-tv": return (
      <svg width={s} height={s} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={12} height={8} fill="#2a3a5c"/>
        <rect x={1} y={1} width={10} height={6} fill="#0a0e1a"/>
        <rect x={2} y={2} width={4} height={2} fill="#4ecdc4" opacity={0.35}/>
        <rect x={7} y={2} width={3} height={1} fill="#ff2d55" opacity={0.6}/>
        <rect x={7} y={3} width={3} height={1} fill="#ffe66d" opacity={0.5}/>
        <rect x={2} y={5} width={8} height={1} fill="#2a4a6a" opacity={0.5}/>
        <rect x={10} y={1} width={1} height={1} fill="#00ff88"/>
        <rect x={5} y={8} width={2} height={1} fill="#1a2340"/>
        <rect x={3} y={9} width={6} height={3} fill="#2a3a5c"/>
        <rect x={3} y={9} width={6} height={1} fill="#3a4a6c"/>
      </svg>
    );
    case "dad-couch": return (
      <svg width={s} height={s} viewBox="0 0 12 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={10} height={5} fill="#2a3a4a"/>
        <rect x={2} y={1} width={4} height={3} fill="#3a4a5a"/>
        <rect x={7} y={1} width={3} height={3} fill="#3a4a5a"/>
        <rect x={2} y={1} width={4} height={1} fill="#4a5a6a" opacity={0.6}/>
        <rect x={7} y={1} width={3} height={1} fill="#4a5a6a" opacity={0.6}/>
        <rect x={6} y={1} width={1} height={4} fill="#1a2a3a"/>
        <rect x={0} y={5} width={12} height={3} fill="#3a4a5a"/>
        <rect x={1} y={5} width={10} height={1} fill="#4a5a6a"/>
        <rect x={0} y={0} width={1} height={8} fill="#1a2a3a"/>
        <rect x={11} y={0} width={1} height={8} fill="#1a2a3a"/>
        <rect x={1} y={8} width={2} height={1} fill="#0a1a2a"/>
        <rect x={9} y={8} width={2} height={1} fill="#0a1a2a"/>
      </svg>
    );
    case "dad-cabinet": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={12} fill="#5a3010"/>
        <rect x={1} y={0} width={8} height={12} fill="#4a2010"/>
        <rect x={1} y={1} width={8} height={3} fill="#3a1808"/>
        <rect x={1} y={1} width={8} height={1} fill="#5a3010" opacity={0.5}/>
        <rect x={4} y={2} width={2} height={1} fill="#ffe66d"/>
        <rect x={1} y={5} width={8} height={3} fill="#3a1808"/>
        <rect x={1} y={5} width={8} height={1} fill="#5a3010" opacity={0.5}/>
        <rect x={4} y={6} width={2} height={1} fill="#ffe66d"/>
        <rect x={1} y={9} width={8} height={3} fill="#3a1808"/>
        <rect x={1} y={9} width={8} height={1} fill="#5a3010" opacity={0.5}/>
        <rect x={4} y={10} width={2} height={1} fill="#ffe66d"/>
        <rect x={0} y={4} width={10} height={1} fill="#2a1000"/>
        <rect x={0} y={8} width={10} height={1} fill="#2a1000"/>
      </svg>
    );
    case "dad-door": return (
      <svg width={s} height={s} viewBox="0 0 10 14" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={14} fill="#5a3010"/>
        <rect x={1} y={1} width={8} height={12} fill="#8b5e3c"/>
        <rect x={2} y={1} width={6} height={12} fill="#aa7040"/>
        <rect x={2} y={2} width={2} height={3} fill="#8b5e3c"/>
        <rect x={6} y={2} width={2} height={3} fill="#8b5e3c"/>
        <rect x={2} y={7} width={2} height={5} fill="#8b5e3c"/>
        <rect x={6} y={7} width={2} height={5} fill="#8b5e3c"/>
        <rect x={7} y={6} width={2} height={2} fill="#ffe66d"/>
        <rect x={7} y={7} width={1} height={1} fill="#aa9900"/>
        <rect x={1} y={3} width={1} height={1} fill="#3a1808"/>
        <rect x={1} y={10} width={1} height={1} fill="#3a1808"/>
      </svg>
    );
    case "dad-shower": return (
      <svg width={s} height={s} viewBox="0 0 10 14" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={4} y={0} width={2} height={5} fill="#6b8ba4"/>
        <rect x={1} y={4} width={8} height={2} fill="#6b8ba4"/>
        <rect x={1} y={2} width={2} height={4} fill="#6b8ba4"/>
        <rect x={0} y={6} width={10} height={3} fill="#4a6a7c"/>
        <rect x={1} y={6} width={8} height={1} fill="#5a7a8c"/>
        <rect x={1} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={3} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={5} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={7} y={7} width={1} height={1} fill="#2a4a5c"/>
        <rect x={2} y={8} width={1} height={1} fill="#2a4a5c"/>
        <rect x={4} y={8} width={1} height={1} fill="#2a4a5c"/>
        <rect x={6} y={8} width={1} height={1} fill="#2a4a5c"/>
        <rect x={1} y={10} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={3} y={11} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={5} y={10} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={7} y={11} width={1} height={2} fill="#4ecdc4" opacity={0.7}/>
        <rect x={9} y={10} width={1} height={2} fill="#4ecdc4" opacity={0.5}/>
      </svg>
    );
    case "kid-bed": return (
      <svg width={s} height={s} viewBox="0 0 12 10" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={3} height={9} fill="#ffe66d"/>
        <rect x={1} y={1} width={1} height={7} fill="#aa9900"/>
        <rect x={3} y={2} width={9} height={6} fill="#2a4aa4"/>
        <rect x={3} y={2} width={9} height={5} fill="#3a5ab4"/>
        <rect x={4} y={2} width={4} height={3} fill="#e8f4f8"/>
        <rect x={5} y={3} width={2} height={1} fill="#c0d8e0"/>
        <rect x={3} y={5} width={9} height={1} fill="#1a3a7a"/>
        <rect x={4} y={6} width={8} height={2} fill="#2a4aa4"/>
        <rect x={0} y={8} width={12} height={2} fill="#aa9900"/>
        <rect x={10} y={3} width={2} height={7} fill="#ffe66d"/>
      </svg>
    );
    case "kid-toybox": return (
      <svg width={s} height={s} viewBox="0 0 10 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={3} fill="#cc9900"/>
        <rect x={0} y={0} width={10} height={1} fill="#ffe66d"/>
        <rect x={4} y={1} width={2} height={2} fill="#ff6b35"/>
        <rect x={0} y={3} width={10} height={6} fill="#aa7700"/>
        <rect x={1} y={3} width={8} height={5} fill="#bb8800"/>
        <rect x={1} y={4} width={2} height={2} fill="#ff2d55" opacity={0.9}/>
        <rect x={4} y={4} width={2} height={2} fill="#00ff88" opacity={0.9}/>
        <rect x={7} y={4} width={2} height={2} fill="#4ecdc4" opacity={0.9}/>
        <rect x={2} y={6} width={2} height={2} fill="#c77dff" opacity={0.9}/>
        <rect x={6} y={6} width={2} height={2} fill="#ffe66d" opacity={0.9}/>
        <rect x={0} y={8} width={10} height={1} fill="#8b5e00"/>
      </svg>
    );
    case "kid-teddy": return (
      <svg width={s} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={3} height={3} fill="#cc9900"/>
        <rect x={6} y={0} width={3} height={3} fill="#cc9900"/>
        <rect x={2} y={0} width={1} height={2} fill="#ff8855" opacity={0.6}/>
        <rect x={7} y={0} width={1} height={2} fill="#ff8855" opacity={0.6}/>
        <rect x={1} y={1} width={8} height={5} fill="#cc9900"/>
        <rect x={2} y={2} width={6} height={4} fill="#ddaa00"/>
        <rect x={3} y={2} width={1} height={2} fill="#0a0e1a"/>
        <rect x={6} y={2} width={1} height={2} fill="#0a0e1a"/>
        <rect x={3} y={2} width={1} height={1} fill="#ffffff" opacity={0.5}/>
        <rect x={6} y={2} width={1} height={1} fill="#ffffff" opacity={0.5}/>
        <rect x={4} y={4} width={2} height={1} fill="#0a0e1a"/>
        <rect x={3} y={5} width={4} height={1} fill="#0a0e1a"/>
        <rect x={2} y={6} width={6} height={5} fill="#cc9900"/>
        <rect x={3} y={6} width={4} height={5} fill="#ddaa00"/>
        <rect x={3} y={7} width={4} height={3} fill="#ffe66d" opacity={0.7}/>
        <rect x={0} y={6} width={2} height={4} fill="#cc9900"/>
        <rect x={8} y={6} width={2} height={4} fill="#cc9900"/>
        <rect x={2} y={10} width={3} height={2} fill="#aa7700"/>
        <rect x={5} y={10} width={3} height={2} fill="#aa7700"/>
      </svg>
    );
    case "kid-alarm": return (
      <svg width={s} height={s} viewBox="0 0 10 11" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={3} height={3} fill="#ffe66d"/>
        <rect x={2} y={1} width={1} height={2} fill="#aa9900"/>
        <rect x={6} y={0} width={3} height={3} fill="#ffe66d"/>
        <rect x={7} y={1} width={1} height={2} fill="#aa9900"/>
        <rect x={2} y={1} width={6} height={1} fill="#ffe66d"/>
        <rect x={1} y={2} width={8} height={6} fill="#ffe66d"/>
        <rect x={0} y={3} width={10} height={4} fill="#ffe66d"/>
        <rect x={1} y={7} width={8} height={2} fill="#ffe66d"/>
        <rect x={2} y={8} width={6} height={2} fill="#ffe66d"/>
        <rect x={2} y={2} width={6} height={7} fill="#0a0e1a"/>
        <rect x={3} y={3} width={4} height={5} fill="#111827"/>
        <rect x={4} y={3} width={1} height={4} fill="#e8f4f8"/>
        <rect x={4} y={5} width={3} height={1} fill="#ff2d55"/>
        <rect x={4} y={3} width={1} height={1} fill="#2a3a5c"/>
        <rect x={4} y={7} width={1} height={1} fill="#2a3a5c"/>
        <rect x={2} y={5} width={1} height={1} fill="#2a3a5c"/>
        <rect x={6} y={5} width={1} height={1} fill="#2a3a5c"/>
        <rect x={2} y={9} width={2} height={2} fill="#aa9900"/>
        <rect x={6} y={9} width={2} height={2} fill="#aa9900"/>
      </svg>
    );
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 10 10" style={{ imageRendering: "pixelated", display: "block" }}>
          <rect x={1} y={1} width={8} height={8} fill="#2a3a5c"/>
          <rect x={3} y={3} width={4} height={4} fill="#1a2340"/>
          <rect x={4} y={4} width={2} height={2} fill="#4ecdc4" opacity={0.5}/>
        </svg>
      );
  }
}

// ── Wallpaper preview swatches ───────────────────────────────────────────
function WallpaperSwatch({ id }: { id: string }) {
  if (id === "wp1") return (
    <svg width="100%" height="100%" viewBox="0 0 14 14" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect width={14} height={14} fill="#0a0e1a"/>
      <rect x={0} y={4} width={14} height={1} fill="#2a3a5c" opacity={0.7}/>
      <rect x={0} y={8} width={14} height={1} fill="#2a3a5c" opacity={0.7}/>
      <rect x={0} y={12} width={14} height={1} fill="#2a3a5c" opacity={0.7}/>
      <rect x={4} y={0} width={1} height={14} fill="#2a3a5c" opacity={0.7}/>
      <rect x={8} y={0} width={1} height={14} fill="#2a3a5c" opacity={0.7}/>
      <rect x={12} y={0} width={1} height={14} fill="#2a3a5c" opacity={0.7}/>
      <rect x={4} y={4} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={8} y={4} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={12} y={4} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={4} y={8} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={8} y={8} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={12} y={8} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={4} y={12} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
      <rect x={8} y={12} width={1} height={1} fill="#4ecdc4" opacity={0.55}/>
    </svg>
  );
  if (id === "wp2") return (
    <svg width="100%" height="100%" viewBox="0 0 14 14" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect width={14} height={14} fill="#1a2340"/>
      <rect x={0} y={0} width={14} height={3} fill="#0a0e1a"/>
      <rect x={0} y={5} width={14} height={3} fill="#0a0e1a"/>
      <rect x={0} y={10} width={14} height={3} fill="#0a0e1a"/>
      <rect x={0} y={3} width={14} height={1} fill="#4ecdc4" opacity={0.22}/>
      <rect x={0} y={8} width={14} height={1} fill="#4ecdc4" opacity={0.22}/>
      <rect x={0} y={13} width={14} height={1} fill="#4ecdc4" opacity={0.22}/>
    </svg>
  );
  return (
    <svg width="100%" height="100%" viewBox="0 0 14 14" preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect width={14} height={14} fill="#100c20"/>
      <rect x={2} y={1} width={1} height={3} fill="#ffffff" opacity={0.85}/>
      <rect x={1} y={2} width={3} height={1} fill="#ffffff" opacity={0.85}/>
      <rect x={7} y={4} width={1} height={1} fill="#ffffff" opacity={0.9}/>
      <rect x={11} y={1} width={1} height={3} fill="#c77dff" opacity={0.75}/>
      <rect x={10} y={2} width={3} height={1} fill="#c77dff" opacity={0.75}/>
      <rect x={4} y={7} width={1} height={1} fill="#ffffff" opacity={0.6}/>
      <rect x={9} y={6} width={1} height={1} fill="#ffe66d" opacity={0.75}/>
      <rect x={12} y={9} width={1} height={1} fill="#ffffff" opacity={0.5}/>
      <rect x={1} y={11} width={1} height={1} fill="#c77dff" opacity={0.65}/>
      <rect x={6} y={11} width={1} height={3} fill="#ffffff" opacity={0.5}/>
      <rect x={5} y={12} width={3} height={1} fill="#ffffff" opacity={0.5}/>
      <rect x={10} y={12} width={1} height={1} fill="#ffe66d" opacity={0.6}/>
    </svg>
  );
}

// ── Pixel Mascot ──────────────────────────────────────────────────────────
function PixelMascot({ size = 64, animate = false }: { size?: number; animate?: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % 2), 500);
    return () => clearInterval(t);
  }, [animate]);

  const s = size / 16;
  const px = (n: number) => n * s;
  const bodyY = frame === 0 ? 0 : s;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      <rect x={px(4)} y={px(1)} width={px(8)} height={px(7)} fill="#4ecdc4" />
      <rect x={px(5)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(3)} width={px(1)} height={px(1)} fill="#ffffff" />
      <rect x={px(10)} y={px(3)} width={px(1)} height={px(1)} fill="#ffffff" />
      <rect x={px(6)} y={px(6)} width={px(1)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(7)} y={px(7)} width={px(2)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(6)} width={px(1)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(4)} y={px(8) + bodyY} width={px(8)} height={px(6)} fill="#00ff88" />
      <rect x={px(5)} y={px(9) + bodyY} width={px(6)} height={px(4)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(10) + bodyY} width={px(4)} height={px(2)} fill="#00ff88" />
      <rect x={px(1)} y={px(9) + bodyY} width={px(3)} height={px(2)} fill="#4ecdc4" />
      <rect x={px(12)} y={px(9) + bodyY} width={px(3)} height={px(2)} fill="#4ecdc4" />
      <rect x={px(5)} y={px(14) + bodyY} width={px(2)} height={px(2)} fill="#4ecdc4" />
      <rect x={px(9)} y={px(14) + bodyY} width={px(2)} height={px(2)} fill="#4ecdc4" />
    </svg>
  );
}

// ── Pixi Avatar — AI coach variant of the mascot ─────────────────────────
// Distinct from PixelMascot: antenna on top, single-pixel glowing eye centres,
// slightly different body accents. Reads as "bot, not player".
function PixiAvatar({ size = 32 }: { size?: number }) {
  const s = size / 16;
  const px = (n: number) => n * s;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      {/* Antenna */}
      <rect x={px(7)} y={px(0)} width={px(2)} height={px(1)} fill="#00d4ff" />
      <rect x={px(7)} y={px(1)} width={px(2)} height={px(1)} fill="#ffe66d" />
      {/* Head */}
      <rect x={px(4)} y={px(2)} width={px(8)} height={px(6)} fill="#00d4ff" />
      <rect x={px(3)} y={px(3)} width={px(1)} height={px(4)} fill="#00d4ff" />
      <rect x={px(12)} y={px(3)} width={px(1)} height={px(4)} fill="#00d4ff" />
      {/* Eye sockets (dark) with glowing centre pixels */}
      <rect x={px(5)} y={px(4)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(4)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(5)} y={px(4)} width={px(1)} height={px(1)} fill="#00ff88" />
      <rect x={px(10)} y={px(5)} width={px(1)} height={px(1)} fill="#00ff88" />
      {/* Mouth speaker grille */}
      <rect x={px(6)} y={px(6)} width={px(4)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(6)} width={px(1)} height={px(1)} fill="#00ff88" />
      <rect x={px(8)} y={px(6)} width={px(1)} height={px(1)} fill="#00ff88" />
      {/* Body */}
      <rect x={px(4)} y={px(8)} width={px(8)} height={px(6)} fill="#0099cc" />
      <rect x={px(5)} y={px(9)} width={px(6)} height={px(4)} fill="#0a0e1a" />
      {/* Chest indicator light */}
      <rect x={px(7)} y={px(10)} width={px(2)} height={px(2)} fill="#ffe66d" />
      <rect x={px(7)} y={px(10)} width={px(1)} height={px(1)} fill="#ffffff" opacity={0.7} />
      {/* Arms (angular, robotic) */}
      <rect x={px(1)} y={px(9)} width={px(3)} height={px(2)} fill="#00d4ff" />
      <rect x={px(12)} y={px(9)} width={px(3)} height={px(2)} fill="#00d4ff" />
      {/* Feet */}
      <rect x={px(5)} y={px(14)} width={px(2)} height={px(2)} fill="#00d4ff" />
      <rect x={px(9)} y={px(14)} width={px(2)} height={px(2)} fill="#00d4ff" />
    </svg>
  );
}

function PixelAvatar({ rank = 1, size = 40 }: { rank?: number; size?: number }) {
  const colors = ["#00ff88", "#ff6b35", "#4ecdc4", "#ffe66d", "#ff2d55", "#c77dff", "#4ecdc4", "#ff6b35", "#6b8ba4"];
  const c = colors[(rank - 1) % colors.length];
  const s = size / 16;
  const px = (n: number) => n * s;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      <rect x={px(4)} y={px(1)} width={px(8)} height={px(7)} fill={c} />
      <rect x={px(5)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(9)} y={px(3)} width={px(2)} height={px(2)} fill="#0a0e1a" />
      <rect x={px(6)} y={px(6)} width={px(4)} height={px(1)} fill="#0a0e1a" />
      <rect x={px(4)} y={px(8)} width={px(8)} height={px(5)} fill={c} />
      <rect x={px(2)} y={px(9)} width={px(2)} height={px(2)} fill={c} />
      <rect x={px(12)} y={px(9)} width={px(2)} height={px(2)} fill={c} />
      <rect x={px(5)} y={px(13)} width={px(2)} height={px(3)} fill={c} />
      <rect x={px(9)} y={px(13)} width={px(2)} height={px(3)} fill={c} />
    </svg>
  );
}

function PixelPhone({ ringing = false }: { ringing?: boolean }) {
  const [tilt, setTilt] = useState(0);
  useEffect(() => {
    if (!ringing) return;
    const t = setInterval(() => setTilt((v) => (v === 0 ? -4 : v === -4 ? 4 : 0)), 150);
    return () => clearInterval(t);
  }, [ringing]);
  return (
    <div style={{ transform: `rotate(${tilt}deg)`, transition: "transform 0.1s", display: "inline-block" }}>
      <svg width={80} height={80} viewBox="0 0 80 80" style={{ imageRendering: "pixelated" }}>
        <rect x={16} y={8} width={48} height={64} fill="#2a3a5c" />
        <rect x={20} y={12} width={40} height={56} fill="#111827" />
        <rect x={24} y={16} width={32} height={40} fill="#1a2340" />
        <rect x={28} y={60} width={24} height={4} fill="#2a3a5c" />
        <rect x={34} y={62} width={12} height={2} fill="#4ecdc4" />
        {ringing && (
          <>
            <rect x={8} y={24} width={4} height={4} fill="#ffe66d" />
            <rect x={68} y={24} width={4} height={4} fill="#ffe66d" />
            <rect x={8} y={32} width={4} height={4} fill="#ffe66d" />
            <rect x={68} y={32} width={4} height={4} fill="#ffe66d" />
          </>
        )}
      </svg>
    </div>
  );
}

function PixelBtn({
  children,
  onClick,
  color = "#00ff88",
  textColor = "#0a0e1a",
  size = "md",
  full = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  color?: string;
  textColor?: string;
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const pad = size === "lg" ? "px-6 py-4" : size === "sm" ? "px-3 py-2" : "px-4 py-3";
  const txt = size === "lg" ? "text-[10px]" : size === "sm" ? "text-[7px]" : "text-[8px]";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        backgroundColor: disabled ? "#2a3a5c" : color,
        color: disabled ? "#6b8ba4" : textColor,
        border: `4px solid ${disabled ? "#1a2340" : "#0a0e1a"}`,
        boxShadow: pressed || disabled ? "none" : `4px 4px 0px #0a0e1a`,
        transform: pressed ? "translate(4px, 4px)" : "translate(0,0)",
        fontFamily: "'Press Start 2P', monospace",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "transform 0.05s, box-shadow 0.05s",
        imageRendering: "pixelated",
      }}
      className={`${pad} ${txt} ${full ? "w-full" : ""} select-none outline-none`}
    >
      {children}
    </button>
  );
}

function PixelPanel({
  children,
  className = "",
  accent = "#2a3a5c",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: `4px solid ${accent}`,
        boxShadow: `4px 4px 0px ${accent}`,
      }}
      className={`p-4 ${className}`}
    >
      {children}
    </div>
  );
}

function XPBar({ current, max, color = "#00ff88" }: { current: number; max: number; color?: string }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full" style={{ border: "3px solid #2a3a5c", backgroundColor: "#0a0e1a", height: 16 }}>
      <div style={{ width: `${pct}%`, backgroundColor: color, height: "100%", transition: "width 0.5s" }} />
    </div>
  );
}

// `min` is the dimmed opacity. Default 0 (a true blink) suits the scam-warning text,
// where vanishing is the point. Anything the user is meant to TAP should set a floor so
// it never fully disappears — an invisible call-to-action reads as "not there yet".
function Blink({ children, ms = 600, min = 0 }: { children: React.ReactNode; ms?: number; min?: number }) {
  const [vis, setVis] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setVis((v) => !v), ms);
    return () => clearInterval(t);
  }, [ms]);
  return <span style={{ opacity: vis ? 1 : min, transition: `opacity ${Math.round(ms / 3)}ms linear` }}>{children}</span>;
}

function Scanlines() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }}
    />
  );
}

function Stars() {
  const stars = Array.from({ length: 40 }, (_, i) => ({
    x: ((i * 137.5) % 100).toFixed(1),
    y: ((i * 73.1) % 100).toFixed(1),
    s: i % 3 === 0 ? 2 : 1,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.s,
            height: s.s,
            backgroundColor: "#ffffff",
            opacity: 0.3 + (i % 4) * 0.15,
            animation: `twinkle ${1.5 + (i % 3) * 0.7}s ease-in-out infinite`,
            animationDelay: `${(i % 7) * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
}

// On a desktop this draws a phone-shaped mockup. On an actual phone that mockup is the
// problem: a fixed 390x844 box either overflows a small screen or floats in the middle of
// a large one. So below ~520px we drop the bezel and go full-bleed, and above it we keep
// the mockup but never let it exceed the viewport.
//
// Height uses dvh where supported: on mobile browsers 100vh includes the collapsing
// URL bar, which leaves the bottom nav cut off until the user scrolls.
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 520,
  );
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth <= 520);
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const inner: React.CSSProperties = compact
    ? { width: "100%", height: "100dvh", backgroundColor: "#0a0e1a" }
    : {
        width: "min(390px, 100vw)",
        height: "min(844px, 100dvh)",
        backgroundColor: "#0a0e1a",
        border: "6px solid #2a3a5c",
        boxShadow: "8px 8px 0px #000, 0 0 40px rgba(0,255,136,0.15)",
      };

  return (
    <div
      className="flex items-center justify-center w-full bg-[#05080f]"
      style={{ height: compact ? "100dvh" : undefined, minHeight: compact ? undefined : "100vh" }}
    >
      <div className="relative overflow-hidden flex flex-col" style={inner}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// GEAR ICON
// ─────────────────────────────────────────────────────────────────────────
function IconGear({ size = 16, color = "#6b8ba4" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
      <rect x={4} y={0} width={4} height={2} fill={color} />
      <rect x={0} y={4} width={2} height={4} fill={color} />
      <rect x={10} y={4} width={2} height={4} fill={color} />
      <rect x={4} y={10} width={4} height={2} fill={color} />
      <rect x={2} y={2} width={8} height={8} fill={color} />
      <rect x={4} y={4} width={4} height={4} fill="#0a0e1a" />
      <rect x={5} y={5} width={2} height={2} fill={color} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// APP HEADER
// ─────────────────────────────────────────────────────────────────────────
function AppHeader({
  title,
  titleColor,
  hasUnreadNotifications = false,
  onChat,
  onNotifications,
  onSettings,
}: {
  title: string;
  titleColor: string;
  hasUnreadNotifications?: boolean;
  onChat: () => void;
  onNotifications: () => void;
  onSettings: () => void;
}) {
  return (
    <div
      style={{
        padding: "0 16px",
        minHeight: 52,
        backgroundColor: "#0a0e1a",
        borderBottom: "4px solid #2a3a5c",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: titleColor }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={onChat}
          aria-label="Open family chat"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconChat size={18} color="#4ecdc4" />
        </button>
        <button
          onClick={onNotifications}
          aria-label="Open notifications"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", position: "relative" }}
        >
          <IconBell size={18} color="#ffe66d" />
          {hasUnreadNotifications && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                backgroundColor: "#ff2d55",
                border: "1px solid #0a0e1a",
              }}
            />
          )}
        </button>
        <button
          onClick={onSettings}
          aria-label="Open settings"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconGear size={18} color="#6b8ba4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SUB-PAGE HEADER
// ─────────────────────────────────────────────────────────────────────────
function SubPageHeader({
  title,
  titleColor,
  onBack,
}: {
  title: string;
  titleColor: string;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        padding: "0 16px",
        minHeight: 52,
        backgroundColor: "#0a0e1a",
        borderBottom: "4px solid #2a3a5c",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        aria-label="Go back"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
      >
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: "#6b8ba4" }}>{"< BACK"}</div>
      </button>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: titleColor }}>{title}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FLAG DATA
// ─────────────────────────────────────────────────────────────────────────
type DrillFlag = { id: string; name: string; explanation: string };

const RED_FLAGS: DrillFlag[] = [
  { id: "impersonation", name: "IMPERSONATION", explanation: "The real IRS contacts you by postal mail first — never by surprise phone call claiming urgent fraud." },
  { id: "arrest_threat", name: "ARREST THREAT", explanation: "No government agency threatens arrest over the phone. Fake legal threats bypass rational thinking." },
  { id: "gift_card", name: "GIFT CARD DEMAND", explanation: "No legitimate agency accepts gift cards as payment. Gift cards are untraceable — perfect for scammers." },
  { id: "urgency", name: "FAKE URGENCY", explanation: "Pressure to act RIGHT NOW stops you verifying anything. Scammers need you panicked, not thinking." },
  { id: "escalation", name: "FAKE ESCALATION", explanation: "Threatening to send police is a scare tactic. Real law enforcement does not coordinate with phone callers." },
];

const SMS_FLAGS: DrillFlag[] = [
  { id: "sms_sender", name: "UNKNOWN SENDER", explanation: "Legitimate delivery companies use official sender IDs, not random numbers or unrecognised names." },
  { id: "sms_urgency", name: "FAKE URGENCY", explanation: "Deadlines pressure you to act without thinking. Real parcels give you more than a few hours." },
  { id: "sms_link", name: "SUSPICIOUS LINK", explanation: "Real organisations rarely ask you to update payment details through random shortened links." },
  { id: "sms_payment", name: "SMALL PAYMENT TRICK", explanation: "Scammers use tiny fees like $1.99 to make the request feel harmless — but they want your card details." },
  { id: "sms_card", name: "CARD DETAILS REQUEST", explanation: "Never enter card details on a page reached through an SMS link. Use the official website directly." },
];

const EMAIL_FLAGS: DrillFlag[] = [
  { id: "email_domain", name: "SUSPICIOUS DOMAIN", explanation: "The sender domain 'campus-secure.example' is not an official institution address. Always verify the full email." },
  { id: "email_reward", name: "TOO GOOD TO BE TRUE", explanation: "Unexpected cash rewards are a classic lure. Legitimate programmes do not contact you out of the blue." },
  { id: "email_urgency", name: "FAKE URGENCY", explanation: "Scammers create time pressure — '30 minutes only' — so you act before checking if it is real." },
  { id: "email_verify", name: "CREDENTIAL THEFT", explanation: "'Verify your account' often leads to fake login pages designed to steal your password and ID." },
  { id: "email_attachment", name: "DANGEROUS ATTACHMENT", explanation: "ZIP files can hide malware, ransomware, or fake forms. Never open unexpected attachments." },
  { id: "email_threat", name: "THREAT LANGUAGE", explanation: "Warnings like 'reward will be reassigned' are designed to scare you into acting without thinking." },
];

const FLAG_MAP: Record<string, DrillFlag> = Object.fromEntries(
  [...RED_FLAGS, ...SMS_FLAGS, ...EMAIL_FLAGS].map((f) => [f.id, f])
);

// ─────────────────────────────────────────────────────────────────────────
// LEADERBOARD DATA
// ─────────────────────────────────────────────────────────────────────────
const HALL_OF_FAME = [
  { rank: 1, name: "PIXEL_HERO", score: 9842, wins: 98, area: "Downtown" },
  { rank: 2, name: "SCAM_BSTR", score: 8710, wins: 87, area: "Midtown" },
  { rank: 3, name: "SAFE_KING", score: 7355, wins: 73, area: "Uptown" },
  { rank: 4, name: "SHIELD_UP", score: 6201, wins: 62, area: "Eastside" },
  { rank: 5, name: "NO_SCAM_4U", score: 5988, wins: 59, area: "Westside" },
  { rank: 6, name: "DEFENDER1", score: 4422, wins: 44, area: "Southside" },
  { rank: 7, name: "IRONWALL", score: 3981, wins: 39, area: "Northside" },
  { rank: 8, name: "GUARDIAN7", score: 3100, wins: 31, area: "Downtown" },
];

const HALL_OF_SHAME = [
  { rank: 1, name: "GULLIBLE_G", scammed: 47, loss: 12400, area: "Westside" },
  { rank: 2, name: "EASY_MARK", scammed: 38, loss: 9800, area: "Uptown" },
  { rank: 3, name: "CLK_ANYTHING", scammed: 31, loss: 7200, area: "Midtown" },
  { rank: 4, name: "OOPS_IDIDIT", scammed: 24, loss: 4100, area: "Eastside" },
  { rank: 5, name: "NOTSCAMPROOF", scammed: 18, loss: 3300, area: "Downtown" },
  { rank: 6, name: "TRYHRDR_NXT", scammed: 12, loss: 2100, area: "Southside" },
  { rank: 7, name: "DEFENDER1", scammed: 7, loss: 900, area: "Southside" },
  { rank: 8, name: "PLAYER_001", scammed: 3, loss: 400, area: "Downtown" },
];

// ─────────────────────────────────────────────────────────────────────────
// FURNITURE STORE
// ─────────────────────────────────────────────────────────────────────────
const FURNITURE_STORE: FurnitureItem[] = [
  { id: "grandma-chair",   name: "ARMCHAIR",      sellValue: 80,  memberId: "grandma" },
  { id: "grandma-shelf",   name: "BOOKSHELF",     sellValue: 60,  memberId: "grandma" },
  { id: "grandma-lamp",    name: "TABLE LAMP",    sellValue: 55,  memberId: "grandma" },
  { id: "grandma-frame",   name: "PICTURE FRAME", sellValue: 45,  memberId: "grandma" },
  { id: "mum-plant",       name: "POT PLANT",     sellValue: 40,  memberId: "mum"     },
  { id: "mum-desk",        name: "WORK DESK",     sellValue: 90,  memberId: "mum"     },
  { id: "mum-laptop",      name: "LAPTOP",        sellValue: 110, memberId: "mum"     },
  { id: "mum-phone",       name: "PHONE",         sellValue: 35,  memberId: "mum"     },
  { id: "dad-tv",          name: "TV SET",        sellValue: 120, memberId: "dad"     },
  { id: "dad-couch",       name: "COUCH",         sellValue: 100, memberId: "dad"     },
  { id: "dad-cabinet",     name: "CABINET",       sellValue: 65,  memberId: "dad"     },
  { id: "dad-door",        name: "DOOR",          sellValue: 45,  memberId: "dad"     },
  { id: "dad-shower",      name: "SHOWER",        sellValue: 50,  memberId: "dad"     },
  { id: "kid-bed",         name: "BED",           sellValue: 70,  memberId: "kid"     },
  { id: "kid-toybox",      name: "TOY BOX",       sellValue: 30,  memberId: "kid"     },
  { id: "kid-teddy",       name: "TEDDY BEAR",    sellValue: 25,  memberId: "kid"     },
  { id: "kid-alarm",       name: "ALARM CLOCK",   sellValue: 20,  memberId: "kid"     },
];

// ─────────────────────────────────────────────────────────────────────────
// SHOP CATALOGUE — buyable furniture (distinct from FURNITURE_STORE which is
// pre-owned sellable items). Members buy from here; items land in
// purchasedItems[memberId] and become placeable via CustomizeScreen.
// ─────────────────────────────────────────────────────────────────────────
type ShopItem = {
  id: string;
  name: string;
  cost: number;
  color: string;
  // Which shop-item pixel-art to render; distinct namespace from FurnitureIcon.
  art: "sofa" | "lamp" | "plant" | "tv" | "rug" | "bookshelf" | "bed" | "window";
};

const SHOP_CATALOGUE: ShopItem[] = [
  { id: "shop-sofa",      name: "PIXEL SOFA",   cost: 50,  color: "#4ecdc4", art: "sofa" },
  { id: "shop-lamp",      name: "PIXEL LAMP",   cost: 25,  color: "#ffe66d", art: "lamp" },
  { id: "shop-plant",     name: "PIXEL PLANT",  cost: 30,  color: "#00ff88", art: "plant" },
  { id: "shop-tv",        name: "PIXEL TV",     cost: 80,  color: "#ff6b35", art: "tv" },
  { id: "shop-rug",       name: "PIXEL RUG",    cost: 60,  color: "#ff6b35", art: "rug" },
  { id: "shop-bookshelf", name: "BOOKSHELF",    cost: 90,  color: "#ff6b35", art: "bookshelf" },
  { id: "shop-bed",       name: "PIXEL BED",    cost: 120, color: "#4ecdc4", art: "bed" },
  { id: "shop-window",    name: "PIXEL WINDOW", cost: 200, color: "#4ecdc4", art: "window" },
];

// ─────────────────────────────────────────────────────────────────────────
// SHOP FURNITURE ART — inline pixel-art renders for each ShopItem.art key
// ─────────────────────────────────────────────────────────────────────────
function ShopFurnitureArt({ art, size = 48 }: { art: ShopItem["art"]; size?: number }) {
  const s = size;
  switch (art) {
    case "sofa": return (
      <svg width={s} height={s * 0.75} viewBox="0 0 12 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={4} width={10} height={4} fill="#4ecdc4" />
        <rect x={0} y={3} width={2} height={6} fill="#4ecdc4" />
        <rect x={10} y={3} width={2} height={6} fill="#4ecdc4" />
        <rect x={1} y={2} width={10} height={3} fill="#4ecdc4" opacity={0.85} />
        <rect x={2} y={7} width={2} height={2} fill="#0a0e1a" />
        <rect x={8} y={7} width={2} height={2} fill="#0a0e1a" />
        <rect x={2} y={3} width={8} height={1} fill="#3aa8a0" />
      </svg>
    );
    case "lamp": return (
      <svg width={s * 0.66} height={s} viewBox="0 0 8 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={6} height={4} fill="#ffe66d" />
        <rect x={0} y={1} width={8} height={2} fill="#ffe66d" />
        <rect x={2} y={4} width={4} height={1} fill="#ffe66d" opacity={0.7} />
        <rect x={2} y={2} width={4} height={2} fill="#fff3a0" opacity={0.7} />
        <rect x={3} y={5} width={2} height={5} fill="#8b5e3c" />
        <rect x={1} y={10} width={6} height={1} fill="#8b5e3c" />
        <rect x={0} y={11} width={8} height={1} fill="#6b4020" />
      </svg>
    );
    case "plant": return (
      <svg width={s} height={s} viewBox="0 0 12 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={4} y={0} width={4} height={3} fill="#00ff88" />
        <rect x={2} y={2} width={8} height={4} fill="#00ff88" />
        <rect x={3} y={1} width={6} height={4} fill="#00cc66" />
        <rect x={5} y={5} width={2} height={2} fill="#006633" />
        <rect x={3} y={7} width={6} height={1} fill="#cd7f32" />
        <rect x={2} y={8} width={8} height={4} fill="#8b5e3c" />
        <rect x={3} y={8} width={6} height={3} fill="#a06840" />
        <rect x={3} y={11} width={6} height={1} fill="#5a3010" />
      </svg>
    );
    case "tv": return (
      <svg width={s} height={s * 0.75} viewBox="0 0 12 9" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={12} height={7} fill="#ff6b35" />
        <rect x={1} y={1} width={10} height={5} fill="#0a0e1a" />
        <rect x={2} y={2} width={4} height={2} fill="#4ecdc4" opacity={0.4} />
        <rect x={7} y={2} width={2} height={1} fill="#ffe66d" opacity={0.5} />
        <rect x={10} y={1} width={1} height={1} fill="#00ff88" />
        <rect x={5} y={7} width={2} height={1} fill="#ff6b35" />
        <rect x={3} y={8} width={6} height={1} fill="#ff6b35" />
      </svg>
    );
    case "rug": return (
      <svg width={s} height={s * 0.6} viewBox="0 0 12 7" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={1} y={0} width={10} height={7} fill="#ff6b35" />
        <rect x={0} y={1} width={12} height={5} fill="#ff6b35" />
        <rect x={2} y={2} width={8} height={3} fill="#ff8855" />
        <rect x={4} y={3} width={4} height={1} fill="#ffe66d" opacity={0.6} />
        <rect x={5} y={2} width={2} height={3} fill="#ffe66d" opacity={0.5} />
        <rect x={0} y={0} width={1} height={1} fill="#ffe66d" />
        <rect x={11} y={0} width={1} height={1} fill="#ffe66d" />
        <rect x={0} y={6} width={1} height={1} fill="#ffe66d" />
        <rect x={11} y={6} width={1} height={1} fill="#ffe66d" />
      </svg>
    );
    case "bookshelf": return (
      <svg width={s * 0.85} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={12} fill="#ff6b35" />
        <rect x={1} y={1} width={8} height={10} fill="#0a0e1a" />
        <rect x={0} y={4} width={10} height={1} fill="#ff6b35" />
        <rect x={0} y={7} width={10} height={1} fill="#ff6b35" />
        <rect x={1} y={1} width={2} height={3} fill="#4ecdc4" />
        <rect x={3} y={1} width={1} height={3} fill="#ffe66d" />
        <rect x={5} y={1} width={2} height={3} fill="#00ff88" />
        <rect x={7} y={1} width={2} height={3} fill="#c77dff" />
        <rect x={1} y={5} width={3} height={2} fill="#ffe66d" />
        <rect x={4} y={5} width={2} height={2} fill="#4ecdc4" />
        <rect x={6} y={5} width={3} height={2} fill="#ff2d55" opacity={0.7} />
        <rect x={1} y={8} width={2} height={3} fill="#00ff88" />
        <rect x={3} y={8} width={4} height={3} fill="#4ecdc4" opacity={0.6} />
        <rect x={7} y={8} width={2} height={3} fill="#ffe66d" />
      </svg>
    );
    case "bed": return (
      <svg width={s} height={s * 0.7} viewBox="0 0 12 8" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={2} width={12} height={5} fill="#4ecdc4" />
        <rect x={0} y={1} width={2} height={6} fill="#3aa8a0" />
        <rect x={10} y={1} width={2} height={6} fill="#3aa8a0" />
        <rect x={2} y={3} width={4} height={2} fill="#ffffff" opacity={0.7} />
        <rect x={6} y={3} width={4} height={3} fill="#4ecdc4" opacity={0.7} />
        <rect x={1} y={7} width={2} height={1} fill="#0a0e1a" />
        <rect x={9} y={7} width={2} height={1} fill="#0a0e1a" />
      </svg>
    );
    case "window": return (
      <svg width={s * 0.85} height={s} viewBox="0 0 10 12" style={{ imageRendering: "pixelated", display: "block" }}>
        <rect x={0} y={0} width={10} height={12} fill="#4ecdc4" />
        <rect x={1} y={1} width={8} height={10} fill="#0a0e1a" />
        <rect x={1} y={1} width={4} height={4} fill="#4ecdc4" opacity={0.35} />
        <rect x={5} y={1} width={4} height={4} fill="#4ecdc4" opacity={0.35} />
        <rect x={1} y={6} width={4} height={5} fill="#4ecdc4" opacity={0.35} />
        <rect x={5} y={6} width={4} height={5} fill="#4ecdc4" opacity={0.35} />
        <rect x={4} y={1} width={2} height={10} fill="#4ecdc4" />
        <rect x={1} y={5} width={8} height={1} fill="#4ecdc4" />
        <rect x={3} y={2} width={1} height={2} fill="#ffe66d" opacity={0.5} />
      </svg>
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FLAG TOOLTIP
// ─────────────────────────────────────────────────────────────────────────
function FlagTooltip({ flag, onClose }: { flag: DrillFlag; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        backgroundColor: "rgba(10,14,26,0.95)",
        borderTop: "3px solid #ff2d55",
        padding: "12px 16px 16px",
        backdropFilter: "blur(4px)",
        animation: "slideUp 0.15s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <IconWarning size={16} color="#ff2d55" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ff2d55", marginBottom: 6, letterSpacing: 1 }}>
            {flag.name}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 1.5 }}>
            {flag.explanation}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4 }}>
          <IconX size={12} color="#6b8ba4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ANNOTATED MESSAGE
// ─────────────────────────────────────────────────────────────────────────
type Highlight = { phrase: string; flagId: string };

function AnnotatedMessage({
  text,
  highlights = [],
  onFlagTap,
}: {
  text: string;
  highlights?: Highlight[];
  onFlagTap: (flagId: string) => void;
}) {
  if (highlights.length === 0) return <>{text}</>;
  const sorted = [...highlights].sort((a, b) => text.indexOf(a.phrase) - text.indexOf(b.phrase));
  const segments: { text: string; flagId?: string }[] = [];
  let cursor = 0;
  for (const h of sorted) {
    const idx = text.indexOf(h.phrase, cursor);
    if (idx === -1) continue;
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx) });
    segments.push({ text: h.phrase, flagId: h.flagId });
    cursor = idx + h.phrase.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return (
    <>
      {segments.map((seg, i) =>
        seg.flagId ? (
          <span
            key={i}
            onClick={(e) => { e.stopPropagation(); onFlagTap(seg.flagId!); }}
            style={{
              color: "#ff2d55",
              backgroundColor: "rgba(255,45,85,0.18)",
              borderBottom: "2px solid #ff2d55",
              cursor: "pointer",
              padding: "0 2px",
              fontWeight: "bold",
            }}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN 1: TITLE
// ─────────────────────────────────────────────────────────────────────────
function TitleScreen({ onNext }: { onNext: () => void }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-between h-full px-6 py-10 overflow-hidden">
      <Stars />
      <div className="relative z-10 flex flex-col items-center gap-2 mt-8">
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 28,
            color: "#00ff88",
            textShadow: glitch
              ? "4px 0 #ff2d55, -4px 0 #4ecdc4"
              : "4px 4px 0 #006633, 0 0 20px rgba(0,255,136,0.5)",
            letterSpacing: 2,
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          DRILL<br />MODE
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#4ecdc4", letterSpacing: 3, marginTop: 4 }}>
          SCAM FIGHTER
        </div>
        <div className="flex gap-2 mt-2">
          {["#ff6b35", "#ffe66d", "#00ff88", "#4ecdc4", "#ff2d55"].map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        <PixelMascot size={128} animate />
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 20, color: "#ffe66d", textAlign: "center" }}>
          DEFEND YOUR MIND.<br />DEFEAT THE SCAMMERS.
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 mb-4">
        <Blink ms={700} min={0.5}>
          <PixelBtn onClick={onNext} color="#00ff88" size="lg">[ PRESS START ]</PixelBtn>
        </Blink>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#2a3a5c" }}>
          v2.0.0 © 2024 DRILL MODE
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: DRILL SELECT 
// ─────────────────────────────────────────────────────────────────────────
function DrillSelectScreen({
  onCall, onSms, onEmail, onRealisticPhone, onTelegram, onRealisticEmail, onBack,
}: {
  onCall: () => void;
  onSms: () => void;
  onEmail: () => void;
  onRealisticPhone: () => void;
  onTelegram: () => void;
  onRealisticEmail: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center justify-between px-4" style={{ borderBottom: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>{"< BACK"}</div>
        </button>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#00ff88" }}>CHOOSE DRILL</div>
        <div style={{ width: 40 }} />
      </div>

      <div className="flex flex-col gap-4 px-4 py-5 flex-1">
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#6b8ba4", textAlign: "center", lineHeight: 1.4 }}>
          Train against different scam attacks.
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#00ff88", letterSpacing: 2 }}>GAME DRILLS</div>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4", textAlign: "center", marginTop: -4, lineHeight: 1.4 }}>
          In-app simulations. Full coin rewards.
        </div>

        <div style={{ backgroundColor: "#111827", border: "4px solid #ff6b35", boxShadow: "4px 4px 0 #ff6b35", padding: "20px 16px" }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ filter: "drop-shadow(0 0 6px rgba(255,107,53,0.8))" }}>
              <IconPhone size={28} color="#ff6b35" />
            </div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ff6b35" }}>PHONE CALL</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#2a3a5c", marginTop: 3 }}>CLASSIC SCAM DRILL</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", marginBottom: 14, lineHeight: 1.5 }}>
            Listen carefully. Hang up before it is too late.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCoin size={10} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffe66d" }}>WIN +50  ·  LOSE -25</div>
          </div>
          <PixelBtn onClick={onCall} color="#ff6b35" textColor="#0a0e1a" size="md" full>START CALL DRILL</PixelBtn>
        </div>

        <div style={{ backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "4px 4px 0 #4ecdc4", padding: "20px 16px" }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ filter: "drop-shadow(0 0 6px rgba(78,205,196,0.8))" }}>
              <IconChatBubble size={28} color="#4ecdc4" />
            </div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#4ecdc4" }}>SMS MESSAGE</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#2a3a5c", marginTop: 3 }}>PARCEL SCAM</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", marginBottom: 14, lineHeight: 1.5 }}>
            Spot suspicious links and fake urgency.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCoin size={10} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffe66d" }}>WIN +40  ·  LOSE -20</div>
          </div>
          <PixelBtn onClick={onSms} color="#4ecdc4" textColor="#0a0e1a" size="md" full>START SMS DRILL</PixelBtn>
        </div>

        <div style={{ backgroundColor: "#111827", border: "4px solid #c77dff", boxShadow: "4px 4px 0 #c77dff", padding: "20px 16px" }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ filter: "drop-shadow(0 0 6px rgba(199,125,255,0.8))" }}>
              <IconEnvelope size={28} color="#c77dff" />
            </div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#c77dff" }}>EMAIL TRAP</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#2a3a5c", marginTop: 3 }}>PHISHING DRILL</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", marginBottom: 14, lineHeight: 1.5 }}>
            Inspect the email before clicking.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCoin size={10} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffe66d" }}>WIN +60  ·  LOSE -30</div>
          </div>
          <PixelBtn onClick={onEmail} color="#c77dff" textColor="#0a0e1a" size="md" full>START EMAIL DRILL</PixelBtn>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#00d4ff", letterSpacing: 2 }}>REALISTIC DRILLS</div>
          <div style={{ flex: 1, height: 2, backgroundColor: "#2a3a5c" }} />
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4", textAlign: "center", marginTop: -4, lineHeight: 1.4 }}>
          External training. Backend integration required.
        </div>

        <div style={{ backgroundColor: "#111827", border: "4px solid #00ff88", boxShadow: "4px 4px 0 #00ff88", padding: "20px 16px" }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ filter: "drop-shadow(0 0 6px rgba(0,255,136,0.8))" }}>
              <IconPhone size={28} color="#00ff88" />
            </div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#00ff88" }}>REAL PHONE CALL</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#2a3a5c", marginTop: 3 }}>SENT TO YOUR PHONE</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", marginBottom: 14, lineHeight: 1.5 }}>
            Receive a simulated scam call on your registered phone number.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCoin size={10} color="#6b8ba4" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>COINS: PENDING BACKEND</div>
          </div>
          <PixelBtn onClick={onRealisticPhone} color="#00ff88" textColor="#0a0e1a" size="md" full>SETUP CALL DRILL</PixelBtn>
        </div>

        <div style={{ backgroundColor: "#111827", border: "4px solid #00d4ff", boxShadow: "4px 4px 0 #00d4ff", padding: "20px 16px" }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ filter: "drop-shadow(0 0 6px rgba(0,212,255,0.8))" }}>
              <IconTelegram size={28} color="#00d4ff" />
            </div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#00d4ff" }}>TELEGRAM BOT</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#2a3a5c", marginTop: 3 }}>REAL CONVERSATION</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", marginBottom: 14, lineHeight: 1.5 }}>
            Practice with our Telegram scam-fighter bot.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCoin size={10} color="#6b8ba4" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>COINS: PENDING BACKEND</div>
          </div>
          <PixelBtn onClick={onTelegram} color="#00d4ff" textColor="#0a0e1a" size="md" full>OPEN TELEGRAM DRILL</PixelBtn>
        </div>

        <div style={{ backgroundColor: "#111827", border: "4px solid #ff6b35", boxShadow: "4px 4px 0 #ff6b35", padding: "20px 16px" }}>
          <div className="flex items-center gap-3 mb-3">
            <div style={{ filter: "drop-shadow(0 0 6px rgba(255,107,53,0.8))" }}>
              <IconRealEmail size={28} color="#ff6b35" />
            </div>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ff6b35" }}>REAL INBOX EMAIL</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#2a3a5c", marginTop: 3 }}>SENT TO YOUR MAILBOX</div>
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", marginBottom: 14, lineHeight: 1.5 }}>
            Get simulated phishing emails in your real inbox.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconCoin size={10} color="#6b8ba4" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>COINS: PENDING BACKEND</div>
          </div>
          <PixelBtn onClick={onRealisticEmail} color="#ff6b35" textColor="#0a0e1a" size="md" full>SETUP REAL DRILL</PixelBtn>
        </div>

        <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK HOME</PixelBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: TELEGRAM DRILL INTRO — explains flow, then opens Telegram bot
// ─────────────────────────────────────────────────────────────────────────
const TELEGRAM_BOT_URL = "https://t.me/drillmodebot";

function TelegramDrillIntroScreen({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="TELEGRAM DRILL" titleColor="#00d4ff" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.8))" }}>
            <IconTelegram size={64} color="#00d4ff" />
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#00d4ff", textAlign: "center", textShadow: "3px 3px 0 #003a4a" }}>
            REAL BOT DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Talk to a real scam-fighter bot on Telegram.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #00d4ff", boxShadow: "3px 3px 0 #00d4ff", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#00d4ff", marginBottom: 10 }}>WHAT HAPPENS NEXT</div>
          {[
            "You will be sent to Telegram.",
            "Start a chat with our drill bot.",
            "Complete the scenarios in Telegram.",
            "Come back to the app when done.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#00d4ff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35", marginBottom: 4 }}>COIN REWARDS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
              Coins for this drill require backend integration. They will not be credited yet.
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "#0d1a24", border: "2px solid #2a3a5c", padding: "10px 12px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <IconLink size={12} color="#00d4ff" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00d4ff", flex: 1, wordBreak: "break-all" }}>
            {TELEGRAM_BOT_URL}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelBtn onClick={onOpen} color="#00d4ff" textColor="#0a0e1a" size="lg" full>[ OPEN TELEGRAM ]</PixelBtn>
          <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC PHONE DRILL INTRO — explains flow, disabled until backend
// ─────────────────────────────────────────────────────────────────────────
function RealisticPhoneDrillIntroScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL PHONE DRILL" titleColor="#00ff88" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(0,255,136,0.8))" }}>
            <IconPhone size={64} color="#00ff88" />
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#00ff88", textAlign: "center", textShadow: "3px 3px 0 #003a1f" }}>
            LIVE CALL DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Receive a simulated scam call on your real phone.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #00ff88", boxShadow: "3px 3px 0 #00ff88", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#00ff88", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We call your registered phone number.",
            "Answer the call as you normally would.",
            "Decide whether to engage, verify, or hang up.",
            "Return to the app to see your result.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#00ff88", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35", marginBottom: 4 }}>TRAINING CALL</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
              This is a simulated security drill. We will never ask for real passwords, OTPs, card details, transfers, or payments.
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(107,139,164,0.08)", border: "3px solid #6b8ba4", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconLock size={14} color="#6b8ba4" />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginBottom: 4 }}>BACKEND NOT CONFIGURED</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4", lineHeight: 1.5 }}>
              This drill requires telephony integration and a verified phone number. It will become available once the call-delivery backend is connected.
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35", marginBottom: 4 }}>COIN REWARDS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
              Coins will be credited automatically once the backend reports the call outcome.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelBtn onClick={() => {}} color="#2a3a5c" textColor="#6b8ba4" size="lg" full disabled>
            [ START CALL - COMING SOON ]
          </PixelBtn>
          <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC EMAIL DRILL INTRO — explains flow, disabled until backend
// ─────────────────────────────────────────────────────────────────────────
function RealisticEmailDrillIntroScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL EMAIL DRILL" titleColor="#ff6b35" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(255,107,53,0.8))" }}>
            <IconRealEmail size={64} color="#ff6b35" />
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#ff6b35", textAlign: "center", textShadow: "3px 3px 0 #4a1a08" }}>
            REAL INBOX DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#ffe66d", textAlign: "center", lineHeight: 1.4 }}>
            Get simulated phishing emails in your real mailbox.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #ff6b35", boxShadow: "3px 3px 0 #ff6b35", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff6b35", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We send 1-2 test emails to your registered address.",
            "Some are phishing. Some are safe.",
            "Handle them in your real email client.",
            "Return to the app to see your score.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#ff6b35", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(107,139,164,0.08)", border: "3px solid #6b8ba4", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconLock size={14} color="#6b8ba4" />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginBottom: 4 }}>BACKEND NOT CONFIGURED</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4", lineHeight: 1.5 }}>
              This drill requires email delivery infrastructure. Available in a future update once backend integration is complete.
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35", marginBottom: 4 }}>COIN REWARDS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
              Coins will be credited automatically once backend reports outcomes.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelBtn onClick={() => {}} color="#2a3a5c" textColor="#6b8ba4" size="lg" full disabled>
            [ SEND EMAILS - COMING SOON ]
          </PixelBtn>
          <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FAMILY HOME — types & data
// ─────────────────────────────────────────────────────────────────────────
type FamilyMember = {
  id: string; name: string; role: string;
  level: number; xp: number; xpMax: number;
  streak: number; timesSafe: number; timesScammed: number;
  safeThisWeek: boolean; recentDrillResult: "WON" | "LOST" | null;
  primaryColor: string; roomName: string; roomBg: string;
  badgeCount: number; badgeTotal: number;
  coins: number;
};

const FAMILY_MEMBERS: FamilyMember[] = [
  { id: "grandma", name: "GRANDMA", role: "ELDER GUARDIAN", level: 12, xp: 3800, xpMax: 4000, streak: 24, timesSafe: 89, timesScammed: 1, safeThisWeek: true, recentDrillResult: "WON", primaryColor: "#c77dff", roomName: "GRANDMA'S ROOM", roomBg: "#100c20", badgeCount: 7, badgeTotal: 9, coins: 1240 },
  { id: "mum", name: "MUM", role: "SHIELD BEARER", level: 9, xp: 2100, xpMax: 2500, streak: 16, timesSafe: 67, timesScammed: 2, safeThisWeek: true, recentDrillResult: "WON", primaryColor: "#00ff88", roomName: "MUM'S ROOM", roomBg: "#0c1a10", badgeCount: 5, badgeTotal: 9, coins: 850 },
  { id: "dad", name: "DAD", role: "ROOKIE", level: 4, xp: 890, xpMax: 1200, streak: 0, timesSafe: 23, timesScammed: 7, safeThisWeek: false, recentDrillResult: "LOST", primaryColor: "#4ecdc4", roomName: "DAD'S ROOM", roomBg: "#081420", badgeCount: 2, badgeTotal: 9, coins: -120 },
  { id: "kid", name: "KID", role: "TRAINEE", level: 3, xp: 450, xpMax: 800, streak: 5, timesSafe: 12, timesScammed: 3, safeThisWeek: true, recentDrillResult: "WON", primaryColor: "#ffe66d", roomName: "KID'S ROOM", roomBg: "#161408", badgeCount: 3, badgeTotal: 9, coins: 300 },
];

const MEMBER_MAP = Object.fromEntries(FAMILY_MEMBERS.map(m => [m.id, m]));

// Pixi — the AI coach. Not a real family member; synthetic entry for chat rendering.
const PIXI_MEMBER = {
  id: "pixi",
  name: "PIXI",
  primaryColor: "#00d4ff",
};

const INITIAL_CHAT: ChatMsg[] = [
  { memberId:"pixi", isPixi:true, text:"Hi family! I'm PIXI, your scam-fighter coach. I'll drop by after drills to share tips and celebrate wins.", time:"9:12 AM" },
  { memberId:"grandma", text:"Did everyone do their drill this week? I spotted three red flags in mine!", time:"9:14 AM" },
  { memberId:"mum",     text:"Yes! The IRS one was really convincing. I almost fell for the urgency tactic.", time:"9:16 AM" },
  { memberId:"dad",     text:"I failed mine... got tricked by the 'officer dispatch' threat. Feeling silly.", time:"9:18 AM" },
  { memberId:"mum",     text:"Don't be hard on yourself, Dad. That's exactly what they count on!", time:"9:19 AM" },
  { memberId:"grandma", text:"Remember — hang up first, verify later. That's the rule.", time:"9:21 AM" },
  { memberId:"kid",     text:"My teacher told us about gift card scams today at school! Just like in the app.", time:"9:24 AM" },
];

function useIdleFrame(fps = 2): number {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % 4), Math.floor(1000 / fps));
    return () => clearInterval(t);
  }, [fps]);
  return frame;
}

function CharGrandma({ size = 48, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 12;
  const yo = (frame === 1 || frame === 3) ? u * 0.5 : 0;
  const xo = (frame === 1 || frame === 2) ? u * 0.3 : -(u * 0.3);
  const H = size * 1.5;
  const r = (x: number, y: number, w: number, h: number, c: string, ox = 0, oy = 0) =>
    <rect key={`${x}${y}${c}`} x={(x + ox) * u} y={(y + oy) * u} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(4, 0, 4, 1, "#e0e0e0", xo, yo)}{r(3, 1, 6, 1, "#e0e0e0", xo, yo)}
      {r(3, 2, 6, 4, "#f4b880", xo, yo)}{r(2, 3, 8, 2, "#f4b880", xo, yo)}
      {r(4, 3, 1, 1, "#0a0e1a", xo, yo)}{r(7, 3, 1, 1, "#0a0e1a", xo, yo)}
      {r(4, 5, 1, 1, "#c8704a", xo, yo)}{r(5, 6, 2, 1, "#c8704a", xo, yo)}{r(7, 5, 1, 1, "#c8704a", xo, yo)}
      <rect x={(3 + xo) * u} y={(3 + yo) * u} width={2 * u} height={2 * u} fill="none" stroke="#2a3a5c" strokeWidth={u * 0.4} key="gl1" />
      <rect x={(7 + xo) * u} y={(3 + yo) * u} width={2 * u} height={2 * u} fill="none" stroke="#2a3a5c" strokeWidth={u * 0.4} key="gl2" />
      {r(3, 7, 6, 1, "#c77dff", xo, yo)}
      {r(2, 8, 8, 5, "#9b4dca", xo, yo)}{r(3, 8, 6, 5, "#c77dff", xo, yo)}
      {r(1, 11, 10, 3, "#9b4dca", xo, yo)}{r(2, 11, 8, 3, "#c77dff", xo, yo)}
      {r(1, 8, 2, 3, "#f4b880", xo, yo)}{r(9, 8, 2, 3, "#f4b880", xo, yo)}
      {r(10, 9, 1, 8, "#8b5e3c")}{r(9, 16, 3, 1, "#8b5e3c")}
      {r(4, 14, 2, 3, "#7a3a9a", xo, yo)}{r(7, 14, 2, 3, "#7a3a9a", xo, yo)}
      {r(3, 16, 3, 1, "#5a2a7a", xo, yo)}{r(6, 16, 3, 1, "#5a2a7a", xo, yo)}
    </svg>
  );
}

function CharMum({ size = 48, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 12;
  const yo = (frame === 1 || frame === 3) ? -u * 0.8 : 0;
  const H = size * 1.5;
  const r = (x: number, y: number, w: number, h: number, c: string) =>
    <rect key={`${x}${y}${c}`} x={x * u} y={(y * u) + yo} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(5, 0, 2, 1, "#3a2a1a")}{r(4, 1, 4, 1, "#3a2a1a")}
      {r(2, 3, 2, 3, "#3a2a1a")}{r(8, 3, 2, 3, "#3a2a1a")}
      {r(3, 2, 6, 5, "#f4b880")}{r(2, 3, 8, 3, "#f4b880")}
      {r(4, 4, 1, 1, "#0a0e1a")}{r(7, 4, 1, 1, "#0a0e1a")}
      {r(4, 6, 4, 1, "#c8704a")}{r(5, 7, 2, 1, "#c8704a")}
      {r(5, 7, 2, 1, "#f4b880")}
      {r(2, 8, 8, 4, "#006633")}{r(3, 8, 6, 4, "#00ff88")}
      {r(1, 8, 2, 4, "#f4b880")}{r(9, 8, 2, 4, "#f4b880")}
      {r(4, 9, 4, 2, "#00cc66")}
      {r(3, 12, 6, 3, "#1a3a2a")}
      {r(3, 15, 2, 2, "#1a3a2a")}{r(7, 15, 2, 2, "#1a3a2a")}
      {r(2, 16, 3, 1, "#0a1a12")}{r(6, 16, 3, 1, "#0a1a12")}
    </svg>
  );
}

function CharDad({ size = 52, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 12;
  const xo = frame < 2 ? u * 1 : -u * 1;
  const H = size * 1.55;
  const r = (x: number, y: number, w: number, h: number, c: string) =>
    <rect key={`${x}${y}${c}`} x={(x + xo) * u} y={y * u} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(3, 0, 6, 2, "#2a1a0a")}{r(2, 1, 8, 2, "#2a1a0a")}
      {r(2, 2, 8, 6, "#e8a060")}{r(1, 3, 10, 4, "#e8a060")}
      {r(3, 4, 2, 1, "#0a0e1a")}{r(7, 4, 2, 1, "#0a0e1a")}
      {r(2, 7, 8, 1, "#b06030")}
      {r(1, 8, 10, 5, "#1a4040")}{r(2, 8, 8, 5, "#4ecdc4")}
      {r(4, 8, 4, 1, "#ffffff")}
      {r(0, 8, 2, 5, "#e8a060")}{r(10, 8, 2, 5, "#e8a060")}
      {r(2, 13, 8, 1, "#0a0e1a")}
      {r(2, 14, 8, 3, "#2a3a4a")}
      {r(2, 16, 3, 1, "#2a3a4a")}{r(7, 16, 3, 1, "#2a3a4a")}
      {r(1, 17, 4, 1, "#1a2030")}{r(6, 17, 4, 1, "#1a2030")}
    </svg>
  );
}

function CharKid({ size = 40, frame = 0 }: { size?: number; frame?: number }) {
  const u = size / 10;
  const yo = (frame === 0 || frame === 2) ? -u * 1.2 : u * 0.4;
  const H = size * 1.6;
  const r = (x: number, y: number, w: number, h: number, c: string) =>
    <rect key={`${x}${y}${c}`} x={x * u} y={(y * u) + yo} width={w * u} height={h * u} fill={c} />;
  return (
    <svg width={size} height={H} viewBox={`0 0 ${size} ${H}`} style={{ imageRendering: "pixelated", overflow: "visible" }}>
      {r(2, 0, 1, 3, "#b8900a")}{r(4, 0, 1, 2, "#b8900a")}{r(6, 0, 1, 3, "#b8900a")}{r(8, 0, 1, 2, "#b8900a")}
      {r(1, 1, 8, 2, "#ffe66d")}
      {r(2, 2, 6, 5, "#f4c060")}{r(1, 3, 8, 3, "#f4c060")}
      {r(3, 4, 1, 2, "#0a0e1a")}{r(6, 4, 1, 2, "#0a0e1a")}
      {r(3, 4, 1, 1, "#ffffff")}{r(6, 4, 1, 1, "#ffffff")}
      {r(3, 6, 4, 1, "#c8704a")}{r(3, 7, 1, 1, "#c8704a")}{r(6, 7, 1, 1, "#c8704a")}
      {r(2, 7, 6, 4, "#aa9900")}{r(1, 8, 8, 3, "#ffe66d")}
      {r(4, 9, 2, 1, "#aa9900")}{r(3, 10, 4, 1, "#aa9900")}
      {r(0, 8, 2, 3, "#f4c060")}{r(8, 8, 2, 3, "#f4c060")}
      {r(2, 11, 6, 2, "#2a4aa4")}
      {r(2, 13, 2, 3, "#f4c060")}{r(6, 13, 2, 3, "#f4c060")}
      {r(1, 15, 3, 1, "#ffffff")}{r(5, 15, 3, 1, "#ffffff")}
      {r(1, 16, 4, 1, "#ff2d55")}{r(5, 16, 4, 1, "#ff2d55")}
    </svg>
  );
}

function FamilyChar({ id, size, frame }: { id: string; size?: number; frame?: number }) {
  if (id === "grandma") return <CharGrandma size={size} frame={frame} />;
  if (id === "mum") return <CharMum size={size} frame={frame} />;
  if (id === "dad") return <CharDad size={size} frame={frame} />;
  return <CharKid size={size} frame={frame} />;
}

function SafetyBadge({ safe, size = 20 }: { safe: boolean; size?: number }) {
  const color = safe ? "#00ff88" : "#ff2d55";
  const glow = safe ? "0 0 8px rgba(0,255,136,0.8)" : "0 0 8px rgba(255,45,85,0.8)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{ filter: `drop-shadow(${glow})` }}>
        <IconShield size={size} color={color} />
      </div>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color, letterSpacing: 0.5 }}>
        {safe ? "SAFE" : "SCAMMED"}
      </div>
    </div>
  );
}

function FurnitureGrandma() {
  return (
    <>
      <svg width={52} height={44} viewBox="0 0 13 11" style={{ imageRendering: "pixelated" }}>
        <rect x={0} y={4} width={13} height={2} fill="#5a2a7a" />
        <rect x={1} y={3} width={11} height={5} fill="#7a3a9a" />
        <rect x={2} y={5} width={9} height={4} fill="#9b4dca" />
        <rect x={0} y={3} width={2} height={8} fill="#5a2a7a" />
        <rect x={11} y={3} width={2} height={8} fill="#5a2a7a" />
        <rect x={2} y={9} width={3} height={2} fill="#3a1a5a" />
        <rect x={8} y={9} width={3} height={2} fill="#3a1a5a" />
      </svg>
      <svg width={44} height={56} viewBox="0 0 11 14" style={{ imageRendering: "pixelated" }}>
        <rect x={0} y={0} width={11} height={14} fill="#3a2a1a" />
        <rect x={1} y={1} width={9} height={2} fill="#c77dff" opacity={0.7} />
        <rect x={1} y={4} width={9} height={2} fill="#ffe66d" opacity={0.7} />
        <rect x={1} y={7} width={9} height={2} fill="#4ecdc4" opacity={0.7} />
        <rect x={1} y={10} width={9} height={2} fill="#ff6b35" opacity={0.7} />
      </svg>
    </>
  );
}

function FurnitureMum() {
  return (
    <>
      <svg width={28} height={44} viewBox="0 0 7 11" style={{ imageRendering: "pixelated" }}>
        <rect x={2} y={0} width={3} height={1} fill="#00ff88" />
        <rect x={1} y={1} width={5} height={1} fill="#00ff88" />
        <rect x={0} y={2} width={7} height={2} fill="#00cc66" />
        <rect x={2} y={5} width={3} height={1} fill="#8b5e3c" />
        <rect x={1} y={6} width={5} height={3} fill="#4a2a1a" />
        <rect x={2} y={9} width={3} height={2} fill="#4a2a1a" />
      </svg>
      <svg width={56} height={44} viewBox="0 0 14 11" style={{ imageRendering: "pixelated" }}>
        <rect x={0} y={4} width={14} height={2} fill="#2a3a2a" />
        <rect x={1} y={6} width={12} height={1} fill="#3a4a3a" />
        <rect x={1} y={7} width={2} height={4} fill="#1a2a1a" />
        <rect x={11} y={7} width={2} height={4} fill="#1a2a1a" />
        <rect x={4} y={0} width={7} height={5} fill="#0a0e1a" />
        <rect x={5} y={1} width={5} height={3} fill="#4ecdc4" opacity={0.3} />
        <rect x={6} y={2} width={3} height={1} fill="#00ff88" opacity={0.6} />
      </svg>
    </>
  );
}

function FurnitureDad() {
  return (
    <>
      <svg width={52} height={52} viewBox="0 0 13 13" style={{ imageRendering: "pixelated" }}>
        <rect x={1} y={0} width={11} height={7} fill="#0a0e1a" />
        <rect x={2} y={1} width={9} height={5} fill="#1a2340" />
        <rect x={3} y={2} width={3} height={2} fill="#4ecdc4" opacity={0.4} />
        <rect x={7} y={2} width={3} height={1} fill="#ff2d55" opacity={0.6} />
        <rect x={5} y={7} width={3} height={1} fill="#2a3a5c" />
        <rect x={2} y={8} width={9} height={2} fill="#2a3a5c" />
      </svg>
      <svg width={56} height={44} viewBox="0 0 14 11" style={{ imageRendering: "pixelated" }}>
        <rect x={0} y={3} width={14} height={2} fill="#1a2a3a" />
        <rect x={1} y={4} width={12} height={5} fill="#2a3a4a" />
        <rect x={2} y={5} width={10} height={4} fill="#3a4a5a" />
        <rect x={0} y={3} width={2} height={8} fill="#1a2a3a" />
        <rect x={12} y={3} width={2} height={8} fill="#1a2a3a" />
      </svg>
    </>
  );
}

function FurnitureKid() {
  return (
    <>
      <svg width={48} height={44} viewBox="0 0 12 11" style={{ imageRendering: "pixelated" }}>
        <rect x={0} y={2} width={12} height={2} fill="#ffe66d" />
        <rect x={0} y={4} width={12} height={5} fill="#2a4aa4" />
        <rect x={1} y={5} width={10} height={3} fill="#3a5ab4" />
        <rect x={0} y={9} width={12} height={2} fill="#1a2a7a" />
        <rect x={1} y={2} width={4} height={3} fill="#ffffff" opacity={0.8} />
      </svg>
      <svg width={36} height={32} viewBox="0 0 9 8" style={{ imageRendering: "pixelated" }}>
        <rect x={0} y={1} width={9} height={7} fill="#aa7700" />
        <rect x={1} y={2} width={7} height={5} fill="#cc9900" />
        <rect x={0} y={0} width={9} height={2} fill="#ffe66d" />
        <rect x={3} y={0} width={3} height={2} fill="#ff6b35" />
        <rect x={2} y={3} width={2} height={2} fill="#ff2d55" opacity={0.7} />
        <rect x={5} y={3} width={2} height={2} fill="#00ff88" opacity={0.7} />
      </svg>
    </>
  );
}

function DollhouseRoom({ member, onTap, coins, soldItems }: { member: FamilyMember; onTap: (m: FamilyMember) => void; coins: number; soldItems: string[] }) {
  const frame = useIdleFrame(member.id === "kid" ? 3 : 2);
  const charSize = member.id === "dad" ? 48 : member.id === "kid" ? 36 : 44;
  const isInDebt = coins < 0;
  return (
    <button onClick={() => onTap(member)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: "0", cursor: "pointer" }}>
      <div style={{ backgroundColor: member.roomBg, borderBottom: "4px solid #2a3a5c", position: "relative", height: 168, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 15px,rgba(255,255,255,0.015) 15px,rgba(255,255,255,0.015) 16px),repeating-linear-gradient(90deg,transparent,transparent 15px,rgba(255,255,255,0.015) 15px,rgba(255,255,255,0.015) 16px)` }} />
        <div style={{ position: "absolute", top: 10, right: 16 }}>
          <svg width={28} height={32} viewBox="0 0 7 8" style={{ imageRendering: "pixelated" }}>
            <rect x={0} y={0} width={7} height={8} fill="#2a3a5c" />
            <rect x={1} y={1} width={2} height={3} fill={member.primaryColor} opacity={0.12} />
            <rect x={4} y={1} width={2} height={3} fill={member.primaryColor} opacity={0.08} />
            <rect x={1} y={5} width={2} height={2} fill="#1a2a4a" />
            <rect x={4} y={5} width={2} height={2} fill="#1a2a4a" />
          </svg>
        </div>
        <div style={{ position: "absolute", top: 10, left: 12, fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: member.primaryColor, opacity: 0.8 }}>
          {member.roomName}
        </div>
        <div style={{ position: "absolute", top: 24, left: 12, fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#6b8ba4" }}>
          LVL {member.level}
        </div>
        {isInDebt && (
          <div style={{ position: "absolute", top: 38, left: 12, display: "flex", alignItems: "center", gap: 3, backgroundColor: "rgba(255,45,85,0.18)", border: "2px solid #ff2d55", padding: "2px 5px" }}>
            <IconCoin size={8} color="#ff2d55" />
            <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#ff2d55" }}>IOU</span>
          </div>
        )}
        <div style={{ position: "absolute", top: isInDebt ? 58 : 38, left: 12, display: "flex", alignItems: "center", gap: 3 }}>
          <IconCoin size={8} color={coins < 0 ? "#ff2d55" : "#ffe66d"} />
          <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: coins < 0 ? "#ff2d55" : "#ffe66d" }}>
            {coins < 0 ? "-" : ""}{Math.abs(coins)}
          </span>
        </div>
        <div style={{ position: "absolute", left: 8, bottom: 12, display: "flex", alignItems: "flex-end", gap: 4 }}>
          {member.id === "grandma" && <FurnitureGrandma />}
          {member.id === "mum" && <FurnitureMum />}
          {member.id === "dad" && <FurnitureDad />}
          {member.id === "kid" && <FurnitureKid />}
        </div>
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <SafetyBadge safe={member.safeThisWeek} size={18} />
          <FamilyChar id={member.id} size={charSize} frame={frame} />
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: member.primaryColor }}>{member.name}</div>
        </div>
        <div style={{ position: "absolute", bottom: 12, right: 12, fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#2a3a5c", lineHeight: 1.8 }}>
          TAP{"\n"}TO{"\n"}VIEW
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)`, borderTop: `2px solid ${member.primaryColor}44` }} />
      </div>
    </button>
  );
}

function HouseRoof() {
  return (
    <div style={{ position: "relative", height: 48, backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", overflow: "hidden" }}>
      <svg width="100%" height={48} viewBox="0 0 390 48" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, imageRendering: "pixelated" }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <rect key={i} x={i * 16} y={48 - ((12 - i) * 4)} width={(390 - i * 32)} height={(12 - i) * 4} fill="#1a2a3a" opacity={0.9} />
        ))}
        <polyline points="0,48 195,4 390,48" fill="none" stroke="#2a3a5c" strokeWidth={3} />
        <rect x={280} y={10} width={20} height={24} fill="#2a3a5c" />
        <rect x={278} y={8} width={24} height={6} fill="#3a4a6c" />
        <rect x={283} y={2} width={4} height={4} fill="#4a5a7c" opacity={0.5} />
      </svg>
      <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#4ecdc4", letterSpacing: 2, whiteSpace: "nowrap" }}>
        FAMILY HOME
      </div>
    </div>
  );
}

function FamilySafetyBar({ coins }: { coins: Record<string, number> }) {
  const safeCount = FAMILY_MEMBERS.filter((m) => m.safeThisWeek).length;
  const allSafe = safeCount === FAMILY_MEMBERS.length;
  const totalCoins = Object.values(coins).reduce((a, b) => a + b, 0);
  return (
    <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ filter: `drop-shadow(0 0 6px ${allSafe ? "#00ff88" : "#ff6b35"})`, flexShrink: 0 }}>
        <IconShield size={32} color={allSafe ? "#00ff88" : "#ff6b35"} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: allSafe ? "#00ff88" : "#ff6b35", marginBottom: 4 }}>FAMILY SAFETY</div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: "#6b8ba4", lineHeight: 1.4 }}>
          {safeCount}/{FAMILY_MEMBERS.length} members safe this week
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {FAMILY_MEMBERS.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ filter: `drop-shadow(0 0 3px ${m.safeThisWeek ? "#00ff88" : "#ff2d55"})` }}>
                <IconShield size={10} color={m.safeThisWeek ? "#00ff88" : "#ff2d55"} />
              </div>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color: "#6b8ba4" }}>{m.name.slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", padding: "6px 10px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconCoin size={12} color="#ffe66d" />
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: totalCoins >= 0 ? "#ffe66d" : "#ff2d55" }}>
            {totalCoins >= 0 ? "" : "-"}{Math.abs(totalCoins)}
          </div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color: "#6b8ba4" }}>FAMILY</div>
      </div>
    </div>
  );
}

function MemberProfileOverlay({
  member, onClose, onTrainMember, onCustomize, coins,
}: { member: FamilyMember; onClose: () => void; onTrainMember: (memberId: string) => void; onCustomize: (memberId: string) => void; coins: number }) {
  const frame = useIdleFrame(member.id === "kid" ? 3 : 2);
  const charSize = member.id === "dad" ? 64 : member.id === "kid" ? 52 : 56;
  const badges = Array.from({ length: member.badgeTotal }, (_, i) => ({
    unlocked: i < member.badgeCount,
    color: ["#00ff88", "#ff6b35", "#4ecdc4", "#ffe66d", "#ff2d55", "#c77dff", "#4ecdc4", "#ff6b35", "#6b8ba4"][i],
  }));
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "rgba(0,0,0,0.75)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "#0a0e1a", border: `4px solid ${member.primaryColor}`, boxShadow: `0 -6px 0 ${member.primaryColor}66`, maxHeight: "82%", overflowY: "auto", scrollbarWidth: "none", animation: "slideUp 0.2s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 40, height: 4, backgroundColor: "#2a3a5c" }} />
        </div>
        <div style={{ padding: "0 16px 12px", borderBottom: `3px solid ${member.primaryColor}33`, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ filter: `drop-shadow(0 0 8px ${member.primaryColor})` }}>
            <FamilyChar id={member.id} size={charSize} frame={frame} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 12, color: member.primaryColor }}>{member.name}</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#6b8ba4", marginTop: 4 }}>{member.role}</div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#e8f4f8", marginTop: 6 }}>LVL {member.level}</div>
            <div style={{ marginTop: 6 }}>
              <XPBar current={member.xp} max={member.xpMax} color={member.primaryColor} />
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#6b8ba4", marginTop: 3 }}>
                {member.xp.toLocaleString()} / {member.xpMax.toLocaleString()} XP
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", alignSelf: "flex-start", padding: 4 }}>
            <IconX size={16} color="#6b8ba4" />
          </button>
        </div>

        <div style={{ margin: "12px 16px 0", padding: "10px 12px", backgroundColor: coins < 0 ? "rgba(255,45,85,0.06)" : "rgba(255,230,109,0.06)", border: `3px solid ${coins < 0 ? "#ff2d55" : "#ffe66d"}`, display: "flex", alignItems: "center", gap: 10 }}>
          <IconCoin size={20} color={coins < 0 ? "#ff2d55" : "#ffe66d"} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: coins < 0 ? "#ff2d55" : "#ffe66d" }}>
              {coins < 0 ? "-" : "+"}{Math.abs(coins)} COINS
            </div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#6b8ba4", marginTop: 3 }}>
              {coins < 0 ? "IN DEBT — sell furniture to recover" : "Balance this week"}
            </div>
          </div>
          {coins < 0 && (
            <div style={{ backgroundColor: "#ff2d55", padding: "4px 6px", fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#0a0e1a" }}>IOU</div>
          )}
        </div>

        <div style={{ margin: "8px 16px 0", padding: "10px 12px", backgroundColor: member.safeThisWeek ? "rgba(0,255,136,0.06)" : "rgba(255,45,85,0.06)", border: `3px solid ${member.safeThisWeek ? "#00ff88" : "#ff2d55"}`, display: "flex", alignItems: "center", gap: 10 }}>
          <IconShield size={20} color={member.safeThisWeek ? "#00ff88" : "#ff2d55"} />
          <div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: member.safeThisWeek ? "#00ff88" : "#ff2d55" }}>
              {member.safeThisWeek ? "SAFE THIS WEEK" : "SCAMMED THIS WEEK"}
            </div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#6b8ba4", marginTop: 3 }}>
              Last drill: {member.recentDrillResult ?? "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 16px 0" }}>
          {[
            { label: "STREAK", val: member.streak === 0 ? "BROKEN" : `${member.streak}`, color: member.streak > 0 ? "#ff6b35" : "#ff2d55", icon: <IconFlame size={12} color={member.streak > 0 ? "#ff6b35" : "#ff2d55"} /> },
            { label: "SAFE", val: `${member.timesSafe}`, color: "#00ff88", icon: <IconShield size={12} color="#00ff88" /> },
            { label: "SCAMMED", val: `${member.timesScammed}`, color: "#ff2d55", icon: <IconSkull size={12} color="#ff2d55" /> },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "10px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                {s.icon}
                <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 4, color: "#6b8ba4" }}>{s.label}</div>
              </div>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconBadge size={12} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#ffe66d" }}>BADGES — {member.badgeCount}/{member.badgeTotal}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {badges.map((b, i) => (
              <div key={i} style={{ width: 32, height: 32, backgroundColor: b.unlocked ? "#111827" : "#0a0e1a", border: `2px solid ${b.unlocked ? b.color : "#1a2340"}`, boxShadow: b.unlocked ? `2px 2px 0 ${b.color}` : "none", opacity: b.unlocked ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {b.unlocked ? <IconBadge size={20} color={b.color} /> : <IconLock size={12} color="#2a3a5c" />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelBtn
            onClick={() => { onClose(); onTrainMember(member.id); }}
            color={member.primaryColor}
            textColor={["#ffe66d", "#00ff88"].includes(member.primaryColor) ? "#0a0e1a" : "#ffffff"}
            size="lg" full
          >
            [ TRAIN {member.name} ]
          </PixelBtn>
          <PixelBtn
            onClick={() => { onClose(); onCustomize(member.id); }}
            color="#1a2340" textColor="#6b8ba4" size="md" full
          >
            CUSTOMIZE ROOM
          </PixelBtn>
        </div>
        <div style={{ padding: "0 16px 20px", fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#6b8ba4", textAlign: "center" }}>
          Choose call, SMS, or email scam training.
        </div>
      </div>
    </div>
  );
}

function FamilyHomeScreen({ onDrillSelect, onFamilyDrill, onPayday, onCustomize, onTrainMember, onRegister, onTutorial, coins, soldItems }: {
  onDrillSelect: () => void; onFamilyDrill: () => void;
  onPayday: () => void;
  onCustomize: (memberId: string) => void;
  onTrainMember: (memberId: string) => void;
  onRegister: () => void;
  onTutorial: () => void;
  coins: Record<string, number>; soldItems: string[];
}) {
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
        <div style={{ height: 6, background: "linear-gradient(90deg,#2a3a5c,#3a4a6c,#2a3a5c)" }} />
        <div data-tour="safety-bar"><FamilySafetyBar coins={coins} /></div>
        <HouseRoof />
        <div data-tour="family-rooms" style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 8, backgroundColor: "#2a3a5c", backgroundImage: "repeating-linear-gradient(0deg,#1a2a3c,#1a2a3c 4px,#2a3a5c 4px,#2a3a5c 8px)" }} />
          {FAMILY_MEMBERS.map((member) => (
            <DollhouseRoom key={member.id} member={member} onTap={setSelectedMember} coins={coins[member.id] ?? member.coins} soldItems={soldItems} />
          ))}
        </div>
        <div style={{ height: 24, backgroundColor: "#1a2340", borderTop: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#2a3a5c", letterSpacing: 3 }}>████████████████████████████</div>
        </div>
        <div style={{ padding: "16px 16px 8px", backgroundColor: "#0a0e1a" }}>
          <div data-tour="start-drill"><PixelBtn onClick={onFamilyDrill} color="#00ff88" size="lg" full>[ START FAMILY DRILL ]</PixelBtn></div>
        </div>
        <div style={{ padding: "0 16px 20px", backgroundColor: "#0a0e1a" }}>
          <PixelBtn onClick={onPayday} color="#ffe66d" textColor="#0a0e1a" size="md" full>PAYDAY SUNDAY</PixelBtn>
          <div style={{ height: 10 }} />
          <div data-tour="opt-in"><PixelBtn onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="md" full>[ OPT IN TO REAL CALL DRILLS ]</PixelBtn></div>
          <div style={{ height: 10 }} />
          <PixelBtn onClick={onTutorial} color="#1a2340" textColor="#6b8ba4" size="sm" full>HOW TO PLAY</PixelBtn>
        </div>
        <div style={{ padding: "0 16px 24px", backgroundColor: "#0a0e1a", fontFamily: "'Press Start 2P',monospace", fontSize: 5, color: "#6b8ba4", textAlign: "center" }}>
          Train together. Protect the whole household.
        </div>
      </div>
      {selectedMember && (
        <MemberProfileOverlay
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onTrainMember={onTrainMember}
          onCustomize={onCustomize}
          coins={coins[selectedMember.id] ?? selectedMember.coins}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: INCOMING CALL
// ─────────────────────────────────────────────────────────────────────────
function IncomingCallScreen({ onAccept, onDecline }: { activeMemberId: string; onAccept: () => void; onDecline: () => void }) {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(t);
  }, []);
  return (
      <div className="flex flex-col items-center justify-between flex-1 px-6 py-12" style={{ background: "linear-gradient(180deg, #0a0e1a 0%, #0d1526 50%, #0a0e1a 100%)" }}>
        <div className="flex flex-col items-center gap-2">
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4", letterSpacing: 2 }}>INCOMING CALL</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff6b35", border: "2px solid #ff6b35", padding: "4px 8px", backgroundColor: "rgba(255,107,53,0.1)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconWarning size={12} color="#ff6b35" />
            UNKNOWN CALLER
          </div>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div style={{ opacity: pulse ? 1 : 0.6, transition: "opacity 0.4s" }}>
            <PixelPhone ringing />
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 18, color: "#ffffff", textAlign: "center" }}>
            +1 (???)<br />???-????
          </div>
          <Blink ms={900}>
            <div className="flex items-center gap-2" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff6b35" }}>
              <IconBell size={14} color="#ff6b35" />
              RINGING...
            </div>
          </Blink>
          <div style={{ backgroundColor: "rgba(255,45,85,0.1)", border: "3px solid #ff2d55", padding: "8px 12px", width: "100%" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ff6b35", lineHeight: 1.5 }}>
              DRILL MODE ACTIVE — This is a simulated scam call. Can you hang tough?
            </div>
          </div>
        </div>
        <div className="flex gap-12 items-center">
          <div className="flex flex-col items-center gap-3">
            <button onClick={onDecline} onMouseDown={(e) => (e.currentTarget.style.transform = "translate(4px,4px)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} style={{ width: 72, height: 72, backgroundColor: "#ff2d55", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.05s" }}>
              <IconX size={32} color="#ffffff" />
            </button>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff2d55" }}>DECLINE</div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={onAccept} onMouseDown={(e) => (e.currentTarget.style.transform = "translate(4px,4px)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} style={{ width: 72, height: 72, backgroundColor: "#00ff88", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.05s" }}>
              <IconCheck size={32} color="#0a0e1a" />
            </button>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#00ff88" }}>ACCEPT</div>
          </div>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: CALL
// ─────────────────────────────────────────────────────────────────────────
type ConvLine = { who: string; text: string; highlights?: Highlight[] };

const CONVERSATION: ConvLine[] = [
  { who: "caller", text: "Hello! This is David from the IRS Fraud Division.", highlights: [{ phrase: "IRS Fraud Division", flagId: "impersonation" }] },
  { who: "caller", text: "We detected suspicious activity on your tax account." },
  { who: "you", text: "Uh, okay. What kind of activity?" },
  { who: "caller", text: "You owe $2,400 in back taxes. You must pay immediately to avoid arrest.", highlights: [{ phrase: "avoid arrest", flagId: "arrest_threat" }] },
  { who: "you", text: "Arrest? That sounds scary..." },
  { who: "caller", text: "Yes. You need to pay with gift cards RIGHT NOW to clear this up.", highlights: [{ phrase: "pay with gift cards", flagId: "gift_card" }, { phrase: "RIGHT NOW", flagId: "urgency" }] },
  { who: "caller", text: "Buy $2,400 in iTunes gift cards and read me the numbers.", highlights: [{ phrase: "iTunes gift cards", flagId: "gift_card" }] },
  { who: "you", text: "Gift cards? That doesn't sound right..." },
  { who: "caller", text: "This is your FINAL warning. Officers are being dispatched to your address.", highlights: [{ phrase: "FINAL warning", flagId: "urgency" }, { phrase: "Officers are being dispatched", flagId: "escalation" }] },
];

function CallScreen({ onHangUp, onResult }: { activeMemberId: string; onHangUp: (win: boolean) => void; onResult: (win: boolean) => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [callerSpeaking, setCallerSpeaking] = useState(true);
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleLines >= CONVERSATION.length) return;
    const delay = visibleLines === 0 ? 1000 : 2200;
    const t = setTimeout(() => {
      setVisibleLines((v) => v + 1);
      setCallerSpeaking(CONVERSATION[visibleLines]?.who === "caller");
    }, delay);
    return () => clearTimeout(t);
  }, [visibleLines]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleLines]);

  useEffect(() => {
    if (visibleLines >= CONVERSATION.length) {
      const t = setTimeout(() => onResult(false), 3000);
      return () => clearTimeout(t);
    }
  }, [visibleLines]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c" }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, backgroundColor: callerSpeaking ? "#ff6b35" : "#00ff88", animation: "pulse-dot 1s ease-in-out infinite" }} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: callerSpeaking ? "#ff6b35" : "#00ff88" }}>
            {callerSpeaking ? "CALLER SPEAKING" : "LISTENING..."}
          </div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe66d" }}>{mins}:{secs}</div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "3px solid #1a2340" }}>
        <PixelPhone />
        <div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ffffff" }}>UNKNOWN CALLER</div>
          <div className="flex items-center gap-1 mt-1">
            <IconWarning size={10} color="#ff6b35" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35" }}>SCAM DRILL ACTIVE</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div ref={scrollRef} className="flex flex-col gap-3" style={{ height: "100%", overflowY: "auto", padding: "16px 16px 8px", scrollbarWidth: "none" }}>
          {CONVERSATION.slice(0, visibleLines).map((line, i) => {
            const hasFlags = (line.highlights?.length ?? 0) > 0;
            return (
              <div key={i} className={`flex ${line.who === "you" ? "justify-end" : "justify-start"}`}>
                {line.who === "caller" && <div className="mr-2 mt-1 flex-shrink-0"><PixelAvatar rank={9} size={24} /></div>}
                <div style={{ maxWidth: "72%", backgroundColor: line.who === "you" ? "#1a3a2a" : "#1a2340", border: `3px solid ${line.who === "you" ? "#00ff88" : hasFlags ? "#ff2d55" : "#ff6b35"}`, padding: "8px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: line.who === "you" ? "#00ff88" : "#e8f4f8", lineHeight: 1.6 }}>
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                  {hasFlags && line.who === "caller" && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <IconWarning size={9} color="#ff2d55" />
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55" }}>TAP RED TEXT</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {visibleLines < CONVERSATION.length && (
            <div className="flex justify-start">
              <div className="mr-2"><PixelAvatar rank={9} size={24} /></div>
              <div style={{ backgroundColor: "#1a2340", border: "3px solid #ff6b35", padding: "8px 14px" }}>
                <Blink ms={400}><span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ff6b35" }}>...</span></Blink>
              </div>
            </div>
          )}
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-4" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <PixelBtn onClick={() => onHangUp(true)} color="#ff2d55" textColor="#ffffff" size="lg" full>
          [ HANG UP — DEFEAT SCAMMER ]
        </PixelBtn>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SMS SCREENS
// ─────────────────────────────────────────────────────────────────────────
const SMS_INBOX_ITEMS = [
  { id: "parcelgo", sender: "ParcelGo Alert", preview: "Your parcel is on hold. Pay $1.99 redelivery fee…", time: "NOW", isScam: true },
  { id: "grandma", sender: "Grandma", preview: "Dinner at 7?", time: "2h" },
  { id: "school", sender: "School Admin", preview: "Reminder: class starts at 9AM.", time: "9h" },
  { id: "cyber", sender: "Cyber Tips", preview: "Never share OTPs with anyone.", time: "1d" },
];

function SMSInboxScreen({ onOpenScam, onBack }: { activeMemberId: string; onOpenScam: () => void; onBack: () => void }) {
  const [shaking, setShaking] = useState<string | null>(null);
  const [glowFrame, setGlowFrame] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setGlowFrame((f) => !f), 800);
    return () => clearInterval(t);
  }, []);

  const handleNonScam = (id: string) => {
    setShaking(id);
    setTimeout(() => setShaking(null), 600);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>{"< BACK"}</div>
        </button>
        <div className="flex items-center gap-2">
          <IconChatBubble size={16} color="#4ecdc4" />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#4ecdc4" }}>MESSAGES</div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff2d55" }}>
          <Blink ms={700}>1 NEW</Blink>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "rgba(255,107,53,0.1)", borderBottom: "2px solid #ff6b35" }}>
        <IconWarning size={12} color="#ff6b35" />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35" }}>
          DRILL MODE — 1 suspicious message detected
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {SMS_INBOX_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => item.isScam ? onOpenScam() : handleNonScam(item.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", background: "none",
              border: "none", borderBottom: "2px solid #1a2340", cursor: "pointer",
              padding: "12px 16px",
              backgroundColor: item.isScam ? (glowFrame ? "rgba(255,45,85,0.06)" : "rgba(255,107,53,0.06)") : "#0a0e1a",
              animation: shaking === item.id ? "shake 0.5s ease" : "none",
              boxShadow: item.isScam ? `inset 0 0 ${glowFrame ? "12px" : "4px"} rgba(255,45,85,0.15)` : "none",
              transition: "background-color 0.4s, box-shadow 0.4s",
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, backgroundColor: item.isScam ? "#ff2d55" : "#2a3a5c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: item.isScam ? "2px solid #ff2d55" : "2px solid #1a2340" }}>
                {item.isScam ? <IconWarning size={20} color="#ffffff" /> : <IconPerson size={20} color="#6b8ba4" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: item.isScam ? 7 : 6, color: item.isScam ? "#ff2d55" : "#e8f4f8" }}>{item.sender}</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: item.isScam ? "#ff6b35" : "#6b8ba4" }}>{item.time}</div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: item.isScam ? "#ff6b35" : "#6b8ba4", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.preview}
                </div>
                {item.isScam && (
                  <div className="flex items-center gap-2 mt-1">
                    <div style={{ backgroundColor: "#ff2d55", padding: "1px 5px", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffffff" }}>
                      <Blink ms={600}>IMPORTANT</Blink>
                    </div>
                    <div style={{ backgroundColor: "#ff6b35", padding: "1px 5px", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#0a0e1a" }}>UNREAD</div>
                  </div>
                )}
              </div>
            </div>
            {shaking === item.id && (
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#4ecdc4", marginTop: 6, textAlign: "center" }}>
                Not part of this drill.
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

const SMS_LINES: { text: string; highlights?: Highlight[] }[] = [
  { text: "Your parcel is on hold due to incomplete address details." },
  { text: "Pay $1.99 redelivery fee before 11:59PM or your parcel will be returned.", highlights: [{ phrase: "Pay $1.99", flagId: "sms_payment" }, { phrase: "before 11:59PM", flagId: "sms_urgency" }] },
  { text: "Update now: http://parcelgo-redeliver.example", highlights: [{ phrase: "http://parcelgo-redeliver.example", flagId: "sms_link" }] },
];

function SMSThreadScreen({ onReport, onAskFamily, onTapLink, onBack }: { activeMemberId: string; onReport: () => void; onAskFamily: () => void; onTapLink: () => void; onBack: () => void }) {
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4" style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>{"<"}</div>
        </button>
        <div style={{ width: 32, height: 32, backgroundColor: "#ff2d55", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconWarning size={16} color="#ffffff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff2d55" }}>ParcelGo Alert</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginTop: 2 }}>Unknown sender</div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff6b35" }}>DRILL ACTIVE</div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div className="flex flex-col gap-3" style={{ height: "100%", overflowY: "auto", padding: "16px", scrollbarWidth: "none" }}>
          <div className="flex justify-start">
            <div style={{ maxWidth: "80%", backgroundColor: "#1a2340", border: "3px solid #ff2d55", padding: "12px", fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 1.8 }}>
              {SMS_LINES.map((line, i) => (
                <div key={i}>
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                </div>
              ))}
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <IconWarning size={9} color="#ff2d55" />
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55" }}>TAP RED TEXT TO INSPECT</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div style={{ maxWidth: "75%", backgroundColor: "#0c1a10", border: "3px solid #00ff88", padding: "10px 12px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#00ff88", lineHeight: 1.5 }}>
              Something feels off. Inspect the message carefully before acting.
            </div>
          </div>
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-4 flex flex-col gap-3" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <PixelBtn onClick={onReport} color="#00ff88" textColor="#0a0e1a" size="sm" full>REPORT + BLOCK</PixelBtn>
          </div>
          <div style={{ flex: 1 }}>
            <PixelBtn onClick={onAskFamily} color="#ffe66d" textColor="#0a0e1a" size="sm" full>ASK FAMILY</PixelBtn>
          </div>
        </div>
        <PixelBtn onClick={onTapLink} color="#ff2d55" textColor="#ffffff" size="sm" full>TAP LINK (DANGER)</PixelBtn>
      </div>
    </div>
  );
}

function SMSBrowserScreen({ onClose, onSubmit }: { activeMemberId: string; onClose: () => void; onSubmit: () => void }) {
  const [showUrlTip, setShowUrlTip] = useState(false);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 80); }, 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #ff2d55", padding: "10px 12px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, backgroundColor: "#ff2d55" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#ffe66d" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#00ff88" }} />
        </div>
        <button onClick={() => setShowUrlTip(!showUrlTip)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "rgba(255,45,85,0.08)", border: "2px solid #ff2d55", padding: "6px 8px", cursor: "pointer" }}>
          <IconWarning size={10} color="#ff2d55" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ff6b35", flex: 1, textAlign: "left" }}>parcelgo-redeliver.example</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55" }}>UNSECURED</div>
        </button>
        {showUrlTip && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.12)", border: "2px solid #ff2d55", padding: "8px", marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#e8f4f8", lineHeight: 1.5 }}>
            Check the URL carefully. Fake domains often look similar to real services.
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "#111827" }}>
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ textAlign: "center", filter: glitch ? "hue-rotate(180deg)" : "none", transition: "filter 0.05s" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ff6b35", marginBottom: 6 }}>Redelivery Payment</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4" }}>Enter your details to reschedule your parcel.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#1a2340", border: "2px solid #ff2d55", padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <IconWarning size={10} color="#ff2d55" />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55" }}>
                <Blink ms={400}>SECURE VERIFIED</Blink>
              </div>
            </div>
          </div>
          {["Full Name", "Home Address", "Card Number", "CVV", "OTP Code"].map((label) => (
            <div key={label}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginBottom: 4 }}>{label}</div>
              <div style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "10px", height: 36, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#1a2340" }}>▋</div>
            </div>
          ))}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55", textAlign: "center" }}>
            <Blink ms={800}>UNSECURED PAGE — DO NOT ENTER DETAILS</Blink>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-4 py-4" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <div style={{ flex: 1 }}>
          <PixelBtn onClick={onSubmit} color="#ff2d55" textColor="#ffffff" size="sm" full>SUBMIT PAYMENT</PixelBtn>
        </div>
        <div style={{ flex: 1 }}>
          <PixelBtn onClick={onClose} color="#00ff88" textColor="#0a0e1a" size="sm" full>CLOSE PAGE</PixelBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EMAIL SCREENS
// ─────────────────────────────────────────────────────────────────────────
const EMAIL_INBOX_ITEMS = [
  { id: "campus", sender: "Campus Rewards Office", subject: "IMPORTANT: Claim Your $300 Digital Safety Reward", preview: "You have been selected for a limited-time cyber safety reward…", time: "NOW", isScam: true },
  { id: "tips", sender: "Cyber Tips Weekly", subject: "How to spot fake links", preview: "This week's safety tip…", time: "3h" },
  { id: "family", sender: "Family Group", subject: "Weekend lunch", preview: "Mum: Are we free this Sunday?", time: "5h" },
  { id: "school", sender: "School Portal", subject: "Assignment reminder", preview: "Your submission is due soon.", time: "1d" },
  { id: "game", sender: "Game Updates", subject: "New badge unlocked", preview: "You are close to your next rank.", time: "2d" },
];

function EmailInboxScreen({ onOpenScam, onBack }: { activeMemberId: string; onOpenScam: () => void; onBack: () => void }) {
  const [toast, setToast] = useState("");
  const [glowFrame, setGlowFrame] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setGlowFrame((f) => !f), 900);
    return () => clearInterval(t);
  }, []);

  const handleNonScam = () => {
    setToast("This email is safe. Open the important email to continue.");
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>{"< BACK"}</div>
        </button>
        <div className="flex items-center gap-2">
          <IconEnvelope size={16} color="#c77dff" />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#c77dff" }}>MAILBOX</div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35" }}>DRILL ACTIVE</div>
      </div>
      <div className="px-4 py-2" style={{ borderBottom: "2px solid #1a2340" }}>
        <div style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c", padding: "6px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#2a3a5c" }}>
          Search mail…
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "rgba(255,107,53,0.1)", borderBottom: "2px solid #ff6b35", flexShrink: 0 }}>
        <IconWarning size={12} color="#ff6b35" />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff6b35" }}>
          New important email detected. Inspect before clicking.
        </div>
      </div>
      {toast && (
        <div style={{ backgroundColor: "#1a2340", border: "2px solid #4ecdc4", padding: "8px 12px", margin: "8px 12px", position: "absolute", top: 160, left: 0, right: 0, zIndex: 20, animation: "slideUp 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#4ecdc4", lineHeight: 1.6 }}>{toast}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {EMAIL_INBOX_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => item.isScam ? onOpenScam() : handleNonScam()}
            style={{
              display: "block", width: "100%", textAlign: "left", background: "none",
              border: "none", borderBottom: "2px solid #1a2340", cursor: "pointer",
              padding: "12px 16px",
              backgroundColor: item.isScam ? (glowFrame ? "rgba(255,107,53,0.08)" : "rgba(255,45,85,0.05)") : "#0a0e1a",
              boxShadow: item.isScam ? `inset 0 0 ${glowFrame ? "16px" : "6px"} rgba(255,107,53,0.12)` : "none",
              transition: "background-color 0.45s, box-shadow 0.45s",
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{ width: 36, height: 36, backgroundColor: item.isScam ? "#ff6b35" : "#2a3a5c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.isScam ? <IconWarning size={18} color="#0a0e1a" /> : <IconEnvelope size={16} color="#6b8ba4" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: item.isScam ? 6 : 5, color: item.isScam ? "#ff6b35" : "#e8f4f8" }}>{item.sender}</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: item.isScam ? "#ff6b35" : "#6b8ba4" }}>{item.time}</div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: item.isScam ? "#ff2d55" : "#e8f4f8", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.subject}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#6b8ba4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.preview}
                </div>
                {item.isScam && (
                  <div className="flex gap-2 mt-1">
                    <div style={{ backgroundColor: "#ff6b35", padding: "1px 5px", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#0a0e1a" }}>
                      <Blink ms={500}>IMPORTANT</Blink>
                    </div>
                    <div style={{ backgroundColor: "#ff2d55", padding: "1px 5px", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffffff" }}>UNREAD</div>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const EMAIL_BODY_LINES: { text: string; highlights?: Highlight[] }[] = [
  { text: "Dear Student," },
  { text: "" },
  { text: "Congratulations! You have been selected to receive a $300 Digital Safety Reward for completing your campus cyber awareness profile.", highlights: [{ phrase: "$300 Digital Safety Reward", flagId: "email_reward" }] },
  { text: "" },
  { text: "This reward is only available for the next 30 minutes.", highlights: [{ phrase: "only available for the next 30 minutes", flagId: "email_urgency" }] },
  { text: "" },
  { text: "To claim your reward, verify your student account using the secure link below.", highlights: [{ phrase: "verify your student account", flagId: "email_verify" }] },
  { text: "" },
  { text: "[ CLAIM REWARD NOW ]", highlights: [{ phrase: "[ CLAIM REWARD NOW ]", flagId: "email_button" }] },
  { text: "" },
  { text: "If the button does not work, open the attached Reward_Verification_Form.zip and follow the instructions.", highlights: [{ phrase: "Reward_Verification_Form.zip", flagId: "email_attachment" }] },
  { text: "" },
  { text: "Failure to verify today may result in your reward being reassigned.", highlights: [{ phrase: "Failure to verify today", flagId: "email_threat" }] },
  { text: "" },
  { text: "Campus Rewards Office" },
];

function EmailDetailScreen({ onReport, onAskFamily, onClaimReward, onOpenAttachment, onBack }: { activeMemberId: string; onReport: () => void; onAskFamily: () => void; onClaimReward: () => void; onOpenAttachment: () => void; onBack: () => void }) {
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);
  const [foundFlags, setFoundFlags] = useState<Set<string>>(new Set());

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setFoundFlags((prev) => new Set([...prev, flagId]));
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4" style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>{"<"}</div>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#c77dff" }}>Campus Rewards Office</div>
          <div className="flex items-center gap-1 mt-1">
            <IconWarning size={8} color="#ff6b35" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ff6b35" }}>rewards-office@campus-secure.example</div>
          </div>
        </div>
        <div style={{ backgroundColor: "#ff6b35", padding: "2px 6px", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#0a0e1a", flexShrink: 0 }}>IMPORTANT</div>
      </div>
      <div className="px-4 py-3" style={{ borderBottom: "2px solid #1a2340", backgroundColor: "#0d1120" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff2d55", lineHeight: 1.5, marginBottom: 6 }}>
          IMPORTANT: Claim Your $300 Digital Safety Reward
        </div>
        <div className="flex items-center justify-between">
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4" }}>Tap red text to inspect</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: foundFlags.size > 0 ? "#ff6b35" : "#6b8ba4" }}>
            RED FLAGS: {foundFlags.size}/6
          </div>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div style={{ height: "100%", overflowY: "auto", padding: "16px", scrollbarWidth: "none" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 2 }}>
            {EMAIL_BODY_LINES.map((line, i) => (
              <div key={i} style={{ minHeight: line.text === "" ? 8 : "auto" }}>
                {line.highlights?.length ? (
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                ) : (
                  line.text
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4" style={{ backgroundColor: "#1a2340", border: "2px solid #c77dff", padding: "8px 10px", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); handleFlagTap("email_attachment"); }}>
            <IconAttachment size={14} color="#c77dff" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#c77dff" }}>Reward_Verification_Form.zip</div>
            <IconWarning size={10} color="#ff2d55" />
          </div>
          <div style={{ height: 120 }} />
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", flexShrink: 0 }}>
        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <PixelBtn onClick={onReport} color="#00ff88" textColor="#0a0e1a" size="sm" full>REPORT PHISHING</PixelBtn>
          </div>
          <div style={{ flex: 1 }}>
            <PixelBtn onClick={onAskFamily} color="#ffe66d" textColor="#0a0e1a" size="sm" full>ASK FAMILY</PixelBtn>
          </div>
        </div>
        <PixelBtn onClick={onClaimReward} color="#ff2d55" textColor="#ffffff" size="sm" full>CLAIM REWARD (DANGER)</PixelBtn>
        <PixelBtn onClick={onOpenAttachment} color="#1a2340" textColor="#c77dff" size="sm" full>OPEN ATTACHMENT (DANGER)</PixelBtn>
      </div>
    </div>
  );
}

function EmailBrowserScreen({ onClose, onSubmit }: { activeMemberId: string; onClose: () => void; onSubmit: () => void }) {
  const [showUrlTip, setShowUrlTip] = useState(false);
  const [showBreach, setShowBreach] = useState(false);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const t = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 90); }, 3000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = () => {
    setShowBreach(true);
    setTimeout(() => onSubmit(), 2200);
  };

  if (showBreach) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6" style={{ backgroundColor: "#1a0000" }}>
        <div style={{ filter: "drop-shadow(0 0 20px rgba(255,45,85,0.9))" }}>
          <IconSkull size={80} color="#ff2d55" />
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: "#ff2d55", textAlign: "center", lineHeight: 1.6, textShadow: "0 0 20px #ff2d55" }}>
          DETAILS<br />CAPTURED
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: "#ff6b35", textAlign: "center" }}>Redirecting to result...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #ff2d55", padding: "10px 12px", flexShrink: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div style={{ width: 8, height: 8, backgroundColor: "#ff2d55" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#ffe66d" }} />
          <div style={{ width: 8, height: 8, backgroundColor: "#00ff88" }} />
        </div>
        <button onClick={() => setShowUrlTip(!showUrlTip)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", backgroundColor: "rgba(255,45,85,0.08)", border: "2px solid #ff2d55", padding: "6px 8px", cursor: "pointer" }}>
          <IconWarning size={10} color="#ff2d55" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ff6b35", flex: 1, textAlign: "left" }}>campus-secure-rewards.example</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55" }}>UNVERIFIED SITE</div>
        </button>
        {showUrlTip && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.12)", border: "2px solid #ff2d55", padding: "8px", marginTop: 6, fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#e8f4f8", lineHeight: 1.5 }}>
            The domain is suspicious. Scammers often use official-sounding fake domains.
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", backgroundColor: "#111827" }}>
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ textAlign: "center", filter: glitch ? "hue-rotate(200deg) brightness(1.2)" : "none", transition: "filter 0.05s" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#c77dff", marginBottom: 6 }}>Digital Safety Reward Portal</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4" }}>Verify your identity to receive $300.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ backgroundColor: "#1a2340", border: `2px solid ${glitch ? "#ff2d55" : "#2a3a5c"}`, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6, transition: "border-color 0.05s" }}>
              <IconShield size={12} color={glitch ? "#ff2d55" : "#2a3a5c"} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: glitch ? "#ff2d55" : "#2a3a5c" }}>SECURE VERIFIED</div>
            </div>
          </div>
          {["Student Email", "Password", "NRIC / ID Number", "Phone Number", "OTP Code"].map((label) => (
            <div key={label}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginBottom: 4 }}>{label}</div>
              <div style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "10px", height: 36, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#1a2340" }}>▋</div>
            </div>
          ))}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55", textAlign: "center" }}>
            <Blink ms={700}>UNSECURED — DO NOT SUBMIT REAL DATA</Blink>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-4 py-4" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <div style={{ flex: 1 }}>
          <PixelBtn onClick={handleSubmit} color="#ff2d55" textColor="#ffffff" size="sm" full>SUBMIT DETAILS</PixelBtn>
        </div>
        <div style={{ flex: 1 }}>
          <PixelBtn onClick={onClose} color="#00ff88" textColor="#0a0e1a" size="sm" full>CLOSE + REPORT</PixelBtn>
        </div>
      </div>
    </div>
  );
}

function EmailDownloadScreen({ onCancel, onComplete }: { activeMemberId: string; onCancel: () => void; onComplete: () => void }) {
  const [phase, setPhase] = useState<"downloading" | "opening" | "malware">("downloading");
  const [progress, setProgress] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => { if (p >= 100) { clearInterval(interval); return 100; } return p + 1; });
    }, 32);
    const t1 = setTimeout(() => setPhase("opening"), 3500);
    const t2 = setTimeout(() => setPhase("malware"), 5500);
    const t3 = setTimeout(() => { doneRef.current = true; onComplete(); }, 7500);
    return () => { clearInterval(interval); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const handleCancel = () => { if (!doneRef.current) onCancel(); };

  if (phase === "malware") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6" style={{ backgroundColor: "#1a0000" }}>
        <div style={{ filter: "drop-shadow(0 0 20px rgba(255,45,85,0.9))" }}>
          <IconSkull size={72} color="#ff2d55" />
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: "#ff2d55", textAlign: "center", lineHeight: 1.8, textShadow: "0 0 20px #ff2d55" }}>
          MALWARE SIMULATION<br />DETECTED
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff6b35", textAlign: "center", lineHeight: 2 }}>
          DEVICE COMPROMISED<br />PASSWORDS AT RISK
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4" }}>Returning to result...</div>
      </div>
    );
  }

  return (
      <div className="flex flex-col items-center justify-center flex-1 gap-8 px-6">
        <div style={{ filter: "drop-shadow(0 0 8px rgba(199,125,255,0.6))" }}>
          <IconDownload size={48} color="#c77dff" />
        </div>
        <div style={{ width: "100%", backgroundColor: "#111827", border: "3px solid #c77dff", padding: "16px" }}>
          <div className="flex items-center gap-3 mb-4">
            <IconAttachment size={20} color="#c77dff" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#c77dff" }}>Reward_Verification_Form.zip</div>
          </div>
          <div style={{ width: "100%", backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", height: 20, marginBottom: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ height: "100%", backgroundColor: phase === "opening" ? "#ff6b35" : "#c77dff", width: `${progress}%`, transition: "width 0.1s" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffffff", mixBlendMode: "difference" }}>
                {phase === "downloading" ? `${progress}%` : "100%"}
              </div>
            </div>
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: phase === "opening" ? "#ff6b35" : "#c77dff", textAlign: "center" }}>
            {phase === "downloading" ? "DOWNLOADING..." : "OPENING FILE..."}
          </div>
        </div>
        <PixelBtn onClick={handleCancel} color="#00ff88" textColor="#0a0e1a" size="md" full>CANCEL DOWNLOAD</PixelBtn>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55", textAlign: "center", lineHeight: 2 }}>
          <Blink ms={500}>WARNING — SIMULATED MALWARE DETECTED</Blink>
        </div>
      </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCAM REASON SECTION
// ─────────────────────────────────────────────────────────────────────────
function ScamReasonSection({ flags }: { flags: DrillFlag[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "3px solid #ff2d55" }}>
        <IconWarning size={16} color="#ff2d55" />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ff2d55", letterSpacing: 1 }}>WHY IT WAS A SCAM</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((flag, i) => {
          const isOpen = expanded === flag.id;
          return (
            <button key={flag.id} onClick={() => setExpanded(isOpen ? null : flag.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", padding: 0, border: "none", cursor: "pointer" }}>
              <div style={{ backgroundColor: isOpen ? "rgba(255,45,85,0.10)" : "#111827", border: `3px solid ${isOpen ? "#ff2d55" : "#2a3a5c"}`, boxShadow: isOpen ? "3px 3px 0 #ff2d55" : "none", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, backgroundColor: "#ff2d55", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#0a0e1a" }}>{i + 1}</span>
                  </div>
                  <IconWarning size={14} color={isOpen ? "#ff2d55" : "#6b8ba4"} />
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: isOpen ? "#ff2d55" : "#e8f4f8", flex: 1 }}>{flag.name}</div>
                  <svg width={10} height={8} viewBox="0 0 5 4" style={{ imageRendering: "pixelated", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <rect x={0} y={0} width={1} height={1} fill="#6b8ba4" />
                    <rect x={1} y={1} width={1} height={1} fill="#6b8ba4" />
                    <rect x={2} y={2} width={1} height={1} fill="#6b8ba4" />
                    <rect x={3} y={1} width={1} height={1} fill="#6b8ba4" />
                    <rect x={4} y={0} width={1} height={1} fill="#6b8ba4" />
                  </svg>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "2px solid rgba(255,45,85,0.3)", fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 1.6 }}>
                    {flag.explanation}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: RESULT
// ─────────────────────────────────────────────────────────────────────────
function getResultContent(win: boolean, drillType: DrillType, smsOutcome: SmsOutcome | null, emailOutcome: EmailOutcome | null) {
  if (drillType === "call") {
    return {
      header: win ? "DRILL COMPLETE!" : "GAME OVER",
      xp: win ? 320 : 50,
      feedback: win ? "You correctly identified gift card payment as a scam tactic!" : "Never give gift card numbers to strangers on the phone!",
      flags: RED_FLAGS,
    };
  }
  if (drillType === "sms") {
    if (win) {
      const feedback =
        smsOutcome === "asked-family" ? "You paused and checked before acting. Good thinking!" :
        smsOutcome === "closed-page" ? "You recognised the fake page and closed it before entering your details." :
        "You spotted the suspicious delivery message and avoided the phishing link.";
      return { header: "SCAM BLOCKED!", xp: 280, feedback, flags: SMS_FLAGS };
    }
    return { header: "YOU GOT PHISHED!", xp: 50, feedback: "You tapped the link and reached a fake payment page. Scammers often use small fees to steal card details.", flags: SMS_FLAGS };
  }
  if (win) {
    const feedback =
      emailOutcome === "asked-family" ? "You paused and verified before trusting the email." :
      emailOutcome === "cancelled-download" ? "You stopped the download before opening the file." :
      "You inspected the email before clicking. Reporting phishing protects both you and your family.";
    return { header: "PHISHING REPORTED!", xp: 350, feedback, flags: EMAIL_FLAGS };
  }
  if (emailOutcome === "opened-attachment") {
    return { header: "MALWARE TRIGGERED!", xp: 50, feedback: "You opened a suspicious ZIP attachment. Attachments can hide malware or fake forms.", flags: EMAIL_FLAGS };
  }
  return { header: "DETAILS STOLEN!", xp: 50, feedback: "You submitted details on a fake login page. Scammers use official-looking forms to steal passwords, IDs, and OTPs.", flags: EMAIL_FLAGS };
}

function ResultScreen({ win, drillType, smsOutcome, emailOutcome, activeMemberId, onPlayAgain, onGoHome, xpOverride }: { win: boolean; drillType: DrillType; smsOutcome: SmsOutcome | null; emailOutcome: EmailOutcome | null; activeMemberId: string; onPlayAgain: () => void; onGoHome: () => void; xpOverride?: number | null }) {
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowDetails(true), 700); return () => clearTimeout(t); }, []);

  const { header, xp, feedback, flags } = getResultContent(win, drillType, smsOutcome, emailOutcome);
  const drillLabel = drillType === "call" ? "CALL" : drillType === "sms" ? "SMS" : "EMAIL";
  const member = MEMBER_MAP[activeMemberId];
  const coinReward = win
    ? (drillType === "call" ? 50 : drillType === "sms" ? 40 : 60)
    : (drillType === "call" ? -25 : drillType === "sms" ? -20 : -30);

  return (
    <div style={{ position: "relative", height: "100%", overflowY: "auto", scrollbarWidth: "none" }}>
      <Stars />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "32px 20px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4", letterSpacing: 2 }}>
            {drillLabel} DRILL — {win ? "SUCCESS" : "FAIL"}
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: win ? 24 : 20, color: win ? "#00ff88" : "#ff2d55", textShadow: win ? "4px 4px 0 #006633, 0 0 30px rgba(0,255,136,0.7)" : "4px 4px 0 #660011, 0 0 30px rgba(255,45,85,0.7)", textAlign: "center", lineHeight: 1.3 }}>
            {header}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 22, color: win ? "#4ecdc4" : "#ff6b35", textAlign: "center" }}>
            {win ? '"Great instinct!"' : '"Stay alert next time."'}
          </div>
          {member && (
            <div style={{ marginTop: 4, padding: "4px 10px", border: `2px solid ${member.primaryColor}`, backgroundColor: `${member.primaryColor}11`, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>FOR:</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: member.primaryColor }}>{member.name}</div>
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <PixelMascot size={96} animate />
          {win && (
            <div style={{ position: "absolute", top: -20, right: -20, animation: "spin 2s linear infinite" }}>
              <IconStar size={24} color="#ffe66d" />
            </div>
          )}
        </div>
        {showDetails && (
          <div style={{ width: "100%" }}>
            <PixelPanel accent={win ? "#00ff88" : "#ff2d55"} className="w-full">
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: win ? "#00ff88" : "#ff2d55", marginBottom: 12, textAlign: "center" }}>
                === RESULTS ===
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>XP GAINED</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe66d" }}>+{xpOverride ?? xp}</div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>COINS</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconCoin size={12} color={coinReward >= 0 ? "#ffe66d" : "#ff2d55"} />
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: coinReward >= 0 ? "#00ff88" : "#ff2d55" }}>
                    {coinReward >= 0 ? "+" : ""}{coinReward}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>STREAK</div>
                <div className="flex items-center gap-2">
                  {win ? <IconFlame size={14} color="#ff6b35" /> : <IconSkull size={14} color="#ff2d55" />}
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: win ? "#ff6b35" : "#ff2d55" }}>
                    {win ? "EXTENDED" : "BROKEN"}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: win ? "#00ff88" : "#ff6b35", backgroundColor: win ? "rgba(0,255,136,0.08)" : "rgba(255,45,85,0.08)", border: `2px solid ${win ? "#00ff88" : "#ff2d55"}`, padding: "8px 10px", lineHeight: 1.6 }}>
                {feedback}
              </div>
            </PixelPanel>
          </div>
        )}
        {showDetails && <ScamReasonSection flags={flags} />}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <PixelBtn onClick={onPlayAgain} color={win ? "#00ff88" : "#ff6b35"} size="lg" full>[ PLAY ANOTHER DRILL ]</PixelBtn>
          <PixelBtn onClick={onGoHome} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK TO HOME</PixelBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────
function LeaderboardScreen() {
  const [tab, setTab] = useState<"fame" | "shame">("fame");
  return (
    <div className="flex flex-col h-full">
      <div className="flex" style={{ borderBottom: "4px solid #2a3a5c" }}>
        <button onClick={() => setTab("fame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "fame" ? "#1a3a2a" : "#0a0e1a", border: "none", borderBottom: tab === "fame" ? "4px solid #00ff88" : "4px solid transparent", cursor: "pointer" }}>
          <IconTrophy size={16} color={tab === "fame" ? "#00ff88" : "#2a3a5c"} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: tab === "fame" ? "#00ff88" : "#2a3a5c" }}>HALL OF FAME</div>
        </button>
        <div style={{ width: 4, backgroundColor: "#2a3a5c" }} />
        <button onClick={() => setTab("shame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "shame" ? "#1a0a10" : "#0a0e1a", border: "none", borderBottom: tab === "shame" ? "4px solid #ff2d55" : "4px solid transparent", cursor: "pointer" }}>
          <IconSkull size={16} color={tab === "shame" ? "#ff2d55" : "#2a3a5c"} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: tab === "shame" ? "#ff2d55" : "#2a3a5c" }}>HALL OF SHAME</div>
        </button>
      </div>
      {tab === "fame" ? <FameBoard /> : <ShameBoard />}
    </div>
  );
}

function FameBoard() {
  const [board, setBoard] = useState<LeaderboardRow[]>(HALL_OF_FAME);

  useEffect(() => {
    apiGet<LeaderboardRow[]>("/api/leaderboard").then((rows) => {
      if (rows && rows.length) {
        setBoard(rows.map((r) => ({ ...r, wins: r.wins ?? 0, area: r.area ?? "FAMILY" })));
      }
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-2 flex items-center justify-between" style={{ backgroundColor: "#111827", border: "3px solid #ffe66d" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4" }}>DOWNTOWN AREA</div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffe66d" }}>YOUR RANK: #12</div>
      </div>
      <div className="mx-4 mt-2 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "rgba(0,255,136,0.08)", border: "3px solid #00ff88" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#00ff88" }}>#12</div>
        <PixelMascot size={28} />
        <div className="flex-1">
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#00ff88" }}>YOU</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#4ecdc4" }}>2,340 PTS / 48 WINS</div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>LVL 7</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {board.map((p) => (
          <div key={p.rank} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: "#111827", border: `3px solid ${p.rank <= 3 ? ["#ffe66d", "#c0c0c0", "#cd7f32"][p.rank - 1] : "#2a3a5c"}`, boxShadow: p.rank <= 3 ? `3px 3px 0px ${["#ffe66d", "#c0c0c0", "#cd7f32"][p.rank - 1]}` : "none" }}>
            <div className="flex items-center justify-center" style={{ width: 28 }}>
              {p.rank <= 3 ? <IconMedal rank={p.rank} size={20} /> : <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4" }}>#{p.rank}</div>}
            </div>
            <PixelAvatar rank={p.rank} size={28} />
            <div className="flex-1">
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#e8f4f8" }}>{p.name}</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginTop: 2 }}>{p.wins} WINS · {p.area}</div>
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#4ecdc4" }}>{p.score.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShameBoard() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-2 flex items-center gap-2" style={{ backgroundColor: "rgba(255,45,85,0.08)", border: "3px solid #ff2d55" }}>
        <IconWarning size={12} color="#ff2d55" />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff2d55" }}>MOST SCAMMED IN YOUR AREA</div>
      </div>
      <div className="mx-4 mt-2 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35" }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ff6b35" }}>#8</div>
        <PixelMascot size={28} />
        <div className="flex-1">
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff6b35" }}>YOU</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>3 TIMES SCAMMED</div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#00ff88" }}>NOT BAD!</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {HALL_OF_SHAME.map((p, i) => {
          const isYou = p.name === "PLAYER_001";
          const shameColors = ["#ff2d55", "#ff2d55", "#ff2d55", "#ff6b35", "#ff6b35", "#ff6b35", "#ffe66d", "#ffe66d"];
          const rowColor = shameColors[i] ?? "#2a3a5c";
          return (
            <div key={p.rank} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: isYou ? "rgba(255,107,53,0.08)" : "#111827", border: `3px solid ${isYou ? "#ff6b35" : rowColor}`, boxShadow: i < 3 ? `3px 3px 0px ${rowColor}` : "none" }}>
              <div className="flex items-center justify-center" style={{ width: 28 }}>
                {i < 3 ? <IconSkull size={18} color={rowColor} /> : <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>#{p.rank}</div>}
              </div>
              <PixelAvatar rank={p.rank + 4} size={28} />
              <div className="flex-1">
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: isYou ? "#ff6b35" : "#e8f4f8" }}>{isYou ? "YOU" : p.name}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginTop: 2 }}>{p.area}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: rowColor }}>{p.scammed}x</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>SCAMMED</div>
              </div>
            </div>
          );
        })}
        <div className="py-3 text-center" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#2a3a5c" }}>
          — KEEP TRAINING TO STAY OFF THIS LIST —
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: STORE — Phase 3 real implementation
// Persistent member-picker header; per-member wallet + purchase state.
// ─────────────────────────────────────────────────────────────────────────
function ShopScreen({
  activeMemberId, onSelectMember, coins, purchasedItems, onBuy,
}: {
  activeMemberId: string;
  onSelectMember: (memberId: string) => void;
  coins: Record<string, number>;
  purchasedItems: Record<string, string[]>;
  onBuy: (memberId: string, itemId: string, cost: number) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | "AFFORDABLE" | "OWNED">("ALL");
  const [justBought, setJustBought] = useState<string | null>(null);

  const member = MEMBER_MAP[activeMemberId] ?? FAMILY_MEMBERS[1];
  const memberCoins = coins[activeMemberId] ?? 0;
  const owned = purchasedItems[activeMemberId] ?? [];

  const filtered = SHOP_CATALOGUE.filter(item => {
    const isOwned = owned.includes(item.id);
    if (filter === "OWNED") return isOwned;
    if (filter === "AFFORDABLE") return !isOwned && memberCoins >= item.cost;
    return true;
  });

  const handleBuy = (item: ShopItem) => {
    if (owned.includes(item.id)) return;
    if (memberCoins < item.cost) return;
    onBuy(activeMemberId, item.id, item.cost);
    setJustBought(item.id);
    setTimeout(() => setJustBought(prev => prev === item.id ? null : prev), 1200);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Member picker strip — always visible */}
      <div style={{ padding: "10px 12px", backgroundColor: "#0a0e1a", borderBottom: `4px solid ${member.primaryColor}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: "#6b8ba4" }}>SHOPPING FOR</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoin size={12} color={memberCoins < 0 ? "#ff2d55" : "#ffe66d"} />
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: memberCoins < 0 ? "#ff2d55" : "#ffe66d" }}>
              {memberCoins < 0 ? "-" : ""}{Math.abs(memberCoins)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {FAMILY_MEMBERS.map(m => {
            const active = m.id === activeMemberId;
            const mCoins = coins[m.id] ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMember(m.id)}
                style={{
                  flex: 1,
                  padding: "6px 4px",
                  backgroundColor: active ? m.primaryColor : "#111827",
                  border: `2px solid ${active ? "#0a0e1a" : m.primaryColor}`,
                  boxShadow: active ? "2px 2px 0 #0a0e1a" : "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <FamilyChar id={m.id} size={24} frame={0} />
                <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: active ? "#0a0e1a" : m.primaryColor }}>
                  {m.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "14px 14px 4px" }}>
          {/* Virtual house preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconHouse size={12} color={member.primaryColor} />
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: member.primaryColor }}>
              {member.name}'S ROOM PREVIEW
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: 100,
              backgroundColor: member.roomBg,
              border: `3px solid ${member.primaryColor}`,
              boxShadow: `3px 3px 0 ${member.primaryColor}`,
              position: "relative",
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            {/* Wall stripes */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 76, background: `repeating-linear-gradient(90deg, ${member.roomBg} 0px, ${member.roomBg} 18px, ${member.primaryColor}0a 18px, ${member.primaryColor}0a 36px)` }} />
            {/* Floor */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 24, background: `repeating-linear-gradient(90deg, #1a2a3a 0px, #1a2a3a 20px, ${member.roomBg} 20px, ${member.roomBg} 40px)`, borderTop: `2px solid ${member.primaryColor}55` }} />
            {/* Placed shop items (first 5) */}
            <div style={{ position: "absolute", bottom: 22, left: 6, display: "flex", alignItems: "flex-end", gap: 6 }}>
              {owned.slice(0, 5).map(id => {
                const item = SHOP_CATALOGUE.find(i => i.id === id);
                if (!item) return null;
                return <div key={id}><ShopFurnitureArt art={item.art} size={40} /></div>;
              })}
            </div>
            {owned.length === 0 && (
              <div style={{ position: "absolute", bottom: 34, left: 0, right: 0, textAlign: "center", fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#6b8ba4" }}>
                BUY FURNITURE TO FILL THIS ROOM
              </div>
            )}
            {/* Item count badge */}
            <div style={{ position: "absolute", top: 6, right: 6, backgroundColor: "#0a0e1a", border: `2px solid ${member.primaryColor}`, padding: "2px 5px" }}>
              <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: member.primaryColor }}>
                {owned.length} SHOP ITEM{owned.length === 1 ? "" : "S"}
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {(["ALL", "AFFORDABLE", "OWNED"] as const).map(f => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "6px 10px",
                    backgroundColor: active ? "#ffe66d" : "#111827",
                    border: `2px solid ${active ? "#ffe66d" : "#2a3a5c"}`,
                    boxShadow: active ? "2px 2px 0 #0a0e1a" : "none",
                    cursor: "pointer",
                    fontFamily: "'Press Start 2P',monospace",
                    fontSize: 6,
                    color: active ? "#0a0e1a" : "#6b8ba4",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>

          {/* Catalogue grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 16 }}>
            {filtered.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "24px 0", textAlign: "center", fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: "#6b8ba4" }}>
                No items in this filter.
              </div>
            )}
            {filtered.map(item => {
              const isOwned = owned.includes(item.id);
              const affordable = memberCoins >= item.cost;
              const bought = justBought === item.id;
              const borderColor = isOwned ? "#4ecdc4" : (affordable ? "#ffe66d" : "#2a3a5c");
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: "#111827",
                    border: `3px solid ${borderColor}`,
                    boxShadow: isOwned ? "3px 3px 0 #4ecdc4" : (affordable ? "3px 3px 0 #ffe66d" : "none"),
                    padding: "12px 10px",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {isOwned && (
                    <div style={{ position: "absolute", top: 4, right: 4, backgroundColor: "#4ecdc4", padding: "2px 4px" }}>
                      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#0a0e1a" }}>OWNED</div>
                    </div>
                  )}
                  <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShopFurnitureArt art={item.art} size={48} />
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: "#e8f4f8", textAlign: "center", lineHeight: 1.4 }}>
                    {item.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconCoin size={10} color={isOwned ? "#6b8ba4" : "#ffe66d"} />
                    <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: isOwned ? "#6b8ba4" : "#ffe66d" }}>
                      {item.cost}
                    </div>
                  </div>
                  {isOwned ? (
                    <div style={{ width: "100%", padding: "5px 0", textAlign: "center", backgroundColor: "#0d1525", border: "2px solid #4ecdc4" }}>
                      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#4ecdc4" }}>IN ROOM</div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={!affordable}
                      style={{
                        width: "100%",
                        padding: "5px 0",
                        cursor: affordable ? "pointer" : "not-allowed",
                        backgroundColor: bought ? "#00ff88" : (affordable ? "#ffe66d" : "#0d1525"),
                        border: `2px solid ${affordable ? "#ffe66d" : "#2a3a5c"}`,
                        boxShadow: affordable && !bought ? "2px 2px 0 #0a0e1a" : "none",
                      }}
                    >
                      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: bought ? "#0a0e1a" : (affordable ? "#0a0e1a" : "#6b8ba4") }}>
                        {bought ? "BOUGHT!" : (affordable ? "BUY" : "NOT ENOUGH")}
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PROFILE — EDIT button lives inside profile card (per user edit)
// ─────────────────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 1, name: "FIRST BLOCK", unlocked: true, color: "#00ff88" },
  { id: 2, name: "STREAK X5", unlocked: true, color: "#ff6b35" },
  { id: 3, name: "IRS SLAYER", unlocked: true, color: "#4ecdc4" },
  { id: 4, name: "EAGLE EYE", unlocked: true, color: "#ffe66d" },
  { id: 5, name: "STREAK X10", unlocked: false, color: "#ff6b35" },
  { id: 6, name: "GRANDMASTER", unlocked: false, color: "#ffe66d" },
  { id: 7, name: "GHOST MODE", unlocked: false, color: "#c77dff" },
  { id: 8, name: "TECH SCAM", unlocked: false, color: "#4ecdc4" },
  { id: 9, name: "ROMANCE DEF", unlocked: false, color: "#ff2d55" },
];

// ─────────────────────────────────────────────────────────────────────────
// TOUR: coach-marks over the real UI, narrated by the mascot
// ─────────────────────────────────────────────────────────────────────────
// Targets are found at runtime via data-tour attributes rather than refs threaded
// through components — this file is huge and actively edited by others, so a lookup
// by attribute keeps the footprint to one attribute per target.
type TourStep = { target: string | null; accent: string; title: string; body: string };

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    accent: "#00ff88",
    title: "HI, I'M PIP!",
    body: "Scammers practise on our families every day. Let me show you around so your family can practise back.",
  },
  {
    target: "safety-bar",
    accent: "#ff6b35",
    title: "FAMILY SAFETY",
    body: "Your household's week at a glance. A shield means they stayed safe; a red heart means a scam got through.",
  },
  {
    target: "family-rooms",
    accent: "#c77dff",
    title: "THE HOUSE",
    body: "One room per person. Tap a room to see their level, XP and safe-streak. Everyone trains in their own room.",
  },
  {
    target: "start-drill",
    accent: "#00ff88",
    title: "START A DRILL",
    body: "This is the big one. Pick a call, SMS or email drill, then spot the red flags and report, ask family, or hang up.",
  },
  {
    target: "opt-in",
    accent: "#4ecdc4",
    title: "GO LIVE",
    body: "Opt in and drills arrive for real, when you least expect them. We only ever contact the number you verify, and every drill tells you it was a drill.",
  },
];

function SpeechBubble({ step, index, total, onNext, onSkip, onBack, style, innerRef }: {
  step: TourStep; index: number; total: number;
  onNext: () => void; onSkip: () => void; onBack: () => void;
  style?: React.CSSProperties;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const last = index === total - 1;
  return (
    <div ref={innerRef} style={{ position: "fixed", zIndex: 10001, width: 300, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: -4 }}>
        <PixelMascot size={44} animate />
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 9, color: step.accent, paddingBottom: 10 }}>
          {step.title}
        </div>
      </div>
      <div style={{ backgroundColor: "#111827", border: `4px solid ${step.accent}`, boxShadow: `4px 4px 0 #0a0e1a`, padding: 14 }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 14, color: "#e8f4f8", lineHeight: 1.6 }}>
          {step.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, backgroundColor: i === index ? step.accent : "#2a3a5c" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {index > 0 && <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm">BACK</PixelBtn>}
            <PixelBtn onClick={onNext} color={step.accent} size="sm">{last ? "DONE" : "NEXT"}</PixelBtn>
          </div>
        </div>
      </div>
      <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 2px" }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: "#6b8ba4" }}>SKIP TOUR</div>
      </button>
    </div>
  );
}

function TourOverlay({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [bubbleH, setBubbleH] = useState(250); // estimate until measured
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index];

  // Measure the bubble so placement can react to its real height, not a guess.
  useEffect(() => {
    const h = bubbleRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - bubbleH) > 2) setBubbleH(h);
  });

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      if (!step.target) return setRect(null);
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) return setRect(null); // target missing -> fall back to a centred bubble
      setRect(el.getBoundingClientRect());
    };
    // Scroll the target into view, then measure. Deliberately an INSTANT scroll: with
    // smooth scrolling the measurement ran mid-animation and the spotlight landed where
    // the element used to be.
    if (step.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ block: "center", behavior: "auto" });
    }
    const t = setTimeout(measure, step.target ? 90 : 0);
    window.addEventListener("resize", measure);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [index, step.target]);

  const next = () => (index === TOUR_STEPS.length - 1 ? onDone() : setIndex(index + 1));
  const pad = 6;

  // Bubble placement: below the target if it fits, else above, else clamped into view.
  // The last case is real — the family-rooms target is taller than the phone, and an
  // un-clamped "above" pushed the bubble (and Pip) off the top of the screen entirely.
  let bubbleStyle: React.CSSProperties = {
    left: "50%", top: "50%", transform: "translate(-50%,-50%)",
  };
  if (rect) {
    const vh = window.innerHeight;
    const gap = pad + 14;
    let top;
    if (rect.bottom + gap + bubbleH <= vh - 8) top = rect.bottom + gap;
    else if (rect.top - gap - bubbleH >= 8) top = rect.top - gap - bubbleH;
    else top = 8; // target fills the screen — pin it rather than let it drift off
    bubbleStyle = {
      left: Math.min(Math.max(rect.left + rect.width / 2 - 150, 12), Math.max(12, window.innerWidth - 312)),
      top: Math.max(8, Math.min(top, vh - bubbleH - 8)),
    };
  }

  return (
    <>
      {/* Dim everything except the target. One element: a huge spread shadow around it. */}
      <div
        onClick={next}
        style={{
          position: "fixed", zIndex: 10000, cursor: "pointer",
          ...(rect
            ? {
                left: rect.left - pad, top: rect.top - pad,
                width: rect.width + pad * 2, height: rect.height + pad * 2,
                boxShadow: `0 0 0 9999px rgba(4,6,12,0.88)`,
                border: `3px solid ${step.accent}`,
              }
            : { inset: 0, backgroundColor: "rgba(4,6,12,0.88)" }),
        }}
      />
      <SpeechBubble
        step={step} index={index} total={TOUR_STEPS.length}
        onNext={next} onBack={() => setIndex(Math.max(0, index - 1))} onSkip={onDone}
        style={bubbleStyle}
        innerRef={bubbleRef}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REGISTER (phone-ownership + consent via OTP; dev bypass code offline)
// ─────────────────────────────────────────────────────────────────────────
function RegisterScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("+65");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px", backgroundColor: "#0a0e1a",
    border: "3px solid #2a3a5c", color: "#e8f4f8",
    fontFamily: "'Share Tech Mono', monospace", fontSize: 16, outline: "none",
  };
  const label = (t: string) => (
    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4", marginBottom: 8 }}>{t}</div>
  );

  async function sendCode() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/verify/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Could not send code"); setBusy(false); return; }
      setDevCode(d.devCode ?? null);
      setMsg(d.dev ? "DEV MODE — enter the code below" : "Code sent by SMS");
      setStep("code");
    } catch { setMsg("Network error"); }
    setBusy(false);
  }
  async function verify() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/verify/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code, name, email: email.trim() || undefined }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { setMsg(d.error || "Incorrect code"); setBusy(false); return; }
      // Store the server-issued session token — this is what authorises real drills.
      if (d.token) setSessionToken(d.token);
      setMsg("VERIFIED! You're registered."); setTimeout(onDone, 1000);
    } catch { setMsg("Network error"); }
    setBusy(false);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: "#4ecdc4" }}>REGISTER</div>
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: "#2a3a5c" }}>OPT IN</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#6b8ba4", lineHeight: 1.3 }}>
          Verify your phone to opt in to real practice scam calls. We only ever call this number, and you can stop anytime.
        </div>
        <PixelPanel accent="#4ecdc4" className="w-full">
          {step === "phone" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label("YOUR NAME (OPTIONAL)")}<input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="JUDGE" /></div>
              <div>{label("PHONE NUMBER")}<input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+6591234567" inputMode="tel" /></div>
              <div>{label("EMAIL (OPTIONAL — FOR EMAIL DRILLS)")}<input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoCapitalize="none" /></div>
              <PixelBtn onClick={sendCode} color="#4ecdc4" size="lg" full disabled={busy}>{busy ? "SENDING..." : "[ SEND CODE ]"}</PixelBtn>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label(`CODE SENT TO ${phone}`)}<input style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: 22 }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" /></div>
              {devCode && <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: "#ffe66d", textAlign: "center" }}>DEV CODE: {devCode}</div>}
              <PixelBtn onClick={verify} color="#00ff88" size="lg" full disabled={busy || code.length < 6}>{busy ? "CHECKING..." : "[ VERIFY ]"}</PixelBtn>
              <PixelBtn onClick={() => { setStep("phone"); setMsg(""); }} color="#1a2340" textColor="#6b8ba4" size="sm" full>CHANGE NUMBER</PixelBtn>
            </div>
          )}
          {msg && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: msg.includes("VERIFIED") ? "#00ff88" : "#ff6b35", textAlign: "center" }}>{msg}</div>}
        </PixelPanel>
        <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK</PixelBtn>
      </div>
    </div>
  );
}

function ProfileScreen({
  onEditProfile,
  activeMemberId,
  coins,
  coinLedger,
  claimedDailyToday,
  onClaimDaily,
}: {
  onEditProfile?: () => void;
  activeMemberId: string;
  coins: Record<string, number>;
  coinLedger: CoinTx[];
  claimedDailyToday: Record<string, boolean>;
  onClaimDaily: (memberId: string) => void;
}) {
  const activeMember = MEMBER_MAP[activeMemberId] ?? FAMILY_MEMBERS[1];
  const memberCoins = coins[activeMemberId] ?? 0;
  const memberAlreadyClaimed = claimedDailyToday[activeMemberId] ?? false;

  // Filter ledger to just this member's transactions (most recent 6)
  const memberLedger = coinLedger.filter(tx => tx.memberId === activeMemberId).slice(0, 6);

  // Format relative timestamps for the ledger
  const formatRelativeTime = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return "JUST NOW";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}M AGO`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}H AGO`;
    const days = Math.floor(hrs / 24);
    return `${days}D AGO`;
  };
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="relative mx-4 mt-4 p-4 flex items-center gap-4" style={{ backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "4px 4px 0 #4ecdc4" }}>
          <button onClick={onEditProfile} className="absolute top-4 right-4" style={{ background: "none", border: "2px solid #4ecdc4", cursor: "pointer", padding: "4px 8px" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#4ecdc4" }}>EDIT</div>
          </button>
          <PixelMascot size={72} animate />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffffff" }}>PLAYER_001</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#4ecdc4", marginTop: 4 }}>LVL 7 — WATCHER</div>
            <div className="mt-3">
              <XPBar current={2340} max={3000} color="#4ecdc4" />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginTop: 4 }}>2,340 / 3,000 XP TO LVL 8</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
          {[
            { label: "TOTAL SCORE", val: "11,240", color: "#ffe66d", icon: <IconTrophy size={12} color="#ffe66d" /> },
            { label: "DRILLS DONE", val: "51", color: "#4ecdc4", icon: <IconShield size={12} color="#4ecdc4" /> },
            { label: "BEST STREAK", val: "12", color: "#ff6b35", icon: <IconFlame size={12} color="#ff6b35" /> },
            { label: "AREA RANK", val: "#12", color: "#00ff88", icon: <IconStar size={12} color="#00ff88" /> },
          ].map((s) => (
            <div key={s.label} className="p-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c" }}>
              <div className="flex items-center gap-1 mb-1">{s.icon}<div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4" }}>{s.label}</div></div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div className="mx-4 mt-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <IconBadge size={16} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ffe66d" }}>ACHIEVEMENT BADGES</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} className="flex flex-col items-center gap-2 p-3" style={{ backgroundColor: a.unlocked ? "#111827" : "#0d1120", border: `3px solid ${a.unlocked ? a.color : "#1a2340"}`, boxShadow: a.unlocked ? `3px 3px 0 ${a.color}` : "none", opacity: a.unlocked ? 1 : 0.45, position: "relative" }}>
                {!a.unlocked && <div style={{ position: "absolute", top: 4, right: 4 }}><IconLock size={10} color="#2a3a5c" /></div>}
                <IconBadge size={28} color={a.unlocked ? a.color : "#2a3a5c"} />
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: a.unlocked ? a.color : "#2a3a5c", textAlign: "center", lineHeight: 1.4 }}>{a.name}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4", textAlign: "center", marginTop: 12 }}>4 / 9 UNLOCKED</div>
        </div>

        {/* ── COIN REWARDS ────────────────────────────────────────────── */}
        <div className="mx-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <IconCoin size={16} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ffe66d" }}>COIN REWARDS</div>
          </div>

          {/* Coin balance card */}
          <div style={{ backgroundColor: "#111827", border: `4px solid ${memberCoins < 0 ? "#ff2d55" : "#ffe66d"}`, boxShadow: `4px 4px 0 ${memberCoins < 0 ? "#ff2d55" : "#ffe66d"}`, padding: "14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4", marginBottom: 6 }}>TOTAL COINS</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCoin size={20} color={memberCoins < 0 ? "#ff2d55" : "#ffe66d"} />
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 18, color: memberCoins < 0 ? "#ff2d55" : "#ffe66d" }}>
                  {memberCoins < 0 ? "-" : ""}{Math.abs(memberCoins).toLocaleString()}
                </div>
              </div>
              {memberCoins < 0 && (
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff2d55", marginTop: 6 }}>IN DEBT</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>DAILY REWARD</div>
              <button
                onClick={() => onClaimDaily(activeMemberId)}
                disabled={memberAlreadyClaimed}
                style={{
                  backgroundColor: memberAlreadyClaimed ? "#0d1525" : "#ffe66d",
                  border: `2px solid ${memberAlreadyClaimed ? "#2a3a5c" : "#0a0e1a"}`,
                  boxShadow: memberAlreadyClaimed ? "none" : "2px 2px 0 #0a0e1a",
                  padding: "5px 8px",
                  cursor: memberAlreadyClaimed ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <IconCoin size={10} color={memberAlreadyClaimed ? "#6b8ba4" : "#0a0e1a"} />
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: memberAlreadyClaimed ? "#6b8ba4" : "#0a0e1a" }}>
                  {memberAlreadyClaimed ? "CLAIMED" : `+${DAILY_REWARD_AMOUNT}`}
                </span>
              </button>
            </div>
          </div>

          {/* Ways to earn */}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4", letterSpacing: 1, marginBottom: 8 }}>WAYS TO EARN</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "CALL DRILL WIN", reward: "+50", icon: <IconPhone size={14} color="#ff6b35" /> },
              { label: "SMS DRILL WIN", reward: "+40", icon: <IconChatBubble size={14} color="#4ecdc4" /> },
              { label: "EMAIL DRILL WIN", reward: "+60", icon: <IconEnvelope size={14} color="#c77dff" /> },
              { label: "FAMILY ROUND", reward: "+30", icon: <IconShield size={14} color="#00ff88" /> },
              { label: "SELL FURNITURE", reward: "VARIES", icon: <IconSell size={14} color="#ff6b35" /> },
              { label: "PAYDAY (SAFE)", reward: "+350", icon: <IconBell size={14} color="#ffe66d" /> },
            ].map(row => (
              <div key={row.label} style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c", padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                {row.icon}
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", textAlign: "center", lineHeight: 1.4 }}>{row.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <IconCoin size={8} color="#ffe66d" />
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#00ff88" }}>{row.reward}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity ledger */}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4", letterSpacing: 1, marginBottom: 8 }}>RECENT ACTIVITY</div>
          <div style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c" }}>
            {memberLedger.length === 0 ? (
              <div style={{ padding: "16px 12px", textAlign: "center", fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", lineHeight: 1.6 }}>
                No transactions yet.<br />Complete a drill to see activity here.
              </div>
            ) : (
              memberLedger.map((tx, i) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderBottom: i < memberLedger.length - 1 ? "1px solid #2a3a5c" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <IconCoin size={10} color={tx.delta >= 0 ? "#ffe66d" : "#ff2d55"} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6.5, color: "#e8f4f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.label}</div>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginTop: 2 }}>{formatRelativeTime(tx.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: tx.delta >= 0 ? "#00ff88" : "#ff2d55", flexShrink: 0, marginLeft: 8 }}>
                    {tx.delta >= 0 ? "+" : ""}{tx.delta}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FAMILY DRILL SCENARIOS
// ─────────────────────────────────────────────────────────────────────────
const FAMILY_SCENARIOS: FamilyScenario[] = [
  {
    id: 1, targetMember: "Grandma", type: "sms", isScam: true,
    sender: "SG-SAFEALERT", senderDomain: "SG-SAFEALERT (spoofed sender ID)", senderWarning: "Spoofed sender name. Official banks never lock accounts via SMS links.",
    timestamp: "2:14 PM",
    message: "Your bank account has been locked due to suspicious activity. Verify your identity within 15 minutes to avoid suspension: http://secure-bank-verify.example",
    correctAction: "REPORT AS SCAM", actions: ["REPORT AS SCAM", "CLICK LINK", "REPLY WITH NRIC", "ASK FAMILY FIRST"],
    clues: [
      { label: "Urgency", text: "within 15 minutes", explanation: "Scammers pressure you to act fast so you have no time to think." },
      { label: "Suspicious URL", text: "secure-bank-verify.example", explanation: "Not an official bank domain. Real banks use their own verified domains." },
      { label: "Fear Tactic", text: "account has been locked", explanation: "Threatening to lock your account is a classic panic-inducing scare tactic." },
      { label: "Identity Request", text: "Verify your identity", explanation: "Banks never ask you to verify identity through an SMS link." },
    ],
    explanation: "This was a phishing SMS. Scammers create panic by claiming your bank account is locked. Always use the official banking app or call the official hotline — never follow a link in an SMS.",
  },
  {
    id: 2, targetMember: "Mum", type: "email", isScam: false,
    sender: "School Admin", senderEmail: "admin@schoolportal.edu.example", senderDomain: "schoolportal.edu.example", senderWarning: "",
    subject: "Reminder: Parent Briefing This Friday", timestamp: "9:30 AM",
    message: "Dear parents, this is a reminder that the parent briefing will be held this Friday at 7PM in the school hall. No action is required. Please log in through the official school portal if you need more details.",
    correctAction: "MARK AS SAFE", actions: ["MARK AS SAFE", "REPORT AS SCAM", "DELETE IMMEDIATELY", "ASK FAMILY FIRST"],
    clues: [
      { label: "No Urgency", text: "No urgent threat or deadline", explanation: "Legitimate messages rarely pressure you into immediate action." },
      { label: "No Payment", text: "No payment request", explanation: "This email does not ask for money or credentials." },
      { label: "Legit Domain", text: "schoolportal.edu.example", explanation: "The sender domain matches the official school portal." },
      { label: "Official Channel", text: "log in through the official school portal", explanation: "Legitimate messages direct you to official channels, not random links." },
    ],
    explanation: "This appears legitimate. Not every digital message is a scam. The key is to inspect the sender, the request, and whether the message pressures you into unsafe action.",
  },
  {
    id: 3, targetMember: "Dad", type: "sms", isScam: true,
    sender: "ParcelExpress", senderDomain: "ParcelExpress (spoofed SMS sender)", senderWarning: "Real couriers contact you through their official app, not payment links.",
    timestamp: "11:47 AM",
    message: "Delivery failed. Your parcel will be returned unless you pay a $2.10 redelivery fee today. Update here: http://parcel-express-redeliver.example",
    correctAction: "REPORT AS SCAM", actions: ["REPORT AS SCAM", "PAY FEE", "ENTER CARD DETAILS", "ASK FAMILY FIRST"],
    clues: [
      { label: "Small Fee Trick", text: "$2.10 redelivery fee", explanation: "A tiny fee lowers your guard. The real goal is your full card details." },
      { label: "Suspicious URL", text: "parcel-express-redeliver.example", explanation: "Real couriers use official branded domains, not random ones." },
      { label: "Urgency", text: "today", explanation: "Artificial deadlines pressure you into acting without thinking." },
      { label: "Payment via SMS", text: "Update here", explanation: "Legitimate couriers never ask for payment through SMS links." },
    ],
    explanation: "Small payments are used to lower your guard. Scammers use a tiny fee to steal your full card details. Never pay through an SMS link.",
  },
  {
    id: 4, targetMember: "Kid", type: "notification", isScam: true,
    sender: "GameMaster Rewards", senderEmail: "rewards@gamemaster-freecoins.example", senderDomain: "gamemaster-freecoins.example", senderWarning: "Not an official game domain. Free coin offers are commonly used to steal login credentials.",
    subject: "You won 10,000 free coins!", timestamp: "4:02 PM",
    message: "Congratulations! Your account has been selected for 10,000 free coins. Log in now with your username and password to claim before midnight.",
    correctAction: "ASK FAMILY FIRST", actions: ["ASK FAMILY FIRST", "REPORT AS SCAM", "CLAIM REWARD", "ENTER LOGIN DETAILS"],
    clues: [
      { label: "Too-Good-To-Be-True", text: "10,000 free coins", explanation: "Huge free rewards are used to excite you and lower your guard." },
      { label: "Login Request", text: "Log in now with your username and password", explanation: "Legitimate games never ask for credentials via email or notification." },
      { label: "Fake Urgency", text: "before midnight", explanation: "Deadlines create panic and rush you into acting without thinking." },
      { label: "Suspicious Domain", text: "gamemaster-freecoins.example", explanation: "Official game domains are established and verified, not random." },
    ],
    explanation: "Free rewards are commonly used to target younger users. Never enter game login details on unknown reward pages. Always ask a trusted adult first.",
  },
  {
    id: 5, targetMember: "Grandma", type: "email", isScam: true,
    sender: "Billing Department", senderEmail: "service@payment-support.example", senderDomain: "payment-support.example", senderWarning: "Not an official payment domain. Real services use their own verified domains (e.g. paypal.com).",
    subject: "Invoice for $600.00", timestamp: "2:49 PM",
    message: "You have been sent an invoice for $600.00. If you do not recognise this charge, call our support team immediately at +1 858-555-7823.",
    invoiceDetails: { amount: "$600.00", noteFromSeller: "Your account has been accessed unlawfully. A $600.00 transaction will appear within 24 hours. If you do not recognise this transaction, immediately contact us at +1 858-555-7823.", invoiceNumber: "1031" },
    buttonLabel: "View and Pay Invoice", buttonUrl: "http://payment-support-invoice.example/pay/1031",
    correctAction: "REPORT AS SCAM", actions: ["REPORT AS SCAM", "CALL THE NUMBER", "PAY INVOICE", "REPLY TO EMAIL"],
    clues: [
      { label: "Suspicious Domain", text: "payment-support.example", explanation: "Not an official payment domain. Always check the sender address carefully." },
      { label: "Fake Support Number", text: "+1 858-555-7823", explanation: "Scammers use phone numbers to pressure victims. Only call official verified numbers." },
      { label: "Large Fake Invoice", text: "$600.00", explanation: "A large unexpected invoice creates panic and pressures immediate action." },
      { label: "Scare Tactic", text: "account has been accessed unlawfully", explanation: "Claiming your account was hacked forces an emotional reaction." },
      { label: "Hidden in Note", text: "Note from seller", explanation: "Scam text is hidden inside the seller note field to look official." },
    ],
    explanation: "This scam uses a fake invoice to look official. The phone number is the trap — scammers will pressure you on the call. Never call numbers from unexpected invoices.",
  },
  {
    id: 6, targetMember: "Mum", type: "email", isScam: true,
    sender: "Luke Johnson", senderEmail: "luke.json8000@gmail.example", senderDomain: "gmail.example", senderWarning: "Using a suspicious personal email instead of a verified work account. The document link points to a fake domain.",
    subject: "Luke Johnson shared a document", timestamp: "2:46 PM",
    message: "Luke Johnson has invited you to edit the following document: 2026 Department Budget. Open the document to review.",
    buttonLabel: "OPEN DOCUMENT", buttonUrl: "http://drive-google-docs-login.example/d/6374",
    correctAction: "REPORT AS SCAM", actions: ["REPORT AS SCAM", "OPEN DOCUMENT", "REQUEST ACCESS", "MARK AS SAFE"],
    clues: [
      { label: "Lookalike URL", text: "drive-google-docs-login.example", explanation: "Real Google Docs uses docs.google.com. Fake domains mimic the style to fool you." },
      { label: "Unexpected Document", text: "2026 Department Budget", explanation: "If you weren't expecting a shared document, be very cautious." },
      { label: "Unknown Sender", text: "luke.json8000@gmail.example", explanation: "A personal email instead of a professional/work account is a red flag." },
      { label: "Phishing Button", text: "OPEN DOCUMENT", explanation: "The button leads to a fake login page designed to steal your credentials." },
    ],
    explanation: "This is a document-sharing phishing attempt. The email looks like a normal shared document, but the URL reveals a fake domain designed to steal credentials.",
  },
];

// Maps FamilyScenario.targetMember (title case) to member id
const FAMILY_NAME_TO_ID: Record<string, string> = {
  "Grandma": "grandma",
  "Mum": "mum",
  "Dad": "dad",
  "Kid": "kid",
};

// ─────────────────────────────────────────────────────────────────────────
// PIXEL TOGGLE / RADIO
// ─────────────────────────────────────────────────────────────────────────
function PixelToggle({ on, onToggle, color = "#00ff88" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} style={{ width: 52, height: 24, backgroundColor: on ? color : "#2a3a5c", border: `3px solid ${on ? "#0a0e1a" : "#1a2340"}`, boxShadow: on ? `3px 3px 0 #0a0e1a` : "2px 2px 0 #111", cursor: "pointer", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 28 : 2, width: 16, height: 14, backgroundColor: on ? "#0a0e1a" : "#6b8ba4", transition: "left 0.15s" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: on ? "flex-start" : "flex-end", padding: "0 5px" }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: on ? "#0a0e1a" : "#4a5568" }}>{on ? "ON" : "OFF"}</span>
      </div>
    </button>
  );
}

function ToggleSwitchB({ on, onToggle, color = "#00ff88" }: { on: boolean; onToggle: () => void; color?: string }) {
  return (
    <button onClick={onToggle} style={{ width: 44, height: 24, backgroundColor: on ? color : "#2a3a5c", border: "3px solid #0a0e1a", boxShadow: "3px 3px 0 #0a0e1a", cursor: "pointer", position: "relative", transition: "background-color 0.15s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 14, backgroundColor: on ? "#0a0e1a" : "#6b8ba4", transition: "left 0.15s" }} />
    </button>
  );
}

function PixelRadio({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 14, height: 14, border: `3px solid ${value === opt ? "#00ff88" : "#2a3a5c"}`, backgroundColor: value === opt ? "#00ff88" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {value === opt && <div style={{ width: 6, height: 6, backgroundColor: "#0a0e1a" }} />}
          </div>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: value === opt ? "#00ff88" : "#6b8ba4" }}>{opt}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// INSPECTABLE LINK
// ─────────────────────────────────────────────────────────────────────────
function InspectableLink({ label, url, onReveal, showWarning = true }: { label: string; url: string; onReveal?: () => void; showWarning?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      <button onClick={() => { setRevealed((r) => !r); if (!revealed) onReveal?.(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <span style={{ fontFamily: "sans-serif", fontSize: 13, color: "#1a73e8", textDecoration: "underline" }}>{label}</span>
      </button>
      {revealed && (
        <div style={{ marginTop: 6, backgroundColor: showWarning ? "rgba(255,45,85,0.08)" : "rgba(78,205,196,0.08)", border: `2px solid ${showWarning ? "#ff2d55" : "#4ecdc4"}`, padding: "8px 10px", animation: "slideUp 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: showWarning ? "#ff2d55" : "#4ecdc4", marginBottom: 4 }}>ACTUAL URL:</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: showWarning ? "#ff6b35" : "#4ecdc4", wordBreak: "break-all" }}>{url}</div>
          {showWarning && <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#ff2d55", marginTop: 4 }}>⚠ SUSPICIOUS DOMAIN — DO NOT VISIT</div>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SENDER INSPECT PANEL
// ─────────────────────────────────────────────────────────────────────────
function SenderInspectPanel({ scenario, onClose, showWarning = true }: { scenario: FamilyScenario; onClose: () => void; showWarning?: boolean }) {
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50, backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "0 -4px 0 #4ecdc4", animation: "slideUp 0.25s ease-out" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
        <div className="flex items-center gap-2"><IconEyeInspect size={12} color="#4ecdc4" /><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#4ecdc4" }}>SENDER INFO</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        <div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginBottom: 3 }}>DISPLAY NAME</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8" }}>{scenario.sender}</div>
        </div>
        {scenario.senderEmail && (
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginBottom: 3 }}>EMAIL ADDRESS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35" }}>{scenario.senderEmail}</div>
          </div>
        )}
        {scenario.senderDomain && (
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginBottom: 3 }}>DOMAIN</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: scenario.isScam ? "#ff2d55" : "#00ff88" }}>{scenario.senderDomain}</div>
          </div>
        )}
        {showWarning && scenario.senderWarning && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.1)", border: "2px solid #ff2d55", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55", lineHeight: 1.8 }}>{scenario.senderWarning}</div>
          </div>
        )}
        {showWarning && !scenario.isScam && (
          <div style={{ backgroundColor: "rgba(0,255,136,0.1)", border: "2px solid #00ff88", padding: "8px 10px" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#00ff88", lineHeight: 1.8 }}>DOMAIN APPEARS LEGITIMATE</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CLUE TOOLTIP
// ─────────────────────────────────────────────────────────────────────────
function ClueTooltip({ clue, onClose }: { clue: FamilyClue; onClose: () => void }) {
  return (
    <div style={{ position: "absolute", top: "25%", left: 12, right: 12, zIndex: 60, backgroundColor: "#111827", border: "4px solid #ffe66d", boxShadow: "4px 4px 0 #ffe66d", animation: "slideUp 0.2s ease-out" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
        <div className="flex items-center gap-2"><IconBulb size={12} color="#ffe66d" /><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffe66d" }}>CLUE</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ff6b35" }}>{clue.label}</div>
        <div style={{ backgroundColor: "rgba(255,107,53,0.15)", border: "2px solid #ff6b35", padding: "6px 8px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35" }}>"{clue.text}"</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>{clue.explanation}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ANIMATED FAMILY CHARACTER
// ─────────────────────────────────────────────────────────────────────────
function AnimatedFamilyChar({ name, size = 60 }: { name: string; size?: number }) {
  const frame = useIdleFrame(2);
  const idMap: Record<string, string> = { Grandma: "grandma", Mum: "mum", Dad: "dad", Kid: "kid" };
  const id = idMap[name] ?? "mum";
  return <FamilyChar id={id} size={size} frame={frame} />;
}

// ─────────────────────────────────────────────────────────────────────────
// SMS PHONE MOCK CARD
// ─────────────────────────────────────────────────────────────────────────
function SmsMockCard({ scenario, showWarning, onSenderTap }: {
  scenario: FamilyScenario; showWarning: boolean; onSenderTap: () => void;
}) {
  const avatarColor = scenario.isScam ? "#f4a261" : "#4ecdc4";
  return (
    <div style={{ maxWidth: 270, margin: "0 auto", border: "4px solid #2a3a5c", boxShadow: "4px 4px 0 #2a3a5c" }}>
      <div style={{ backgroundColor: "#1a1a2e", padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa" }}>9:41</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[6, 9, 12].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, backgroundColor: "#aaa" }} />
          ))}
          <div style={{ width: 3, height: 12, backgroundColor: "#aaa", marginLeft: 4 }} />
        </div>
      </div>
      <button onClick={onSenderTap} style={{ width: "100%", backgroundColor: "#f0f0f2", borderBottom: "1px solid #ddd", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontFamily: "monospace", fontSize: 20, color: "#555", lineHeight: 1 }}>‹</div>
        <div style={{ width: 28, height: 28, backgroundColor: avatarColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: "bold", color: "#fff" }}>{scenario.sender[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 600, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scenario.sender}</div>
          <div style={{ fontFamily: "sans-serif", fontSize: 9, color: "#888" }}>Tap to inspect sender</div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#4ecdc4", border: "1px solid #4ecdc4", padding: "2px 4px", flexShrink: 0 }}>INFO</div>
      </button>
      <div style={{ backgroundColor: "#f5f5f7", padding: "12px 10px", minHeight: 100 }}>
        <div style={{ textAlign: "center", fontFamily: "sans-serif", fontSize: 9, color: "#999", marginBottom: 10 }}>{scenario.timestamp}</div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div style={{ backgroundColor: "#e5e5ea", borderRadius: "14px 14px 14px 2px", padding: "10px 12px", maxWidth: "85%", wordBreak: "break-word" }}>
            <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#1a1a1a", lineHeight: 1.55 }}>
              {scenario.message.split(/(https?:\/\/\S+)/g).map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <div key={i} style={{ marginTop: 4 }}>
                    <InspectableLink label={part} url={part} showWarning={showWarning} />
                  </div>
                ) : <span key={i}>{part}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY DRILL INTRO
// ─────────────────────────────────────────────────────────────────────────
function FamilyDrillIntroScreen({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const [showHowTo, setShowHowTo] = useState(false);
  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#00ff88" }}>FAMILY DRILL</div>
        <div className="flex items-center gap-2"><IconShield size={14} color="#00ff88" /><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#00ff88" }}>4/4 READY</div></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>
        <div style={{ margin: "14px 0", backgroundColor: "#111827", border: "3px solid #00ff88", padding: "10px 14px" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><IconShield size={14} color="#00ff88" /><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#00ff88" }}>FAMILY TRUST</div></div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#ffe66d" }}>100%</div>
          </div>
          <div style={{ height: 8, backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c" }}>
            <div style={{ height: "100%", width: "100%", backgroundColor: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
          </div>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {["Grandma", "Mum", "Dad", "Kid"].map((name) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <AnimatedFamilyChar name={name} size={44} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 3, color: "#4ecdc4" }}>{name.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffffff", textAlign: "center", marginBottom: 12, lineHeight: 1.8 }}>
          Protect the whole household from scams.
        </div>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#4ecdc4", marginBottom: 8 }}>HOW IT WORKS</div>
          {["Each family member faces a suspicious message.", "Inspect links and senders before deciding.", "Some messages are safe — read carefully!", "Wrong choices teach you what to watch for."].map((line, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 6, height: 6, backgroundColor: "#00ff88", flexShrink: 0, marginTop: 4 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>{line}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "6px 8px", backgroundColor: "rgba(255,230,109,0.08)", border: "2px solid #ffe66d", display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoin size={10} color="#ffe66d" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffe66d" }}>+30 COINS PER CORRECT · -10 PER WRONG</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <PixelBtn onClick={onStart} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ START FAMILY DRILL ]</PixelBtn>
          <PixelBtn onClick={() => setShowHowTo(true)} color="#ffe66d" textColor="#0a0e1a" size="sm" full>[ HOW TO PLAY ]</PixelBtn>
          <PixelBtn onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK HOME ]</PixelBtn>
        </div>
      </div>
      {showHowTo && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.88)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
          <div style={{ backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "4px 4px 0 #4ecdc4", width: "100%" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#4ecdc4" }}>HOW TO PLAY</div>
              <button onClick={() => setShowHowTo(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              {[["TAP SENDER", "Inspect sender identity and domain."], ["LONG-PRESS LINKS", "Reveal the actual URL before opening."], ["TAP CLUE TAGS", "Uncover red flags in the message."], ["READ CAREFULLY", "Not every message is a scam."], ["CHOOSE SAFELY", "Pick the best action for the family."]].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <IconBulb size={12} color="#ffe66d" />
                  <div><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ffe66d", marginBottom: 2 }}>{title}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#6b8ba4", lineHeight: 1.4 }}>{desc}</div></div>
                </div>
              ))}
              <PixelBtn onClick={() => setShowHowTo(false)} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>GOT IT</PixelBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY ROUND
// ─────────────────────────────────────────────────────────────────────────
function FamilyRoundScreen({ scenario, roundIndex, totalRounds, onComplete, onNext, onEnd }: {
  scenario: FamilyScenario; roundIndex: number; totalRounds: number;
  onComplete: (action: string, foundClues: number[], correct: boolean) => void;
  onNext: () => void; onEnd: () => void;
}) {
  const [mode, setMode] = useState<"play" | "debrief">("play");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [lightbulbIdx, setLightbulbIdx] = useState(-1);
  const [activeClue, setActiveClue] = useState<FamilyClue | null>(null);
  const [showSenderPanel, setShowSenderPanel] = useState(false);
  const [foundCluesLocal, setFoundCluesLocal] = useState<number[]>([]);

  useEffect(() => {
    setMode("play");
    setSelectedAction(null);
    setLightbulbIdx(-1);
    setActiveClue(null);
    setShowSenderPanel(false);
    setFoundCluesLocal([]);
  }, [scenario.id]);

  const memberColors: Record<string, string> = { Grandma: "#c77dff", Mum: "#ff6b35", Dad: "#4ecdc4", Kid: "#ffe66d" };
  const color = memberColors[scenario.targetMember] ?? "#6b8ba4";
  const typeLabels: Record<string, string> = { sms: "SMS", email: "EMAIL", notification: "NOTIF" };

  const isCorrect = (action: string | null) =>
    action !== null && (action === scenario.correctAction || (scenario.id === 4 && action === "REPORT AS SCAM"));

  const handleAction = (action: string) => {
    if (mode !== "play") return;
    const correct = isCorrect(action);
    setSelectedAction(action);
    setMode("debrief");
    onComplete(action, foundCluesLocal, correct);
  };

  const handleLightbulb = () => {
    const nextIdx = lightbulbIdx + 1;
    if (nextIdx < scenario.clues.length) {
      setLightbulbIdx(nextIdx);
      setFoundCluesLocal((prev) => (prev.includes(nextIdx) ? prev : [...prev, nextIdx]));
      setActiveClue(scenario.clues[nextIdx]);
    }
  };

  const inDebrief = mode === "debrief";
  const correct = isCorrect(selectedAction);

  const EmailCard = () => (
    <div style={{ border: `4px solid ${color}`, boxShadow: `4px 4px 0 ${color}` }}>
      <div style={{ backgroundColor: "#e8e8e8", borderBottom: "2px solid #ccc", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, backgroundColor: "#ff5f57", borderRadius: "50%" }} />
        <div style={{ width: 8, height: 8, backgroundColor: "#febc2e", borderRadius: "50%" }} />
        <div style={{ width: 8, height: 8, backgroundColor: "#28c840", borderRadius: "50%" }} />
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#555", marginLeft: 6 }}>{typeLabels[scenario.type]}</div>
      </div>
      <button onClick={() => setShowSenderPanel(true)} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#f9f9f9", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 32, height: 32, backgroundColor: scenario.isScam ? "#f4a261" : "#4ecdc4", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", flexShrink: 0 }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", color: "#fff" }}>{scenario.sender[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>
            {scenario.sender}
            {scenario.senderEmail && <span style={{ fontWeight: 400, color: "#888", fontSize: 10 }}> &lt;{scenario.senderEmail}&gt;</span>}
          </div>
          {scenario.subject && <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "#555", fontWeight: 600, marginTop: 1 }}>{scenario.subject}</div>}
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#4ecdc4", border: "1px solid #4ecdc4", padding: "2px 4px", flexShrink: 0 }}>INSPECT</div>
      </button>
      <div style={{ padding: "12px 14px", backgroundColor: "#fff" }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 8 }}>{scenario.message}</div>
        {scenario.invoiceDetails && (
          <div style={{ margin: "10px 0", backgroundColor: "#f8f8f8", border: "1px solid #ddd", padding: "12px" }}>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 8 }}>Invoice details</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "#888", marginBottom: 2 }}>Amount requested</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 8 }}>{scenario.invoiceDetails.amount}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "#888", marginBottom: 4 }}>Note from seller</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#c0392b", lineHeight: 1.5 }}>{scenario.invoiceDetails.noteFromSeller}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "#888", marginTop: 8 }}>Invoice number</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#333" }}>{scenario.invoiceDetails.invoiceNumber}</div>
          </div>
        )}
        {scenario.id === 6 && (
          <div style={{ margin: "10px 0", border: "1px solid #e0e0e0", backgroundColor: "#f9f9f9", padding: "10px" }}>
            <div className="flex items-center gap-2 mb-2">
              <div style={{ width: 18, height: 18, backgroundColor: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>D</span>
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 600, color: "#333" }}>2026 Department Budget</div>
            </div>
            <div style={{ height: 40, backgroundColor: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <span style={{ color: "#4285f4", fontSize: 20, fontWeight: "bold" }}>≡</span>
            </div>
            <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "#888" }}>Luke Johnson is the owner · Last edited 1 hour ago</div>
          </div>
        )}
        {scenario.buttonLabel && scenario.buttonUrl && (
          <div style={{ marginTop: 12 }}>
            <InspectableLink label={scenario.buttonLabel} url={scenario.buttonUrl} showWarning={inDebrief} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full" style={{ position: "relative", background: inDebrief ? (correct ? "linear-gradient(180deg,#0a1a0f,#0a0e1a)" : "linear-gradient(180deg,#1a0a0f,#0a0e1a)") : undefined }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 48, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4" }}>ROUND {roundIndex + 1}/{totalRounds}</div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ffe66d" }}>
          {inDebrief ? "DEBRIEF" : `${foundCluesLocal.length}/${scenario.clues.length} CLUES`}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2" style={{ backgroundColor: "#111827", borderBottom: `4px solid ${color}`, flexShrink: 0 }}>
        <AnimatedFamilyChar name={scenario.targetMember} size={36} />
        <div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>TARGET:</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color }}>{scenario.targetMember.toUpperCase()}</div>
        </div>
        <div style={{ marginLeft: "auto", backgroundColor: "rgba(255,107,53,0.1)", border: `2px solid ${color}`, padding: "3px 7px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color }}>{typeLabels[scenario.type] ?? "MSG"}</div>
        </div>
      </div>
      {inDebrief && (
        <div style={{ backgroundColor: correct ? "rgba(0,255,136,0.15)" : "rgba(255,45,85,0.15)", borderBottom: `4px solid ${correct ? "#00ff88" : "#ff2d55"}`, padding: "10px 16px", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: correct ? "#00ff88" : "#ff2d55", marginBottom: 4 }}>
            {correct ? "SAFE CHOICE!" : "SCAMMER HIT!"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffe66d" }}>+{correct ? 100 : 25} XP</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IconCoin size={9} color={correct ? "#ffe66d" : "#ff2d55"} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: correct ? "#00ff88" : "#ff2d55" }}>{correct ? "+30" : "-10"}</div>
            </div>
            {!correct && (
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>
                CORRECT: <span style={{ color: "#00ff88" }}>{scenario.correctAction}</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
        {scenario.type === "sms"
          ? <SmsMockCard scenario={scenario} showWarning={inDebrief} onSenderTap={() => setShowSenderPanel(true)} />
          : <EmailCard />
        }
        {inDebrief && (
          <>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#4ecdc4", marginTop: 14, marginBottom: 8 }}>
              TAP CLUES TO EXPLORE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 }}>
              {scenario.clues.map((clue, i) => (
                <button key={i} onClick={() => setActiveClue(clue)} style={{ backgroundColor: "rgba(255,107,53,0.15)", border: "3px solid #ff6b35", padding: "7px 13px", cursor: "pointer" }}>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ff6b35" }}>{clue.label}</div>
                </button>
              ))}
            </div>
            <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <IconBulb size={12} color="#ffe66d" />
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ffe66d" }}>WHY?</div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>{scenario.explanation}</div>
            </div>
          </>
        )}
      </div>
      {!inDebrief ? (
        <div className="px-3 py-3" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={handleLightbulb}
              disabled={lightbulbIdx >= scenario.clues.length - 1}
              style={{ background: "none", border: `2px solid ${lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d"}`, cursor: lightbulbIdx >= scenario.clues.length - 1 ? "default" : "pointer", padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}
            >
              <IconBulb size={12} color={lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d"} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d" }}>
                HINT{lightbulbIdx + 1 < scenario.clues.length ? ` (${scenario.clues.length - lightbulbIdx - 1})` : ""}
              </div>
            </button>
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#6b8ba4", marginBottom: 6, textAlign: "center" }}>WHAT SHOULD THE FAMILY DO?</div>
          <div className="grid grid-cols-2 gap-2">
            {scenario.actions.map((action) => (
              <button key={action} onClick={() => handleAction(action)} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "8px 6px", cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#e8f4f8", textAlign: "center", lineHeight: 1.5 }}>
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, padding: "12px", borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", flexShrink: 0 }}>
          <div style={{ flex: 1 }}><PixelBtn onClick={onNext} color="#00ff88" textColor="#0a0e1a" size="sm" full>NEXT MEMBER</PixelBtn></div>
          <div style={{ flex: 1 }}><PixelBtn onClick={onEnd} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>END DRILL</PixelBtn></div>
        </div>
      )}
      {showSenderPanel && (
        <SenderInspectPanel scenario={scenario} onClose={() => setShowSenderPanel(false)} showWarning={inDebrief} />
      )}
      {activeClue && <ClueTooltip clue={activeClue} onClose={() => setActiveClue(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY SUMMARY
// ─────────────────────────────────────────────────────────────────────────
function FamilySummaryScreen({ answers, onPlayAgain, onIndividual, onHome }: {
  answers: { scenarioId: number; action: string; correct: boolean; foundClues: number[] }[];
  onPlayAgain: () => void; onIndividual: () => void; onHome: () => void;
}) {
  const correctCount = answers.filter((a) => a.correct).length;
  const totalClues = FAMILY_SCENARIOS.reduce((sum, s) => sum + s.clues.length, 0);
  const foundCluesCount = answers.reduce((sum, a) => sum + a.foundClues.length, 0);
  const totalXP = answers.reduce((sum, a) => sum + (a.correct ? 100 : 25), 0);
  const totalCoins = answers.reduce((sum, a) => sum + (a.correct ? 30 : -10), 0);

  const header = correctCount >= 5 ? "FAMILY SAFE!" : correctCount >= 3 ? "GOOD TRAINING!" : "MORE PRACTICE NEEDED!";
  const headerColor = correctCount >= 5 ? "#00ff88" : correctCount >= 3 ? "#ffe66d" : "#ff2d55";

  const memberResults: Record<string, boolean[]> = {};
  FAMILY_SCENARIOS.forEach((s, i) => {
    if (!memberResults[s.targetMember]) memberResults[s.targetMember] = [];
    if (i < answers.length) memberResults[s.targetMember].push(answers[i].correct);
  });

  const badges = [
    { name: "LINK INSPECTOR", desc: "Revealed hidden URLs", earned: answers.some((a) => a.foundClues.length >= 2) },
    { name: "FAMILY SHIELD", desc: "Protected all members", earned: correctCount >= 5 },
    { name: "PHISH FINDER", desc: "Found 8+ clues", earned: foundCluesCount >= 8 },
    { name: "NO PANIC BONUS", desc: "Stayed calm under pressure", earned: correctCount >= 4 },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 52, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: headerColor }}>{header}</div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#111827", border: `4px solid ${headerColor}`, boxShadow: `4px 4px 0 ${headerColor}`, padding: "14px", marginBottom: 14 }}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "CORRECT", value: `${correctCount}/6`, color: "#00ff88" },
              { label: "CLUES FOUND", value: `${foundCluesCount}/${totalClues}`, color: "#4ecdc4" },
              { label: "FAMILY XP", value: `+${totalXP}`, color: "#ffe66d" },
              { label: "COINS EARNED", value: `${totalCoins >= 0 ? "+" : ""}${totalCoins}`, color: totalCoins >= 0 ? "#ffe66d" : "#ff2d55" },
            ].map((s) => (
              <div key={s.label} style={{ backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c", padding: "8px 10px" }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#6b8ba4", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#4ecdc4", marginBottom: 8 }}>FAMILY RESULTS</div>
        <div className="flex flex-col gap-2 mb-14">
          {["Grandma", "Mum", "Dad", "Kid"].map((name) => {
            const results = memberResults[name] ?? [];
            const status = results.length === 0 ? "NO DATA" : results.every(Boolean) ? "SAFE" : results.some(Boolean) ? "NEEDS PRACTICE" : "SCAMMED";
            const sc = status === "SAFE" ? "#00ff88" : status === "NEEDS PRACTICE" ? "#ffe66d" : status === "SCAMMED" ? "#ff2d55" : "#6b8ba4";
            return (
              <div key={name} className="flex items-center gap-3" style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c", padding: "8px 12px" }}>
                <AnimatedFamilyChar name={name} size={28} />
                <div style={{ flex: 1, fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#e8f4f8" }}>{name.toUpperCase()}</div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: sc }}>{status}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffe66d", marginBottom: 8 }}>BADGES</div>
        <div className="grid grid-cols-2 gap-2 mb-14">
          {badges.map((b) => (
            <div key={b.name} style={{ backgroundColor: b.earned ? "#111827" : "#0a0e1a", border: `2px solid ${b.earned ? "#ffe66d" : "#1a2340"}`, padding: "8px 10px", opacity: b.earned ? 1 : 0.4 }}>
              <IconBadge size={18} color={b.earned ? "#ffe66d" : "#2a3a5c"} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: b.earned ? "#ffe66d" : "#2a3a5c", marginTop: 4, lineHeight: 1.5 }}>{b.name}</div>
              {!b.earned && <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#1a2340", marginTop: 2 }}>LOCKED</div>}
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#4ecdc4", marginBottom: 8 }}>TOP LESSONS</div>
          {["Always inspect the sender.", "Hover or long-press links before opening.", "Be careful with urgent messages.", "Never share passwords, OTPs, or card details.", "Ask family before acting on suspicious messages."].map((l, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 5, height: 5, backgroundColor: "#4ecdc4", flexShrink: 0, marginTop: 5 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#e8f4f8", lineHeight: 1.5 }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pb-4">
          <PixelBtn onClick={onPlayAgain} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ PLAY FAMILY DRILL AGAIN ]</PixelBtn>
          <PixelBtn onClick={onIndividual} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>[ TRY INDIVIDUAL DRILL ]</PixelBtn>
          <PixelBtn onClick={onHome} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK HOME ]</PixelBtn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────
function SettingsScreen({ settings, onSettings, onNav }: { settings: AppSettings; onSettings: (s: Partial<AppSettings>) => void; onNav: (screen: string) => void }) {
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const toggleAccordion = (key: string) => setOpenAccordion((prev) => (prev === key ? null : key));

  const NavChevron = () => (
    <svg width={8} height={8} viewBox="0 0 4 4" style={{ imageRendering: "pixelated" }}>
      <rect x={0} y={1} width={1} height={1} fill="#6b8ba4" />
      <rect x={1} y={2} width={1} height={1} fill="#6b8ba4" />
      <rect x={2} y={3} width={1} height={1} fill="#6b8ba4" />
      <rect x={3} y={2} width={1} height={1} fill="#6b8ba4" />
    </svg>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>

        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#4ecdc4", marginBottom: 14 }}>DRILL SETTINGS</div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4", marginBottom: 8 }}>FREQUENCY</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[{ id: "free", top: "FREE PLAY", sub: "Manual only" }, { id: "recurring", top: "RECURRING", sub: "Auto weekly" }].map((opt) => {
              const active = settings.drillFrequency === opt.id;
              return (
                <button key={opt.id} onClick={() => onSettings({ drillFrequency: opt.id })} style={{ padding: "12px 8px", backgroundColor: active ? "#00ff88" : "#0a0e1a", border: `3px solid ${active ? "#00ff88" : "#2a3a5c"}`, boxShadow: active ? "3px 3px 0 #006633" : "none", cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: active ? "#0a0e1a" : "#6b8ba4", marginBottom: 4 }}>{opt.top}</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: active ? "#0a1a0a" : "#2a3a5c" }}>{opt.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#e8f4f8" }}>FAMILY DRILL</div>
          <ToggleSwitchB on={settings.familyDrillEnabled} onToggle={() => onSettings({ familyDrillEnabled: !settings.familyDrillEnabled })} color="#c77dff" />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#e8f4f8" }}>NOTIFICATIONS</div>
          <ToggleSwitchB on={settings.notificationsEnabled} onToggle={() => onSettings({ notificationsEnabled: !settings.notificationsEnabled })} color="#ffe66d" />
        </div>

        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ffe66d", marginBottom: 14 }}>ACCOUNT</div>

        <div style={{ padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <PixelMascot size={36} />
          <div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ffffff" }}>PLAYER_001</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#4ecdc4", marginTop: 4 }}>LVL 7 — WATCHER</div>
          </div>
        </div>

        {[
          { key: "account-settings", label: "ACCOUNT" },
          { key: "privacy-settings", label: "PRIVACY" },
          { key: "accessibility-settings", label: "ACCESSIBILITY" },
          { key: "about-settings", label: "ABOUT" },
        ].map((row) => (
          <button
            key={row.key}
            onClick={() => onNav(row.key)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", cursor: "pointer", marginBottom: 4 }}
          >
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#e8f4f8" }}>{row.label}</div>
            <NavChevron />
          </button>
        ))}

        <div style={{ marginBottom: 4, marginTop: 4 }}>
          <button onClick={() => toggleAccordion("reset")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", cursor: "pointer" }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ff2d55" }}>RESET PROGRESS</div>
            <div style={{ transform: openAccordion === "reset" ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "flex" }}>
              <NavChevron />
            </div>
          </button>
          {openAccordion === "reset" && (
            <div style={{ backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", borderTop: "none", padding: "14px 16px", animation: "slideUp 0.15s ease-out" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#ff2d55", marginBottom: 10, lineHeight: 1.5 }}>This will erase all progress, XP and badges. Cannot be undone.</div>
              <PixelBtn onClick={() => {}} color="#ff2d55" textColor="#ffffff" size="sm" full>CONFIRM RESET</PixelBtn>
            </div>
          )}
        </div>

        <div style={{ margin: "24px 0 8px", border: "3px solid #1a2340", padding: "18px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#2a3a5c", lineHeight: 2.4 }}>
            DRILL MODE v2.0.0<br />
            SCAM FIGHTER TRAINING<br />
            © 2026 ALL RIGHTS RESERVED
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS SUB-SCREENS
// ─────────────────────────────────────────────────────────────────────────
function AccountSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ACCOUNT" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {[{ label: "USERNAME", value: "PLAYER_001", color: "#e8f4f8" }, { label: "EMAIL", value: "player@drillmode.example", color: "#4ecdc4" }, { label: "LINKED FAMILY PROFILES", value: "4 MEMBERS", color: "#00ff88" }].map((row) => (
          <div key={row.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4", marginBottom: 4 }}>{row.label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: row.color }}>{row.value}</div>
          </div>
        ))}
        <PixelBtn onClick={() => {}} color="#ff2d55" textColor="#ffffff" size="sm" full>[ DELETE ACCOUNT ]</PixelBtn>
      </div>
    </div>
  );
}

function PrivacySettingsScreen({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState([false, false]);
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="PRIVACY" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#4ecdc4", marginBottom: 6 }}>DATA PRIVACY</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>Training data stays on this device. No personal data is collected or shared. Do not use real personal data in drills.</div>
        </div>
        {["Hide sensitive examples", "Clear drill history"].map((label, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#e8f4f8" }}>{label}</div>
            <PixelToggle on={s[i]} onToggle={() => setS((arr) => arr.map((v, j) => j === i ? !v : v))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessibilitySettingsScreen({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState([false, false, false, false, false]);
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ACCESSIBILITY" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {["Reduce flashing effects", "Larger text", "High contrast mode", "Disable CRT scanlines", "Slower animations"].map((label, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#e8f4f8" }}>{label}</div>
            <PixelToggle on={s[i]} onToggle={() => setS((arr) => arr.map((v, j) => j === i ? !v : v))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ABOUT" titleColor="#ffe66d" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#00ff88", marginBottom: 6 }}>DRILL MODE</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#4ecdc4", marginBottom: 4 }}>SCAM FIGHTER TRAINING</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4" }}>v2.0.0</div>
        </div>
        <div style={{ backgroundColor: "rgba(255,107,53,0.1)", border: "3px solid #ff6b35", padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#ff6b35", marginBottom: 6 }}>DISCLAIMER</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>This app is a training simulation. It does not detect real scams automatically. All scenarios are fictional educational examples.</div>
        </div>
      </div>
    </div>
  );
}

function ProfileEditScreen({ onBack, onAvatar, onHouse }: { onBack: () => void; onAvatar: () => void; onHouse: () => void }) {
  const [profileTitle, setProfileTitle] = useState("WATCHER");
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="EDIT PROFILE" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4", marginBottom: 6 }}>USERNAME</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 16, color: "#e8f4f8", marginBottom: 8 }}>PLAYER_001</div>
          <PixelBtn onClick={() => {}} color="#4ecdc4" textColor="#0a0e1a" size="sm">CHANGE NAME</PixelBtn>
        </div>
        <button onClick={onAvatar} style={{ width: "100%", backgroundColor: "#111827", border: "3px solid #c77dff", padding: "12px 14px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#c77dff", marginBottom: 4 }}>CHANGE AVATAR</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#6b8ba4" }}>Customise your pixel character</div></div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#c77dff" }}>›</div>
        </button>
        <button onClick={onHouse} style={{ width: "100%", backgroundColor: "#111827", border: "3px solid #00ff88", padding: "12px 14px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#00ff88", marginBottom: 4 }}>CUSTOMISE HOUSE</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#6b8ba4" }}>Sell furniture and buy wallpapers</div></div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#00ff88" }}>›</div>
        </button>
        <div style={{ backgroundColor: "#111827", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffe66d", marginBottom: 10 }}>PROFILE TITLE</div>
          <PixelRadio options={["WATCHER", "SCAM BLOCKER", "LINK INSPECTOR", "FAMILY GUARDIAN"]} value={profileTitle} onChange={setProfileTitle} />
        </div>
        <PixelBtn onClick={onBack} color="#00ff88" textColor="#0a0e1a" size="sm" full>[ SAVE PROFILE ]</PixelBtn>
      </div>
    </div>
  );
}

function AvatarCustomisationScreen({ onBack }: { onBack: () => void }) {
  const [baseColor, setBaseColor] = useState("#4ecdc4");
  const [glowColor, setGlowColor] = useState("#00ff88");
  const palette = ["#4ecdc4", "#ff6b35", "#c77dff", "#ffe66d", "#ff2d55", "#00ff88"];
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="AVATAR" titleColor="#c77dff" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex justify-center mb-4" style={{ padding: "16px", backgroundColor: "#111827", border: "3px solid #c77dff", boxShadow: `0 0 16px ${glowColor}` }}>
          <PixelMascot size={80} animate />
        </div>
        {[{ label: "AVATAR COLOUR", sel: baseColor, set: setBaseColor }, { label: "GLOW COLOUR", sel: glowColor, set: setGlowColor }].map((row) => (
          <div key={row.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#c77dff", marginBottom: 8 }}>{row.label}</div>
            <div className="flex gap-3 flex-wrap">{palette.map((c) => (<button key={c} onClick={() => row.set(c)} style={{ width: 32, height: 32, backgroundColor: c, border: `4px solid ${row.sel === c ? "#fff" : "#0a0e1a"}`, cursor: "pointer" }} />))}</div>
          </div>
        ))}
        {[{ label: "HELMET / HAT", opts: ["None", "Cap", "Helmet", "Crown"] }, { label: "EYE STYLE", opts: ["Default", "Shades", "Visor", "Goggles"] }, { label: "OUTFIT", opts: ["Standard", "Camo", "Neon", "Stealth"] }].map((sec) => (
          <div key={sec.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#c77dff", marginBottom: 8 }}>{sec.label}</div>
            <div className="flex gap-2 flex-wrap">{sec.opts.map((opt, i) => (<button key={opt} style={{ backgroundColor: i === 0 ? "#c77dff" : "#0a0e1a", border: `2px solid ${i === 0 ? "#c77dff" : "#2a3a5c"}`, padding: "4px 8px", cursor: "pointer", fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: i === 0 ? "#0a0e1a" : "#6b8ba4" }}>{opt}</button>))}</div>
          </div>
        ))}
        <div className="flex gap-3">
          <div style={{ flex: 1 }}><PixelBtn onClick={onBack} color="#c77dff" textColor="#0a0e1a" size="sm" full>[ SAVE AVATAR ]</PixelBtn></div>
          <div style={{ flex: 1 }}><PixelBtn onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK ]</PixelBtn></div>
        </div>
      </div>
    </div>
  );
}

function CustomizeScreen({ memberId, coins, purchasedItems, onBack, onSell }: {
  memberId: string; coins: number; purchasedItems:string[]; onBack: () => void; onSell: (itemId: string, value: number) => void;
}) {
  const member = FAMILY_MEMBERS.find(m => m.id === memberId) ?? FAMILY_MEMBERS[1];
  const memberItems = FURNITURE_STORE.filter(i => i.memberId === memberId);
  const [sold, setSold] = useState<string[]>([]);
  const isInDebt = coins < 0;

  const WALLPAPERS = [
    { id:"wp1", name:"DARK GRID",   color:"#0a0e1a", price: 50  },
    { id:"wp2", name:"NAVY STRIPE", color:"#1a2340", price: 80  },
    { id:"wp3", name:"PIXEL STARS", color:"#100c20", price: 120 },
  ];

  // Unified item shape for the merged furniture list.
  // Pre-owned items (FURNITURE_STORE) sell at their full sellValue.
  // Shop-bought items sell at half their original buy cost (rounded down).
  type UnifiedItem = {
    id: string;
    name: string;
    sellValue: number;
    art: React.ReactNode;
  };

  const unifiedItems: UnifiedItem[] = [
    ...memberItems.map<UnifiedItem>(item => ({
      id: item.id,
      name: item.name,
      sellValue: item.sellValue,
      art: <FurnitureIcon itemId={item.id} size={32} />,
    })),
    ...purchasedItems
      .map(id => SHOP_CATALOGUE.find(i => i.id === id))
      .filter((i): i is ShopItem => !!i)
      .map<UnifiedItem>(item => ({
        id: item.id,
        name: item.name,
        sellValue: Math.floor(item.cost * 0.75),
        art: <ShopFurnitureArt art={item.art} size={30} />,
      })),
  ];

  const handleSell = (item: UnifiedItem) => {
    if (sold.includes(item.id)) return;
    setSold(s => [...s, item.id]);
    onSell(item.id, item.sellValue);
  };

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: `4px solid ${member.primaryColor}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconX size={16} color="#6b8ba4" /></button>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: member.primaryColor }}>CUSTOMIZE ROOM</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCoin size={12} color={coins < 0 ? "#ff2d55" : "#ffe66d"} />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: coins < 0 ? "#ff2d55" : "#ffe66d" }}>{coins < 0 ? "-" : ""}{Math.abs(coins)}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          {isInDebt && (
            <div style={{ backgroundColor: "rgba(255,45,85,0.08)", border: "3px solid #ff2d55", padding: "10px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <IconWarning size={14} color="#ff2d55" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>In debt — sell furniture to recover coins</div>
            </div>
          )}

          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4", letterSpacing: 2, marginBottom: 10 }}>FURNITURE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {unifiedItems.map(item => {
              const isSold = sold.includes(item.id);
              return (
                <div key={item.id} style={{ backgroundColor: "#111827", border: `3px solid ${isSold ? "#2a3a5c" : isInDebt ? "#ff6b35" : "#2a3a5c"}`, opacity: isSold ? 0.5 : 1, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0a0e1a", border: `2px solid ${isSold ? "#1a2340" : isInDebt ? "#ff6b35" : "#2a3a5c"}` }}>
                    {item.art}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: isSold ? "#6b8ba4" : "#e8f4f8" }}>{item.name}</div>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", marginTop: 4 }}>
                      {isSold ? "SOLD" : `SELL FOR ${item.sellValue} COINS`}
                    </div>
                  </div>
                  {!isSold && (
                    <button onClick={() => handleSell(item)} style={{ backgroundColor: isInDebt ? "#ff6b35" : "#2a3a5c", border: "none", cursor: "pointer", padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <IconCoin size={10} color={isInDebt ? "#0a0e1a" : "#ffe66d"} />
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: isInDebt ? "#0a0e1a" : "#ffe66d" }}>SELL</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4", letterSpacing: 2, marginBottom: 10 }}>WALLPAPER SHOP</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
            {WALLPAPERS.map(wp => (
              <button key={wp.id} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                <div style={{ border: "3px solid #2a3a5c", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ width: "100%", height: 64, overflow: "hidden" }}>
                    <WallpaperSwatch id={wp.id} />
                  </div>
                  <div style={{ backgroundColor: "#111827", padding: "6px 4px 5px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#e8f4f8", textAlign: "center" }}>{wp.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <IconCoin size={7} color="#ffe66d" />
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ffe66d" }}>{wp.price}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <PixelBtn onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK TO HOME</PixelBtn>
        </div>
      </div>
    </div>
  );
}

function FamilyChatScreen({ messages, onSend, onBack }: {
  messages: ChatMsg[];
  onSend: (text: string) => void;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #4ecdc4", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="#6b8ba4" />
        </button>
        <IconChat size={16} color="#4ecdc4" />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#4ecdc4" }}>FAMILY CHAT</div>
        <div style={{ marginLeft: "auto", width: 8, height: 8, backgroundColor: "#00ff88", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ padding: "12px 12px 4px", scrollbarWidth: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((msg, i) => {
          const isPixi = msg.isPixi === true;
          const isPlayer = msg.isPlayer === true;
          const isRight = isPlayer;
          const member = (isPlayer || isPixi) ? null : MEMBER_MAP[msg.memberId];
          const color = isPixi
            ? PIXI_MEMBER.primaryColor
            : isPlayer
              ? "#00ff88"
              : (member?.primaryColor ?? "#6b8ba4");
          const bubbleBg = isPixi
            ? "#0d1a24"
            : isPlayer
              ? "#1a3a2a"
              : "#111827";
          const textColor = isPixi
            ? "#00d4ff"
            : color;

          return (
            <div key={i} style={{ display: "flex", flexDirection: isRight ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
              {/* Left column: avatar + label */}
              {!isRight && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  {isPixi ? (
                    <PixiAvatar size={28} />
                  ) : member ? (
                    <FamilyChar id={member.id} size={28} frame={0} />
                  ) : null}
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color }}>
                    {isPixi ? "PIXI" : member?.name.slice(0, 3)}
                  </div>
                </div>
              )}
              {isRight && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <PixelMascot size={28} />
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#00ff88" }}>YOU</div>
                </div>
              )}
              {/* Right column: bubble + timestamp */}
              <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isRight ? "flex-end" : "flex-start", gap: 3 }}>
                <div style={{ backgroundColor: bubbleBg, border: `2px solid ${color}`, padding: "8px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: textColor, lineHeight: 1.6 }}>
                  {msg.text}
                </div>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#2a3a5c" }}>{msg.time}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: "10px 12px", borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="TYPE YOUR MESSAGE..."
          style={{ flex: 1, backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "10px 12px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", outline: "none" }}
        />
        <button onClick={send} style={{ backgroundColor: "#4ecdc4", border: "3px solid #0a0e1a", boxShadow: "3px 3px 0 #0a0e1a", cursor: "pointer", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#0a0e1a" }}>▶</div>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: NOTIFICATIONS (list view)
// ─────────────────────────────────────────────────────────────────────────
function iconForNotifKind(kind: NotificationKind): { icon: React.ReactNode; accent: string } {
  if (kind.startsWith("drill-win")) {
    return { icon: <IconCheck size={14} color="#00ff88" />, accent: "#00ff88" };
  }
  if (kind.startsWith("drill-lose")) {
    return { icon: <IconWarning size={14} color="#ff2d55" />, accent: "#ff2d55" };
  }
  if (kind === "family-drill-complete") {
    return { icon: <IconShield size={14} color="#00d4ff" />, accent: "#00d4ff" };
  }
  if (kind === "payday") {
    return { icon: <IconCoin size={14} color="#ffe66d" />, accent: "#ffe66d" };
  }
  return { icon: <IconStar size={14} color="#ffe66d" />, accent: "#ffe66d" };
}

function formatNotifTimestamp(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "JUST NOW";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `${days}D AGO`;
}

function NotificationsScreen({
  notifications, onOpen, onMarkAllRead, onBack,
}: {
  notifications: Notification[];
  onOpen: (id: string) => void;
  onMarkAllRead: () => void;
  onBack: () => void;
}) {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #ffe66d", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="#6b8ba4" />
        </button>
        <IconBell size={16} color="#ffe66d" />
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ffe66d" }}>NOTIFICATIONS</div>
        <div style={{ marginLeft: "auto", fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: unreadCount > 0 ? "#ff2d55" : "#6b8ba4" }}>
          {unreadCount > 0 ? `${unreadCount} UNREAD` : "ALL READ"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <IconBell size={40} color="#2a3a5c" />
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: "#6b8ba4" }}>NO NOTIFICATIONS YET</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4", lineHeight: 1.5, maxWidth: 260 }}>
              Complete drills, collect payday, or claim daily rewards to see activity here.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {notifications.map(n => {
              const { icon, accent } = iconForNotifKind(n.kind);
              const member = n.memberId !== "family" ? MEMBER_MAP[n.memberId] : null;
              const isUnread = !n.read;
              return (
                <button
                  key={n.id}
                  onClick={() => onOpen(n.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "12px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "2px solid #1a2340",
                    borderLeft: isUnread ? `4px solid ${accent}` : "4px solid transparent",
                    backgroundColor: isUnread ? "rgba(255,230,109,0.03)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ width: 28, height: 28, backgroundColor: "#111827", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: isUnread ? "#e8f4f8" : "#6b8ba4", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.title}
                      </div>
                      {isUnread && (
                        <div style={{ width: 6, height: 6, backgroundColor: "#ff2d55", flexShrink: 0, marginTop: 2 }} />
                      )}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: isUnread ? "#4ecdc4" : "#4a5c78", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {n.body}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      {member && (
                        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: member.primaryColor }}>
                          {member.name}
                        </div>
                      )}
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#2a3a5c" }}>
                        {formatNotifTimestamp(n.timestamp)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ padding: "10px 12px", borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
          <PixelBtn
            onClick={onMarkAllRead}
            color={unreadCount > 0 ? "#ffe66d" : "#1a2340"}
            textColor={unreadCount > 0 ? "#0a0e1a" : "#6b8ba4"}
            size="sm"
            full
            disabled={unreadCount === 0}
          >
            {unreadCount > 0 ? `MARK ALL READ (${unreadCount})` : "ALL CAUGHT UP"}
          </PixelBtn>
        </div>
      )}
    </div>
  );
}

function NotificationDetailScreen({
  notification, onBack, onAction,
}: {
  notification: Notification;
  onBack: () => void;
  onAction: (action: "train" | "family-drill") => void;
}) {
  const { icon, accent } = iconForNotifKind(notification.kind);
  const member = notification.memberId !== "family" ? MEMBER_MAP[notification.memberId] : null;
  const fullTimestamp = new Date(notification.timestamp).toLocaleString(undefined, {
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).toUpperCase();

  // Determine follow-up action
  const isDrillOutcome = notification.kind.startsWith("drill-");
  const isFamilyDrill = notification.kind === "family-drill-complete";
  const actionLabel = isDrillOutcome
    ? "TRAIN AGAIN"
    : isFamilyDrill
      ? "PLAY FAMILY DRILL AGAIN"
      : null;
  const actionHandler = isDrillOutcome
    ? () => onAction("train")
    : isFamilyDrill
      ? () => onAction("family-drill")
      : null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: `4px solid ${accent}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>{"< BACK"}</div>
        </button>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: accent }}>NOTIFICATION</div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "16px" }}>
        <div style={{ backgroundColor: "#111827", border: `4px solid ${accent}`, boxShadow: `4px 4px 0 ${accent}`, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, backgroundColor: "#0a0e1a", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: accent, lineHeight: 1.5 }}>
                {notification.title}
              </div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginTop: 4 }}>
                {fullTimestamp}
              </div>
            </div>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 1.6, paddingTop: 12, borderTop: "2px solid #2a3a5c" }}>
            {notification.body}
          </div>
        </div>

        {member && (
          <div style={{ marginTop: 14, backgroundColor: "#0a0e1a", border: `3px solid ${member.primaryColor}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <FamilyChar id={member.id} size={40} frame={0} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4" }}>MEMBER</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: member.primaryColor, marginTop: 3 }}>
                {member.name}
              </div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginTop: 3 }}>
                {member.role}
              </div>
            </div>
          </div>
        )}

        {actionLabel && actionHandler && (
          <div style={{ marginTop: 20 }}>
            <PixelBtn onClick={actionHandler} color={accent} textColor="#0a0e1a" size="md" full>
              [ {actionLabel} ]
            </PixelBtn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PAYDAY SUNDAY — now actually distributes coins via ledger
// ─────────────────────────────────────────────────────────────────────────
function PaydayScreen({ coins, onCollect, onClose }: { coins: Record<string, number>; onCollect: () => void; onClose: () => void }) {
  const [collected, setCollected] = useState(false);
  const weeklyBase = 200;
  const drillBonus = 150;
  const scamPenalty = -100;

  const handleCollect = () => {
    if (collected) return;
    setCollected(true);
    onCollect();
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #ffe66d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCoin size={18} color="#ffe66d" />
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ffe66d" }}>PAYDAY SUNDAY</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="#6b8ba4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          <div style={{ backgroundColor: "#111827", border: "4px solid #ffe66d", boxShadow: "4px 4px 0 #ffe66d", padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>PAY PERIOD</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#ffe66d" }}>WK 28 — JUL 2024</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>BASE ALLOWANCE</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ffe66d" }}>+{weeklyBase}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>DRILL BONUS (SAFE)</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#00ff88" }}>+{drillBonus}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: "#6b8ba4" }}>SCAM PENALTY (UNSAFE)</div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: "#ff2d55" }}>{scamPenalty}</div>
            </div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", lineHeight: 1.6 }}>
              Every member gets +{weeklyBase}. Safe members get +{drillBonus} bonus, scammed members get {scamPenalty} penalty.
            </div>
          </div>

          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#6b8ba4", letterSpacing: 2, marginBottom: 10 }}>MEMBER BALANCES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {FAMILY_MEMBERS.map(m => {
              const balance = coins[m.id] ?? m.coins;
              const isDebt = balance < 0;
              const frame = 0;
              return (
                <div key={m.id} style={{ backgroundColor: "#111827", border: `3px solid ${isDebt ? "#ff2d55" : "#2a3a5c"}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <FamilyChar id={m.id} size={36} frame={frame} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: m.primaryColor }}>{m.name}</div>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#6b8ba4", marginTop: 3 }}>
                      {m.safeThisWeek ? "SAFE THIS WEEK" : "GOT SCAMMED"}
                    </div>
                    {isDebt && (
                      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: "#ff2d55", marginTop: 3 }}>IOU TO FAMILY FUND</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: isDebt ? "#ff2d55" : "#ffe66d" }}>
                      {isDebt ? "-" : "+"}{Math.abs(balance)}
                    </div>
                    <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#6b8ba4", marginTop: 3 }}>COINS</div>
                  </div>
                </div>
              );
            })}
          </div>

          {FAMILY_MEMBERS.some(m => (coins[m.id] ?? m.coins) < 0) && (
            <div style={{ backgroundColor: "rgba(255,45,85,0.06)", border: "3px solid #ff2d55", padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <IconWarning size={14} color="#ff2d55" />
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ff2d55" }}>FAMILY DEBT ALERT</div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
                One or more members are in debt. The family fund covers shortfalls this week, but debt members can sell furniture to recover coins. Tap a member's room to customize.
              </div>
            </div>
          )}

          <div style={{ backgroundColor: "rgba(0,255,136,0.06)", border: "3px solid #00ff88", padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <IconBulb size={12} color="#ffe66d" />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#ffe66d" }}>PAYDAY TIP</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#00ff88", lineHeight: 1.5 }}>
              Complete drills every week to earn your full salary bonus. Getting scammed costs the whole family — protect each other!
            </div>
          </div>

          {collected ? (
            <div style={{ backgroundColor: "#00ff88", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <IconCheck size={16} color="#0a0e1a" />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: "#0a0e1a" }}>COLLECTED!</div>
            </div>
          ) : (
            <PixelBtn onClick={handleCollect} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ COLLECT PAYDAY ]</PixelBtn>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────
function BottomNav({ activeTab, onTab, onDrillSelect }: { activeTab: Tab; onTab: (t: Tab) => void; onDrillSelect: () => void }) {
  const leftItems: { tab: Tab; icon: React.ReactNode; label: string; activeColor: string }[] = [
    { tab: "home", icon: <IconHouse size={18} color={activeTab === "home" ? "#00ff88" : "#2a3a5c"} />, label: "HOME", activeColor: "#00ff88" },
    { tab: "leaderboard", icon: <IconTrophy size={18} color={activeTab === "leaderboard" ? "#ffe66d" : "#2a3a5c"} />, label: "RANKS", activeColor: "#ffe66d" },
  ];
  const rightItems: { tab: Tab; icon: React.ReactNode; label: string; activeColor: string }[] = [
    { tab: "store", icon: <IconStore size={18} color={activeTab === "store" ? "#c77dff" : "#2a3a5c"} />, label: "STORE", activeColor: "#c77dff" },
    { tab: "profile", icon: <IconPerson size={18} color={activeTab === "profile" ? "#4ecdc4" : "#2a3a5c"} />, label: "PROFILE", activeColor: "#4ecdc4" },
  ];
  return (
    <div className="flex items-stretch" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", minHeight: 68, flexShrink: 0 }}>
      {leftItems.map((item) => (
        <button key={item.tab} onClick={() => onTab(item.tab)} className="flex-1 flex flex-col items-center justify-center gap-1" style={{ background: "none", border: "none", borderTop: activeTab === item.tab ? `4px solid ${item.activeColor}` : "4px solid transparent", cursor: "pointer", paddingTop: 6 }}>
          {item.icon}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: activeTab === item.tab ? item.activeColor : "#2a3a5c" }}>{item.label}</div>
        </button>
      ))}
      <div className="flex items-center justify-center px-1" style={{ flexShrink: 0 }}>
        <button onClick={onDrillSelect} style={{ backgroundColor: "#00ff88", border: "4px solid #0a0e1a", boxShadow: "0 -4px 0 #006633, 4px 0 0 #006633, -4px 0 0 #006633", cursor: "pointer", width: 58, height: 58, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: "#0a0e1a", lineHeight: 1 }}>▶</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: "#0a0e1a" }}>DRILL</div>
        </button>
      </div>
      {rightItems.map((item) => (
        <button key={item.tab} onClick={() => onTab(item.tab)} className="flex-1 flex flex-col items-center justify-center gap-1" style={{ background: "none", border: "none", borderTop: activeTab === item.tab ? `4px solid ${item.activeColor}` : "4px solid transparent", cursor: "pointer", paddingTop: 6 }}>
          {item.icon}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 4, color: activeTab === item.tab ? item.activeColor : "#2a3a5c" }}>{item.label}</div>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [drillType, setDrillType] = useState<DrillType>("call");
  const [smsOutcome, setSmsOutcome] = useState<SmsOutcome | null>(null);
  const [emailOutcome, setEmailOutcome] = useState<EmailOutcome | null>(null);
  const [resultXp, setResultXp] = useState<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  const [familyRoundIndex, setFamilyRoundIndex] = useState(0);
  const [familyAnswers, setFamilyAnswers] = useState<{ scenarioId: number; action: string; correct: boolean; foundClues: number[] }[]>([]);

  const [settings, setSettings] = useState<AppSettings>({
    drillFrequency: "recurring",
    familyDrillEnabled: true,
    notificationsEnabled: true,
    difficulty: "Normal",
    includeSafeMessages: true,
    autoExplain: true,
    requireLinkInspection: false,
    realismMode: true,
  });

  // Coin state
  const [coins, setCoins] = useState<Record<string, number>>(
    Object.fromEntries(FAMILY_MEMBERS.map(m => [m.id, m.coins]))
  );
  const [soldItems, setSoldItems] = useState<string[]>([]);
  const [purchasedItems, setPurchasedItems] = useState<Record<string, string[]>>(
    Object.fromEntries(FAMILY_MEMBERS.map(m => [m.id, []]))
  );
  const [claimedDailyToday, setClaimedDailyToday] = useState<Record<string, boolean>>(
    Object.fromEntries(FAMILY_MEMBERS.map(m => [m.id, false]))
  );
  const [customizeMemberId, setCustomizeMemberId] = useState<string>("mum");
  const [lastViewedMemberId, setLastViewedMemberId] = useState<string>("mum");

  // Phase 2: activeMemberId + ledger
  const [activeMemberId, setActiveMemberId] = useState<string>("mum");
  const [coinLedger, setCoinLedger] = useState<CoinTx[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(INITIAL_CHAT);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);

  // Central helper: mutate coins + append to ledger (cap-enforced)
  const addCoinTx = (memberId: string, delta: number, reason: CoinTxReason, label: string) => {
    const tx: CoinTx = { id: makeTxId(), memberId, delta, reason, label, timestamp: Date.now() };
    setCoins(prev => ({ ...prev, [memberId]: (prev[memberId] ?? 0) + delta }));
    setCoinLedger(prev => [tx, ...prev].slice(0, LEDGER_CAP));
  };

  const CHAT_CAP = 100;
  const appendChatMessage = (msg: ChatMsg) => {
    setChatMessages(prev => [...prev, msg].slice(-CHAT_CAP));
  };

  const appendNotification = (n: Omit<Notification, "id" | "timestamp" | "read">) => {
    const notif: Notification = {
      ...n,
      id: makeNotifId(),
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => [notif, ...prev].slice(0, NOTIFICATIONS_CAP));
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const emitNotifDrill = (memberId: string, drill: DrillType, outcome: "win" | "lose") => {
    const member = MEMBER_MAP[memberId];
    if (!member) return;
    const rewards: Record<DrillType, number> = { call: 50, sms: 40, email: 60 };
    const penalties: Record<DrillType, number> = { call: -25, sms: -20, email: -30 };
    const delta = outcome === "win" ? rewards[drill] : penalties[drill];
    const drillLabel = drill.toUpperCase();
    const kind: NotificationKind = outcome === "win"
      ? (drill === "call" ? "drill-win-call" : drill === "sms" ? "drill-win-sms" : "drill-win-email")
      : (drill === "call" ? "drill-lose-call" : drill === "sms" ? "drill-lose-sms" : "drill-lose-email");
    appendNotification({
      kind,
      memberId,
      title: outcome === "win"
        ? `${member.name} won a ${drillLabel.toLowerCase()} drill`
        : `${member.name} got caught by a ${drillLabel.toLowerCase()} scam`,
      body: outcome === "win"
        ? `+${delta} coins · Nice work spotting the red flags`
        : `${delta} coins · Review the tips and try again`,
    });
  };

  const emitNotifFamilyDrill = (correctCount: number, totalRounds: number) => {
    appendNotification({
      kind: "family-drill-complete",
      memberId: "family",
      title: "Family drill complete",
      body: `${correctCount}/${totalRounds} correct — ${
        correctCount === totalRounds
          ? "perfect run!"
          : correctCount >= Math.ceil(totalRounds / 2)
            ? "solid effort"
            : "needs more practice"
      }`,
    });
  };

  const emitNotifPayday = () => {
    const safeCount = FAMILY_MEMBERS.filter(m => m.safeThisWeek).length;
    appendNotification({
      kind: "payday",
      memberId: "family",
      title: "Payday collected",
      body: `${safeCount}/${FAMILY_MEMBERS.length} members earned the safety bonus`,
    });
  };

  const emitNotifDailyReward = (memberId: string) => {
    const member = MEMBER_MAP[memberId];
    if (!member) return;
    appendNotification({
      kind: "daily-reward",
      memberId,
      title: `${member.name} claimed daily reward`,
      body: `+${DAILY_REWARD_AMOUNT} coins added to balance`,
    });
  };
  
  // Pixi message templates — keyed by event type + member name.
  const nowTimeString = () => {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const emitPixiDrillMessage = (memberId: string, drill: DrillType, outcome: "win" | "lose") => {
    const member = MEMBER_MAP[memberId];
    if (!member) return;
    const name = member.name;
    const templates: Record<DrillType, { win: string; lose: string }> = {
      call: {
        win: `Nice hang-up, ${name}! Gift-card demands are always a scam. Great instinct.`,
        lose: `${name}, that IRS call was a scam. Real agencies contact you by post first — never phone threats. Try again soon.`,
      },
      sms: {
        win: `${name} spotted a fake parcel notice — well done! Real couriers don't ask for card details by SMS.`,
        lose: `${name} clicked a suspicious link. Next time, long-press links to see the real URL before tapping.`,
      },
      email: {
        win: `${name} reported that phishing email. That's how the family stays safe.`,
        lose: `${name} submitted details to a fake reward page. Always check the sender domain first. It happens — the important thing is spotting it next time.`,
      },
    };
    appendChatMessage({
      memberId: "pixi",
      isPixi: true,
      text: templates[drill][outcome],
      time: nowTimeString(),
      incidentRef: { memberId, kind: outcome === "win" ? "drill-win" : "drill-lose" },
    });
  };

  const emitPixiFamilyDrillSummary = (correctCount: number, totalRounds: number) => {
    let text: string;
    if (correctCount === totalRounds) {
      text = `Perfect family drill — ${correctCount}/${totalRounds} correct! The whole household is scam-savvy today.`;
    } else if (correctCount >= totalRounds - 1) {
      text = `Great job team — ${correctCount}/${totalRounds} correct. One slip, but you mostly held the line.`;
    } else if (correctCount >= Math.ceil(totalRounds / 2)) {
      text = `Family drill done: ${correctCount}/${totalRounds} correct. Some good instincts, some near-misses. Worth a debrief!`;
    } else {
      text = `Family drill done: ${correctCount}/${totalRounds} correct. Scammers got through today — let's practice more this week.`;
    }
    appendChatMessage({
      memberId: "pixi",
      isPixi: true,
      text,
      time: nowTimeString(),
      incidentRef: { memberId: "family", kind: "family-round" },
    });
  };

  const emitPixiPaydayMessage = () => {
    appendChatMessage({
      memberId: "pixi",
      isPixi: true,
      text: "Payday collected! Members who stayed safe got the full bonus. Keep training so no one falls behind.",
      time: nowTimeString(),
      incidentRef: { memberId: "family", kind: "payday" },
    });
  };

  // Drill-outcome event helper (used by call/sms/email flows)
  const emitDrillEvent = (memberId: string, drill: DrillType, outcome: "win" | "lose") => {
    const rewards: Record<DrillType, number> = { call: 50, sms: 40, email: 60 };
    const penalties: Record<DrillType, number> = { call: -25, sms: -20, email: -30 };
    const delta = outcome === "win" ? rewards[drill] : penalties[drill];
    const label = outcome === "win"
      ? `${drill.toUpperCase()} DRILL WON`
      : `${drill.toUpperCase()} DRILL LOST`;
    const reason: CoinTxReason = outcome === "win"
      ? (drill === "call" ? "drill-win-call" : drill === "sms" ? "drill-win-sms" : "drill-win-email")
      : (drill === "call" ? "drill-lose-call" : drill === "sms" ? "drill-lose-sms" : "drill-lose-email");
    addCoinTx(memberId, delta, reason, label);
    emitPixiDrillMessage(memberId, drill, outcome);
    emitNotifDrill(memberId, drill, outcome);
  };

  // Family-round event helper
  const emitFamilyRoundEvent = (memberId: string, correct: boolean) => {
    const delta = correct ? 30 : -10;
    const label = correct ? "FAMILY DRILL CORRECT" : "FAMILY DRILL WRONG";
    const reason: CoinTxReason = correct ? "family-drill-correct" : "family-drill-wrong";
    addCoinTx(memberId, delta, reason, label);
  };

  // Payday distribution: per-member, per-line-item entries in ledger
  const collectPayday = () => {
    const base = 200, bonus = 150, penalty = -100;
    FAMILY_MEMBERS.forEach(m => {
      addCoinTx(m.id, base, "payday-base", "PAYDAY BASE ALLOWANCE");
      if (m.safeThisWeek) {
        addCoinTx(m.id, bonus, "payday-bonus", "PAYDAY DRILL BONUS");
      } else {
        addCoinTx(m.id, penalty, "payday-penalty", "PAYDAY SCAM PENALTY");
      }
    });
    emitPixiPaydayMessage();
    emitNotifPayday();
  };

  const FAMILY_DRILL_SCREENS: Screen[] = ["family-round"];
  const DRILL_SCREENS: Screen[] = ["drill-select", "incoming", "call", "sms-inbox", "sms-thread", "sms-browser", "email-inbox", "email-detail", "email-browser", "email-download", "result-win", "result-lose", ...FAMILY_DRILL_SCREENS];
  const FULLSCREEN_ROUTES: Screen[] = ["customize", "family-chat", "payday"];
  const SUB_PAGE_ROUTES: Screen[] = ["account-settings", "privacy-settings", "accessibility-settings", "about-settings", "profile-edit", "avatar-customisation", "family-drill-intro", "family-summary"];

  const isDrillFlow = DRILL_SCREENS.includes(screen);
  const isTitle = screen === "title";
  const isFullscreen = FULLSCREEN_ROUTES.includes(screen);
  const isSubPage = SUB_PAGE_ROUTES.includes(screen);
  const isMainTab = (["home", "leaderboard", "store", "profile", "settings"] as Screen[]).includes(screen);

  const goHome = () => { setActiveTab("home"); setScreen("home"); };
  const goDrillSelect = () => setScreen("drill-select");
  const goFamilyDrill = () => { setFamilyRoundIndex(0); setFamilyAnswers([]); setScreen("family-drill-intro"); };

  const handleTab = (tab: Tab) => { setActiveTab(tab); setScreen(tab as Screen); };
  const handleNav = (s: string) => setScreen(s as Screen);

  const handleChatIcon = () => setScreen("family-chat");
  const handleBellIcon = () => setScreen("notifications");
  const handleSettingsIcon = () => setScreen("settings");

  const getScreenTitle = (): { title: string; color: string } => {
    switch (screen) {
      case "home": return { title: "DRILL MODE", color: "#00ff88" };
      case "leaderboard": return { title: "LEADERBOARD", color: "#ffe66d" };
      case "store": return { title: "STORE", color: "#c77dff" };
      case "profile": return { title: "PROFILE", color: "#4ecdc4" };
      case "settings": return { title: "SETTINGS", color: "#6b8ba4" };
      default: return { title: "DRILL MODE", color: "#00ff88" };
    }
  };

  useEffect(() => {
    apiGet<{ pending: { screen: Screen; xpGained: number; channel?: DrillType } | null }>("/api/drills/pending-result").then((data) => {
      if (data?.pending?.screen) {
        setDrillType(data.pending.channel ?? "call");
        setResultXp(data.pending.xpGained);
        setScreen(data.pending.screen);
      }
    });
  }, []);

  const persistPracticeOutcome = (outcome: string, channel: DrillType) => {
    reportOutcome(outcome, channel).then((xp) => {
      if (xp != null) setResultXp(xp);
    });
  };

  const startCall = () => { setDrillType("call"); setSmsOutcome(null); setEmailOutcome(null); setResultXp(null); setScreen("incoming"); };
  const startSms = () => { setDrillType("sms"); setSmsOutcome(null); setEmailOutcome(null); setResultXp(null); setScreen("sms-inbox"); };
  const startEmail = () => { setDrillType("email"); setSmsOutcome(null); setEmailOutcome(null); setResultXp(null); setScreen("email-inbox"); };

  // Drill outcome handlers — all now emit coin events for activeMemberId
  const handleCallResult = (win: boolean) => {
    persistPracticeOutcome(win ? "disengaged" : "complied", "call");
    emitDrillEvent(activeMemberId, "call", win ? "win" : "lose");
    setScreen(win ? "result-win" : "result-lose");
  };

  const handleSmsWin = (outcome: SmsOutcome) => {
    setSmsOutcome(outcome);
    persistPracticeOutcome(outcome === "closed-page" ? "closed_page" : outcome, "sms");
    emitDrillEvent(activeMemberId, "sms", "win");
    setScreen("result-win");
  };
  const handleSmsLose = (outcome: SmsOutcome) => {
    setSmsOutcome(outcome);
    persistPracticeOutcome(outcome === "clicked-link" ? "clicked_link" : outcome, "sms");
    emitDrillEvent(activeMemberId, "sms", "lose");
    setScreen("result-lose");
  };

  const handleEmailWin = (outcome: EmailOutcome) => {
    setEmailOutcome(outcome);
    persistPracticeOutcome(outcome === "cancelled-download" ? "cancelled_download" : outcome, "email");
    emitDrillEvent(activeMemberId, "email", "win");
    setScreen("result-win");
  };
  const handleEmailLose = (outcome: EmailOutcome) => {
    setEmailOutcome(outcome);
    persistPracticeOutcome(
      outcome === "submitted-details" ? "submitted_details" :
      outcome === "opened-attachment" ? "opened_attachment" :
      outcome,
      "email"
    );
    emitDrillEvent(activeMemberId, "email", "lose");
    setScreen("result-lose");
  };

  // Family round completion: emit per-round coin event for that scenario's target member
  const handleFamilyComplete = (action: string, foundClues: number[], correct: boolean) => {
    const scenario = FAMILY_SCENARIOS[familyRoundIndex];
    const memberId = FAMILY_NAME_TO_ID[scenario.targetMember] ?? "mum";
    emitFamilyRoundEvent(memberId, correct);
    setFamilyAnswers((prev) => [...prev, { scenarioId: scenario.id, action, correct, foundClues }]);
  };

  const handleFamilyNext = () => {
    if (familyRoundIndex + 1 >= FAMILY_SCENARIOS.length) {
      const correctCount = familyAnswers.filter(a => a.correct).length;
      emitPixiFamilyDrillSummary(correctCount, FAMILY_SCENARIOS.length);
      emitNotifFamilyDrill(correctCount, FAMILY_SCENARIOS.length);      
      setScreen("family-summary");
    } else {
      setFamilyRoundIndex((i) => i + 1);
    }
  };

  // Furniture sell — now routes through ledger
  const handleSellItem = (itemId: string, value: number) => {
    setSoldItems(prev => [...prev, itemId]);
    const starter = FURNITURE_STORE.find(i => i.id === itemId);
    if (starter) {
      addCoinTx(starter.memberId, value, "sell-furniture", `SOLD ${starter.name}`);
      return;
    }
    const shopItem = SHOP_CATALOGUE.find(i => i.id === itemId);
    if (shopItem) {
      // Shop items are owned by whoever bought them; find via purchasedItems.
      const ownerId = Object.keys(purchasedItems).find(mid => purchasedItems[mid]?.includes(itemId));
      if (ownerId) {
        // Also remove it from purchasedItems so it doesn't reappear in the shop's virtual house preview.
        setPurchasedItems(prev => ({
          ...prev,
          [ownerId]: (prev[ownerId] ?? []).filter(id => id !== itemId),
        }));
        addCoinTx(ownerId, value, "sell-furniture", `SOLD ${shopItem.name}`);
      }
    }
  };

  const handleBuyItem = (memberId: string, itemId: string, cost: number) => {
    const item = SHOP_CATALOGUE.find(i => i.id === itemId);
    if (!item) return;
    const currentCoins = coins[memberId] ?? 0;
    if (currentCoins < cost) return;
    if ((purchasedItems[memberId] ?? []).includes(itemId)) return;
    setPurchasedItems(prev => ({
      ...prev,
      [memberId]: [...(prev[memberId] ?? []), itemId],
    }));
    addCoinTx(memberId, -cost, "buy-furniture", `BOUGHT ${item.name}`);
  };

  const handleClaimDaily = (memberId: string) => {
    if (claimedDailyToday[memberId]) return;
    setClaimedDailyToday(prev => ({ ...prev, [memberId]: true }));
    addCoinTx(memberId, DAILY_REWARD_AMOUNT, "daily-reward", "DAILY LOGIN REWARD");
    emitNotifDailyReward(memberId);
  };

  const openCustomize = (memberId: string) => {
    setCustomizeMemberId(memberId);
    setLastViewedMemberId(memberId);
    setActiveMemberId(memberId);
    setScreen("customize");
  };

  // Called from MemberProfileOverlay "TRAIN [MEMBER]" button — sets whose drill this is
  const handleTrainMember = (memberId: string) => {
    setActiveMemberId(memberId);
    setLastViewedMemberId(memberId);
    setScreen("drill-select");
  };

  const handleOpenTelegram = () => {
    window.open(TELEGRAM_BOT_URL, "_blank", "noopener,noreferrer");
  };

  const { title, color } = getScreenTitle();
  const hasUnreadNotifications = notifications.some(n => !n.read);

  return (
    <>
      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.6; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      <Scanlines />
      <PhoneFrame>
        <div className="flex flex-col flex-1 overflow-hidden">
          {isMainTab && (
            <AppHeader
              title={title}
              titleColor={color}
              hasUnreadNotifications={hasUnreadNotifications}
              onChat={handleChatIcon}
              onNotifications={handleBellIcon}
              onSettings={handleSettingsIcon}
            />
          )}

          <div className="flex-1 overflow-hidden">
            {screen === "title" && (
              <TitleScreen
                onNext={() => {
                  // The tour highlights real elements, so Home must be mounted first.
                  goHome();
                  if (!hasSeenTutorial()) setTourOpen(true);
                }}
              />
            )}
            {screen === "register" && <RegisterScreen onDone={goHome} onBack={goHome} />}

            {screen === "home" && (
              <FamilyHomeScreen
                onDrillSelect={goDrillSelect}
                onFamilyDrill={goFamilyDrill}
                onPayday={() => setScreen("payday")}
                onCustomize={openCustomize}
                onTrainMember={handleTrainMember}
                onRegister={() => setScreen("register")}
                onTutorial={() => setTourOpen(true)}
                coins={coins}
                soldItems={soldItems}
              />
            )}
            {screen === "leaderboard" && <LeaderboardScreen />}
            {screen === "store" && (
              <ShopScreen
                activeMemberId={activeMemberId}
                onSelectMember={setActiveMemberId}
                coins={coins}
                purchasedItems={purchasedItems}
                onBuy={handleBuyItem}
              />
            )}
            {screen === "profile" && (
              <ProfileScreen
                onEditProfile={() => setScreen("profile-edit")}
                activeMemberId={activeMemberId}
                coins={coins}
                coinLedger={coinLedger}
                claimedDailyToday={claimedDailyToday}
                onClaimDaily={handleClaimDaily}
              />
            )}
            {screen === "settings" && <SettingsScreen settings={settings} onSettings={(s) => setSettings((p) => ({ ...p, ...s }))} onNav={handleNav} />}

            {screen === "account-settings" && <AccountSettingsScreen onBack={() => setScreen("settings")} />}
            {screen === "privacy-settings" && <PrivacySettingsScreen onBack={() => setScreen("settings")} />}
            {screen === "accessibility-settings" && <AccessibilitySettingsScreen onBack={() => setScreen("settings")} />}
            {screen === "about-settings" && <AboutSettingsScreen onBack={() => setScreen("settings")} />}
            {screen === "profile-edit" && (
              <ProfileEditScreen
                onBack={() => setScreen("profile")}
                onAvatar={() => setScreen("avatar-customisation")}
                onHouse={() => { setCustomizeMemberId(lastViewedMemberId); setActiveMemberId(lastViewedMemberId); setScreen("customize"); }}
              />
            )}
            {screen === "avatar-customisation" && <AvatarCustomisationScreen onBack={() => setScreen("profile-edit")} />}

            {screen === "customize" && (
              <CustomizeScreen
                memberId={customizeMemberId}
                coins={coins[customizeMemberId] ?? 0}
                purchasedItems={purchasedItems[customizeMemberId] ?? []}
                onBack={goHome}
                onSell={handleSellItem}
              />
            )}
            {screen === "family-chat" && (
              <FamilyChatScreen
                messages={chatMessages}
                onSend={(text) => appendChatMessage({
                  memberId: "player",
                  text,
                  time: nowTimeString(),
                  isPlayer: true,
                })}
                onBack={goHome}
              />
            )}
            {screen === "notifications" && (
              <NotificationsScreen
                notifications={notifications}
                onOpen={(id) => {
                  setActiveNotificationId(id);
                  markNotificationRead(id);
                  setScreen("notification-detail");
                }}
                onMarkAllRead={markAllNotificationsRead}
                onBack={goHome}
              />
            )}
            {screen === "notification-detail" && activeNotificationId && (() => {
              const notif = notifications.find(n => n.id === activeNotificationId);
              if (!notif) {
                setScreen("notifications");
                return null;
              }
              return (
                <NotificationDetailScreen
                  notification={notif}
                  onBack={() => setScreen("notifications")}
                  onAction={(action) => {
                    if (action === "train") {
                      if (notif.memberId !== "family") {
                        setActiveMemberId(notif.memberId);
                        setLastViewedMemberId(notif.memberId);
                      }
                      setScreen("drill-select");
                    } else if (action === "family-drill") {
                      goFamilyDrill();
                    }
                  }}
                />
              );
            })()}
            {screen === "telegram-intro" && (
              <TelegramDrillIntroScreen
                onOpen={handleOpenTelegram}
                onBack={() => setScreen("drill-select")}
              />
            )}
            {screen === "realistic-phone-intro" && (
              <RealisticPhoneDrillIntroScreen
                onBack={() => setScreen("drill-select")}
              />
            )}
            {screen === "realistic-email-intro" && (
              <RealisticEmailDrillIntroScreen
                onBack={() => setScreen("drill-select")}
              />
            )}
            {screen === "payday" && <PaydayScreen coins={coins} onCollect={collectPayday} onClose={goHome} />}
            {screen === "family-drill-intro" && <FamilyDrillIntroScreen onStart={() => setScreen("family-round")} onBack={goHome} />}
            {screen === "family-round" && (
              <FamilyRoundScreen
                scenario={FAMILY_SCENARIOS[familyRoundIndex]}
                roundIndex={familyRoundIndex}
                totalRounds={FAMILY_SCENARIOS.length}
                onComplete={handleFamilyComplete}
                onNext={handleFamilyNext}
                onEnd={() => {
                  const correctCount = familyAnswers.filter(a => a.correct).length;
                  emitPixiFamilyDrillSummary(correctCount, FAMILY_SCENARIOS.length);
                  emitNotifFamilyDrill(correctCount, FAMILY_SCENARIOS.length);
                  setScreen("family-summary");
                }}
                />
            )}
            {screen === "family-summary" && (
              <FamilySummaryScreen
                answers={familyAnswers}
                onPlayAgain={goFamilyDrill}
                onIndividual={goDrillSelect}
                onHome={goHome}
              />
            )}

            {screen === "drill-select" && (
              <DrillSelectScreen
                onCall={startCall}
                onSms={startSms}
                onEmail={startEmail}
                onRealisticPhone={() => setScreen("realistic-phone-intro")}
                onTelegram={() => setScreen("telegram-intro")}
                onRealisticEmail={() => setScreen("realistic-email-intro")}
                onBack={goHome}
              />
            )}
            {screen === "incoming" && (
              <IncomingCallScreen
                activeMemberId={activeMemberId}
                onAccept={() => setScreen("call")}
                onDecline={() => handleCallResult(true)}
              />
            )}
            {screen === "call" && <CallScreen activeMemberId={activeMemberId} onHangUp={handleCallResult} onResult={handleCallResult} />}
            {screen === "sms-inbox" && (
              <SMSInboxScreen activeMemberId={activeMemberId} onOpenScam={() => setScreen("sms-thread")} onBack={goDrillSelect} />
            )}
            {screen === "sms-thread" && (
              <SMSThreadScreen
                activeMemberId={activeMemberId}
                onReport={() => handleSmsWin("reported")}
                onAskFamily={() => handleSmsWin("asked-family")}
                onTapLink={() => setScreen("sms-browser")}
                onBack={() => setScreen("sms-inbox")}
              />
            )}
            {screen === "sms-browser" && (
              <SMSBrowserScreen
                activeMemberId={activeMemberId}
                onClose={() => handleSmsWin("closed-page")}
                onSubmit={() => handleSmsLose("clicked-link")}
              />
            )}
            {screen === "email-inbox" && (
              <EmailInboxScreen activeMemberId={activeMemberId} onOpenScam={() => setScreen("email-detail")} onBack={goDrillSelect} />
            )}
            {screen === "email-detail" && (
              <EmailDetailScreen
                activeMemberId={activeMemberId}
                onReport={() => handleEmailWin("reported")}
                onAskFamily={() => handleEmailWin("asked-family")}
                onClaimReward={() => setScreen("email-browser")}
                onOpenAttachment={() => setScreen("email-download")}
                onBack={() => setScreen("email-inbox")}
              />
            )}
            {screen === "email-browser" && (
              <EmailBrowserScreen
                activeMemberId={activeMemberId}
                onClose={() => handleEmailWin("reported")}
                onSubmit={() => handleEmailLose("submitted-details")}
              />
            )}
            {screen === "email-download" && (
              <EmailDownloadScreen
                activeMemberId={activeMemberId}
                onCancel={() => handleEmailWin("cancelled-download")}
                onComplete={() => handleEmailLose("opened-attachment")}
              />
            )}
            {(screen === "result-win" || screen === "result-lose") && (
              <ResultScreen
                win={screen === "result-win"}
                drillType={drillType}
                smsOutcome={smsOutcome}
                emailOutcome={emailOutcome}
                activeMemberId={activeMemberId}
                onPlayAgain={goDrillSelect}
                onGoHome={goHome}
                xpOverride={resultXp}
              />
            )}
          </div>

          {isMainTab && (
            <BottomNav
              activeTab={activeTab === ("settings" as any) ? "home" : activeTab}
              onTab={handleTab}
              onDrillSelect={goDrillSelect}
            />
          )}
        </div>
      </PhoneFrame>
      {tourOpen && screen === "home" && (
        <TourOverlay onDone={() => { markTutorialSeen(); setTourOpen(false); }} />
      )}
    </>
  );
}
