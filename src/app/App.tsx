// Import types
import type { Screen, Tab } from "./types/navigation";
import type { AvatarConfig, PlayerProfile, ContactInfo, NameUpdateResult } from "./types/profile";
import type { AppSettings, AccessibilityPrefs } from "./types/settings";
import type {
  CallOutcome,
  ConversationLine,
  DrillFlag,
  DrillResultRecord,
  DrillType,
  EmailOutcome,
  FamilyClue,
  FamilyOutcome,
  FamilyScenario,
  Highlight,
  NeutralResultNotice,
  RealDrillCompletion,
  SmsOutcome,
} from "./types/drills";
import type { FamilyMember } from "./types/family";
import type { ChatMsg } from "./types/chat";
import type { CoinTxReason, CoinTx, HomeInventory, RewardClaims } from "./types/economy";
import type { FurnitureItem, ShopItem } from "./types/store";
import type { Notification, NotificationKind } from "./types/notifications";

// Import data
import { SAFETY_TIPS } from "./data/safetyTips";
import { ACHIEVEMENTS } from "./data/achievements";
import { HALL_OF_FAME } from "./data/leaderboard";
import { RED_FLAGS, LIVE_CALL_FLAGS, SMS_FLAGS, EMAIL_FLAGS, FLAG_MAP } from "./data/scamFlags";
import { FAMILY_MEMBERS, MEMBER_MAP, PIXI_MEMBER, FAMILY_NAME_TO_ID } from "./data/familyMembers";
import { FURNITURE_STORE } from "./data/furniture";
import { SHOP_CATALOGUE } from "./data/shopCatalogue";
import { FAMILY_SCENARIOS } from "./data/familyScenarios";
import { DAILY_REWARD_AMOUNT, LEDGER_CAP } from "./data/economy";
import { NOTIFICATIONS_CAP } from "./data/notifications";

// Import utils
import { createAttemptId, makeNotifId, makeTxId } from "./utils/ids";
import { localDateKey, localWeekKey, formatNotifTimestamp } from "./utils/date";
import { DRILL_DAY_LABELS, DRILL_DAY_NAMES, drillWindowStatus } from "./utils/drillSchedule";

// Import services
import { TOKEN_KEY, sessionToken, setSessionToken, notifySessionExpired } from "./services/session";
import { authHeaders, handleApiAuth, apiGet, reportOutcome, updateVerifiedNameRequest } from "./services/api";
import { 
  PROFILE_KEY, DEFAULT_PROFILE, loadProfile, saveProfile,
  CONTACT_KEY, DEFAULT_CONTACT, loadContact, saveContact,
  loadAccessibility, saveAccessibility
} from "./services/storage";

// Import Icons
import { 
  IconAttachment, 
  IconBadge, IconBell, IconBulb,
  IconChat, IconChatBubble, IconCheck, IconCoin, 
  IconEnvelope, IconEyeInspect, IconFlame,
  IconGear, IconHouse, 
  IconPerson, IconPhone, 
  IconRealEmail,
  IconShield, IconSpeaker, IconStar, IconStore,
  IconTelegram, IconTrophy,
  IconWarning, IconX 
} from "./components/icons";

// Import avatars
import { FamilyChar, PixelAvatar, PixelMascot, PixiAvatar } from "./components/avatars";

// Import furniture
import { FurnitureIcon, PurchasedRoomFurniture, ShopFurnitureArt, WallpaperSwatch } from "./components/furniture";

// Import UI
import { 
  AnnotatedMessage,
  Blink, 
  ClueTooltip, FlagTooltip,
  InspectableLink,
  PixelButton, PixelPanel, PixelRadio, PixelToggle, 
  ScamReasonSection, SenderInspectPanel,
  XPBar 
} from "./components/ui";

// Import layout
import {
  AppHeader,
  BottomNav,
  PhoneFrame,
  Scanlines,
  Stars,
  SubPageHeader,
} from "./components/layout";

// Import screens
import { TitleScreen } from "./screens/title/TitleScreen";
import { DrillSelectScreen } from "./screens/drills/DrillSelectScreen";
import { FamilyHomeScreen } from "./screens/home";
import { AvatarCustomisationScreen, ProfileEditScreen, ProfileScreen } from "./screens/profile";
import { ShopScreen, CustomizeScreen } from "./screens/store";

// Import hooks
import { useIdleFrame } from "./hooks/useIdleFrame";

// default imports
import { useState, useEffect, useRef, useMemo } from "react";
import { unlock, playSfx, setMuted, setMusicEnabled, isMuted } from "./audio";

// ─── Backend API helpers ──────────────────────────────────────────────────
// These keep the richer Figma UI connected to the existing demo backend, while
// still allowing the prototype to run with mock data when the backend is down.
// Session token issued by the server after phone verification. The server derives WHO
// we are from this token — the client never asserts a user id, because a drill places a
// real phone call and a client-supplied id would let anyone target anyone.
// Anonymous visitors simply have no token and act as the shared demo account.
// First-run tutorial. Shown once, then replayable from Home — people forget, and a
// tutorial you can't get back to is worse than none.
const TUTORIAL_KEY = "safespace_tutorial_seen";
function hasSeenTutorial(): boolean {
  try { return localStorage.getItem(TUTORIAL_KEY) === "1"; } catch { return false; }
}
function markTutorialSeen() {
  try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* private mode: show it again, harmless */ }
}

// Player profile — name + avatar customisation. Persisted locally (this is cosmetic
// and never leaves the device), so it survives reloads without a backend round trip.
// Defaults reproduce the original hardcoded look.

// Contact details for real drills — name / phone / email. Saved locally so the register
// screen can pre-fill them and the user doesn't retype on every visit. Kept separate
// from the session token: saving your details is not the same as verifying ownership.

// createAttemptId



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




// Whether a real (surprise) drill is allowed to fire at `now`, given the schedule window.
// Returns whether the window is open and, if not, a short label for when it next opens.
// drillWindowStatus

type LeaderboardRow = { rank: number; name: string; score: number; wins?: number; area?: string };


// ── Phase 2: Coin ledger types ─────────────────────────────────────────────


// ── Phase 6: Notification types ────────────────────────────────────────────


// makeNotifId

// makeTxId

// ─────────────────────────────────────────────────────────────────────────
// PIXEL ICONS
// ─────────────────────────────────────────────────────────────────────────


// ── Per-item pixel-art furniture icons ───────────────────────────────────


// ── Wallpaper preview swatches ───────────────────────────────────────────


// ── Pixel Mascot ──────────────────────────────────────────────────────────
// Outfit → body/limb/accent colours. `Standard` reproduces the original mascot so
// every existing call site (headers, home, etc.) is untouched when no outfit is passed.

// ── Pixi Avatar — AI coach variant of the mascot ─────────────────────────
// Distinct from PixelMascot: antenna on top, single-pixel glowing eye centres,
// slightly different body accents. Reads as "bot, not player".





// `min` is the dimmed opacity. Default 0 (a true blink) suits the scam-warning text,
// where vanishing is the point. Anything the user is meant to TAP should set a floor so
// it never fully disappears — an invisible call-to-action reads as "not there yet".






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


// ─────────────────────────────────────────────────────────────────────────
// GEAR ICON
// ─────────────────────────────────────────────────────────────────────────

// Speaker with sound waves, or a muted speaker with an X. Pixel-drawn to match the
// zero-radius look of the rest of the header icons.


// ─────────────────────────────────────────────────────────────────────────
// APP HEADER
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// SUB-PAGE HEADER
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// FLAG DATA
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// LEADERBOARD DATA
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// FURNITURE STORE
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// SHOP CATALOGUE — buyable furniture (distinct from FURNITURE_STORE which is
// pre-owned sellable items). Members buy from here; items land in
// purchasedItems[memberId] and become placeable via CustomizeScreen.
// ─────────────────────────────────────────────────────────────────────────

// Coins and furniture are one piece of game state: persisting only ownership would
// restore bought items after a reload while also refunding their cost. Keep them in one
// versioned record so the store and Home always reconstruct the same room.
const HOME_INVENTORY_KEY = "safespace_home_inventory_v1";

