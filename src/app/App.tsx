import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from "react";

import type { Screen, Tab } from "./types/navigation";
import type { AvatarConfig, PlayerProfile, ContactInfo, NameUpdateResult } from "./types/profile";
import type { AppSettings, AccessibilityPrefs } from "./types/settings";
import type {
  CallOutcome, DrillFlag, DrillResultRecord, DrillType, EmailOutcome,
  FamilyClue, FamilyOutcome, FamilyScenario, Highlight, RealEmailScenario,
  NeutralResultNotice, RealDrillCompletion, SmsOutcome,
} from "./types/drills";
import type { FamilyMember } from "./types/family";
import type { CoinTxReason, CoinTx, HomeInventory, RewardClaims } from "./types/economy";
import type { Notification, NotificationKind } from "./types/notifications";
import { reconcileLayout, type RoomLayout, type RoomLayouts } from "./types/roomLayout";
import {
  DEFAULT_ROOM_STYLE, loadRoomStyles, saveRoomStyles, normalizeRoomStyle,
  type RoomStyle,
} from "./types/roomStyle";

import { SAFETY_TIPS } from "./data/safetyTips";
import { HALL_OF_FAME } from "./data/leaderboard";
import { RED_FLAGS, LIVE_CALL_FLAGS, SMS_FLAGS, EMAIL_FLAGS, FLAG_MAP } from "./data/scamFlags";
import { pickScenarios } from "./data/drillPool";
import { loadDrillPreferences, saveDrillPreferences, setPreferenceUser, type DrillPreferences } from "./data/drillPreferences";
import { DAILY_REWARD_AMOUNT, LEDGER_CAP, RACE_WIN_COINS } from "./data/economy";
import { NOTIFICATIONS_CAP } from "./data/notifications";
import { FURNITURE_STORE } from "./data/furniture";
import { SHOP_CATALOGUE } from "./data/shopCatalogue";
import { FAMILY_COINS } from "./data/familyData";
import { MUSIC_SILENT_SCREENS } from "./data/navigation";

import { createAttemptId, makeNotifId, makeTxId } from "./utils/ids";
import { localDateKey, localWeekKey, formatNotifTimestamp } from "./utils/date";
import { drillWindowStatus } from "./utils/drillSchedule";
import {
  PROFILE_KEY, CONTACT_KEY, DEFAULT_PROFILE,
  loadProfile, saveProfile, loadContact, saveContact,
  loadAccessibility, saveAccessibility,
} from "./services/storage";

import {
  TOKEN_KEY, apiGet, apiPost, authHeaders, handleApiAuth, sessionToken,
  setSessionToken, reportOutcome, updateVerifiedNameRequest, type ApiResult,
} from "./services/api";
import {
  useHouse, createHouse, joinHouse, switchHouse, HOUSES_PER_USER, leaveHouse, regenerateCode, renameHouse, editFamily,
  removeMember, saveAvatar, postHouseRun, formatCodeInput, captureInviteFromUrl,
  peekPendingInvite, takePendingInvite, type HouseState, type HouseView, type MemberView,
} from "./services/house";
import { unlock, playSfx, setMuted, setMusicEnabled, isMuted } from "./services/audio";

import {
  IconBadge, IconBell, IconBulb, IconChat, IconChatBubble, IconCheck, IconCoin, IconEnvelope,
  IconFlame, IconGear, IconHouse, IconLink, IconLock, IconMedal, IconPerson, IconPhone,
  IconRealEmail,
  IconShield, IconSkull, IconSpeaker, IconStar, IconStore, IconTelegram,
  IconTrophy, IconWarning, IconX,
} from "./components/icons";
import { CharacterAvatar, MemberChar, normalizeAvatarConfig, PixelAvatar } from "./components/avatars";
import { FurnitureIcon, ShopFurnitureArt, purchasedFurniture } from "./components/furniture";
import { Blink, PixelButton, PixelPanel, PixelRadio, PixelToggle, ToggleSwitchB, XPBar } from "./components/ui";
import { AppHeader, BottomNav, PhoneFrame, Scanlines, Stars, SubPageHeader } from "./components/layout";
import { RoomEditor } from "./components/room";

import { TitleScreen } from "./screens/title/TitleScreen";
import { DrillSelectScreen } from "./screens/drills/DrillSelectScreen";
import { FamilyHomeScreen } from "./screens/home";
import { AvatarCustomisationScreen, ProfileEditScreen, ProfileScreen } from "./screens/profile";
import { ShopScreen, CustomizeScreen } from "./screens/store";
import { CallScreen, IncomingCallScreen } from "./screens/drills/call";
import { EmailBrowserScreen, EmailDetailScreen, EmailDownloadScreen, EmailInboxScreen } from "./screens/drills/email";
import { SMSBrowserScreen, SMSInboxScreen, SMSThreadScreen } from "./screens/drills/sms";
import { ResultScreen } from "./screens/drills/result/ResultScreen";
import { FamilyRoundScreen } from "./screens/drills/family/FamilyRoundScreen";
import { FamilySummaryScreen } from "./screens/drills/family/FamilySummaryScreen";
import { SoloDrillIntroScreen } from "./screens/drills/family/SoloDrillIntroScreen";
import { FamilyDrillScreen } from "./screens/drills/family/FamilyDrillScreen";
import { HouseDrillInvite } from "./screens/drills/family/HouseDrillInvite";
import { useHouseDrill, type HouseDrill } from "./services/houseDrill";
import { HouseChatScreen } from "./screens/chat";
import { StartScreen } from "./screens/auth/StartScreen";
import { RegisterScreen } from "./screens/auth/RegisterScreen";
import { DrillPreferencesScreen } from "./screens/auth/DrillPreferencesScreen";
import {
  TelegramDrillIntroScreen, RealisticPhoneDrillIntroScreen,
  RealisticSmsDrillIntroScreen, RealisticEmailDrillIntroScreen, TELEGRAM_BOT_URL,
} from "./screens/drills/live/LiveDrillScreens";
import { LeaderboardScreen } from "./screens/leaderboard/LeaderboardScreen";
import { TourOverlay } from "./components/tutorial/TourOverlay";
import {
  SettingsScreen, AccountSettingsScreen, PrivacySettingsScreen,
  AccessibilitySettingsScreen, AboutSettingsScreen,
} from "./screens/settings/SettingsScreens";
import { HouseChoiceScreen, HouseSettingsScreen } from "./screens/house/HouseScreens";
import { NotificationsScreen, NotificationDetailScreen } from "./screens/notifications/NotificationScreens";
import { NotificationToast } from "./screens/notifications/NotificationToast";
import { PaydayScreen } from "./screens/rewards/PaydayScreen";

import { useIdleFrame } from "./hooks/useIdleFrame";
import { useI18n, translate, type Language } from "./i18n";
import { MembersContext, useMemberMap, useMembers } from "./hooks/useMembers";
import { SelfIdContext, useSelfId } from "./hooks/useSelfId";
import { useHouseChat } from "./hooks/useHouseChat";

const TUTORIAL_KEY = "safespace_tutorial_seen";
const ONBOARDING_STAGE_KEY = "safespace_onboarding_stage";
const CHAT_READ_PREFIX = "safespace_chat_read_v1";
const NOTIFICATIONS_KEY_PREFIX = "safespace_notifications_v1";
function onboardingStage(): string | null {
  try { return localStorage.getItem(ONBOARDING_STAGE_KEY); } catch { return null; }
}
function setOnboardingStage(stage: "survey" | "character" | null) {
  try {
    if (stage) localStorage.setItem(ONBOARDING_STAGE_KEY, stage);
    else localStorage.removeItem(ONBOARDING_STAGE_KEY);
  } catch { /* private mode */ }
}
function hasSeenTutorial(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === "1"; } catch { return false; }
}

function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* private mode: show it again, harmless */ }
}

function chatReadKey(identity: string) {
  return `${CHAT_READ_PREFIX}:${identity}`;
}

function readChatThrough(identity: string): string {
  try {
    const value = localStorage.getItem(chatReadKey(identity)) ?? "0";
    return /^\d+$/.test(value) ? value : "0";
  } catch { return "0"; }
}

function isChatMessageUnread(messageId: string, readThrough: string): boolean {
  try { return BigInt(messageId) > BigInt(readThrough); } catch { return false; }
}

function notificationsKey(memberId: string) {
  return `${NOTIFICATIONS_KEY_PREFIX}:${memberId}`;
}

function loadNotifications(memberId: string): Notification[] {
  try {
    const raw = localStorage.getItem(notificationsKey(memberId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Notification =>
      !!item && typeof item === "object"
      && typeof item.id === "string"
      && typeof item.kind === "string"
      && typeof item.memberId === "string"
      && typeof item.title === "string"
      && typeof item.body === "string"
      && typeof item.timestamp === "number"
      && typeof item.read === "boolean")
      .slice(0, NOTIFICATIONS_CAP);
  } catch { return []; }
}

function saveNotifications(memberId: string, notifications: Notification[]) {
  try { localStorage.setItem(notificationsKey(memberId), JSON.stringify(notifications)); }
  catch { /* private mode or storage quota: keep notifications for this session */ }
}




// ── Types ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "safespace_settings";
const DEFAULT_SETTINGS: AppSettings = {
  drillFrequency: "recurring",
  familyDrillEnabled: true,
  notificationsEnabled: true,
  difficulty: "Normal",
  includeSafeMessages: true,
  autoExplain: true,
  requireLinkInspection: false,
  realismMode: true,
  drillDays: [false, true, true, true, true, true, false], // Mon–Fri
  drillStartHour: 9,
  drillEndHour: 21,
};
function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    // Guard the array shape so an old/partial store can't break the schedule UI.
    if (!Array.isArray(merged.drillDays) || merged.drillDays.length !== 7) {
      merged.drillDays = [...DEFAULT_SETTINGS.drillDays];
    }
    return merged;
  } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: AppSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode: not persisted */ }
}

// On a desktop this draws a phone-shaped mockup. On an actual phone that mockup is the
// problem: a fixed 390x844 box either overflows a small screen or floats in the middle of
// a large one. So on small viewports we drop the bezel and go full-bleed, and above that
// we keep the mockup but never let it exceed the viewport.
//
// A phone in LANDSCAPE has a wide innerWidth (~812) but a short innerHeight (~375), so
// width alone misclassified it as "desktop" and drew the floating bezel. Going compact
// when EITHER dimension is small keeps a rotated phone full-bleed while leaving real
// desktops in the mockup.
//
// Height uses dvh where supported: on mobile browsers 100vh includes the collapsing
// URL bar, which leaves the bottom nav cut off until the user scrolls.



