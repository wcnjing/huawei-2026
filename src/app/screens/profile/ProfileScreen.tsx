import type { PlayerProfile } from "../../types/profile";
import type { CoinTx } from "../../types/economy";

import { ACHIEVEMENTS } from "../../data/achievements";
import { DAILY_REWARD_AMOUNT } from "../../data/economy";

import { CharacterAvatar } from "../../components/avatars";
import { XPBar } from "../../components/ui";
import { 
    IconBadge, IconBell, IconChatBubble, IconCoin, 
    IconEnvelope, IconFlame, IconLock, IconPhone, 
    IconSell, IconShield, IconStar, IconTrophy, 
} from "../../components/icons";

import { useMemberMap } from "../../hooks/useMembers";
import { useT } from "../../i18n";


export function ProfileScreen({
  profile,
  onEditProfile,
  activeMemberId,
  coins,
  coinLedger,
  claimedDailyToday,
  onClaimDaily,
}: {
  profile: PlayerProfile;
  onEditProfile?: () => void;
  activeMemberId: string;
  coins: Record<string, number>;
  coinLedger: CoinTx[];
  claimedDailyToday: Record<string, boolean>;
  onClaimDaily: (memberId: string) => void;
}) {
  const t = useT();
  const activeMember = useMemberMap()[activeMemberId];
  const memberCoins = coins[activeMemberId] ?? 0;
  const memberAlreadyClaimed = claimedDailyToday[activeMemberId] ?? false;

  // Filter ledger to just this member's transactions (most recent 6)
  const memberLedger = coinLedger.filter(tx => tx.memberId === activeMemberId).slice(0, 6);

  // Format relative timestamps for the ledger
  const formatRelativeTime = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60) return t("JUST NOW");
    const mins = Math.floor(secs / 60);
    if (mins < 60) return t("{mins}M AGO", { mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t("{hrs}H AGO", { hrs });
    const days = Math.floor(hrs / 24);
    return t("{days}D AGO", { days });
  };
  if (!activeMember) return null;
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="profile-summary mx-4 mt-4" style={{ backgroundColor: "#111827", border: "4px solid #4ecdc4", boxShadow: "4px 4px 0 #4ecdc4", alignItems: "start", padding: "0 14px 16px" }}>
          <div style={{ minWidth: 68, display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 8px ${profile.avatar.glow})`, paddingTop: 16 }}>
            <CharacterAvatar size={104} animate config={profile.avatar} title={`${profile.name}'s character`} />
          </div>
          <div style={{ minWidth: 0, paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0, overflowWrap: "anywhere", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-title)", color: "#ffffff" }}>{profile.name}</div>
              <button onClick={onEditProfile} style={{ flexShrink: 0, minHeight: 36, background: "none", border: "2px solid #4ecdc4", cursor: "pointer", padding: "4px 8px" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4" }}>{t("EDIT")}</div>
              </button>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginTop: 4 }}>{t("LVL {level} — {title}", { level: 7, title: t("WATCHER") })}</div>
            <div className="mt-3">
              <XPBar current={2340} max={3000} color="#4ecdc4" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 4 }}>{t("{current} / {max} XP TO LVL {level}", { current: "2,340", max: "3,000", level: 8 })}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
          {[
            { label: t("TOTAL SCORE"), val: "11,240", color: "#ffe66d", icon: <IconTrophy size={12} color="#ffe66d" /> },
            { label: t("DRILLS DONE"), val: "51", color: "#4ecdc4", icon: <IconShield size={12} color="#4ecdc4" /> },
            { label: t("BEST STREAK"), val: "12", color: "#ff6b35", icon: <IconFlame size={12} color="#ff6b35" /> },
            { label: t("AREA RANK"), val: "#12", color: "#00ff88", icon: <IconStar size={12} color="#00ff88" /> },
          ].map((s) => (
            <div key={s.label} className="p-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c" }}>
              <div className="flex items-center gap-1 mb-1">{s.icon}<div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{s.label}</div></div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div className="mx-4 mt-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <IconBadge size={16} color="#ffe66d" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d" }}>{t("ACHIEVEMENT BADGES")}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} className="flex flex-col items-center gap-2 p-3" style={{ backgroundColor: a.unlocked ? "#111827" : "#0d1120", border: `3px solid ${a.unlocked ? a.color : "#1a2340"}`, boxShadow: a.unlocked ? `3px 3px 0 ${a.color}` : "none", opacity: a.unlocked ? 1 : 0.45, position: "relative" }}>
                {!a.unlocked && <div style={{ position: "absolute", top: 4, right: 4 }}><IconLock size={10} color="#2a3a5c" /></div>}
                <IconBadge size={28} color={a.unlocked ? a.color : "#2a3a5c"} />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: a.unlocked ? a.color : "#2a3a5c", textAlign: "center", lineHeight: 1.4 }}>{t(a.name)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", textAlign: "center", marginTop: 12 }}>{t("{count} / {total} UNLOCKED", { count: 4, total: 9 })}</div>
        </div>

        {/* ── COIN REWARDS ────────────────────────────────────────────── */}
        <div className="mx-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <IconCoin size={16} color="#ffe66d" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d" }}>{t("COIN REWARDS")}</div>
          </div>

          {/* Coin balance card */}
          <div style={{ backgroundColor: "#111827", border: `4px solid ${memberCoins < 0 ? "#ff2d55" : "#ffe66d"}`, boxShadow: `4px 4px 0 ${memberCoins < 0 ? "#ff2d55" : "#ffe66d"}`, padding: "14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 6 }}>{t("TOTAL COINS")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCoin size={20} color={memberCoins < 0 ? "#ff2d55" : "#ffe66d"} />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-heading)", color: memberCoins < 0 ? "#ff2d55" : "#ffe66d" }}>
                  {memberCoins < 0 ? "-" : ""}{Math.abs(memberCoins).toLocaleString()}
                </div>
              </div>
              {memberCoins < 0 && (
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff2d55", marginTop: 6 }}>{t("IN DEBT")}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>{t("DAILY REWARD")}</div>
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
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: memberAlreadyClaimed ? "#6b8ba4" : "#0a0e1a" }}>
                  {memberAlreadyClaimed ? t("CLAIMED") : `+${DAILY_REWARD_AMOUNT}`}
                </span>
              </button>
            </div>
          </div>

          {/* Ways to earn */}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", letterSpacing: 1, marginBottom: 8 }}>{t("WAYS TO EARN")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: t("CALL DRILL WIN"), reward: "+50", icon: <IconPhone size={14} color="#ff6b35" /> },
              { label: t("SMS DRILL WIN"), reward: "+40", icon: <IconChatBubble size={14} color="#4ecdc4" /> },
              { label: t("EMAIL DRILL WIN"), reward: "+60", icon: <IconEnvelope size={14} color="#c77dff" /> },
              { label: t("HOUSE ROUND"), reward: "+30", icon: <IconShield size={14} color="#00ff88" /> },
              { label: t("SELL FURNITURE"), reward: t("VARIES"), icon: <IconSell size={14} color="#ff6b35" /> },
              { label: t("PAYDAY (SAFE)"), reward: "+350", icon: <IconBell size={14} color="#ffe66d" /> },
            ].map(row => (
              <div key={row.label} style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c", padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                {row.icon}
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", textAlign: "center", lineHeight: 1.4 }}>{row.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <IconCoin size={8} color="#ffe66d" />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#00ff88" }}>{row.reward}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity ledger */}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", letterSpacing: 1, marginBottom: 8 }}>{t("RECENT ACTIVITY")}</div>
          <div style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c" }}>
            {memberLedger.length === 0 ? (
              <div style={{ padding: "16px 12px", textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", lineHeight: 1.6 }}>
                {t("No transactions yet.")}<br />{t("Complete a drill to see activity here.")}
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
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8.5, color: "#e8f4f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(tx.label)}</div>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 2 }}>{formatRelativeTime(tx.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: tx.delta >= 0 ? "#00ff88" : "#ff2d55", flexShrink: 0, marginLeft: 8 }}>
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