function defaultHomeInventory(): HomeInventory {
  return {
    coins: Object.fromEntries(FAMILY_MEMBERS.map(member => [member.id, member.coins])),
    soldItems: [],
    purchasedItems: Object.fromEntries(FAMILY_MEMBERS.map(member => [member.id, []])),
  };
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
    return {
      coins: Object.fromEntries(FAMILY_MEMBERS.map(member => {
        const value = saved?.coins?.[member.id];
        // Earlier builds could take coins away after a missed red flag and leave a
        // family member in "debt". Training outcomes no longer create financial
        // punishment, so migrate those legacy balances back to zero.
        return [member.id, Math.max(0, Number.isFinite(value) ? value : member.coins)];
      })),
      soldItems: [...new Set(savedSoldItems.filter(
        (id): id is string => typeof id === "string" && validFurnitureIds.has(id),
      ))],
      purchasedItems: Object.fromEntries(FAMILY_MEMBERS.map(member => {
        const savedIds: unknown[] = Array.isArray(saved?.purchasedItems?.[member.id])
          ? saved.purchasedItems[member.id]
          : [];
        return [
          member.id,
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
  try { localStorage.setItem(HOME_INVENTORY_KEY, JSON.stringify(inventory)); } catch { /* private mode */ }
}

const REWARD_CLAIMS_KEY = "safespace_reward_claims_v1";

// localDateKey

// Payday is a Sunday event, so use the local Sunday that begins the current week.
// This avoids UTC rollover allowing a second claim near midnight in Singapore.
// localWeekKey

function loadRewardClaims(): RewardClaims {
  const fallback: RewardClaims = { dailyByMember: {}, paydayWeek: null };
  try {
    const raw = localStorage.getItem(REWARD_CLAIMS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      dailyByMember: parsed?.dailyByMember && typeof parsed.dailyByMember === "object"
        ? parsed.dailyByMember
        : {},
      paydayWeek: typeof parsed?.paydayWeek === "string" ? parsed.paydayWeek : null,
    };
  } catch {
    return fallback;
  }
}

function saveRewardClaims(claims: RewardClaims) {
  try { localStorage.setItem(REWARD_CLAIMS_KEY, JSON.stringify(claims)); } catch { /* private mode */ }
}

// ─────────────────────────────────────────────────────────────────────────
// SHOP FURNITURE ART — inline pixel-art renders for each ShopItem.art key
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// FLAG TOOLTIP
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// ANNOTATED MESSAGE
// ─────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────
// SCREEN 1: TITLE
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// SAFETY HABITS — collapsible reference card on the Drill tab. Deliberately tucked
// behind a dropdown, not shown up front: Drill Mode is about building reflexes under
// pressure, not reciting rules, so this is a look-it-up-if-you-want reference, never
// the thing standing between someone and a drill.
// ─────────────────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────────────────
// SCREEN: DRILL SELECT
// ─────────────────────────────────────────────────────────────────────────


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
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#00d4ff", textAlign: "center", textShadow: "3px 3px 0 #003a4a" }}>
            REAL BOT DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Talk to a real scam-fighter bot on Telegram.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #00d4ff", boxShadow: "3px 3px 0 #00d4ff", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#00d4ff", marginBottom: 10 }}>WHAT HAPPENS NEXT</div>
          {[
            "You will be sent to Telegram.",
            "Start a chat with our drill bot.",
            "Complete the scenarios in Telegram.",
            "Come back to the app when done.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#00d4ff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ff6b35", marginBottom: 4 }}>COIN REWARDS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
              Coins for this drill require backend integration. They will not be credited yet.
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "#0d1a24", border: "2px solid #2a3a5c", padding: "10px 12px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <IconLink size={12} color="#00d4ff" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#00d4ff", flex: 1, wordBreak: "break-all" }}>
            {TELEGRAM_BOT_URL}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelButton onClick={onOpen} color="#00d4ff" textColor="#0a0e1a" size="lg" full>[ OPEN TELEGRAM ]</PixelButton>
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC PHONE DRILL INTRO — explains flow, disabled until backend
// ─────────────────────────────────────────────────────────────────────────
function RealisticPhoneDrillIntroScreen({ onBack, onRegister, onStarted, onSelfReport, scheduleBlocked, scheduleNextLabel }: {
  onBack: () => void;
  onRegister: () => void;
  onStarted: (drillId?: string) => void;
  onSelfReport: (win: boolean, drillId: string | null) => void;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  const [phase, setPhase] = useState<"idle" | "calling" | "sent">("idle");
  const [msg, setMsg] = useState("");
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);
  const registered = !!sessionToken();

  const placeCall = async () => {
    setPhase("calling"); setMsg(""); setDeliveryUnconfirmed(false);
    try {
      // No body — the server dials the session user's OWN verified number, never one
      // from the request. That's the invariant that stops this dialling strangers.
      const r = await fetch("/api/drills/fire", { method: "POST", headers: { ...authHeaders() } });
      handleApiAuth(r);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setMsg(d.error || "Could not place the call.");
        setPhase("idle"); return;
      }
      const id = d.drillId ?? d.attemptId ?? d.attempt?.id ?? d.record?.id ?? d.id;
      if (!id) {
        setMsg("The call request may have been accepted, but its drill ID was missing. Do not retry; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setDrillId(null);
        onStarted();
        setPhase("sent");
        return;
      }
      setDrillId(id);
      setDeliveryUnconfirmed(d.deliveryConfirmed === false || d.status === "delivery-unconfirmed");
      onStarted(id);
      setPhase("sent");
    } catch {
      setMsg("The connection dropped while starting the call, so delivery is unknown. Do not retry; refresh later to recover any result.");
      setDeliveryUnconfirmed(true);
      onStarted();
      setPhase("sent");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL PHONE DRILL" titleColor="#00ff88" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(0,255,136,0.8))" }}>
            <IconPhone size={64} color="#00ff88" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#00ff88", textAlign: "center", textShadow: "3px 3px 0 #003a1f" }}>
            LIVE CALL DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Receive a simulated scam call on your real phone.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #00ff88", boxShadow: "3px 3px 0 #00ff88", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#00ff88", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We call your registered phone number.",
            "Answer the call as you normally would.",
            "Decide whether to engage, verify, or hang up.",
            "Return to the app to see your result.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#00ff88", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ff6b35", marginBottom: 4 }}>TRAINING CALL</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", lineHeight: 1.5 }}>
              This is a simulated security drill. We will never ask for real passwords, OTPs, card details, transfers, or payments.
            </div>
          </div>
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "rgba(255,230,109,0.08)" : "rgba(0,255,136,0.08)", border: `3px solid ${deliveryUnconfirmed ? "#ffe66d" : "#00ff88"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="#ffe66d" /> : <IconShield size={16} color="#00ff88" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: deliveryUnconfirmed ? "#ffe66d" : "#00ff88", marginBottom: 6 }}>
                {deliveryUnconfirmed ? "CALL DELIVERY NOT CONFIRMED" : "CALL REQUEST ACCEPTED"}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? "The provider may have accepted the call, but SafeSpace could not confirm it. Do not retry — we will keep checking this drill for a result."
                  : "Your phone should ring shortly. Answer it and stay sharp — hang up if it asks for anything real."}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d", marginBottom: 4 }}>REGISTER FIRST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                Verify your phone so the drill only ever calls the number you own.
              </div>
            </div>
          </div>
        ) : null}

        {msg && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff2d55", marginBottom: 12 }}>{msg}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#ffe66d", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                HOW DID THE CALL GO?
              </div>
              <PixelButton onClick={() => onSelfReport(true, drillId)} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ I HUNG UP / STAYED SAFE ]</PixelButton>
              <PixelButton onClick={() => onSelfReport(false, drillId)} color="#ff2d55" textColor="#ffffff" size="md" full>I ENGAGED / GAVE INFO</PixelButton>
            </>
          ) : registered && scheduleBlocked ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ffe66d", textAlign: "center", lineHeight: 1.5 }}>
                OUTSIDE YOUR DRILL WINDOW · OPENS {scheduleNextLabel}
              </div>
              <PixelButton onClick={() => {}} color="#1a2340" textColor="#6b8ba4" size="lg" full disabled>[ CALL ME NOW ]</PixelButton>
            </>
          ) : registered ? (
            <PixelButton onClick={placeCall} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={phase === "calling"}>
              {phase === "calling" ? "CALLING..." : "[ CALL ME NOW ]"}
            </PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>[ REGISTER TO CONTINUE ]</PixelButton>
          )}
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC SMS DRILL INTRO — fires a real text to the user's own number
// ─────────────────────────────────────────────────────────────────────────
function RealisticSmsDrillIntroScreen({ onBack, onRegister, onOutcome }: {
  onBack: () => void;
  onRegister: () => void;
  onOutcome: (drillId: string, outcome: "reported" | "clicked_link") => Promise<RealDrillCompletion>;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");
  const [msg, setMsg] = useState("");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);
  const registered = !!sessionToken();

  const sendText = async () => {
    setPhase("sending"); setMsg(""); setDeliveryUnconfirmed(false);
    try {
      // No number in the body — the server texts the session user's OWN verified number.
      const r = await fetch("/api/drills/sms", { method: "POST", headers: { ...authHeaders() } });
      handleApiAuth(r);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setMsg(d.error === "SMS drills are not configured"
          ? "SMS delivery isn't configured on this server yet."
          : (d.error || "Could not send the text."));
        setPhase("idle"); return;
      }
      const id = d.drillId ?? d.attemptId ?? d.attempt?.id ?? d.record?.id ?? d.id;
      if (!id) {
        setMsg("The text request may have been accepted, but its drill ID was missing. Do not resend; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setPhase("sent");
        return;
      }
      setDeliveryUnconfirmed(d.deliveryConfirmed === false || d.status === "delivery-unconfirmed");
      setDrillId(id);
      setPhase("sent");
    } catch {
      setMsg("The connection dropped while sending, so delivery is unknown. Do not resend; refresh later to recover any result.");
      setDeliveryUnconfirmed(true);
      setPhase("sent");
    }
  };

  const complete = async (outcome: "reported" | "clicked_link") => {
    if (!drillId || completing) return;
    setCompleting(true);
    setMsg("");
    const result = await onOutcome(drillId, outcome);
    if (!result.ok) setMsg(result.error || "Could not save this result. Please try again.");
    setCompleting(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL SMS DRILL" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(78,205,196,0.8))" }}>
            <IconChatBubble size={64} color="#4ecdc4" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#4ecdc4", textAlign: "center", textShadow: "3px 3px 0 #08312e" }}>
            LIVE SMS DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Get a simulated scam text on your real phone.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #4ecdc4", boxShadow: "3px 3px 0 #4ecdc4", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We text your registered number.",
            "It reads like a scam — that's the point.",
            "Spot the red flags in your real messages app.",
            "A follow-up text reveals it was a drill.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#4ecdc4", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "rgba(255,230,109,0.08)" : "rgba(0,255,136,0.08)", border: `3px solid ${deliveryUnconfirmed ? "#ffe66d" : "#00ff88"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="#ffe66d" /> : <IconShield size={16} color="#00ff88" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: deliveryUnconfirmed ? "#ffe66d" : "#00ff88", marginBottom: 6 }}>
                {deliveryUnconfirmed ? "TEXT DELIVERY NOT CONFIRMED" : "TEXT REQUEST ACCEPTED"}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? drillId
                    ? "The provider may have accepted the text, but SafeSpace could not confirm it. Do not resend. If it arrives, use the actions below; a reveal text should follow."
                    : "Delivery is unknown and the drill ID could not be recovered. Do not resend. If the text arrives, its safety reveal should still follow, but this attempt cannot be scored in the app."
                  : "Check your messages, then come back and tell us how it went — a reveal text also follows to confirm it was a drill."}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d", marginBottom: 4 }}>REGISTER FIRST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                Verify your phone so the drill only ever texts the number you own.
              </div>
            </div>
          </div>
        ) : null}

        {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff2d55", marginBottom: 12 }}>{msg}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            drillId ? <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#ffe66d", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {deliveryUnconfirmed ? "IF THE TEXT ARRIVED, HOW DID IT GO?" : "HOW DID IT GO?"}
              </div>
              <PixelButton onClick={() => complete("reported")} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={completing || !drillId}>[ {deliveryUnconfirmed ? "IF IT ARRIVED: I SPOTTED IT" : "I SPOTTED THE SCAM"} ]</PixelButton>
              <PixelButton onClick={() => complete("clicked_link")} color="#ff2d55" textColor="#ffffff" size="md" full disabled={completing || !drillId}>{deliveryUnconfirmed ? "IF IT ARRIVED: I CLICKED / REPLIED" : "I CLICKED / REPLIED"}</PixelButton>
            </> : (
              <PixelButton onClick={onBack} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ DONE — DO NOT RESEND ]</PixelButton>
            )
          ) : registered ? (
            // This is an explicit, consented manual send. The schedule only limits
            // surprise drills; applying it here made "TEXT ME NOW" unusable for most
            // of the day even though the SMS service itself was healthy.
            <PixelButton onClick={sendText} color="#4ecdc4" textColor="#0a0e1a" size="lg" full disabled={phase === "sending"}>
              {phase === "sending" ? "SENDING..." : "[ TEXT ME NOW ]"}
            </PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>[ REGISTER TO CONTINUE ]</PixelButton>
          )}
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC EMAIL DRILL INTRO — explains flow, disabled until backend
// ─────────────────────────────────────────────────────────────────────────
function RealisticEmailDrillIntroScreen({ onBack, onRegister, onOutcome, scheduleBlocked, scheduleNextLabel }: {
  onBack: () => void;
  onRegister: () => void;
  onOutcome: (drillId: string, outcome: "reported" | "submitted_details") => Promise<RealDrillCompletion>;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  // "idle" shows the intro; tapping send opens the email popup (or nudges to register if
  // there's no session). "sent" is the success state.
  const [phase, setPhase] = useState<"idle" | "ask-email" | "verify-email" | "sent">("idle");
  const [email, setEmail] = useState(() => loadContact().email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);

  const registered = !!sessionToken();

  const onSendTap = () => {
    setMsg("");
    setPhase("ask-email");
  };

  const startEmailVerification = async () => {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setMsg("Enter a valid email address."); return; }
    setBusy(true); setMsg("");
    try {
      const verify = await fetch("/api/me/email/verification/start", {
        method: "POST", headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: addr }),
      });
      handleApiAuth(verify);
      const data = await verify.json().catch(() => ({}));
      if (!verify.ok || data.ok === false) {
        setMsg(data.error || "Could not send the verification email.");
        setBusy(false);
        return;
      }
      const contact = loadContact();
      saveContact({ ...contact, email: addr });
      if (data.verified) {
        setMsg("That inbox is already verified. Sending your drill...");
        await checkVerificationAndSend();
        return;
      }
      setPhase("verify-email");
      setMsg("Verification sent. Open the link in that inbox, then return here.");
    } catch {
      setMsg("The connection dropped, so the verification email may still arrive. Check your inbox before trying again.");
    }
    setBusy(false);
  };

  const checkVerificationAndSend = async () => {
    setBusy(true);
    setMsg("");
    setDeliveryUnconfirmed(false);
    let fireRequestStarted = false;
    try {
      const status = await fetch("/api/me/email/status", { headers: { ...authHeaders() } });
      handleApiAuth(status);
      const statusData = await status.json().catch(() => ({}));
      if (!status.ok) {
        setMsg(statusData.error || "Could not check email verification.");
        setBusy(false);
        return;
      }
      if (!statusData.verified) {
        setMsg("Not verified yet. Click the link in your email, then check again.");
        setBusy(false);
        return;
      }

      fireRequestStarted = true;
      const fire = await fetch("/api/drills/email", { method: "POST", headers: { ...authHeaders() } });
      handleApiAuth(fire);
      const fd = await fire.json().catch(() => ({}));
      if (!fire.ok || fd.ok === false) {
        setMsg(fd.error === "email drills are not configured"
          ? "Email delivery isn't configured on this server yet."
          : (fd.error || "Could not send the email."));
        setBusy(false); return;
      }
      const id = fd.drillId ?? fd.attemptId ?? fd.attempt?.id ?? fd.record?.id ?? fd.id;
      if (!id) {
        setMsg("The email request may have been accepted, but its drill ID was missing. Do not resend; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setPhase("sent");
        setBusy(false);
        return;
      }
      setDeliveryUnconfirmed(fd.deliveryConfirmed === false || fd.status === "delivery-unconfirmed");
      setDrillId(id);
      setPhase("sent");
    } catch {
      if (fireRequestStarted) {
        setMsg("The connection dropped while sending, so delivery is unknown. Do not resend; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setPhase("sent");
      } else {
        setMsg("Network error — check your connection.");
      }
    }
    setBusy(false);
  };

  const complete = async (outcome: "reported" | "submitted_details") => {
    if (!drillId || busy) return;
    setBusy(true);
    setMsg("");
    const result = await onOutcome(drillId, outcome);
    if (!result.ok) setMsg(result.error || "Could not save this result. Please try again.");
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL EMAIL DRILL" titleColor="#ff6b35" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(255,107,53,0.8))" }}>
            <IconRealEmail size={64} color="#ff6b35" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35", textAlign: "center", textShadow: "3px 3px 0 #4a1a08" }}>
            REAL INBOX DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#ffe66d", textAlign: "center", lineHeight: 1.4 }}>
            Get a simulated phishing email in your real mailbox.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #ff6b35", boxShadow: "3px 3px 0 #ff6b35", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ff6b35", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We send a test email to your own address.",
            "It looks like a scam — that's the point.",
            "Spot the red flags in your real email client.",
            "Every drill email has a reveal + report link.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#ff6b35", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "rgba(255,230,109,0.08)" : "rgba(0,255,136,0.08)", border: `3px solid ${deliveryUnconfirmed ? "#ffe66d" : "#00ff88"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="#ffe66d" /> : <IconShield size={16} color="#00ff88" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: deliveryUnconfirmed ? "#ffe66d" : "#00ff88", marginBottom: 6 }}>
                {deliveryUnconfirmed ? "EMAIL DELIVERY NOT CONFIRMED" : "EMAIL REQUEST ACCEPTED"}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? drillId
                    ? "The provider may have accepted the email, but SafeSpace could not confirm it. Do not resend. If it arrives, handle it normally and use the actions below."
                    : "Delivery is unknown and the drill ID could not be recovered. Do not resend. If the email arrives, use its signed reveal or report link; this app screen cannot score it."
                  : "Check your inbox (and spam), handle it as you would a real one, then tell us how it went below."}
              </div>
            </div>
          </div>
        ) : phase === "verify-email" ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconRealEmail size={16} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffe66d", marginBottom: 6 }}>VERIFY YOUR INBOX</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                We sent a verification link to {email}. Click it before sending a drill.
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d", marginBottom: 4 }}>REGISTER FIRST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>
                Verify your phone so drills go only to you — never to an address someone types in.
              </div>
            </div>
          </div>
        ) : null}

        {msg && phase !== "ask-email" && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: msg.startsWith("Verification sent") ? "#00ff88" : "#ff6b35", marginBottom: 12, lineHeight: 1.5 }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            drillId ? <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#ffe66d", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {deliveryUnconfirmed ? "IF THE EMAIL ARRIVED, HOW DID IT GO?" : "HOW DID IT GO?"}
              </div>
              <PixelButton onClick={() => complete("reported")} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={busy || !drillId}>[ {deliveryUnconfirmed ? "IF IT ARRIVED: I SPOTTED IT" : "I SPOTTED THE SCAM"} ]</PixelButton>
              <PixelButton onClick={() => complete("submitted_details")} color="#ff2d55" textColor="#ffffff" size="md" full disabled={busy || !drillId}>{deliveryUnconfirmed ? "IF IT ARRIVED: I CLICKED / REPLIED" : "I CLICKED / REPLIED"}</PixelButton>
            </> : (
              <PixelButton onClick={onBack} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ DONE — DO NOT RESEND ]</PixelButton>
            )
          ) : phase === "verify-email" ? (
            <>
              <PixelButton onClick={checkVerificationAndSend} color="#ffe66d" textColor="#0a0e1a" size="lg" full disabled={busy}>
                {busy ? "CHECKING..." : "[ CHECK VERIFICATION & SEND ]"}
              </PixelButton>
              <PixelButton onClick={() => { setPhase("ask-email"); setMsg(""); }} color="#1a2340" textColor="#6b8ba4" size="sm" full disabled={busy}>USE A DIFFERENT EMAIL</PixelButton>
            </>
          ) : registered && scheduleBlocked ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ffe66d", textAlign: "center", lineHeight: 1.5 }}>
                OUTSIDE YOUR DRILL WINDOW · OPENS {scheduleNextLabel}
              </div>
              <PixelButton onClick={() => {}} color="#1a2340" textColor="#6b8ba4" size="lg" full disabled>[ SEND DRILL EMAIL ]</PixelButton>
            </>
          ) : registered ? (
            <PixelButton onClick={onSendTap} color="#ff6b35" textColor="#0a0e1a" size="lg" full>[ SEND DRILL EMAIL ]</PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>[ REGISTER TO CONTINUE ]</PixelButton>
          )}
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>

      {/* The inbox must be verified through a link before the drill can be sent. */}
      {phase === "ask-email" && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }} onClick={() => !busy && setPhase("idle")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, backgroundColor: "#0a0e1a", border: "4px solid #ff6b35", boxShadow: "6px 6px 0 rgba(255,107,53,0.4)", padding: "18px 16px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ff6b35", marginBottom: 10 }}>YOUR EMAIL</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4", marginBottom: 12, lineHeight: 1.5 }}>
              We'll email a verification link first. The drill can only be sent after the inbox owner clicks it.
            </div>
            <input
              autoFocus value={email} inputMode="email" autoCapitalize="none" placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) startEmailVerification(); }}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "'Share Tech Mono', monospace", fontSize: 15, color: "#e8f4f8", background: "#111827", border: "3px solid #2a3a5c", padding: "10px 12px", outline: "none", marginBottom: 10 }}
            />
            {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff2d55", marginBottom: 10 }}>{msg}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><PixelButton onClick={startEmailVerification} color="#ff6b35" textColor="#0a0e1a" size="sm" full disabled={busy}>{busy ? "SENDING..." : "[ VERIFY ]"}</PixelButton></div>
              <div style={{ flex: 1 }}><PixelButton onClick={() => { if (!busy) { setPhase("idle"); setMsg(""); } }} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>CANCEL</PixelButton></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FAMILY HOME — types & data
// ─────────────────────────────────────────────────────────────────────────

const INITIAL_CHAT: ChatMsg[] = [
  { memberId:"pixi", isPixi:true, text:"Hi family! I'm PIXI, your scam-fighter coach. I'll drop by after drills to share tips and celebrate wins.", time:"9:12 AM" },
  { memberId:"grandma", text:"Did everyone do their drill this week? I spotted three red flags in mine!", time:"9:14 AM" },
  { memberId:"mum",     text:"Yes! The IRS one was really convincing. I almost fell for the urgency tactic.", time:"9:16 AM" },
  { memberId:"dad",     text:"I missed the 'officer dispatch' red flag. I want to practise that one again.", time:"9:18 AM" },
  { memberId:"mum",     text:"Don't be hard on yourself, Dad. That's exactly what they count on!", time:"9:19 AM" },
  { memberId:"grandma", text:"Remember — hang up first, verify later. That's the rule.", time:"9:21 AM" },
  { memberId:"kid",     text:"My teacher told us about gift card scams today at school! Just like in the app.", time:"9:24 AM" },
];

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


// ─────────────────────────────────────────────────────────────────────────
// SCREEN: INCOMING CALL
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// SCREEN: CALL
// ─────────────────────────────────────────────────────────────────────────




// ─────────────────────────────────────────────────────────────────────────
// SMS SCREENS
// ─────────────────────────────────────────────────────────────────────────










// ─────────────────────────────────────────────────────────────────────────
// EMAIL SCREENS
// ─────────────────────────────────────────────────────────────────────────










// ─────────────────────────────────────────────────────────────────────────
// SCAM REASON SECTION
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: RESULT
// ─────────────────────────────────────────────────────────────────────────
function getResultContent(
  win: boolean,
  drillType: DrillType,
  smsOutcome: SmsOutcome | null,
  emailOutcome: EmailOutcome | null,
  callOutcome: CallOutcome | null,
) {
  if (drillType === "call") {
    const liveContent: Partial<Record<CallOutcome, { header: string; feedback: string }>> = {
      hung_up: {
        header: "CALL ENDED SAFELY!",
        feedback: "You refused the request and ended the call. That breaks the scammer's pressure loop.",
      },
      disengaged: {
        header: "VERIFIED SAFELY!",
        feedback: "You disengaged and chose an independent, official way to verify the story. That's the safest response.",
      },
      caught_flag: {
        header: "RED FLAG SPOTTED!",
        feedback: "You recognised the suspicious behaviour. Next time, end the call immediately and verify through an official channel.",
      },
      complied: {
        header: "LET'S REVIEW",
        feedback: "You agreed to an unsafe instruction. Pause before acting, end the call, and verify independently—even when the caller sounds official.",
      },
      shared_data: {
        header: "SENSITIVE DATA SHARED",
        feedback: "The drill detected that sensitive information or a completed payment was shared. A real caller should never receive an OTP, PIN, password or transfer.",
      },
    };
    if (callOutcome && liveContent[callOutcome]) {
      return {
        ...liveContent[callOutcome]!,
        xp: win ? 50 : 0,
        flags: LIVE_CALL_FLAGS,
      };
    }
    return {
      header: win ? "DRILL COMPLETE!" : "LET'S REVIEW",
      xp: win ? 50 : 0,
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
      return { header: "SCAM BLOCKED!", xp: 50, feedback, flags: SMS_FLAGS };
    }
    return { header: "LINK OPENED — REVIEW", xp: 0, feedback: "You tapped the link and reached a fake payment page. Scammers often use small fees to steal card details.", flags: SMS_FLAGS };
  }
  if (win) {
    const feedback =
      emailOutcome === "asked-family" ? "You paused and verified before trusting the email." :
      emailOutcome === "cancelled-download" ? "You stopped the download before opening the file." :
      "You inspected the email before clicking. Reporting phishing protects both you and your family.";
    return { header: "PHISHING REPORTED!", xp: 50, feedback, flags: EMAIL_FLAGS };
  }
  if (emailOutcome === "opened-attachment") {
    return { header: "ATTACHMENT OPENED", xp: 0, feedback: "You opened a suspicious ZIP attachment. Attachments can hide malware or fake forms.", flags: EMAIL_FLAGS };
  }
  return { header: "DETAILS ENTERED — REVIEW", xp: 0, feedback: "You submitted details on a fake login page. Scammers use official-looking forms to steal passwords, IDs, and OTPs.", flags: EMAIL_FLAGS };
}

function ResultScreen({ win, drillType, smsOutcome, emailOutcome, callOutcome, profileName, activeMemberId, onPlayAgain, onGoHome, xpOverride }: { win: boolean; drillType: DrillType; smsOutcome: SmsOutcome | null; emailOutcome: EmailOutcome | null; callOutcome: CallOutcome | null; profileName: string; activeMemberId: string; onPlayAgain: () => void; onGoHome: () => void; xpOverride?: number | null }) {
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowDetails(true), 700); return () => clearTimeout(t); }, []);

  const { header, xp, feedback, flags } = getResultContent(win, drillType, smsOutcome, emailOutcome, callOutcome);
  const drillLabel = drillType === "call" ? "CALL" : drillType === "sms" ? "SMS" : "EMAIL";
  const member = MEMBER_MAP[activeMemberId];
  const resultName = drillType === "call" && callOutcome ? profileName : member?.name;
  const resultNameColor = drillType === "call" && callOutcome ? "#4ecdc4" : member?.primaryColor;
  // Missing a red flag is already the learning signal. Never take away a user's
  // furniture currency for being fooled during a training exercise.
  const coinReward = win
    ? (drillType === "call" ? 50 : drillType === "sms" ? 40 : 60)
    : (drillType === "call" ? -25 : drillType === "sms" ? -20 : -30);
  const displayedXp = xpOverride ?? xp;

  return (
    <div style={{ position: "relative", height: "100%", overflowY: "auto", scrollbarWidth: "none" }}>
      <Stars />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "32px 20px 36px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4", letterSpacing: 2 }}>
            {drillLabel} DRILL — {win ? "SUCCESS" : "REVIEW"}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: win ? 24 : 20, color: win ? "#00ff88" : "#ff2d55", textShadow: win ? "4px 4px 0 #006633, 0 0 30px rgba(0,255,136,0.7)" : "4px 4px 0 #660011, 0 0 30px rgba(255,45,85,0.7)", textAlign: "center", lineHeight: 1.3 }}>
            {header}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: 22, color: win ? "#4ecdc4" : "#ff6b35", textAlign: "center" }}>
            {win ? '"Great instinct!"' : '"Let’s learn from this."'}
          </div>
          {resultName && resultNameColor && (
            <div style={{ marginTop: 4, padding: "4px 10px", border: `2px solid ${resultNameColor}`, backgroundColor: `${resultNameColor}11`, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4" }}>FOR:</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: resultNameColor }}>{resultName}</div>
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
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: win ? "#00ff88" : "#ff2d55", marginBottom: 12, textAlign: "center" }}>
                === RESULTS ===
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>XP GAINED</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: displayedXp >= 0 ? "#ffe66d" : "#ff2d55" }}>{displayedXp >= 0 ? "+" : ""}{displayedXp}</div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>COINS</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconCoin size={12} color={coinReward >= 0 ? "#ffe66d" : "#ff2d55"} />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: coinReward >= 0 ? "#00ff88" : "#ff2d55" }}>
                    {coinReward >= 0 ? `+${coinReward}` : coinReward}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-3">
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>STREAK</div>
                <div className="flex items-center gap-2">
                  {win ? <IconFlame size={14} color="#ff6b35" /> : <IconBulb size={14} color="#ffe66d" />}
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: win ? "#ff6b35" : "#ff2d55" }}>
                    {win ? "EXTENDED" : "READY TO REBUILD"}
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
          <PixelButton onClick={onPlayAgain} color={win ? "#00ff88" : "#ff6b35"} size="lg" full>[ PLAY ANOTHER DRILL ]</PixelButton>
          <PixelButton onClick={onGoHome} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK TO HOME</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────
function LeaderboardScreen() {
  const [tab, setTab] = useState<"fame" | "practice">("fame");
  return (
    <div className="flex flex-col h-full">
      <div className="flex" style={{ borderBottom: "4px solid #2a3a5c" }}>
        <button onClick={() => setTab("fame")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "fame" ? "#1a3a2a" : "#0a0e1a", border: "none", borderBottom: tab === "fame" ? "4px solid #00ff88" : "4px solid transparent", cursor: "pointer" }}>
          <IconTrophy size={16} color={tab === "fame" ? "#00ff88" : "#2a3a5c"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: tab === "fame" ? "#00ff88" : "#2a3a5c" }}>HALL OF FAME</div>
        </button>
        <div style={{ width: 4, backgroundColor: "#2a3a5c" }} />
        <button onClick={() => setTab("practice")} className="flex-1 flex flex-col items-center justify-center gap-1 py-3" style={{ backgroundColor: tab === "practice" ? "#1a0a10" : "#0a0e1a", border: "none", borderBottom: tab === "practice" ? "4px solid #ff6b35" : "4px solid transparent", cursor: "pointer" }}>
          <IconBulb size={16} color={tab === "practice" ? "#ff6b35" : "#2a3a5c"} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: tab === "practice" ? "#ff6b35" : "#2a3a5c" }}>PRACTICE BOARD</div>
        </button>
      </div>
      {tab === "fame" ? <FameBoard /> : <LearningBoard />}
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
      <div className="mx-4 mt-3 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "rgba(0,255,136,0.08)", border: "3px solid #00ff88" }}>
        <PixelMascot size={28} />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#00ff88", marginBottom: 4 }}>TRAINING PROGRESS</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#8da4b8", lineHeight: 1.5 }}>Ranks celebrate safe practice. Registered accounts see only their own entry and the demo family.</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {board.map((p) => (
          <div key={p.rank} className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: "#111827", border: `3px solid ${p.rank <= 3 ? ["#ffe66d", "#c0c0c0", "#cd7f32"][p.rank - 1] : "#2a3a5c"}`, boxShadow: p.rank <= 3 ? `3px 3px 0px ${["#ffe66d", "#c0c0c0", "#cd7f32"][p.rank - 1]}` : "none" }}>
            <div className="flex items-center justify-center" style={{ width: 28 }}>
              {p.rank <= 3 ? <IconMedal rank={p.rank} size={20} /> : <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4" }}>#{p.rank}</div>}
            </div>
            <PixelAvatar rank={p.rank} size={28} />
            <div className="flex-1">
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#e8f4f8" }}>{p.name}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", marginTop: 2 }}>{p.wins} WINS · {p.area}</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4" }}>{p.score.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LearningBoard() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="mx-4 mt-3 px-3 py-3 flex items-center gap-3" style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35" }}>
        <IconBulb size={18} color="#ffe66d" />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ff6b35", marginBottom: 4 }}>SAFETY HABITS</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#8da4b8", lineHeight: 1.5 }}>A missed drill is private. Use it to practise the next response—never to rank or shame someone.</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {SAFETY_TIPS.map((tip) => (
          <div key={tip.title} className="flex items-start gap-3 px-3 py-3" style={{ backgroundColor: "#111827", border: `3px solid ${tip.color}` }}>
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: `${tip.color}18`, border: `2px solid ${tip.color}`, fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: tip.color }}>
              {tip.num}
            </div>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: tip.color, marginBottom: 5 }}>{tip.title}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#b4c6d4", lineHeight: 1.5 }}>{tip.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: STORE — Phase 3 real implementation
// Persistent member-picker header; per-member wallet + purchase state.
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PROFILE — EDIT button lives inside profile card (per user edit)
// ─────────────────────────────────────────────────────────────────────────

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
    title: "TRAIN TOGETHER",
    body: "The family drill runs the whole household through six scam scenarios in one sitting — one round per person.",
  },
  {
    target: "nav-drill",
    accent: "#00ff88",
    title: "PICK A DRILL",
    body: "This button is the heart of it. Choose a call, SMS or email drill, spot the red flags, then report, ask family, or hang up.",
  },
  {
    target: "bottom-nav",
    accent: "#c77dff",
    title: "EXPLORE",
    body: "Climb the leaderboard in RANKS, spend your coins in STORE, and customise your character in PROFILE.",
  },
  {
    target: null,
    accent: "#ffe66d",
    title: "ALWAYS SAFE",
    body: "Every drill ends by telling you it was a drill, and you're NEVER punished for stopping. Say 'stop' or 'is this a drill?' any time and it ends — no penalty.",
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
  innerRef?: React.RefObject<HTMLDivElement>;
}) {
  const last = index === total - 1;
  return (
    <div ref={innerRef} style={{ position: "fixed", zIndex: 10001, width: 300, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: -4 }}>
        <PixelMascot size={44} animate />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: step.accent, paddingBottom: 10 }}>
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
            {index > 0 && <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm">BACK</PixelButton>}
            <PixelButton onClick={onNext} color={step.accent} size="sm">{last ? "DONE" : "NEXT"}</PixelButton>
          </div>
        </div>
      </div>
      <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 2px" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>SKIP TOUR</div>
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
function RegisterScreen({ onDone, onBack }: { onDone: (name: string) => void; onBack: () => void }) {
  // Seed from saved contact so returning users don't retype their details.
  const saved = loadContact();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(saved.phone);
  const [name, setName] = useState(saved.name);
  const [email, setEmail] = useState(saved.email);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const validName = /^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u.test(name.trim());

  // Explicit save — persist the details locally without sending an OTP. Lets the user
  // store their email for email drills, or keep a number on file, before verifying.
  const handleSave = () => {
    if (!validName) {
      setMsg("Enter your name using letters, spaces, apostrophes or hyphens.");
      return;
    }
    saveContact({ name: name.trim(), phone: phone.trim(), email: email.trim() });
    setMsg("SAVED — details stored on this device.");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px", backgroundColor: "#0a0e1a",
    border: "3px solid #2a3a5c", color: "#e8f4f8",
    fontFamily: "'Share Tech Mono', monospace", fontSize: 16, outline: "none",
  };
  const label = (t: string) => (
    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4", marginBottom: 8 }}>{t}</div>
  );

  async function sendCode() {
    if (!validName) {
      setMsg("Your name is required before verification.");
      return;
    }
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
    if (!validName) {
      setMsg("Your name is required before verification.");
      setStep("phone");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/verify/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code, name, email: email.trim() || undefined }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { setMsg(d.error || "Incorrect code"); setBusy(false); return; }
      // Store the server-issued session token — this is what authorises real drills.
      if (d.token) setSessionToken(d.token);
      // Persist the verified details so they're remembered and available to email drills.
      const verifiedName = typeof d.name === "string" && d.name.trim()
        ? d.name.trim()
        : name.trim();
      saveContact({ name: verifiedName, phone: phone.trim(), email: email.trim() });
      setMsg("VERIFIED! You're registered.");
      setTimeout(() => onDone(verifiedName), 1000);
    } catch { setMsg("Network error"); }
    setBusy(false);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#4ecdc4" }}>REGISTER</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#2a3a5c" }}>OPT IN</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: 18, color: "#6b8ba4", lineHeight: 1.3 }}>
          Verify your phone to opt in to real practice scam calls. We only ever call this number, and you can stop anytime.
        </div>
        <PixelPanel accent="#4ecdc4" className="w-full">
          {step === "phone" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label("YOUR NAME (REQUIRED)")}<input required maxLength={30} aria-required="true" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="JUDGE" autoComplete="name" /></div>
              <div>{label("PHONE NUMBER")}<input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+6591234567" inputMode="tel" /></div>
              <div>{label("EMAIL (OPTIONAL — FOR EMAIL DRILLS)")}<input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoCapitalize="none" /></div>
              <PixelButton onClick={sendCode} color="#4ecdc4" size="lg" full disabled={busy}>{busy ? "SENDING..." : "[ SEND CODE ]"}</PixelButton>
              <PixelButton onClick={handleSave} color="#1a2340" textColor="#4ecdc4" size="sm" full disabled={busy}>[ SAVE DETAILS ]</PixelButton>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label(`CODE SENT TO ${phone}`)}<input style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: 22 }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" /></div>
              {devCode && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffe66d", textAlign: "center" }}>DEV CODE: {devCode}</div>}
              <PixelButton onClick={verify} color="#00ff88" size="lg" full disabled={busy || code.length < 6}>{busy ? "CHECKING..." : "[ VERIFY ]"}</PixelButton>
              <PixelButton onClick={() => { setStep("phone"); setMsg(""); }} color="#1a2340" textColor="#6b8ba4" size="sm" full>CHANGE NUMBER</PixelButton>
            </div>
          )}
          {msg && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: msg.includes("VERIFIED") ? "#00ff88" : "#ff6b35", textAlign: "center" }}>{msg}</div>}
        </PixelPanel>
        <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK</PixelButton>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────
// FAMILY DRILL SCENARIOS
// ─────────────────────────────────────────────────────────────────────────

// Maps FamilyScenario.targetMember (title case) to member id


// ─────────────────────────────────────────────────────────────────────────
// PIXEL TOGGLE / RADIO
// ─────────────────────────────────────────────────────────────────────────






// ─────────────────────────────────────────────────────────────────────────
// INSPECTABLE LINK
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// SENDER INSPECT PANEL
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// CLUE TOOLTIP
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// ANIMATED FAMILY CHARACTER
// ─────────────────────────────────────────────────────────────────────────


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
        <div style={{ fontFamily: "monospace", fontSize: 12, color: "#aaa" }}>9:41</div>
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
          <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "#888" }}>Tap to inspect sender</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#4ecdc4", border: "1px solid #4ecdc4", padding: "2px 4px", flexShrink: 0 }}>INFO</div>
      </button>
      <div style={{ backgroundColor: "#f5f5f7", padding: "12px 10px", minHeight: 100 }}>
        <div style={{ textAlign: "center", fontFamily: "sans-serif", fontSize: 11, color: "#999", marginBottom: 10 }}>{scenario.timestamp}</div>
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
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00ff88" }}>FAMILY DRILL</div>
        <div className="flex items-center gap-2"><IconShield size={14} color="#00ff88" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#00ff88" }}>4/4 READY</div></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6" style={{ scrollbarWidth: "none" }}>
        <div style={{ margin: "14px 0", backgroundColor: "#111827", border: "3px solid #00ff88", padding: "10px 14px" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><IconShield size={14} color="#00ff88" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#00ff88" }}>FAMILY TRUST</div></div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ffe66d" }}>100%</div>
          </div>
          <div style={{ height: 8, backgroundColor: "#0a0e1a", border: "2px solid #2a3a5c" }}>
            <div style={{ height: "100%", width: "100%", backgroundColor: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
          </div>
        </div>
        <div className="flex justify-center gap-2 mb-4">
          {["Grandma", "Mum", "Dad", "Kid"].map((name) => (
            <div key={name} className="flex flex-col items-center gap-1">
              <AnimatedFamilyChar name={name} size={44} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 3, color: "#4ecdc4" }}>{name.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffffff", textAlign: "center", marginBottom: 12, lineHeight: 1.8 }}>
          Protect the whole household from scams.
        </div>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#4ecdc4", marginBottom: 8 }}>HOW IT WORKS</div>
          {["Each family member faces a suspicious message.", "Inspect links and senders before deciding.", "Some messages are safe — read carefully!", "Wrong choices teach you what to watch for."].map((line, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 6, height: 6, backgroundColor: "#00ff88", flexShrink: 0, marginTop: 4 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.5 }}>{line}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "6px 8px", backgroundColor: "rgba(255,230,109,0.08)", border: "2px solid #ffe66d", display: "flex", alignItems: "center", gap: 6 }}>
            <IconCoin size={10} color="#ffe66d" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#ffe66d" }}>+30 COINS PER CORRECT · -10 PER WRONG</div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <PixelButton onClick={onStart} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ START FAMILY DRILL ]</PixelButton>
          <PixelButton onClick={() => setShowHowTo(true)} color="#ffe66d" textColor="#0a0e1a" size="sm" full>[ HOW TO PLAY ]</PixelButton>
          <PixelButton onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK HOME ]</PixelButton>
        </div>
      </div>
      {showHowTo && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.88)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
          <div style={{ backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "4px 4px 0 #4ecdc4", width: "100%" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#4ecdc4" }}>HOW TO PLAY</div>
              <button onClick={() => setShowHowTo(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              {[["TAP SENDER", "Inspect sender identity and domain."], ["LONG-PRESS LINKS", "Reveal the actual URL before opening."], ["TAP CLUE TAGS", "Uncover red flags in the message."], ["READ CAREFULLY", "Not every message is a scam."], ["CHOOSE SAFELY", "Pick the best action for the family."]].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-3">
                  <IconBulb size={12} color="#ffe66d" />
                  <div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d", marginBottom: 2 }}>{title}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", lineHeight: 1.4 }}>{desc}</div></div>
                </div>
              ))}
              <PixelButton onClick={() => setShowHowTo(false)} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>GOT IT</PixelButton>
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

// "Ask family first" is cautious, not scammed. For a family anti-scam app, punishing
// the instinct to check with someone teaches the wrong lesson — and the SMS/email drills
// already praise that same instinct ("Good thinking!"), so the family drill has to agree.
// It's a partial win: safe framing, half XP, no coin penalty, plus a nudge toward the
// ideal action. Only "correct" counts toward the family-safe tally.

function familyOutcome(scenario: FamilyScenario, action: string | null): FamilyOutcome {
  if (action === null) return "wrong";
  if (action === scenario.correctAction || (scenario.id === 4 && action === "REPORT AS SCAM")) return "correct";
  if (action === "ASK FAMILY FIRST") return "cautious";
  return "wrong";
}

const FAMILY_XP: Record<FamilyOutcome, number> = { correct: 100, cautious: 50, wrong: 25 };
const FAMILY_COINS: Record<FamilyOutcome, number> = { correct: 30, cautious: 0, wrong: 0 };

function FamilyRoundScreen({ scenario, roundIndex, totalRounds, onComplete, onNext, onEnd }: {
  scenario: FamilyScenario; roundIndex: number; totalRounds: number;
  onComplete: (action: string, foundClues: number[], outcome: FamilyOutcome) => void;
  onNext: () => void; onEnd: () => void;
}) {
  const [mode, setMode] = useState<"play" | "debrief">("play");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [lightbulbIdx, setLightbulbIdx] = useState(-1);
  const [activeClue, setActiveClue] = useState<FamilyClue | null>(null);
  const [showSenderPanel, setShowSenderPanel] = useState(false);
  const [foundCluesLocal, setFoundCluesLocal] = useState<number[]>([]);

  // The correct answer used to be authored first in every scenario's `actions`, so it
  // always landed top-left — players learned "just tap the first button". Shuffle the
  // display order per scenario (outcome is matched by label, not index, so this is safe).
  const displayActions = useMemo(() => {
    const a = [...scenario.actions];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }, [scenario.id]);

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

  const handleAction = (action: string) => {
    if (mode !== "play") return;
    setSelectedAction(action);
    setMode("debrief");
    onComplete(action, foundCluesLocal, familyOutcome(scenario, action));
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
  const outcome = familyOutcome(scenario, selectedAction);

  const EmailCard = () => (
    <div style={{ border: `4px solid ${color}`, boxShadow: `4px 4px 0 ${color}` }}>
      <div style={{ backgroundColor: "#e8e8e8", borderBottom: "2px solid #ccc", padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, backgroundColor: "#ff5f57", borderRadius: "50%" }} />
        <div style={{ width: 8, height: 8, backgroundColor: "#febc2e", borderRadius: "50%" }} />
        <div style={{ width: 8, height: 8, backgroundColor: "#28c840", borderRadius: "50%" }} />
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", marginLeft: 6 }}>{typeLabels[scenario.type]}</div>
      </div>
      <button onClick={() => setShowSenderPanel(true)} style={{ width: "100%", padding: "10px 12px", backgroundColor: "#f9f9f9", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 32, height: 32, backgroundColor: scenario.isScam ? "#f4a261" : "#4ecdc4", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", flexShrink: 0 }}>
          <span style={{ fontFamily: "sans-serif", fontSize: 14, fontWeight: "bold", color: "#fff" }}>{scenario.sender[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 600, color: "#1a1a1a" }}>
            {scenario.sender}
            {scenario.senderEmail && <span style={{ fontWeight: 400, color: "#888", fontSize: 12 }}> &lt;{scenario.senderEmail}&gt;</span>}
          </div>
          {scenario.subject && <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#555", fontWeight: 600, marginTop: 1 }}>{scenario.subject}</div>}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#4ecdc4", border: "1px solid #4ecdc4", padding: "2px 4px", flexShrink: 0 }}>INSPECT</div>
      </button>
      <div style={{ padding: "12px 14px", backgroundColor: "#fff" }}>
        <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#1a1a1a", lineHeight: 1.6, marginBottom: 8 }}>{scenario.message}</div>
        {scenario.invoiceDetails && (
          <div style={{ margin: "10px 0", backgroundColor: "#f8f8f8", border: "1px solid #ddd", padding: "12px" }}>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 700, color: "#333", marginBottom: 8 }}>Invoice details</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#888", marginBottom: 2 }}>Amount requested</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 14, fontWeight: 700, color: "#333", marginBottom: 8 }}>{scenario.invoiceDetails.amount}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#888", marginBottom: 4 }}>Note from seller</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#c0392b", lineHeight: 1.5 }}>{scenario.invoiceDetails.noteFromSeller}</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#888", marginTop: 8 }}>Invoice number</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#333" }}>{scenario.invoiceDetails.invoiceNumber}</div>
          </div>
        )}
        {scenario.id === 6 && (
          <div style={{ margin: "10px 0", border: "1px solid #e0e0e0", backgroundColor: "#f9f9f9", padding: "10px" }}>
            <div className="flex items-center gap-2 mb-2">
              <div style={{ width: 18, height: 18, backgroundColor: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>D</span>
              </div>
              <div style={{ fontFamily: "sans-serif", fontSize: 12, fontWeight: 600, color: "#333" }}>2026 Department Budget</div>
            </div>
            <div style={{ height: 40, backgroundColor: "#e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
              <span style={{ color: "#4285f4", fontSize: 20, fontWeight: "bold" }}>≡</span>
            </div>
            <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#888" }}>Luke Johnson is the owner · Last edited 1 hour ago</div>
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
    <div className="flex flex-col h-full" style={{ position: "relative", background: inDebrief ? (outcome === "wrong" ? "linear-gradient(180deg,#1a0a0f,#0a0e1a)" : "linear-gradient(180deg,#0a1a0f,#0a0e1a)") : undefined }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 48, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4" }}>ROUND {roundIndex + 1}/{totalRounds}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#ffe66d" }}>
          {inDebrief ? "DEBRIEF" : `${foundCluesLocal.length}/${scenario.clues.length} CLUES`}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-2" style={{ backgroundColor: "#111827", borderBottom: `4px solid ${color}`, flexShrink: 0 }}>
        <AnimatedFamilyChar name={scenario.targetMember} size={36} />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4" }}>TARGET:</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color }}>{scenario.targetMember.toUpperCase()}</div>
        </div>
        <div style={{ marginLeft: "auto", backgroundColor: "rgba(255,107,53,0.1)", border: `2px solid ${color}`, padding: "3px 7px" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color }}>{typeLabels[scenario.type] ?? "MSG"}</div>
        </div>
      </div>
      {inDebrief && (() => {
        // Three states, so "ask family first" reads as cautious rather than scammed.
        const banner = {
          correct:  { title: "SAFE CHOICE!",   color: "#00ff88", bg: "rgba(0,255,136,0.15)" },
          cautious: { title: "CAUTIOUS — SMART", color: "#ffe66d", bg: "rgba(255,230,109,0.15)" },
          wrong:    { title: "LET'S REVIEW",   color: "#ff6b35", bg: "rgba(255,107,53,0.15)" },
        }[outcome];
        const coins = FAMILY_COINS[outcome];
        return (
        <div style={{ backgroundColor: banner.bg, borderBottom: `4px solid ${banner.color}`, padding: "10px 16px", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: banner.color, marginBottom: 4 }}>
            {banner.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffe66d" }}>+{FAMILY_XP[outcome]} XP</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <IconCoin size={9} color={coins > 0 ? "#ffe66d" : "#4ecdc4"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: coins > 0 ? "#00ff88" : "#4ecdc4" }}>{coins > 0 ? `+${coins}` : "NO LOSS"}</div>
            </div>
            {outcome === "cautious" && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4" }}>
                EVEN SAFER: <span style={{ color: "#00ff88" }}>{scenario.correctAction}</span>
              </div>
            )}
            {outcome === "wrong" && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4" }}>
                CORRECT: <span style={{ color: "#00ff88" }}>{scenario.correctAction}</span>
              </div>
            )}
          </div>
        </div>
        );
      })()}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
        {scenario.type === "sms"
          ? <SmsMockCard scenario={scenario} showWarning={inDebrief} onSenderTap={() => setShowSenderPanel(true)} />
          : <EmailCard />
        }
        {inDebrief && (
          <>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#4ecdc4", marginTop: 14, marginBottom: 8 }}>
              TAP CLUES TO EXPLORE
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 12 }}>
              {scenario.clues.map((clue, i) => (
                <button key={i} onClick={() => setActiveClue(clue)} style={{ backgroundColor: "rgba(255,107,53,0.15)", border: "3px solid #ff6b35", padding: "7px 13px", cursor: "pointer" }}>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ff6b35" }}>{clue.label}</div>
                </button>
              ))}
            </div>
            <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <IconBulb size={12} color="#ffe66d" />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d" }}>WHY?</div>
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
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: lightbulbIdx >= scenario.clues.length - 1 ? "#1a2340" : "#ffe66d" }}>
                HINT{lightbulbIdx + 1 < scenario.clues.length ? ` (${scenario.clues.length - lightbulbIdx - 1})` : ""}
              </div>
            </button>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#6b8ba4", marginBottom: 6, textAlign: "center" }}>WHAT SHOULD THE FAMILY DO?</div>
          <div className="grid grid-cols-2 gap-2">
            {displayActions.map((action) => (
              <button key={action} onClick={() => handleAction(action)} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "8px 6px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#e8f4f8", textAlign: "center", lineHeight: 1.5 }}>
                {action}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, padding: "12px", borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", flexShrink: 0 }}>
          <div style={{ flex: 1 }}><PixelButton onClick={onNext} color="#00ff88" textColor="#0a0e1a" size="sm" full>NEXT MEMBER</PixelButton></div>
          <div style={{ flex: 1 }}><PixelButton onClick={onEnd} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>END DRILL</PixelButton></div>
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
  answers: { scenarioId: number; action: string; outcome: FamilyOutcome; foundClues: number[] }[];
  onPlayAgain: () => void; onIndividual: () => void; onHome: () => void;
}) {
  const correctCount = answers.filter((a) => a.outcome === "correct").length;
  const totalClues = FAMILY_SCENARIOS.reduce((sum, s) => sum + s.clues.length, 0);
  const foundCluesCount = answers.reduce((sum, a) => sum + a.foundClues.length, 0);
  const totalXP = answers.reduce((sum, a) => sum + FAMILY_XP[a.outcome], 0);
  const totalCoins = answers.reduce((sum, a) => sum + FAMILY_COINS[a.outcome], 0);

  const header = correctCount >= 5 ? "FAMILY SAFE!" : correctCount >= 3 ? "GOOD TRAINING!" : "MORE PRACTICE NEEDED!";
  const headerColor = correctCount >= 5 ? "#00ff88" : correctCount >= 3 ? "#ffe66d" : "#ff2d55";

  const memberResults: Record<string, boolean[]> = {};
  FAMILY_SCENARIOS.forEach((s, i) => {
    if (!memberResults[s.targetMember]) memberResults[s.targetMember] = [];
    // Cautious counts as safe here — asking family is not getting scammed.
    if (i < answers.length) memberResults[s.targetMember].push(answers[i].outcome !== "wrong");
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
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: headerColor }}>{header}</div>
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
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#6b8ba4", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4", marginBottom: 8 }}>FAMILY RESULTS</div>
        <div className="flex flex-col gap-2 mb-14">
          {["Grandma", "Mum", "Dad", "Kid"].map((name) => {
            const results = memberResults[name] ?? [];
            const status = results.length === 0 ? "NO DATA" : results.every(Boolean) ? "SAFE" : results.some(Boolean) ? "NEEDS PRACTICE" : "REVIEW TOGETHER";
            const sc = status === "SAFE" ? "#00ff88" : status === "NO DATA" ? "#6b8ba4" : "#ffe66d";
            return (
              <div key={name} className="flex items-center gap-3" style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c", padding: "8px 12px" }}>
                <AnimatedFamilyChar name={name} size={28} />
                <div style={{ flex: 1, fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#e8f4f8" }}>{name.toUpperCase()}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: sc }}>{status}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffe66d", marginBottom: 8 }}>BADGES</div>
        <div className="grid grid-cols-2 gap-2 mb-14">
          {badges.map((b) => (
            <div key={b.name} style={{ backgroundColor: b.earned ? "#111827" : "#0a0e1a", border: `2px solid ${b.earned ? "#ffe66d" : "#1a2340"}`, padding: "8px 10px", opacity: b.earned ? 1 : 0.4 }}>
              <IconBadge size={18} color={b.earned ? "#ffe66d" : "#2a3a5c"} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: b.earned ? "#ffe66d" : "#2a3a5c", marginTop: 4, lineHeight: 1.5 }}>{b.name}</div>
              {!b.earned && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#1a2340", marginTop: 2 }}>LOCKED</div>}
            </div>
          ))}
        </div>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#4ecdc4", marginBottom: 8 }}>TOP LESSONS</div>
          {["Always inspect the sender.", "Hover or long-press links before opening.", "Be careful with urgent messages.", "Never share passwords, OTPs, or card details.", "Ask family before acting on suspicious messages."].map((l, i) => (
            <div key={i} className="flex items-start gap-2 mb-2">
              <div style={{ width: 5, height: 5, backgroundColor: "#4ecdc4", flexShrink: 0, marginTop: 5 }} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 1.5 }}>{l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 pb-4">
          <PixelButton onClick={onPlayAgain} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ PLAY FAMILY DRILL AGAIN ]</PixelButton>
          <PixelButton onClick={onIndividual} color="#4ecdc4" textColor="#0a0e1a" size="sm" full>[ TRY INDIVIDUAL DRILL ]</PixelButton>
          <PixelButton onClick={onHome} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ BACK HOME ]</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────
function SettingsScreen({ profile, settings, muted, onToggleMute, onSettings, onNav }: { profile: PlayerProfile; settings: AppSettings; muted: boolean; onToggleMute: () => void; onSettings: (s: Partial<AppSettings>) => void; onNav: (screen: string) => void }) {
  // Sound is NOT part of AppSettings: the audio module already persists it in
  // localStorage. The mute state is owned by App (which also drives the header mute
  // button) and passed down, so this toggle and the header can never disagree.
  const soundOn = !muted;
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

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#4ecdc4", marginBottom: 14 }}>APP SETTINGS</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#e8f4f8" }}>SOUND</div>
          <ToggleSwitchB on={soundOn} onToggle={onToggleMute} color="#00ff88" />
        </div>

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ffe66d", marginBottom: 14 }}>ACCOUNT</div>

        <div style={{ padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <PixelMascot size={36} color={profile.avatar.color} hat={profile.avatar.hat} eyes={profile.avatar.eyes} outfit={profile.avatar.outfit} />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ffffff" }}>{profile.name}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4", marginTop: 4 }}>LVL 7 — WATCHER</div>
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
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#e8f4f8" }}>{row.label}</div>
            <NavChevron />
          </button>
        ))}

        <div style={{ marginBottom: 4, marginTop: 4 }}>
          <button onClick={() => toggleAccordion("reset")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", cursor: "pointer" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ff2d55" }}>SIGN OUT THIS DEVICE</div>
            <div style={{ transform: openAccordion === "reset" ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "flex" }}>
              <NavChevron />
            </div>
          </button>
          {openAccordion === "reset" && (
            <div style={{ backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", borderTop: "none", padding: "14px 16px", animation: "slideUp 0.15s ease-out" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#ff2d55", marginBottom: 10, lineHeight: 1.5 }}>Removes this device's session and saved contact prefill. Your server account and XP are kept.</div>
              <PixelButton onClick={() => {
                // Use the key constants, not literals — a renamed constant would otherwise
                // leave a key uncleared and this "sign out" would silently not sign out.
                try {
                  localStorage.removeItem(TOKEN_KEY);
                  localStorage.removeItem(PROFILE_KEY);
                  localStorage.removeItem(CONTACT_KEY);
                  localStorage.removeItem(TUTORIAL_KEY);
                } catch { /* private mode: nothing to clear */ }
                location.reload();
              }} color="#ff2d55" textColor="#ffffff" size="sm" full>CONFIRM SIGN OUT</PixelButton>
            </div>
          )}
        </div>

        <div style={{ margin: "24px 0 8px", border: "3px solid #1a2340", padding: "18px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#2a3a5c", lineHeight: 2.4 }}>
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
function AccountSettingsScreen({ profile, onBack }: { profile: PlayerProfile; onBack: () => void }) {
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [detachMessage, setDetachMessage] = useState("");
  const registered = !!sessionToken();
  const rows = [
    { label: "USERNAME", value: profile.name, color: "#e8f4f8" },
    // The email address is private (never sent to the client), so it isn't shown here —
    // set it in the email drill. We only surface whether the phone is verified.
    { label: "PHONE", value: registered ? "VERIFIED" : "NOT REGISTERED", color: registered ? "#00ff88" : "#6b8ba4" },
    { label: "LINKED FAMILY PROFILES", value: "4 MEMBERS", color: "#00ff88" },
  ];

  const detachPhone = async () => {
    setDetaching(true);
    setDetachMessage("");
    try {
      const r = await fetch("/api/me/phone/detach", {
        method: "POST",
        headers: { ...authHeaders() },
      });
      handleApiAuth(r);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setDetachMessage(d.error || "Could not remove the verified number.");
        setDetaching(false);
        return;
      }

      setSessionToken(null);
      saveContact({ ...loadContact(), phone: "+65" });
      setConfirmDetach(false);
      setDetachMessage("PHONE REMOVED — verify a number again to use real drills.");
    } catch {
      setDetachMessage("We couldn't confirm whether removal finished. Reopen Account settings before trying again.");
    }
    setDetaching(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ACCOUNT" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {rows.map((row) => (
          <div key={row.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4", marginBottom: 4 }}>{row.label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: row.color }}>{row.value}</div>
          </div>
        ))}

        {registered && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.06)", border: "3px solid #ff2d55", padding: "14px 16px", marginTop: 18 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ff2d55", marginBottom: 7 }}>VERIFIED PHONE</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#b4c6d4", lineHeight: 1.55, marginBottom: 12 }}>
              Removing your number signs out every device and stops all real call and SMS drills. Your progress and email are kept.
            </div>
            {confirmDetach ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ffe66d", lineHeight: 1.5, marginBottom: 2 }}>
                  REMOVE YOUR VERIFIED PHONE?
                </div>
                <PixelButton onClick={detachPhone} color="#ff2d55" textColor="#ffffff" size="sm" full disabled={detaching}>
                  {detaching ? "REMOVING..." : "YES, REMOVE NUMBER"}
                </PixelButton>
                <PixelButton onClick={() => setConfirmDetach(false)} color="#1a2340" textColor="#b4c6d4" size="sm" full disabled={detaching}>CANCEL</PixelButton>
              </div>
            ) : (
              <PixelButton onClick={() => { setConfirmDetach(true); setDetachMessage(""); }} color="#ff2d55" textColor="#ffffff" size="sm" full>
                REMOVE VERIFIED NUMBER
              </PixelButton>
            )}
          </div>
        )}

        {detachMessage && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: registered ? "#ff2d55" : "#00ff88", lineHeight: 1.5, marginTop: 12 }}>
            {detachMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacySettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="PRIVACY" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#4ecdc4", marginBottom: 6 }}>DATA PRIVACY</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>
            Your name, verified phone number, optional email, drill outcomes and XP are stored by the service so real drills and progress can work. Room customisation and most display preferences stay in this browser.
          </div>
        </div>
        {[
          ["REAL DRILLS", "Calls and SMS are sent only to your verified number. Email drills require the inbox owner to click a verification link first."],
          ["SENSITIVE DATA", "Never enter real passwords, OTPs, card details or payment information during a drill. For real calls, Vapi processes a short transcript to score the drill; audio recording is disabled, and SafeSpace stores the outcome rather than the transcript."],
          ["YOUR CONTROL", "You can remove your verified phone from Account settings at any time. This signs out active sessions and stops phone-based drills."],
        ].map(([label, copy]) => (
          <div key={label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4", marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#b4c6d4", lineHeight: 1.6 }}>{copy}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessibilitySettingsScreen({
  prefs, onChange, onBack,
}: {
  prefs: AccessibilityPrefs;
  onChange: (patch: Partial<AccessibilityPrefs>) => void;
  onBack: () => void;
}) {
  const rows: { key: keyof AccessibilityPrefs; label: string; description: string }[] = [
    { key: "reduceMotion", label: "REDUCE MOTION", description: "Stops flashing, spinning and animated transitions." },
    { key: "largerText", label: "LARGER TEXT", description: "Raises the smallest pixel text to a more readable size." },
    { key: "highContrast", label: "HIGH CONTRAST", description: "Strengthens colour and border contrast across the app." },
    { key: "disableScanlines", label: "DISABLE CRT SCANLINES", description: "Removes the decorative screen-line overlay." },
  ];
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ACCESSIBILITY" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {rows.map(row => (
          <div key={row.key} className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8, gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#e8f4f8", marginBottom: 5 }}>{row.label}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#8da4b8", lineHeight: 1.45 }}>{row.description}</div>
            </div>
            <PixelToggle on={prefs[row.key]} onToggle={() => onChange({ [row.key]: !prefs[row.key] })} />
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
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#00ff88", marginBottom: 6 }}>DRILL MODE</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4", marginBottom: 4 }}>SCAM FIGHTER TRAINING</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#6b8ba4" }}>v2.0.0</div>
        </div>
        <div style={{ backgroundColor: "rgba(255,107,53,0.1)", border: "3px solid #ff6b35", padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ff6b35", marginBottom: 6 }}>DISCLAIMER</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>This app is a training simulation. It does not detect real scams automatically. All scenarios are fictional educational examples.</div>
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
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#4ecdc4" }}>FAMILY CHAT</div>
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
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color }}>
                    {isPixi ? "PIXI" : member?.name.slice(0, 3)}
                  </div>
                </div>
              )}
              {isRight && (
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <PixelMascot size={28} />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#00ff88" }}>YOU</div>
                </div>
              )}
              {/* Right column: bubble + timestamp */}
              <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: isRight ? "flex-end" : "flex-start", gap: 3 }}>
                <div style={{ backgroundColor: bubbleBg, border: `2px solid ${color}`, padding: "8px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: textColor, lineHeight: 1.6 }}>
                  {msg.text}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#2a3a5c" }}>{msg.time}</div>
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
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#0a0e1a" }}>▶</div>
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

// formatNotifTimestamp

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
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ffe66d" }}>NOTIFICATIONS</div>
        <div style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: unreadCount > 0 ? "#ff2d55" : "#6b8ba4" }}>
          {unreadCount > 0 ? `${unreadCount} UNREAD` : "ALL READ"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <IconBell size={40} color="#2a3a5c" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4" }}>NO NOTIFICATIONS YET</div>
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
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: isUnread ? "#e8f4f8" : "#6b8ba4", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.title}
                      </div>
                      {isUnread && (
                        <div style={{ width: 6, height: 6, backgroundColor: "#ff2d55", flexShrink: 0, marginTop: 2 }} />
                      )}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: isUnread ? "#4ecdc4" : "#4a5c78", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {n.body}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      {member && (
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: member.primaryColor }}>
                          {member.name}
                        </div>
                      )}
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#2a3a5c" }}>
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
          <PixelButton
            onClick={onMarkAllRead}
            color={unreadCount > 0 ? "#ffe66d" : "#1a2340"}
            textColor={unreadCount > 0 ? "#0a0e1a" : "#6b8ba4"}
            size="sm"
            full
            disabled={unreadCount === 0}
          >
            {unreadCount > 0 ? `MARK ALL READ (${unreadCount})` : "ALL CAUGHT UP"}
          </PixelButton>
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
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>{"< BACK"}</div>
        </button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: accent }}>NOTIFICATION</div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "16px" }}>
        <div style={{ backgroundColor: "#111827", border: `4px solid ${accent}`, boxShadow: `4px 4px 0 ${accent}`, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, backgroundColor: "#0a0e1a", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: accent, lineHeight: 1.5 }}>
                {notification.title}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", marginTop: 4 }}>
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
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4" }}>MEMBER</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: member.primaryColor, marginTop: 3 }}>
                {member.name}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", marginTop: 3 }}>
                {member.role}
              </div>
            </div>
          </div>
        )}

        {actionLabel && actionHandler && (
          <div style={{ marginTop: 20 }}>
            <PixelButton onClick={actionHandler} color={accent} textColor="#0a0e1a" size="md" full>
              [ {actionLabel} ]
            </PixelButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PAYDAY SUNDAY — now actually distributes coins via ledger
// ─────────────────────────────────────────────────────────────────────────
function PaydayScreen({ coins, claimedThisWeek, onCollect, onClose }: { coins: Record<string, number>; claimedThisWeek: boolean; onCollect: () => void; onClose: () => void }) {
  const [collected, setCollected] = useState(claimedThisWeek);
  const weeklyBase = 200;
  const drillBonus = 150;
  const payPeriod = new Date().toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();

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
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ffe66d" }}>PAYDAY SUNDAY</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="#6b8ba4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          <div style={{ backgroundColor: "#111827", border: "4px solid #ffe66d", boxShadow: "4px 4px 0 #ffe66d", padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>PAY PERIOD</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffe66d" }}>{payPeriod}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>BASE ALLOWANCE</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#ffe66d" }}>+{weeklyBase}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>DRILL BONUS (SAFE)</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#00ff88" }}>+{drillBonus}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>OUTCOME TO REVIEW</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#4ecdc4" }}>NO COIN LOSS</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", lineHeight: 1.6 }}>
              Every member gets +{weeklyBase}. Safe members get a +{drillBonus} bonus. A missed red flag never reduces an existing balance.
            </div>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4", letterSpacing: 2, marginBottom: 10 }}>MEMBER BALANCES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {FAMILY_MEMBERS.map(m => {
              const balance = coins[m.id] ?? m.coins;
              const frame = 0;
              return (
                <div key={m.id} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <FamilyChar id={m.id} size={36} frame={frame} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: m.primaryColor }}>{m.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", marginTop: 3 }}>
                      {m.safeThisWeek ? "SAFE THIS WEEK" : "REVIEW NEEDED"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ffe66d" }}>
                      +{balance}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#6b8ba4", marginTop: 3 }}>COINS</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ backgroundColor: "rgba(0,255,136,0.06)", border: "3px solid #00ff88", padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <IconBulb size={12} color="#ffe66d" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d" }}>PAYDAY TIP</div>
            </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#00ff88", lineHeight: 1.5 }}>
              Complete drills every week to earn your full salary bonus. Missed red flags reduce the bonus, but every review helps the whole family improve.
            </div>
          </div>

          {collected ? (
            <div style={{ backgroundColor: "#00ff88", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <IconCheck size={16} color="#0a0e1a" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#0a0e1a" }}>{claimedThisWeek ? "COLLECTED THIS WEEK" : "COLLECTED!"}</div>
            </div>
          ) : (
            <PixelButton onClick={handleCollect} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ COLLECT PAYDAY ]</PixelButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BOTTOM NAV
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// ROUTE GROUPS
// ─────────────────────────────────────────────────────────────────────────
// Module scope, not inside App(): these are constant, and rebuilding them on every
// render allocated fresh arrays for no reason.

const FAMILY_DRILL_SCREENS: Screen[] = ["family-round"];

// Every screen belonging to a drill flow.
//
// This list previously had no consumer at all — `isDrillFlow` was computed from it and
// then never used — which is why three drill screens had gone missing from it without
// anyone noticing. It now backs MUSIC_SILENT_SCREENS below, so it has to stay honest.
const DRILL_SCREENS: Screen[] = [
  "drill-select", "incoming", "call",
  "sms-inbox", "sms-thread", "sms-browser",
  "email-inbox", "email-detail", "email-browser", "email-download",
  "realistic-phone-intro", "realistic-sms-intro", "telegram-intro", "realistic-email-intro",
  "result-win", "result-lose",
  ...FAMILY_DRILL_SCREENS, "family-answer",
];

// Drill screens that are NOT a live simulation, so music should keep playing:
// the picker, and the two result screens where the win fanfare belongs.
const MUSIC_OK_DURING_DRILL: Screen[] = ["drill-select", "result-win", "result-lose"];

// Screens where a scam is actively being simulated, and music must NOT play: the
// premise is that the scam feels real, and a chiptune loop under an incoming call
// destroys that instantly. The drop to silence reads as tension, not as a bug.
//
// Derived rather than hand-listed. A new scam screen has to be added to DRILL_SCREENS
// for layout anyway, and now that is the only place it must be remembered — a second
// parallel list would eventually disagree, and the failure mode is music playing over
// a fake scam call, which you only notice by ear, in front of an audience.
const MUSIC_SILENT_SCREENS: Screen[] = DRILL_SCREENS.filter(
  (s) => !MUSIC_OK_DURING_DRILL.includes(s),
);

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
export default function App() {
  const [, setSessionEpoch] = useState(0);
  const [screen, setScreen] = useState<Screen>("title");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [drillType, setDrillType] = useState<DrillType>("call");
  const [callOutcome, setCallOutcome] = useState<CallOutcome | null>(null);
  const [smsOutcome, setSmsOutcome] = useState<SmsOutcome | null>(null);
  const [emailOutcome, setEmailOutcome] = useState<EmailOutcome | null>(null);
  const [resultXp, setResultXp] = useState<number | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
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
    const onExpired = () => setSessionEpoch(value => value + 1);
    window.addEventListener("safespace-session-expired", onExpired);
    return () => window.removeEventListener("safespace-session-expired", onExpired);
  }, []);

  // Mute lives in the audio module (persisted to localStorage); this is just the mirror
  // React needs to re-render the header/settings toggles. Seeded from the persisted value.
  const [muted, setMutedState] = useState(() => isMuted());
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  const [familyRoundIndex, setFamilyRoundIndex] = useState(0);
  const [familyAnswers, setFamilyAnswers] = useState<{ scenarioId: number; action: string; outcome: FamilyOutcome; foundClues: number[] }[]>([]);

  const [settings, setSettings] = useState<AppSettings>(loadSettings);
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
  const [soldItems, setSoldItems] = useState<string[]>(initialHomeInventory.soldItems);
  const [purchasedItems, setPurchasedItems] = useState<Record<string, string[]>>(
    initialHomeInventory.purchasedItems
  );
  useEffect(() => {
    saveHomeInventory({ coins, soldItems, purchasedItems });
  }, [coins, soldItems, purchasedItems]);
  const [rewardClaims, setRewardClaims] = useState<RewardClaims>(loadRewardClaims);
  useEffect(() => saveRewardClaims(rewardClaims), [rewardClaims]);
  const todayKey = localDateKey();
  const weekKey = localWeekKey();
  const claimedDailyToday = Object.fromEntries(
    FAMILY_MEMBERS.map(m => [m.id, rewardClaims.dailyByMember[m.id] === todayKey])
  ) as Record<string, boolean>;
  const paydayClaimedThisWeek = rewardClaims.paydayWeek === weekKey;
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

  const emitNotifDrill = (memberId: string, drill: DrillType, outcome: "win" | "lose", displayName?: string) => {
    const member = MEMBER_MAP[memberId];
    if (!member) return;
    const rewards: Record<DrillType, number> = { call: 50, sms: 40, email: 60 };
    const delta = outcome === "win" ? rewards[drill] : 0;
    const drillLabel = drill.toUpperCase();
    const kind: NotificationKind = outcome === "win"
      ? (drill === "call" ? "drill-win-call" : drill === "sms" ? "drill-win-sms" : "drill-win-email")
      : (drill === "call" ? "drill-lose-call" : drill === "sms" ? "drill-lose-sms" : "drill-lose-email");
    appendNotification({
      kind,
      memberId,
      title: outcome === "win"
        ? `${displayName ?? member.name} won a ${drillLabel.toLowerCase()} drill`
        : `${displayName ?? member.name} has a ${drillLabel.toLowerCase()} drill to review`,
      body: outcome === "win"
        ? `+${delta} coins · Nice work spotting the red flags`
        : `No coins lost · Review the tips and try again`,
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

  const emitPixiDrillMessage = (memberId: string, drill: DrillType, outcome: "win" | "lose", liveCallOutcome?: CallOutcome | null) => {
    const member = MEMBER_MAP[memberId];
    if (!member) return;
    const name = drill === "call" && liveCallOutcome ? profile.name : member.name;
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
    const liveCallTemplates: Partial<Record<CallOutcome, string>> = {
      hung_up: `Nice work, ${name}! You refused the caller and ended the pressure safely.`,
      disengaged: `Excellent verification, ${name}. Ending the call and using an official channel is the safest move.`,
      caught_flag: `${name} spotted the red flags. Next time, end the call as soon as the story stops adding up.`,
      complied: `${name}, the caller got agreement to an unsafe step. Pause, hang up and verify independently next time.`,
      shared_data: `${name}, sensitive information was shared in the drill. Real callers should never receive an OTP, PIN, password or transfer.`,
    };
    appendChatMessage({
      memberId: "pixi",
      isPixi: true,
      text: drill === "call" && liveCallOutcome && liveCallTemplates[liveCallOutcome]
        ? liveCallTemplates[liveCallOutcome]!
        : templates[drill][outcome],
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
      text = `Family drill done: ${correctCount}/${totalRounds} correct. There are a few useful lessons to review — let's practise more this week.`;
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
  const emitDrillEvent = (memberId: string, drill: DrillType, outcome: "win" | "lose", liveCallOutcome?: CallOutcome | null) => {
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
    emitPixiDrillMessage(memberId, drill, outcome, liveCallOutcome);
    emitNotifDrill(memberId, drill, outcome, drill === "call" && liveCallOutcome ? profile.name : undefined);
  };

  // Family-round event helper
  const emitFamilyRoundEvent = (memberId: string, outcome: FamilyOutcome) => {
    const delta = FAMILY_COINS[outcome];
    if (delta === 0) return; // cautious: no reward, but no penalty either
    const correct = outcome === "correct";
    const label = correct ? "FAMILY DRILL CORRECT" : "FAMILY DRILL WRONG";
    const reason: CoinTxReason = correct ? "family-drill-correct" : "family-drill-wrong";
    addCoinTx(memberId, delta, reason, label);
  };

  // Payday distribution: per-member, per-line-item entries in ledger
  const collectPayday = () => {
    const claimKey = `payday:${localWeekKey()}`;
    if (rewardClaims.paydayWeek === localWeekKey() || rewardClaimInFlightRef.current.has(claimKey)) return;
    rewardClaimInFlightRef.current.add(claimKey);
    setRewardClaims(prev => {
      const next = { ...prev, paydayWeek: localWeekKey() };
      saveRewardClaims(next);
      return next;
    });
    const base = 200, bonus = 150;
    FAMILY_MEMBERS.forEach(m => {
      addCoinTx(m.id, base, "payday-base", "PAYDAY BASE ALLOWANCE");
      if (m.safeThisWeek) {
        addCoinTx(m.id, bonus, "payday-bonus", "PAYDAY DRILL BONUS");
      }
    });
    emitPixiPaydayMessage();
    emitNotifPayday();
  };

  const FULLSCREEN_ROUTES: Screen[] = ["customize", "family-chat", "payday"];

  const SUB_PAGE_ROUTES: Screen[] = ["account-settings", "privacy-settings", "accessibility-settings", "about-settings", "profile-edit", "avatar-customisation", "family-drill-intro", "family-summary"];

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
  ): Promise<RealDrillCompletion> => {
    try {
      const response = await fetch(`/api/drills/${encodeURIComponent(drillId)}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ outcome }),
      });
      handleApiAuth(response);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.record) {
        return { ok: false, error: data.error || "Could not save this result." };
      }
      const consumed = await consumeDrillResult({ ...data.record, channel });
      return consumed ? { ok: true } : { ok: false, error: "Result saved and will be recovered automatically." };
    } catch {
      return { ok: false, error: "Network error. Your result will be recovered when the app reconnects." };
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

  // Family round completion: emit per-round coin event for that scenario's target member
  const handleFamilyComplete = (action: string, foundClues: number[], outcome: FamilyOutcome) => {
    const scenario = FAMILY_SCENARIOS[familyRoundIndex];
    const memberId = FAMILY_NAME_TO_ID[scenario.targetMember] ?? "mum";
    emitFamilyRoundEvent(memberId, outcome);
    setFamilyAnswers((prev) => [...prev, { scenarioId: scenario.id, action, outcome, foundClues }]);
  };

  const handleFamilyNext = () => {
    if (familyRoundIndex + 1 >= FAMILY_SCENARIOS.length) {
      const correctCount = familyAnswers.filter(a => a.outcome === "correct").length;
      emitPixiFamilyDrillSummary(correctCount, FAMILY_SCENARIOS.length);
      emitNotifFamilyDrill(correctCount, FAMILY_SCENARIOS.length);      
      setScreen("family-summary");
    } else {
      setFamilyRoundIndex((i) => i + 1);
    }
  };

  // Furniture sell — now routes through ledger
  const handleSellItem = (memberId: string, itemId: string, value: number) => {
    const saleKey = `${memberId}:${itemId}`;
    if (sellInFlightRef.current.has(saleKey)) return;
    const starter = FURNITURE_STORE.find(i => i.id === itemId);
    if (starter) {
      if (starter.memberId !== memberId || soldItems.includes(itemId)) return;
      sellInFlightRef.current.add(saleKey);
      setSoldItems(prev => prev.includes(itemId) ? prev : [...prev, itemId]);
      addCoinTx(memberId, value, "sell-furniture", `SOLD ${starter.name}`);
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
        addCoinTx(memberId, value, "sell-furniture", `SOLD ${shopItem.name}`);
      }
    }
  };

  const handleBuyItem = (memberId: string, itemId: string, cost: number) => {
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
    addCoinTx(memberId, -cost, "buy-furniture", `BOUGHT ${item.name}`);
  };

  const handleClaimDaily = (memberId: string) => {
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
    addCoinTx(memberId, DAILY_REWARD_AMOUNT, "daily-reward", "DAILY LOGIN REWARD");
    emitNotifDailyReward(memberId);
  };

  const openCustomize = (memberId: string) => {
    setCustomizeMemberId(memberId);
    setLastViewedMemberId(memberId);
    setActiveMemberId(memberId);
    setScreen("customize");
  };

  const openRegistration = (returnTo: Screen) => {
    setRegistrationReturn(returnTo);
    setScreen("register");
  };

  const finishRegistration = (name: string) => {
    const canonical = name.trim();
    updateProfile({ name: canonical });
    saveContact({ ...loadContact(), name: canonical });
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
  const hasUnreadNotifications = notifications.some(n => !n.read);

  // These buttons explicitly request a drill now. Automatic scheduling is not exposed
  // until a server-side scheduler exists, so a stale local preference must not block
  // a user-initiated call or email.
  const drillWin = drillWindowStatus(settings);
  const realDrillBlocked = false;

  // Player name + avatar, persisted locally. Seeded once from storage.
  const [profile, setProfileState] = useState<PlayerProfile>(loadProfile);
  const updateProfile = (patch: Partial<PlayerProfile>) =>
    setProfileState((prev) => { const next = { ...prev, ...patch }; saveProfile(next); return next; });

  // A verified account owns the canonical drill name. Keep the cosmetic profile and
  // registration prefill in sync with it, but retain local-only naming in demo/offline use.
  useEffect(() => {
    if (!sessionToken()) return;
    apiGet<any>("/api/me").then((data) => {
      const serverName = data?.name ?? data?.user?.name ?? data?.profile?.name;
      if (typeof serverName !== "string" || !serverName.trim()) return;
      const clean = serverName.trim();
      updateProfile({ name: clean });
      saveContact({ ...loadContact(), name: clean });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateVerifiedName = async (
    name: string,
  ): Promise<NameUpdateResult> => {
    const clean = name.trim();

    if (!clean) {
      return {
        ok: false,
        error: "Name is required.",
      };
    }

    // Offline or unregistered profile.
    if (!sessionToken()) {
      updateProfile({
        name: clean,
      });

      saveContact({
        ...loadContact(),
        name: clean,
      });

      return {
        ok: true,
        name: clean,
      };
    }

    // Registered profile: server owns the canonical drill name.
    const result =
      await updateVerifiedNameRequest(clean);

    if (!result.ok || !result.name) {
      return result;
    }

    updateProfile({
      name: result.name,
    });

    saveContact({
      ...loadContact(),
      name: result.name,
    });

    return result;
  };

  return (
    <div className={[
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
        .a11y-large-text [style*="font-size: 6px"] { font-size: 8px !important; }
        .a11y-large-text [style*="font-size: 7px"] { font-size: 9px !important; }
        .a11y-large-text [style*="font-size: 8px"] { font-size: 10px !important; }
        .a11y-large-text [style*="font-size: 9px"] { font-size: 11px !important; }
        .a11y-large-text [style*="font-size: 10px"] { font-size: 12px !important; }
        .a11y-large-text [style*="font-size: 11px"] { font-size: 13px !important; }
        .a11y-large-text [style*="font-size: 12px"] { font-size: 14px !important; }
        .a11y-large-text [style*="font-size: 13px"] { font-size: 15px !important; }
        .a11y-large-text [style*="font-size: 14px"] { font-size: 16px !important; }
        .a11y-large-text [style*="font-size: 16px"] { font-size: 18px !important; }
      `}</style>
      {!accessibility.disableScanlines && <Scanlines />}
      <PhoneFrame>
        <div className="flex flex-col flex-1 overflow-hidden">
          {showAppChrome && (
            <AppHeader
              title={title}
              titleColor={color}
              hasUnreadNotifications={hasUnreadNotifications}
              muted={muted}
              onToggleMute={toggleMute}
              onChat={handleChatIcon}
              onNotifications={handleBellIcon}
              onSettings={handleSettingsIcon}
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
                  // The tour highlights real elements, so Home must be mounted first.
                  goHome();
                  if (!hasSeenTutorial()) setTourOpen(true);
                }}
              />
            )}
            {screen === "register" && <RegisterScreen onDone={finishRegistration} onBack={() => setScreen(registrationReturn)} />}

            {screen === "home" && (
              <FamilyHomeScreen
                onDrillSelect={goDrillSelect}
                onFamilyDrill={goFamilyDrill}
                onPayday={() => setScreen("payday")}
                onCustomize={openCustomize}
                onRegister={() => openRegistration("home")}
                onTutorial={() => setTourOpen(true)}
                coins={coins}
                soldItems={soldItems}
                purchasedItems={purchasedItems}
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
                onHouse={() => { setCustomizeMemberId(lastViewedMemberId); setActiveMemberId(lastViewedMemberId); setScreen("customize"); }}
              />
            )}
            {screen === "avatar-customisation" && (
              <AvatarCustomisationScreen
                avatar={profile.avatar}
                onSave={(avatar) => updateProfile({ avatar })}
                onBack={() => setScreen("profile-edit")}
              />
            )}

            {screen === "customize" && (
              <CustomizeScreen
                memberId={customizeMemberId}
                coins={coins[customizeMemberId] ?? 0}
                purchasedItems={purchasedItems[customizeMemberId] ?? []}
                soldItems={soldItems}
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
                onOutcome={(drillId, outcome) => handleRealDrillOutcome("email", drillId, outcome)}
                scheduleBlocked={realDrillBlocked}
                scheduleNextLabel={drillWin.nextLabel}
              />
            )}
            {screen === "payday" && <PaydayScreen coins={coins} claimedThisWeek={paydayClaimedThisWeek} onCollect={collectPayday} onClose={goHome} />}
            {screen === "family-drill-intro" && <FamilyDrillIntroScreen onStart={() => setScreen("family-round")} onBack={goHome} />}
            {screen === "family-round" && (
              <FamilyRoundScreen
                scenario={FAMILY_SCENARIOS[familyRoundIndex]}
                roundIndex={familyRoundIndex}
                totalRounds={FAMILY_SCENARIOS.length}
                onComplete={handleFamilyComplete}
                onNext={handleFamilyNext}
                onEnd={() => {
                  const correctCount = familyAnswers.filter(a => a.outcome === "correct").length;
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
                onRealisticPhone={() => setScreen("realistic-phone-intro")}
                onRealisticSms={() => setScreen("realistic-sms-intro")}
                onTelegram={() => setScreen("telegram-intro")}
                onRealisticEmail={() => setScreen("realistic-email-intro")}
                onFamily={goFamilyDrill}
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
      {tourOpen && screen === "home" && (
        <TourOverlay onDone={() => { markTutorialSeen(); setTourOpen(false); }} />
      )}
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
            <div id="neutral-result-title" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: "#4ecdc4", lineHeight: 1.5, marginBottom: 12 }}>
              DRILL NOT SCORED
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: "#e8f4f8", lineHeight: 1.6, marginBottom: 16 }}>
              {neutralResultNotice.message}
            </div>
            <PixelButton onClick={dismissNeutralResult} color="#4ecdc4" textColor="#0a0e1a" size="md" full>
              [ GOT IT ]
            </PixelButton>
          </div>
        </div>
      )}
    </div>
  );
}