// Coins and furniture are one piece of game state: persisting only ownership would
// restore bought items after a reload while also refunding their cost. Keep them in one
// versioned record so the store and Home always reconstruct the same room.
const HOME_INVENTORY_KEY = "safespace_home_inventory_v1";


function defaultHomeInventory(): HomeInventory {
  return { coins: {}, soldItems: [], purchasedItems: {}, roomLayouts: {} };
}

function loadHomeInventory(): HomeInventory {
  const fallback = defaultHomeInventory();
  try {
    const raw = localStorage.getItem(HOME_INVENTORY_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    const validShopIds = new Set(SHOP_CATALOGUE.map(item => item.id));
    // Starter furniture is tracked as sold forever. Shop furniture is instead removed
    // from purchasedItems when sold, because it can legitimately be bought again.
    // Older snapshots may contain shop ids in soldItems; filtering those out is the
    // backwards-compatible migration that restores the correct ownership semantics.
    const validFurnitureIds = new Set(FURNITURE_STORE.map(item => item.id));
    const savedSoldItems: unknown[] = Array.isArray(saved?.soldItems) ? saved.soldItems : [];
    const savedCoins: Record<string, unknown> = saved?.coins ?? {};
    const savedPurchases: Record<string, unknown> = saved?.purchasedItems ?? {};
    const savedLayouts = saved?.roomLayouts ?? {};
    return {
      coins: Object.fromEntries(Object.entries(savedCoins).map(([memberId, value]) => {
        // Earlier builds could take coins away after a missed red flag and leave a
        // member in "debt". Training outcomes no longer create financial punishment,
        // so migrate those legacy balances back to zero.
        return [memberId, Math.max(0, typeof value === "number" && Number.isFinite(value) ? value : 0)];
      })),
      soldItems: [...new Set(savedSoldItems.filter(
        (id): id is string => typeof id === "string" && validFurnitureIds.has(id),
      ))],
      roomLayouts: Object.fromEntries(Object.entries(savedPurchases).map(([memberId, value]) => [
        memberId, reconcileLayout(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && validShopIds.has(id)) : [], savedLayouts[memberId]),
      ])),
      purchasedItems: Object.fromEntries(Object.entries(savedPurchases).map(([memberId, value]) => {
        const savedIds: unknown[] = Array.isArray(value) ? value : [];
        return [
          memberId,
          [...new Set(savedIds.filter(
            (id): id is string => typeof id === "string" && validShopIds.has(id),
          ))],
        ];
      })),
    };
  } catch {
    return fallback;
  }
}

function saveHomeInventory(inventory: HomeInventory) {
  try { localStorage.setItem(HOME_INVENTORY_KEY, JSON.stringify(inventory)); return true; } catch { return false; }
}

// Before houses, coins and furniture were keyed by role id. A player now owns one
// server id, so an existing player's balance and purchases would otherwise read as a
// brand-new 0. Fold the old entries into the signed-in id once per device.
const LEGACY_MEMBER_IDS = ["you", "grandma", "mum", "dad", "kid"];
const HOME_INVENTORY_MIGRATED_KEY = "safespace_home_inventory_migrated_v1";

function legacyInventoryMigrated(): boolean {
  // Storage we cannot read is storage we cannot migrate: treat it as already done.
  try { return localStorage.getItem(HOME_INVENTORY_MIGRATED_KEY) === "1"; } catch { return true; }
}

function markLegacyInventoryMigrated() {
  try { localStorage.setItem(HOME_INVENTORY_MIGRATED_KEY, "1"); } catch { /* private mode */ }
}

/**
 * Sum the legacy coins and union the legacy purchases into `selfId`, then drop the old
 * keys. Returns null when there is nothing to fold, or when this id already has an
 * entry — the account's own balance always wins over stale role-keyed ones. soldItems
 * is not member-keyed, so it is untouched.
 */
function foldLegacyInventory(inventory: HomeInventory, selfId: string): HomeInventory | null {
  if (LEGACY_MEMBER_IDS.includes(selfId)) return null;
  if (inventory.coins[selfId] !== undefined || inventory.purchasedItems[selfId] !== undefined) return null;
  const legacyIds = LEGACY_MEMBER_IDS.filter(
    (id) => inventory.coins[id] !== undefined || inventory.purchasedItems[id] !== undefined,
  );
  if (!legacyIds.length) return null;
  const coins = { ...inventory.coins };
  const purchasedItems = { ...inventory.purchasedItems };
  let total = 0;
  const items = new Set<string>();
  for (const id of legacyIds) {
    total += coins[id] ?? 0;
    for (const item of purchasedItems[id] ?? []) items.add(item);
    delete coins[id];
    delete purchasedItems[id];
  }
  return {
    ...inventory,
    coins: { ...coins, [selfId]: total },
    purchasedItems: { ...purchasedItems, [selfId]: [...items] },
  };
}

const REWARD_CLAIMS_KEY = "safespace_reward_claims_v1";


// Payday is a Sunday event, so use the local Sunday that begins the current week.
// This avoids UTC rollover allowing a second claim near midnight in Singapore.


function loadRewardClaims(): RewardClaims {
  const fallback: RewardClaims = { dailyByMember: {}, paydayWeek: null, raceWins: [] };
  try {
    const raw = localStorage.getItem(REWARD_CLAIMS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      dailyByMember: parsed?.dailyByMember && typeof parsed.dailyByMember === "object"
        ? parsed.dailyByMember
        : {},
      paydayWeek: typeof parsed?.paydayWeek === "string" ? parsed.paydayWeek : null,
      raceWins: Array.isArray(parsed?.raceWins) ? parsed.raceWins.filter((id: unknown) => typeof id === "string") : [],
    };
  } catch {
    return fallback;
  }
}

function saveRewardClaims(claims: RewardClaims) {
  try { localStorage.setItem(REWARD_CLAIMS_KEY, JSON.stringify(claims)); } catch { /* private mode */ }
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: START — the fork after PRESS START for anyone without a session.
// New players design a character first and verify afterwards; returning players
// go straight to the phone check.
// ─────────────────────────────────────────────────────────────────────────
// Each room is tinted from the member's avatar colour, so a house of six still reads
// as six distinct rooms without anyone picking wallpaper.
const ROOM_BACKGROUNDS: Record<string, string> = {
  "#4ecdc4": "#081420", "#ff6b35": "#1a0e08", "#c77dff": "#100c20",
  "#ffe66d": "#161408", "#ff2d55": "#1a0810", "#00ff88": "#0c1a10",
};
const DEFAULT_AVATAR: AvatarConfig = DEFAULT_PROFILE.avatar;

// The server's member shape, adapted to what the existing screens already render.
function toFamilyMember(m: MemberView, roomStyle = DEFAULT_ROOM_STYLE, language: Language = "en"): FamilyMember {
  const avatar = normalizeAvatarConfig(m.avatar ?? DEFAULT_AVATAR);
  return {
    id: m.id, name: m.name, role: m.isOwner ? translate(language, "HOUSE OWNER") : translate(language, "HOUSEMATE"),
    coins: m.room?.coins ?? 0,
    level: m.level, xp: m.xp, xpMax: m.xpMax, streak: m.streak,
    timesSafe: m.timesSafe, timesScammed: m.timesScammed,
    safeThisWeek: m.safeThisWeek, recentDrillResult: m.recentDrillResult,
    primaryColor: avatar.color, roomName: roomStyle.name || translate(language, "{name}'S ROOM", { name: m.name }), roomStyle,
    roomBg: ROOM_BACKGROUNDS[avatar.color] ?? "#081420",
    roomItems: m.room?.items ?? [], roomLayout: m.room?.layout ?? undefined,
    badgeCount: m.badgeCount, badgeTotal: m.badgeTotal, avatar,
  };
}

// One copy of the house's members, provided by App() and read by the screens.







const DRILL_WIN_TITLES: Record<DrillType, string> = {
  call: "{name} won a call drill", sms: "{name} won an SMS drill", email: "{name} won an email drill",
};
const DRILL_REVIEW_TITLES: Record<DrillType, string> = {
  call: "{name} has a call drill to review", sms: "{name} has an SMS drill to review", email: "{name} has an email drill to review",
};
const DRILL_WON_LABELS: Record<DrillType, string> = { call: "CALL DRILL WON", sms: "SMS DRILL WON", email: "EMAIL DRILL WON" };
const DRILL_LOST_LABELS: Record<DrillType, string> = { call: "CALL DRILL LOST", sms: "SMS DRILL LOST", email: "EMAIL DRILL LOST" };

const WAITING_CALL_KEY = "safespace_waiting_call_v1";
const REAL_EVENT_IDS_KEY = "safespace_real_event_ids_v1";
function loadWaitingCallId(): string | null {
  try { return localStorage.getItem(WAITING_CALL_KEY); } catch { return null; }
}
function saveWaitingCallId(id: string | null) {
  try {
    if (id) localStorage.setItem(WAITING_CALL_KEY, id);
    else localStorage.removeItem(WAITING_CALL_KEY);
  } catch { /* private mode */ }
}

function claimRealEventId(id: string): boolean {
  try {
    const parsed = JSON.parse(localStorage.getItem(REAL_EVENT_IDS_KEY) || "[]");
    const ids = Array.isArray(parsed) ? parsed.filter(value => typeof value === "string") : [];
    if (ids.includes(id)) return false;
    localStorage.setItem(REAL_EVENT_IDS_KEY, JSON.stringify([...ids.slice(-199), id]));
    return true;
  } catch {
    // Private mode has no durable local coin ledger, so duplicate cosmetic events are
    // less harmful than suppressing feedback entirely.
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────

export default function App({ initialScreen = "title", devMode = false }: { initialScreen?: Screen; devMode?: boolean }) {
  const { t, language } = useI18n();
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [drillType, setDrillType] = useState<DrillType>("call");
  const [callOutcome, setCallOutcome] = useState<CallOutcome | null>(null);
  const [smsOutcome, setSmsOutcome] = useState<SmsOutcome | null>(null);
  const [emailOutcome, setEmailOutcome] = useState<EmailOutcome | null>(null);
  const [realEmailScenario, setRealEmailScenario] = useState<RealEmailScenario | null>(null);
  const [resultXp, setResultXp] = useState<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [signInMode, setSignInMode] = useState<"new" | "returning">("new");
  const [registrationReturn, setRegistrationReturn] = useState<Screen>("home");
  const [waitingCallId, setWaitingCallId] = useState<string | null>(loadWaitingCallId);
  const [pendingResultAckId, setPendingResultAckId] = useState<string | null>(null);
  const [neutralResultNotice, setNeutralResultNotice] = useState<NeutralResultNotice | null>(null);
  const pendingCheckRef = useRef<() => Promise<void>>(async () => {});
  const handlingPendingIdsRef = useRef(new Set<string>());
  const practiceAttemptIdsRef = useRef<Partial<Record<DrillType, string>>>({});
  const displayedPracticeAttemptRef = useRef<string | null>(null);
  const sellInFlightRef = useRef(new Set<string>());
  const rewardClaimInFlightRef = useRef(new Set<string>());

  useEffect(() => {
    // The token is already gone by the time this fires: send the player back to a
    // sign-in they can actually complete, rather than leaving them on a screen whose
    // every request now 401s.
    const onExpired = () => {
      setPreferenceUser(null);
      setOnboardingStage(null);
      setDrillPreferences(loadDrillPreferences());
      setSessionEpoch(value => value + 1);
      setSignInMode("returning");
      setScreen("sign-in");
    };
    window.addEventListener("safespace-session-expired", onExpired);
    return () => window.removeEventListener("safespace-session-expired", onExpired);
  }, []);

  // An invite link (/?house=K7P3QX) may land on a signed-out device. Stash the code
  // and clean the URL now; it pre-fills the join box once the player has an account.
  useEffect(() => { captureInviteFromUrl(); }, []);

  // Mute lives in the audio module (persisted to localStorage); this is just the mirror
  // React needs to re-render the header/settings toggles. Seeded from the persisted value.
  const [muted, setMutedState] = useState(() => isMuted());
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const [soloScenarios, setSoloScenarios] = useState<FamilyScenario[]>([]);
  const [soloIndex, setSoloIndex] = useState(0);
  const [soloAnswers, setSoloAnswers] = useState<{ scenarioId: number; action: string; outcome: FamilyOutcome; foundClues: number[] }[]>([]);
  const [houseRunXp, setHouseRunXp] = useState<number | null | "pending">(null);
  // The latest answers, readable synchronously when the drill ends (state lags a render).
  const soloAnswersRef = useRef<typeof soloAnswers>([]);
  // One post per run, even if the end handler fires twice.
  const houseRunKeyRef = useRef<string | null>(null);

  // Player name + avatar, persisted locally. Seeded once from storage.
  const [profile, setProfileState] = useState<PlayerProfile>(loadProfile);
  const updateProfile = (patch: Partial<PlayerProfile>) =>
    setProfileState((prev) => { const next = { ...prev, ...patch }; saveProfile(next); return next; });

  // A verified account owns the canonical drill name. Keep the cosmetic profile and
  // registration prefill in sync with it, but retain local-only naming in demo/offline use.
  // The same fetch also pulls this account's saved coins + furniture (see below), so a
  // player signing in on a second device sees the room they built, not an empty one —
  // one round trip does both instead of firing /api/me twice on every load.
  useEffect(() => {
    if (!sessionToken()) { setServerInventoryChecked(true); return; }
    // apiGet never throws — a network error, a 5xx or a non-OK response all resolve to
    // `null`, not a rejection. Only mark the check done when a response actually
    // arrived: flagging it done on a failed fetch would let the save effect below fire
    // immediately with this device's local (possibly empty/default) snapshot and
    // overwrite the account's real saved room. Leaving the gate closed on failure just
    // means this session doesn't sync — nothing is lost, since local storage still
    // holds it — and the next successful load reconciles normally.
    apiGet<any>("/api/me").then((data) => {
      if (!data) return;
      if (typeof data.id === "string") {
        setPreferenceUser(data.id);
        setDrillPreferences(loadDrillPreferences());
      }
      const serverName = data?.name ?? data?.user?.name ?? data?.profile?.name;
      if (typeof serverName === "string" && serverName.trim()) {
        const clean = serverName.trim();
        updateProfile({ name: clean });
        saveContact({ ...loadContact(), name: clean });
      }
      const serverInventory = data?.homeInventory ?? data?.user?.homeInventory;
      if (serverInventory && typeof serverInventory === "object") {
        const serverCoins = serverInventory.coins ?? {};
        // A drill can finish while this initial account fetch is still in flight.
        // Keep any balances already changed in this session instead of replacing them
        // with the older server snapshot returned by the request.
        setCoins((current) => ({
          ...serverCoins,
          ...Object.fromEntries([...coinMutationsSinceInventoryLoadRef.current]
            .map((memberId) => [memberId, current[memberId] ?? 0])),
        }));
        setSoldItems(serverInventory.soldItems ?? []);
        setPurchasedItems(serverInventory.purchasedItems ?? {});
        setRoomLayouts(serverInventory.roomLayouts ?? {});
      }
      setServerInventoryChecked(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateVerifiedName = async (name: string): Promise<NameUpdateResult> => {
    const clean = name.trim();
    if (!clean) return { ok: false, error: t("Name is required.") };
    if (!sessionToken()) {
      updateProfile({ name: clean });
      saveContact({ ...loadContact(), name: clean });
      return { ok: true, name: clean };
    }
    try {
      const response = await fetch("/api/me/name", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: clean }),
      });
      handleApiAuth(response);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { ok: false, error: t(data.error || "Could not update your name.") };
      }
      const canonical = data?.name ?? data?.user?.name ?? data?.profile?.name ?? clean;
      const savedName = String(canonical).trim();
      updateProfile({ name: savedName });
      saveContact({ ...loadContact(), name: savedName });
      return { ok: true, name: savedName };
    } catch {
      return {
        ok: false,
        error: t("Could not reach the server. Your drill name was not changed."),
      };
    }
  };

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [drillPreferences, setDrillPreferences] = useState<DrillPreferences>(loadDrillPreferences);
  const updateDrillPreferences = (next: DrillPreferences) => {
    setDrillPreferences(next);
    saveDrillPreferences(next);
  };
  // Persist settings so the drill schedule (and every other toggle) survives a reload.
  const updateSettings = (patch: Partial<AppSettings>) =>
    setSettings((prev) => { const next = { ...prev, ...patch }; saveSettings(next); return next; });

  const [accessibility, setAccessibility] = useState<AccessibilityPrefs>(loadAccessibility);
  const updateAccessibility = (patch: Partial<AccessibilityPrefs>) =>
    setAccessibility((prev) => {
      const next = { ...prev, ...patch };
      saveAccessibility(next);
      return next;
    });

  // Coin + furniture ownership must survive leaving/reopening the app. Loading them
  // from the same snapshot also prevents a bought item and its deducted cost drifting
  // apart after refresh.
  const initialHomeInventory = useMemo(loadHomeInventory, []);
  const [coins, setCoins] = useState<Record<string, number>>(initialHomeInventory.coins);
  const coinMutationsSinceInventoryLoadRef = useRef(new Set<string>());
  const [soldItems, setSoldItems] = useState<string[]>(initialHomeInventory.soldItems);
  const [purchasedItems, setPurchasedItems] = useState<Record<string, string[]>>(
    initialHomeInventory.purchasedItems
  );
  const [roomLayouts, setRoomLayouts] = useState<RoomLayouts>(initialHomeInventory.roomLayouts);
  const [arrangingRoom, setArrangingRoom] = useState(false);
  const [roomStyles, setRoomStyles] = useState(loadRoomStyles);
  // Set once the /api/me fetch above has resolved (or been skipped while signed out), so
  // the very first save-effect run — firing with whatever this device had locally, before
  // the server has had a chance to say what it already knows — never overwrites a
  // signed-in account's saved room with this device's stale or default snapshot.
  const [serverInventoryChecked, setServerInventoryChecked] = useState(false);
  useEffect(() => {
    saveHomeInventory({ coins, soldItems, purchasedItems, roomLayouts });
    if (!sessionToken() || !serverInventoryChecked) return;
    // localStorage above is the durable local copy either way, so a failed sync here
    // never loses this device's data — but silently swallowing it would make a real,
    // recurring sync problem invisible. Log it so it shows up in the console/telemetry
    // rather than only manifesting later as "my room didn't follow me to my new phone".
    void apiPost("/api/me/home-inventory", { homeInventory: { coins, soldItems, purchasedItems, roomLayouts } })
      .then((result) => {
        if (!result.ok) console.warn("[home-inventory] sync to account failed:", result.status, result.data?.error);
      });
  }, [coins, soldItems, purchasedItems, roomLayouts, serverInventoryChecked]);
  const [rewardClaims, setRewardClaims] = useState<RewardClaims>(loadRewardClaims);
  useEffect(() => saveRewardClaims(rewardClaims), [rewardClaims]);
  const todayKey = localDateKey();
  const weekKey = localWeekKey();

  // The house is the only source of members now. Signed-out visitors have no house
  // and no members, so every member-keyed screen simply has nothing to show.
  const currentSession = sessionToken();
  const signedIn = !!currentSession;
  const house = useHouse(signedIn, currentSession ?? "signed-out");
  const selfView = house.state.self;
  const selfId = selfView?.id ?? "me";
  const refreshHouseAfterChatDenied = useCallback(() => {
    void house.refresh();
  }, [house.refresh]);
  const chat = useHouseChat({
    houseId: house.state.house?.id ?? null,
    selfId: selfView?.id ?? null,
    sessionKey: currentSession,
    active: screen === "family-chat",
    observe: signedIn && !!house.state.house?.id,
    changeRevision: house.changeRevision,
    onAccessDenied: refreshHouseAfterChatDenied,
  });
  const chatIdentity = house.state.house?.id && selfView?.id
    ? `${house.state.house.id}:${selfView.id}`
    : null;
  const [chatReadMarker, setChatReadMarker] = useState<{ identity: string | null; id: string }>({ identity: null, id: "0" });
  useEffect(() => {
    if (!chatIdentity) {
      setChatReadMarker({ identity: null, id: "0" });
      return;
    }
    setChatReadMarker({ identity: chatIdentity, id: readChatThrough(chatIdentity) });
  }, [chatIdentity]);
  useEffect(() => {
    if (screen !== "family-chat" || !chatIdentity) return;
    const latestId = chat.messages.at(-1)?.id;
    if (!latestId) return;
    try { localStorage.setItem(chatReadKey(chatIdentity), latestId); } catch { /* badge remains session only */ }
    setChatReadMarker({ identity: chatIdentity, id: latestId });
  }, [screen, chatIdentity, chat.messages]);
  const hasUnreadChatMessages = chatReadMarker.identity === chatIdentity
    && chat.messages.some(message => message.senderId !== selfId && isChatMessageUnread(message.id, chatReadMarker.id));
  const houseDrill = useHouseDrill({
    enabled: signedIn && !!selfView,
    houseId: house.state.house?.id ?? null,
    selfId,
    changeRevision: house.changeRevision,
  });
  const members = useMemo(() => {
    const views = house.state.house?.members ?? (house.state.self ? [house.state.self] : []);
    // Everyone's room look comes from the server, so housemates see each other's rooms as
    // decorated. This phone's own saved look wins for the player's own room, so an edit
    // shows instantly (and survives) before the server round-trip lands.
    const selfViewId = house.state.self?.id;
    return views.map(view => {
      const style = view.id === selfViewId && roomStyles[view.id]
        ? roomStyles[view.id]
        : view.room?.style ? normalizeRoomStyle(view.room.style) : DEFAULT_ROOM_STYLE;
      return toFamilyMember(view, style, language);
    });
  }, [house.state, roomStyles, language]);
  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const activeMemberId = selfId; // one player per phone now
  // Nothing may be earned or claimed before the server says who we are. A coin written
  // against the "me" placeholder lands under an id no screen reads, and a week marked
  // claimed that way can never be re-earned. Truthiness, not `!== null`: a house whose
  // member list has lost us arrives as `self: undefined`, which is the same "we don't
  // know who we are" state.
  const canEarn = !!selfView;

  // One-off per device: adopt the coins and furniture this player earned before houses,
  // when everything was keyed by role id ("you", "mum", …) instead of an account id.
  // Runs only once the server has said who we are, so nothing lands under a placeholder.
  const knownSelfId = canEarn ? selfId : null;
  useEffect(() => {
    if (!knownSelfId || legacyInventoryMigrated()) return;
    markLegacyInventoryMigrated();
    const folded = foldLegacyInventory({ coins, soldItems, purchasedItems, roomLayouts }, knownSelfId);
    if (!folded) return;
    setCoins(folded.coins);
    setPurchasedItems(folded.purchasedItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownSelfId]);

  // The account owns the avatar, so a player who signs in on a second device sees the
  // character they made, not this device's leftover defaults. Keyed on the serialised
  // avatar so a refresh that returns the same values doesn't re-run this.
  const serverAvatarKey = selfView?.avatar ? JSON.stringify(selfView.avatar) : "";
  useEffect(() => {
    if (!serverAvatarKey) return;
    const merged = normalizeAvatarConfig(JSON.parse(serverAvatarKey));
    const same = JSON.stringify(merged) === JSON.stringify(profile.avatar);
    if (!same) updateProfile({ avatar: merged });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverAvatarKey]);

  // The account owns the room look too, so housemates see it and a second device shows it.
  const pushRoomStyle = useCallback(async (style: RoomStyle) => {
    if (!sessionToken()) return;
    const result = await apiPost("/api/me/room-style", { roomStyle: style });
    if (result.ok) void house.refresh();
    else console.warn("[room-style] sync to account failed:", result.status, result.data?.error);
  }, [house.refresh]);
  const serverRoomStyleKey = selfView?.room?.style ? JSON.stringify(normalizeRoomStyle(selfView.room.style)) : "";
  const localRoomStyle = selfView ? roomStyles[selfView.id] : undefined;
  useEffect(() => {
    if (!selfView) return;
    if (serverRoomStyleKey) {
      // Adopt the account's look when it changed elsewhere (another device).
      if (JSON.stringify(localRoomStyle ?? null) === serverRoomStyleKey) return;
      const next = { ...roomStyles, [selfView.id]: normalizeRoomStyle(JSON.parse(serverRoomStyleKey)) };
      saveRoomStyles(next);
      setRoomStyles(next);
    } else if (localRoomStyle) {
      // One-off: a look saved on this phone before rooms were shared goes up to the account.
      void pushRoomStyle(localRoomStyle);
    }
    // Only when the server's copy changes; local edits push themselves (onStyleSave).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRoomStyleKey, selfView?.id]);

  // Editing the avatar while signed in writes it back to the account; signed-out
  // players keep it locally until they verify (sign-up sends it with the code).
  const persistAvatar = (avatar: AvatarConfig) => {
    updateProfile({ avatar });
    if (sessionToken()) void saveAvatar(avatar).then(() => house.refresh());
  };

  const claimedDailyToday: Record<string, boolean> = {
    [selfId]: rewardClaims.dailyByMember[selfId] === todayKey,
  };
  const paydayClaimedThisWeek = rewardClaims.paydayWeek === weekKey;

  const [coinLedger, setCoinLedger] = useState<CoinTx[]>([]);

  const [notifications, setNotifications] = useState<Notification[]>(() => loadNotifications(selfId));
  const [activeNotificationId, setActiveNotificationId] = useState<string | null>(null);
  // The newest notification, shown as a banner under the bell until it times out.
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  useEffect(() => {
    setNotifications(loadNotifications(selfId));
    setActiveNotificationId(null);
  }, [selfId]);

  // Central helper: mutate coins + append to ledger (cap-enforced)
  const addCoinTx = (memberId: string, delta: number, reason: CoinTxReason, label: string) => {
    if (!canEarn) return;
    coinMutationsSinceInventoryLoadRef.current.add(memberId);
    const tx: CoinTx = { id: makeTxId(), memberId, delta, reason, label, timestamp: Date.now() };
    setCoins(prev => ({ ...prev, [memberId]: (prev[memberId] ?? 0) + delta }));
    setCoinLedger(prev => [tx, ...prev].slice(0, LEDGER_CAP));
  };

  const appendNotification = (n: Omit<Notification, "id" | "timestamp" | "read">) => {
    const notif: Notification = {
      ...n,
      id: makeNotifId(),
      timestamp: Date.now(),
      read: false,
    };
    setNotifications(prev => {
      const next = [notif, ...prev].slice(0, NOTIFICATIONS_CAP);
      saveNotifications(selfId, next);
      return next;
    });
    setToastNotification(notif);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(selfId, next);
      return next;
    });
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      saveNotifications(selfId, next);
      return next;
    });
  };

  const emitNotifDrill = (memberId: string, drill: DrillType, outcome: "win" | "lose", displayName?: string) => {
    const member = memberMap[memberId];
    if (!member) return;
    const rewards: Record<DrillType, number> = { call: 50, sms: 40, email: 60 };
    const delta = outcome === "win" ? rewards[drill] : 0;
    const kind: NotificationKind = outcome === "win"
      ? (drill === "call" ? "drill-win-call" : drill === "sms" ? "drill-win-sms" : "drill-win-email")
      : (drill === "call" ? "drill-lose-call" : drill === "sms" ? "drill-lose-sms" : "drill-lose-email");
    appendNotification({
      kind,
      memberId,
      title: outcome === "win"
        ? translate(language, DRILL_WIN_TITLES[drill], { name: displayName ?? member.name })
        : translate(language, DRILL_REVIEW_TITLES[drill], { name: displayName ?? member.name }),
      body: outcome === "win"
        ? translate(language, "+{delta} coins · Nice work spotting the red flags", { delta })
        : translate(language, "No coins lost · Review the tips and try again"),
    });
  };

  const emitNotifFamilyDrill = (correctCount: number, totalRounds: number, title = "House drill complete") => {
    if (totalRounds === 0) return;
    appendNotification({
      kind: "family-drill-complete",
      memberId: "family",
      title: translate(language, title),
      body: translate(language,
        correctCount === totalRounds
          ? "{correct}/{total} correct — perfect run!"
          : correctCount >= Math.ceil(totalRounds / 2)
            ? "{correct}/{total} correct — solid effort"
            : "{correct}/{total} correct — needs more practice",
        { correct: correctCount, total: totalRounds }),
    });
  };

  const emitNotifPayday = () => {
    appendNotification({
      kind: "payday",
      memberId: "family",
      title: translate(language, "Payday collected"),
      body: selfView?.safeThisWeek ? translate(language, "You earned the safety bonus") : translate(language, "Stay safe this week to earn the bonus"),
    });
  };

  const emitNotifDailyReward = (memberId: string) => {
    const member = memberMap[memberId];
    if (!member) return;
    appendNotification({
      kind: "daily-reward",
      memberId,
      title: translate(language, "{name} claimed daily reward", { name: member.name }),
      body: translate(language, "+{amount} coins added to balance", { amount: DAILY_REWARD_AMOUNT }),
    });
  };
  // Drill-outcome event helper (used by call/sms/email flows)
  const emitDrillEvent = (memberId: string, drill: DrillType, outcome: "win" | "lose", liveCallOutcome?: CallOutcome | null) => {
    if (!canEarn) return;
    const rewards: Record<DrillType, number> = { call: 50, sms: 40, email: 60 };
    const penalties: Record<DrillType, number> = { call: -25, sms: -20, email: -30 };
    const delta = outcome === "win" ? rewards[drill] : penalties[drill];
    const label = outcome === "win"
      ? translate(language, DRILL_WON_LABELS[drill])
      : translate(language, DRILL_LOST_LABELS[drill]);
    const reason: CoinTxReason = outcome === "win"
      ? (drill === "call" ? "drill-win-call" : drill === "sms" ? "drill-win-sms" : "drill-win-email")
      : (drill === "call" ? "drill-lose-call" : drill === "sms" ? "drill-lose-sms" : "drill-lose-email");
    addCoinTx(memberId, delta, reason, label);
    emitNotifDrill(memberId, drill, outcome, drill === "call" && liveCallOutcome ? profile.name : undefined);
  };

  // Family-round event helper
  const emitFamilyRoundEvent = (memberId: string, outcome: FamilyOutcome) => {
    if (!canEarn) return;
    const delta = FAMILY_COINS[outcome];
    if (delta === 0) return; // cautious: no reward, but no penalty either
    const correct = outcome === "correct";
    const label = correct ? translate(language, "HOUSE DRILL CORRECT") : translate(language, "HOUSE DRILL WRONG");
    const reason: CoinTxReason = correct ? "family-drill-correct" : "family-drill-wrong";
    addCoinTx(memberId, delta, reason, label);
  };

  // Payday distribution: per-member, per-line-item entries in ledger
  const collectPayday = () => {
    if (!canEarn) return;
    const claimKey = `payday:${localWeekKey()}`;
    if (rewardClaims.paydayWeek === localWeekKey() || rewardClaimInFlightRef.current.has(claimKey)) return;
    rewardClaimInFlightRef.current.add(claimKey);
    setRewardClaims(prev => {
      const next = { ...prev, paydayWeek: localWeekKey() };
      saveRewardClaims(next);
      return next;
    });
    const base = 200, bonus = 150;
    addCoinTx(selfId, base, "payday-base", translate(language, "PAYDAY BASE ALLOWANCE"));
    if (selfView?.safeThisWeek) {
      addCoinTx(selfId, bonus, "payday-bonus", translate(language, "PAYDAY DRILL BONUS"));
    }
    emitNotifPayday();
  };

  const FULLSCREEN_ROUTES: Screen[] = ["customize", "family-chat", "payday"];
  // A house-drill invite never interrupts sign-in, a live call, or the drill screen itself.
  const INVITE_SUPPRESSED_SCREENS: Screen[] = ["title", "start", "new-character", "drill-preferences-onboarding", "sign-in", "register", "incoming", "call", "family-drill-intro"];

  const SUB_PAGE_ROUTES: Screen[] = ["account-settings", "privacy-settings", "accessibility-settings", "about-settings", "preferences", "profile-edit", "avatar-customisation", "family-drill-intro", "solo-drill-intro", "solo-drill-summary"];

  // --- Audio ---------------------------------------------------------------
  // No-ops until unlock() has run from a real click (PRESS START); browsers refuse to
  // start audio without a user gesture.
  useEffect(() => {
    setMusicEnabled(!MUSIC_SILENT_SCREENS.includes(screen));

    // Stings on arrival at the screens that carry emotional weight.
    if (screen === "incoming") playSfx("incoming");
    else if (screen === "result-win") playSfx("win");
    else if (screen === "result-lose") playSfx("lose");
  }, [screen]);

  const isTitle = screen === "title";
  const isFullscreen = FULLSCREEN_ROUTES.includes(screen);
  const isSubPage = SUB_PAGE_ROUTES.includes(screen);
  const isMainTab = (["home", "leaderboard", "store", "profile", "settings"] as Screen[]).includes(screen);
  const showAppChrome = isMainTab || screen === "drill-select";

  const goHome = () => { setActiveTab("home"); setScreen("home"); };
  const goDrillSelect = () => {
    practiceAttemptIdsRef.current = {};
    displayedPracticeAttemptRef.current = null;
    setResultXp(null);
    setScreen("drill-select");
  };
  const goFamilyDrill = () => setScreen("family-drill-intro");
  const goSoloDrill = () => setScreen("solo-drill-intro");
  const startSoloDrill = (count: number) => {
    setSoloScenarios(pickScenarios(count, Math.random, drillPreferences));
    setSoloIndex(0);
    setSoloAnswers([]);
    soloAnswersRef.current = [];
    houseRunKeyRef.current = null;
    setHouseRunXp(null);
    setScreen("solo-drill-round");
  };

  const handleTab = (tab: Tab) => { setActiveTab(tab); setScreen(tab as Screen); };
  const handleNav = (s: string) => setScreen(s as Screen);

  const handleChatIcon = () => setScreen("family-chat");
  const handleBellIcon = () => { setToastNotification(null); setScreen("notifications"); };
  const handleSettingsIcon = () => setScreen("settings");

  const getScreenTitle = (): { title: string; color: string } => {
    switch (screen) {
      case "home": return { title: "DRILL MODE", color: "#00ff88" };
      case "leaderboard": return { title: "LEADERBOARD", color: "#ffe66d" };
      case "store": return { title: "STORE", color: "#c77dff" };
      case "profile": return { title: "PROFILE", color: "#4ecdc4" };
      case "settings": return { title: "SETTINGS", color: "#9bb0c8" };
      case "drill-select": return { title: "DRILLS", color: "#00ff88" };
      default: return { title: "DRILL MODE", color: "#00ff88" };
    }
  };

  const acknowledgePendingResult = async (recordId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/drills/pending-result/${encodeURIComponent(recordId)}/ack`,
        { method: "POST", headers: { ...authHeaders() } },
      );
      handleApiAuth(response);
      if (!response.ok) {
        handlingPendingIdsRef.current.delete(recordId);
        return false;
      }
      handlingPendingIdsRef.current.delete(recordId);
      window.setTimeout(() => { void pendingCheckRef.current(); }, 0);
      return true;
    } catch {
      handlingPendingIdsRef.current.delete(recordId);
      return false;
    }
  };

  const consumeDrillResult = async (record: DrillResultRecord): Promise<boolean> => {
    const recordId = record.id ?? record.drillId;
    if (!recordId) return false;
    if (handlingPendingIdsRef.current.has(recordId)) return true;
    handlingPendingIdsRef.current.add(recordId);

    const channel = record.channel ?? "call";
    const outcome = record.outcome as CallOutcome | undefined;
    const safeCall = outcome === "hung_up" || outcome === "disengaged" || outcome === "caught_flag";
    const failedCall = outcome === "complied" || outcome === "shared_data";
    const win = record.screen
      ? record.screen === "result-win"
      : channel === "call"
        ? safeCall
        : record.result === "win";
    const scored = record.screen === "result-win" || record.screen === "result-lose"
      || (channel === "call" ? safeCall || failedCall : record.result === "win" || record.result === "lose");

    if (scored) {
      displayedPracticeAttemptRef.current = null;
      setDrillType(channel);
      setResultXp(typeof record.xpGained === "number" ? record.xpGained : null);
      setCallOutcome(channel === "call" ? (outcome ?? null) : null);
      if (channel === "sms") {
        setSmsOutcome(record.outcome === "clicked_link" ? "clicked-link" : record.outcome === "reported" ? "reported" : null);
      } else {
        setSmsOutcome(null);
      }
      if (channel === "email") {
        setEmailOutcome(record.outcome === "submitted_details" ? "submitted-details" : record.outcome === "reported" ? "reported" : null);
      } else {
        setEmailOutcome(null);
      }
      setScreen(win ? "result-win" : "result-lose");
      setPendingResultAckId(recordId);
      if (claimRealEventId(recordId)) {
        emitDrillEvent(activeMemberId, channel, win ? "win" : "lose", channel === "call" ? outcome : null);
      }
    } else {
      const reason = record.unscoredReason;
      const message = outcome === "distress_offramp"
        ? "The drill stopped safely when you opted out. It was not scored, and your streak was not changed."
        : reason === "no_answer"
          ? "The call was not answered, so this drill was not scored."
          : reason === "voicemail"
            ? "The call reached voicemail, so this drill was not scored."
            : "There was not enough reliable evidence to score this call. No XP or streak change was applied.";
      setNeutralResultNotice({ id: recordId, message });
    }

    const matchesWaitingCall = channel === "call"
      && (waitingCallId === "awaiting" || record.attemptId === waitingCallId);
    if (matchesWaitingCall) {
      setWaitingCallId(null);
      saveWaitingCallId(null);
    }
    return true;
  };

  pendingCheckRef.current = async () => {
    if (!sessionToken()) return;
    const data = await apiGet<{ pending: DrillResultRecord | null }>("/api/drills/pending-result");
    if (data?.pending) await consumeDrillResult(data.pending);
  };

  useEffect(() => {
    const check = () => { void pendingCheckRef.current(); };
    const onVisibility = () => { if (document.visibilityState === "visible") check(); };
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!waitingCallId) return;
    const timer = window.setInterval(() => { void pendingCheckRef.current(); }, 4000);
    return () => window.clearInterval(timer);
  }, [waitingCallId]);

  const persistPracticeOutcome = (outcome: string, channel: DrillType) => {
    const attemptId = practiceAttemptIdsRef.current[channel] ?? createAttemptId(`practice_${channel}`);
    practiceAttemptIdsRef.current[channel] = attemptId;
    displayedPracticeAttemptRef.current = attemptId;
    setResultXp(null);
    reportOutcome(outcome, channel, attemptId).then((xp) => {
      if (xp != null && displayedPracticeAttemptRef.current === attemptId) setResultXp(xp);
    });
  };

  const handleRealDrillOutcome = async (
    channel: "sms" | "email",
    drillId: string,
    outcome: "reported" | "clicked_link" | "submitted_details",
    scenario: RealEmailScenario | null = null,
  ): Promise<RealDrillCompletion> => {
    if (channel === "email") setRealEmailScenario(scenario);
    try {
      const response = await fetch(`/api/drills/${encodeURIComponent(drillId)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ outcome }),
      });
      handleApiAuth(response);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.record) {
        return { ok: false, error: t(data.error || "Could not save this result.") };
      }
      const consumed = await consumeDrillResult({ ...data.record, channel });
      return consumed ? { ok: true } : { ok: false, error: t("Result saved and will be recovered automatically.") };
    } catch {
      return { ok: false, error: t("Network error. Your result will be recovered when the app reconnects.") };
    }
  };

  // Real phone drills fall back to self-report when the Vapi webhook can't score the call
  // (no tunnel / not configured). Resolve it client-side: show the pass/fail result + tally
  // coins, stop waiting on the webhook, and de-dupe by drillId so a later webhook result
  // for the same call can't score it twice.
  const handlePhoneSelfReport = (win: boolean, drillId: string | null) => {
    if (waitingCallId) { setWaitingCallId(null); saveWaitingCallId(null); }
    if (drillId) {
      handlingPendingIdsRef.current.add(drillId);
      claimRealEventId(drillId);
    }
    const outcome: CallOutcome = win ? "disengaged" : "complied";
    displayedPracticeAttemptRef.current = null;
    setDrillType("call");
    setSmsOutcome(null);
    setEmailOutcome(null);
    setCallOutcome(outcome);
    setResultXp(null);
    emitDrillEvent(activeMemberId, "call", win ? "win" : "lose", outcome);
    setScreen(win ? "result-win" : "result-lose");
  };

  const leaveResultScreen = (destination: () => void) => {
    const recordId = pendingResultAckId;
    setPendingResultAckId(null);
    setRealEmailScenario(null);
    destination();
    if (recordId) void acknowledgePendingResult(recordId);
  };

  const dismissNeutralResult = () => {
    const notice = neutralResultNotice;
    if (!notice) return;
    setNeutralResultNotice(null);
    void acknowledgePendingResult(notice.id);
  };


  // Drill outcome handlers — all now emit coin events for activeMemberId
  const handleCallResult = (win: boolean) => {
    setCallOutcome(null);
    persistPracticeOutcome(win ? "disengaged" : "complied", "call");
    emitDrillEvent(activeMemberId, "call", win ? "win" : "lose");
    setScreen(win ? "result-win" : "result-lose");
  };

  // Distress off-ramp: the caller can stop any time and it is NEVER scored — no XP
  // change, no streak reset, no win/lose screen, no coin event. The backend models this
  // as `distress_offramp` (a "safe-exit" that leaves the record untouched); we still post
  // it so the choice is logged, then quietly return home. This is the ethical core of the
  // app: opting out of a distressing drill must never carry a penalty.
  const handleCallDistress = () => {
    persistPracticeOutcome("distress_offramp", "call");
    goHome();
  };

  const handleSmsWin = (outcome: SmsOutcome) => {
    setCallOutcome(null);
    setSmsOutcome(outcome);
    persistPracticeOutcome(outcome === "closed-page" ? "closed_page" : outcome, "sms");
    emitDrillEvent(activeMemberId, "sms", "win");
    setScreen("result-win");
  };
  const handleSmsLose = (outcome: SmsOutcome) => {
    setCallOutcome(null);
    setSmsOutcome(outcome);
    persistPracticeOutcome(outcome === "clicked-link" ? "clicked_link" : outcome, "sms");
    emitDrillEvent(activeMemberId, "sms", "lose");
    setScreen("result-lose");
  };

  const handleEmailWin = (outcome: EmailOutcome) => {
    setCallOutcome(null);
    setEmailOutcome(outcome);
    persistPracticeOutcome(outcome === "cancelled-download" ? "cancelled_download" : outcome, "email");
    emitDrillEvent(activeMemberId, "email", "win");
    setScreen("result-win");
  };
  const handleEmailLose = (outcome: EmailOutcome) => {
    setCallOutcome(null);
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

  // Solo round completion: the coins go to whoever is playing this run.
  const handleSoloComplete = (action: string, foundClues: number[], outcome: FamilyOutcome) => {
    const scenario = soloScenarios[soloIndex];
    emitFamilyRoundEvent(selfId, outcome);
    const next = [...soloAnswersRef.current, { scenarioId: scenario.id, action, outcome, foundClues }];
    soloAnswersRef.current = next;
    setSoloAnswers(next);
  };

  // Posts the finished solo drill's tally once. soloAnswersRef holds the last answer
  // synchronously (soloAnswers itself lags a render behind), and houseRunKeyRef stops a
  // second post if the end handler ever fires twice.
  const finishSoloDrill = () => {
    const answers = soloAnswersRef.current;
    const count = (o: FamilyOutcome) => answers.filter((a) => a.outcome === o).length;
    emitNotifFamilyDrill(count("correct"), answers.length, "Individual drill complete");
    const run = { correct: count("correct"), cautious: count("cautious"), wrong: count("wrong") };
    setScreen("solo-drill-summary");
    if (run.correct + run.cautious + run.wrong === 0 || houseRunKeyRef.current) {
      if (!houseRunKeyRef.current) setHouseRunXp(null);
      return;
    }
    const clientKey = createAttemptId("house-run");
    houseRunKeyRef.current = clientKey;
    setHouseRunXp("pending");
    void postHouseRun({ clientKey, ...run }).then((r) => {
      setHouseRunXp(r.ok ? r.data.run.xpGained : null);
      if (r.ok) void house.refresh();
    });
  };

  const handleSoloNext = () => {
    if (soloIndex + 1 >= soloScenarios.length) finishSoloDrill();
    else setSoloIndex((i) => i + 1);
  };

  const handleHouseDrillFinished = useCallback((drill: HouseDrill) => {
    // A race is scored per player, so report this player's own tally.
    const answered = drill.answers.filter((a) => !a.skipped && (drill.mode !== "race" || a.playerId === selfId));
    emitNotifFamilyDrill(answered.filter((a) => a.outcome === "correct").length, answered.length);
    void house.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [house.refresh, language, selfId]);

  // The winner of a house race gets a one-off coin bonus, paid once per race on this device.
  useEffect(() => {
    const drill = houseDrill.drill;
    if (!canEarn || drill?.status !== "finished" || drill.mode !== "race" || drill.winnerId !== selfId) return;
    const claimKey = `race-win:${drill.id}`;
    if (rewardClaims.raceWins.includes(drill.id) || rewardClaimInFlightRef.current.has(claimKey)) return;
    rewardClaimInFlightRef.current.add(claimKey);
    setRewardClaims(prev => {
      const next = { ...prev, raceWins: [drill.id, ...prev.raceWins].slice(0, 20) };
      saveRewardClaims(next);
      return next;
    });
    addCoinTx(selfId, RACE_WIN_COINS, "race-win", translate(language, "HOUSE RACE WIN"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseDrill.drill, selfId, canEarn, rewardClaims.raceWins]);

  // Furniture sell — now routes through ledger
  const handleSellItem = (memberId: string, itemId: string, value: number) => {
    if (!canEarn) return; // never take furniture away when the coins can't be paid
    const saleKey = `${memberId}:${itemId}`;
    if (sellInFlightRef.current.has(saleKey)) return;
    const starter = FURNITURE_STORE.find(i => i.id === itemId);
    if (starter) {
      if (starter.memberId !== memberId || soldItems.includes(itemId)) return;
      sellInFlightRef.current.add(saleKey);
      setSoldItems(prev => prev.includes(itemId) ? prev : [...prev, itemId]);
      addCoinTx(memberId, value, "sell-furniture", translate(language, "SOLD {item}", { item: translate(language, starter.name) }));
      return;
    }
    const shopItem = SHOP_CATALOGUE.find(i => i.id === itemId);
    if (shopItem) {
      // The same catalogue item can belong to several members. Remove and credit only
      // the member whose room initiated this sale.
      if ((purchasedItems[memberId] ?? []).includes(itemId)) {
        sellInFlightRef.current.add(saleKey);
        // Also remove it from this member's purchasedItems so it disappears from their room.
        setPurchasedItems(prev => ({
          ...prev,
          [memberId]: (prev[memberId] ?? []).filter(id => id !== itemId),
        }));
        setRoomLayouts(prev => ({ ...prev, [memberId]: reconcileLayout(
          (purchasedItems[memberId] ?? []).filter(id => id !== itemId), prev[memberId],
        ) }));
        addCoinTx(memberId, value, "sell-furniture", translate(language, "SOLD {item}", { item: translate(language, shopItem.name) }));
      }
    }
  };

  const handleBuyItem = (memberId: string, itemId: string, cost: number) => {
    if (!canEarn) return; // never hand out an item when the cost can't be deducted
    const item = SHOP_CATALOGUE.find(i => i.id === itemId);
    if (!item) return;
    const currentCoins = coins[memberId] ?? 0;
    if (currentCoins < cost) return;
    if ((purchasedItems[memberId] ?? []).includes(itemId)) return;
    sellInFlightRef.current.delete(`${memberId}:${itemId}`);
    setPurchasedItems(prev => ({
      ...prev,
      [memberId]: [...(prev[memberId] ?? []), itemId],
    }));
    setRoomLayouts(prev => ({ ...prev, [memberId]: reconcileLayout(
      [...(purchasedItems[memberId] ?? []), itemId], prev[memberId],
    ) }));
    addCoinTx(memberId, -cost, "buy-furniture", translate(language, "BOUGHT {item}", { item: translate(language, item.name) }));
  };

  const handleClaimDaily = (memberId: string) => {
    if (!canEarn) return;
    const claimDate = localDateKey();
    const claimKey = `daily:${memberId}:${claimDate}`;
    if (rewardClaims.dailyByMember[memberId] === claimDate || rewardClaimInFlightRef.current.has(claimKey)) return;
    rewardClaimInFlightRef.current.add(claimKey);
    setRewardClaims(prev => {
      const next = {
        ...prev,
        dailyByMember: { ...prev.dailyByMember, [memberId]: claimDate },
      };
      saveRewardClaims(next);
      return next;
    });
    addCoinTx(memberId, DAILY_REWARD_AMOUNT, "daily-reward", translate(language, "DAILY LOGIN REWARD"));
    emitNotifDailyReward(memberId);
  };

  // Only your own room is customisable — tapping a housemate's room just shows theirs.
  const openCustomize = (memberId: string) => {
    if (memberId !== selfId) return;
    setScreen("customize");
  };

  const handleRemoveMember = async (id: string) => {
    const r = await removeMember(id);
    if (r.ok) house.apply(r.data); else window.alert(t(r.data.error ?? "Could not remove that player."));
  };

  // Every house route answers with the whole { self, house } state, so one helper can
  // apply the result and hand the screen a message to show when it fails.
  const applyHouseResult = async (call: () => Promise<ApiResult<HouseState>>): Promise<string | null> => {
    const r = await call();
    if (!r.ok) return t(r.data.error ?? "Something went wrong.");
    house.apply(r.data);
    return null;
  };

  // Creating or joining is the end of the invite's life: consume the pending code so a
  // stale one can't pre-fill the join box later, and show the player their new house.
  const houseAction = async (call: () => Promise<ApiResult<HouseState>>): Promise<string | null> => {
    const error = await applyHouseResult(call);
    if (error) return error;
    takePendingInvite();
    goHome();
    return null;
  };

  // Set while this client is leaving on purpose, so the house going away doesn't get
  // reported to the player as somebody else removing them.
  const leavingRef = useRef(false);
  const handleLeaveHouse = async (): Promise<string | null> => {
    leavingRef.current = true;
    const error = await applyHouseResult(leaveHouse);
    if (error) { leavingRef.current = false; return error; }
    goHome();
    window.alert(t("You left the house."));
    return null;
  };

  // Being removed is silent otherwise — the house simply disappears on the next refresh.
  const prevHouseId = useRef<string | null>(null);
  const houseId = house.state.house?.id ?? null;
  useEffect(() => {
    const previous = prevHouseId.current;
    prevHouseId.current = houseId;
    if (houseId) { leavingRef.current = false; return; }
    if (!previous) return;
    if (leavingRef.current) { leavingRef.current = false; return; }
    appendNotification({
      kind: "house",
      memberId: selfId,
      title: translate(language, "You're no longer in a house"),
      body: translate(language, "Your progress is still yours. Create or join another any time."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  // Houses need an account. Detaching the phone clears the session without moving the
  // player, so guard the route itself: every create/join from there would 401 with no
  // way back. Signed-out players get the returning sign-in instead of a dead end.
  useEffect(() => {
    if (signedIn || (screen !== "house" && screen !== "house-settings" && screen !== "family-tree" && screen !== "house-new")) return;
    setSignInMode("returning");
    setScreen("sign-in");
  }, [screen, signedIn]);

  // Signing in is the point the app becomes "yours": adopt the verified name, load the
  // house, and land on Home (or the house, for an invited player).
  const finishSignIn = async (name: string, userId?: string, skipOnboarding = false) => {
    updateProfile({ name });
    if (skipOnboarding) setOnboardingStage(null);
    else if (signInMode === "new" && !onboardingStage()) setOnboardingStage("survey");
    if (userId) {
      setPreferenceUser(userId);
      setDrillPreferences(loadDrillPreferences());
    }
    // This may be a different account than the one that was last signed in here. Forget
    // the previous session's house so the removed-from-a-house watcher doesn't fire on
    // the switch, and drop any half-finished leave.
    prevHouseId.current = null;
    leavingRef.current = false;
    setSessionEpoch((v) => v + 1);
    // Fetched rather than house.refresh()'d because the decision below needs the house in
    // hand: a state update would not be readable from this closure. house.apply keeps the
    // hook holding the same copy.
    const signedInIdentity = sessionToken() ?? "signed-out";
    const state = await apiGet<HouseState>("/api/house");
    if (state) house.apply(state, signedInIdentity);
    const account = await apiGet<{ avatar?: AvatarConfig }>("/api/me");
    if (account?.avatar) updateProfile({ avatar: normalizeAvatarConfig(account.avatar) });
    else if (signInMode === "new" && !skipOnboarding) updateProfile({ avatar: DEFAULT_PROFILE.avatar });
    const invite = peekPendingInvite();
    if (onboardingStage()) {
      setScreen(onboardingStage() === "character" ? "new-character" : "drill-preferences-onboarding");
      return;
    }
    goHome();
    if (!skipOnboarding && !hasSeenTutorial()) setTourOpen(true);
    if (!invite) return;
    // Up to HOUSES_PER_USER houses: someone with room for another is taken to join it (the
    // code is pre-filled); someone already at the limit can't use it, so spend it here —
    // left alone it would re-route every later sign-in and pre-fill a dead code.
    const count = state?.houses?.length ?? (state?.house ? 1 : 0);
    if (count >= HOUSES_PER_USER) takePendingInvite();
    else setScreen(state?.house ? "house-new" : "house");
  };

  const finishNewPlayerOnboarding = () => {
    setOnboardingStage(null);
    goHome();
    if (!hasSeenTutorial()) setTourOpen(true);
    const invite = peekPendingInvite();
    if (invite && !house.state.house) setScreen("house");
    else if (invite) takePendingInvite();
  };

  const openRegistration = (returnTo: Screen) => {
    setRegistrationReturn(returnTo);
    setScreen("register");
  };

  const finishRegistration = (name: string, userId?: string) => {
    const canonical = name.trim();
    if (userId) {
      setPreferenceUser(userId);
      setDrillPreferences(loadDrillPreferences());
    }
    updateProfile({ name: canonical });
    saveContact({ ...loadContact(), name: canonical });
    // Verifying here signs in as that number's account, which may not be the one the
    // screens are showing. Resync the house exactly as sign-in does, or the UI would
    // keep showing the previous account's house and self.
    prevHouseId.current = null;
    leavingRef.current = false;
    setSessionEpoch((v) => v + 1);
    void house.refresh();
    setScreen(registrationReturn);
  };

  const beginWaitingForCall = (drillId?: string) => {
    const id = drillId || "awaiting";
    setWaitingCallId(id);
    saveWaitingCallId(id);
    void pendingCheckRef.current();
  };

  const handleOpenTelegram = () => {
    window.open(TELEGRAM_BOT_URL, "_blank", "noopener,noreferrer");
  };

  const { title, color } = getScreenTitle();
  const unreadNotificationCount = notifications.filter(n => !n.read).length;
  // Not over the notification screens, which already list it, or mid-drill.
  const showNotificationToast = toastNotification !== null && showAppChrome
    && screen !== "notifications" && screen !== "notification-detail";

  // These buttons explicitly request a drill now. Automatic scheduling is not exposed
  // until a server-side scheduler exists, so a stale local preference must not block
  // a user-initiated call or email.
  const drillWin = drillWindowStatus(settings, new Date(), t);
  const realDrillBlocked = false;

  return (
    // Deliberately not re-indented: every screen below reads members through context,
    // and wrapping in place keeps this file's diff reviewable.
    <MembersContext.Provider value={members}>
    <SelfIdContext.Provider value={selfId}>
    <div className={[
      "safespace-app",
      accessibility.reduceMotion ? "a11y-reduce-motion" : "",
      accessibility.largerText ? "a11y-large-text" : "",
      accessibility.highContrast ? "a11y-high-contrast" : "",
    ].filter(Boolean).join(" ")}>
      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.6; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        ::-webkit-scrollbar { display: none; }
        .a11y-reduce-motion *, .a11y-reduce-motion *::before, .a11y-reduce-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
        .a11y-high-contrast { filter: contrast(1.22) saturate(1.08); }
      `}</style>
      {!accessibility.disableScanlines && <Scanlines />}
      <PhoneFrame>
        <div className="flex flex-col flex-1 overflow-hidden" style={{ position: "relative" }}>
          {showAppChrome && (
            <AppHeader
              title={t(title)}
              titleColor={color}
              unreadNotificationCount={unreadNotificationCount}
              hasUnreadChatMessages={hasUnreadChatMessages}
              muted={muted}
              onToggleMute={toggleMute}
              onChat={handleChatIcon}
              onNotifications={handleBellIcon}
              onSettings={handleSettingsIcon}
              onTutorial={() => { setScreen("home"); setTourOpen(true); }}
            />
          )}
          {showNotificationToast && (
            <NotificationToast
              notification={toastNotification}
              onOpen={() => {
                setActiveNotificationId(toastNotification.id);
                markNotificationRead(toastNotification.id);
                setToastNotification(null);
                setScreen("notification-detail");
              }}
              onDismiss={() => setToastNotification(null)}
            />
          )}

          <div className="flex-1 overflow-hidden">
            {screen === "title" && (
              <TitleScreen
                onNext={() => {
                  // The only reliable place to start audio: browsers require a real
                  // user gesture, and this is the one button everybody presses first.
                  unlock();
                  playSfx("select");
                  // Signed in: straight to Home. The tour highlights real elements, so
                  // Home must be mounted first. Otherwise: pick new or returning player.
                  if (sessionToken()) {
                    const stage = onboardingStage();
                    if (stage) setScreen(stage === "character" ? "new-character" : "drill-preferences-onboarding");
                    else {
                      goHome();
                      if (!hasSeenTutorial()) setTourOpen(true);
                    }
                  } else {
                    setScreen("start");
                  }
                }}
              />
            )}
            {screen === "start" && (
              <StartScreen
                onNew={() => { if (devMode) setOnboardingStage(null); setSignInMode("new"); setScreen("sign-in"); }}
                onReturning={() => { if (devMode) setOnboardingStage(null); setSignInMode("returning"); setScreen("sign-in"); }}
              />
            )}
            {screen === "new-character" && (
              <AvatarCustomisationScreen
                avatar={profile.avatar}
                onSave={persistAvatar}
                onBack={finishNewPlayerOnboarding}
                onboardingFinish
              />
            )}
            {screen === "drill-preferences-onboarding" && (
              <DrillPreferencesScreen
                onboarding
                preferences={drillPreferences}
                onSave={(next) => { updateDrillPreferences(next); setOnboardingStage("character"); setScreen("new-character"); }}
              />
            )}
            {screen === "sign-in" && (
              <RegisterScreen
                key={signInMode}
                mode={signInMode}
                devMode={devMode}
                name={profile.name}
                onNewPlayer={() => { setSignInMode("new"); setScreen("sign-in"); }}
                onBack={() => setScreen("start")}
                onDone={(name, userId) => { void finishSignIn(name, userId); }}
                onDevSkip={(name, userId) => { void finishSignIn(name, userId, true); }}
              />
            )}
            {/* The drill opt-in entry points re-verify an already signed-in player, so no
                new-player escape hatch here: taking it would start a second account and
                replace the session they already have. */}
            {screen === "register" && (
              <RegisterScreen
                mode="returning"
                devMode={devMode}
                name={profile.name}
                onDone={finishRegistration}
                onBack={() => setScreen(registrationReturn)}
              />
            )}
            {(screen === "house" || screen === "house-settings" || screen === "family-tree") && (
              house.state.house ? (
                <HouseSettingsScreen
                  key={house.state.house.id}
                  house={house.state.house}
                  selfId={selfId}
                  onRegenerate={() => applyHouseResult(regenerateCode)}
                  onRename={(name) => applyHouseResult(() => renameHouse(name))}
                  onRemove={(id) => applyHouseResult(() => removeMember(id))}
                  onLeave={handleLeaveHouse}
                  onBack={goHome}
                  tab={screen === "family-tree" ? "tree" : "settings"}
                  onTab={(tab) => setScreen(tab === "tree" ? "family-tree" : "house")}
                  onFamilyEdit={(edits) => applyHouseResult(() => editFamily(edits))}
                  houses={house.state.houses ?? []}
                  onSwitchHouse={(id) => applyHouseResult(() => switchHouse(id))}
                  onAddHouse={() => setScreen("house-new")}
                  />
              ) : signedIn ? (
                <HouseChoiceScreen
                  initialCode={peekPendingInvite() ?? ""}
                  onCreate={(n) => houseAction(() => createHouse(n))}
                  onJoin={(c) => houseAction(() => joinHouse(c))}
                  onBack={goHome}
                />
              ) : null
            )}

            {screen === "house-new" && signedIn && (
              <HouseChoiceScreen
                title={t("ADD A HOUSE")}
                initialCode={peekPendingInvite() ?? ""}
                onCreate={(n) => houseAction(() => createHouse(n))}
                onJoin={(c) => houseAction(() => joinHouse(c))}
                onBack={goHome}
              />
            )}

            {screen === "home" && (
              <FamilyHomeScreen
                onPayday={() => setScreen("payday")}
                paydayClaimedThisWeek={paydayClaimedThisWeek}
                onCustomize={openCustomize}
                onArrange={() => setArrangingRoom(true)}
                roomLayouts={roomLayouts}
                coins={coins}
                soldItems={soldItems}
                purchasedItems={purchasedItems}
                house={house.state.house}
                houses={house.state.houses ?? []}
                onSwitchHouse={(id) => applyHouseResult(() => switchHouse(id))}
                onPlayWithOthers={() => setScreen("house")}
                onRemoveMember={handleRemoveMember}
                houseLoading={house.loading}
                houseFailed={house.failed}
                onRetryHouse={() => { void house.refresh(); }}
              />
            )}
            {screen === "leaderboard" && <LeaderboardScreen onPlayWithOthers={() => setScreen("house")} />}
            {screen === "store" && (
              <ShopScreen
                activeMemberId={activeMemberId}
                coins={coins}
                purchasedItems={purchasedItems}
                onBuy={handleBuyItem}
                layout={roomLayouts[selfId]}
                onArrange={() => setArrangingRoom(true)}
              />
            )}
            {screen === "profile" && (
              <ProfileScreen
                profile={profile}
                onEditProfile={() => setScreen("profile-edit")}
                activeMemberId={activeMemberId}
                coins={coins}
                coinLedger={coinLedger}
                claimedDailyToday={claimedDailyToday}
                onClaimDaily={handleClaimDaily}
              />
            )}
            {screen === "settings" && <SettingsScreen profile={profile} settings={settings} muted={muted} onToggleMute={toggleMute} onSettings={updateSettings} onNav={handleNav} />}
            {screen === "preferences" && <DrillPreferencesScreen preferences={drillPreferences} onSave={(next) => { updateDrillPreferences(next); setScreen("settings"); }} onBack={() => setScreen("settings")} />}

            {screen === "account-settings" && <AccountSettingsScreen profile={profile} onBack={() => setScreen("settings")} />}
            {screen === "privacy-settings" && <PrivacySettingsScreen onBack={() => setScreen("settings")} />}
            {screen === "accessibility-settings" && (
              <AccessibilitySettingsScreen
                prefs={accessibility}
                onChange={updateAccessibility}
                onBack={() => setScreen("settings")}
              />
            )}
            {screen === "about-settings" && <AboutSettingsScreen onBack={() => setScreen("settings")} />}
            {screen === "profile-edit" && (
              <ProfileEditScreen
                profile={profile}
                onRename={updateVerifiedName}
                onBack={() => setScreen("profile")}
                onAvatar={() => setScreen("avatar-customisation")}
                onHouse={() => setScreen("customize")}
              />
            )}
            {screen === "avatar-customisation" && (
              <AvatarCustomisationScreen
                avatar={profile.avatar}
                onSave={persistAvatar}
                onBack={() => setScreen("profile-edit")}
              />
            )}

            {screen === "customize" && (
              <CustomizeScreen
                memberId={selfId}
                coins={coins[selfId] ?? 0}
                purchasedItems={purchasedItems[selfId] ?? []}
                soldItems={soldItems}
                layout={roomLayouts[selfId]}
                onStyleSave={style => {
                  if (!selfView) return false;
                  const clean = normalizeRoomStyle(style);
                  const next = { ...roomStyles, [selfId]: clean };
                  if (!saveRoomStyles(next)) return false;
                  setRoomStyles(next);
                  void pushRoomStyle(clean);
                  return true;
                }}
                onBack={goHome}
                onSell={handleSellItem}
                onArrange={() => setArrangingRoom(true)}
              />
            )}
            {screen === "family-chat" && (
              <HouseChatScreen
                key={`${sessionEpoch}:${selfId}:${house.state.house?.id ?? ""}`}
                chat={chat}
                selfId={selfId}
                selfName={profile.name}
                houseName={house.state.house?.name ?? ""}
                hasHouse={!!house.state.house}
                identityKey={`${selfId}:${house.state.house?.id ?? ""}`}
                reduceMotion={accessibility.reduceMotion}
                onBack={goHome}
                onJoinHouse={() => setScreen("house")}
                renderAvatar={avatar => (
                  <CharacterAvatar size={32} config={normalizeAvatarConfig(avatar)} title="Message sender character" />
                )}
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
                onRegister={() => openRegistration("realistic-phone-intro")}
                onStarted={beginWaitingForCall}
                onSelfReport={handlePhoneSelfReport}
                scheduleBlocked={realDrillBlocked}
                scheduleNextLabel={drillWin.nextLabel}
              />
            )}
            {screen === "realistic-sms-intro" && (
              <RealisticSmsDrillIntroScreen
                onBack={() => setScreen("drill-select")}
                onRegister={() => openRegistration("realistic-sms-intro")}
                onOutcome={(drillId, outcome) => handleRealDrillOutcome("sms", drillId, outcome)}
                scheduleBlocked={realDrillBlocked}
                scheduleNextLabel={drillWin.nextLabel}
              />
            )}
            {screen === "realistic-email-intro" && (
              <RealisticEmailDrillIntroScreen
                onBack={() => setScreen("drill-select")}
                onRegister={() => openRegistration("realistic-email-intro")}
                onOutcome={(drillId, outcome, scenario) => handleRealDrillOutcome("email", drillId, outcome, scenario)}
                scheduleBlocked={realDrillBlocked}
                scheduleNextLabel={drillWin.nextLabel}
              />
            )}
            {screen === "payday" && <PaydayScreen coins={coins} claimedThisWeek={paydayClaimedThisWeek} canCollect={canEarn} onCollect={collectPayday} onClose={goHome} />}
            {screen === "family-drill-intro" && (
              <FamilyDrillScreen
                drill={houseDrill.drill}
                selfId={selfId}
                inHouse={!!house.state.house}
                onApply={houseDrill.apply}
                onRefresh={() => void houseDrill.refresh()}
                onRoundResult={(outcome) => emitFamilyRoundEvent(selfId, outcome)}
                onFinished={handleHouseDrillFinished}
                onExit={goDrillSelect}
                onIndividual={goSoloDrill}
                onSetUpHouse={() => setScreen("house")}
              />
            )}
            {screen === "solo-drill-intro" && <SoloDrillIntroScreen preferences={drillPreferences} onStart={startSoloDrill} onBack={goDrillSelect} />}
            {screen === "solo-drill-round" && soloScenarios[soloIndex] && (
              <FamilyRoundScreen
                scenario={soloScenarios[soloIndex]}
                roundIndex={soloIndex}
                totalRounds={soloScenarios.length}
                targetLabel={t("YOU")}
                prompt={t("WHAT SHOULD YOU DO?")}
                nextLabel={soloIndex + 1 >= soloScenarios.length ? t("SEE RESULTS") : t("NEXT QUESTION")}
                onComplete={handleSoloComplete}
                onNext={handleSoloNext}
                onEnd={finishSoloDrill}
              />
            )}
            {screen === "solo-drill-summary" && (
              <FamilySummaryScreen
                mode="solo"
                answers={soloAnswers.map((a) => ({ scenarioId: a.scenarioId, outcome: a.outcome, foundClues: a.foundClues.length }))}
                total={soloAnswers.length}
                coins={soloAnswers.reduce((sum, a) => sum + FAMILY_COINS[a.outcome], 0)}
                serverXp={houseRunXp}
                onPlayAgain={() => startSoloDrill(soloScenarios.length || 5)}
                onSwitchMode={goFamilyDrill}
                onHome={goHome}
              />
            )}

            {screen === "drill-select" && (
              <DrillSelectScreen
                preferredChannels={drillPreferences.channels}
                onRealisticPhone={() => setScreen("realistic-phone-intro")}
                onRealisticSms={() => setScreen("realistic-sms-intro")}
                onTelegram={() => setScreen("telegram-intro")}
                onRealisticEmail={() => setScreen("realistic-email-intro")}
                onFamily={house.state.house ? goFamilyDrill : () => setScreen("house")}
                onIndividual={goSoloDrill}
                inHouse={!!house.state.house}
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
            {screen === "call" && <CallScreen activeMemberId={activeMemberId} onHangUp={handleCallResult} onResult={handleCallResult} onDistress={handleCallDistress} />}
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
                realEmailScenario={realEmailScenario}
                callOutcome={callOutcome}
                profileName={profile.name}
                activeMemberId={activeMemberId}
                onPlayAgain={() => leaveResultScreen(goDrillSelect)}
                onGoHome={() => leaveResultScreen(goHome)}
                xpOverride={resultXp}
              />
            )}
          </div>

          {showAppChrome && (
            <BottomNav
              activeTab={activeTab === ("settings" as any) ? "home" : activeTab}
              drillActive={screen === "drill-select"}
              onTab={handleTab}
              onDrillSelect={goDrillSelect}
            />
          )}
        </div>
      </PhoneFrame>
      {arrangingRoom && selfView && memberMap[selfId] && (
        <RoomEditor
          key={selfId}
          items={purchasedFurniture(purchasedItems[selfId] ?? [])}
          layout={roomLayouts[selfId]}
          roomName={memberMap[selfId].roomName}
          accent={memberMap[selfId].primaryColor}
          background={memberMap[selfId].roomBg}
          roomStyle={memberMap[selfId].roomStyle}
          onCancel={() => setArrangingRoom(false)}
          onSave={layout => {
            const next = { ...roomLayouts, [selfId]: reconcileLayout(purchasedItems[selfId] ?? [], layout) };
            if (!saveHomeInventory({ coins, soldItems, purchasedItems, roomLayouts: next })) return false;
            setRoomLayouts(next);
            setArrangingRoom(false);
            return true;
          }}
        />
      )}
      {tourOpen && (screen === "home" || screen === "drill-select" || screen === "leaderboard" || screen === "store") && (
        <TourOverlay
          onScreenChange={setScreen}
          onDone={() => { markTutorialSeen(); setTourOpen(false); setScreen("home"); }}
        />
      )}
      <HouseDrillInvite
        drill={houseDrill.drill}
        selfId={selfId}
        suppressed={tourOpen || !!neutralResultNotice || INVITE_SUPPRESSED_SCREENS.includes(screen)}
        onApply={houseDrill.apply}
        onOpen={goFamilyDrill}
      />
      {neutralResultNotice && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="neutral-result-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backgroundColor: "rgba(0,0,0,0.78)",
          }}
        >
          <div style={{ width: "min(340px, 100%)", backgroundColor: "#0d1526", border: "4px solid #4ecdc4", boxShadow: "6px 6px 0 #071018", padding: "18px 16px" }}>
            <div id="neutral-result-title" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-body)", color: "#4ecdc4", lineHeight: 1.5, marginBottom: 12 }}>
              {t("DRILL NOT SCORED")}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, marginBottom: 16 }}>
              {t(neutralResultNotice.message)}
            </div>
            <PixelButton onClick={dismissNeutralResult} color="#4ecdc4" textColor="#0a0e1a" size="md" full>
              {t("[ GOT IT ]")}
            </PixelButton>
          </div>
        </div>
      )}
    </div>
    </SelfIdContext.Provider>
    </MembersContext.Provider>
  );
}
