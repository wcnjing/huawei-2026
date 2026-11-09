import type { PlayerProfile } from "../../types/profile";
import type { CoinTx } from "../../types/economy";

import { achievementsFor, houseRank, rankTitle, totalXp } from "../../utils/progress";
import { DAILY_REWARD_AMOUNT } from "../../data/economy";

import { CharacterAvatar } from "../../components/avatars";
import { XPBar } from "../../components/ui";
import { 
    IconBadge, IconBell, IconChatBubble, IconCoin, 
    IconEnvelope, IconFlame, IconLock, IconPhone, 
    IconSell, IconShield, IconStar, IconTrophy, 
} from "../../components/icons";

import { useMembers } from "../../hooks/useMembers";
import { useT } from "../../i18n";
import { ink, line } from "../../utils/color";


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
  const members = useMembers();
  const activeMember = members.find((m) => m.id === activeMemberId);
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
  const achievements = achievementsFor(activeMember);
  const rank = houseRank(members, activeMemberId);
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="profile-summary mx-4 mt-4" style={{ backgroundColor: "var(--card)", border: "4px solid var(--teal-line)", boxShadow: "4px 4px 0 var(--teal-line)", alignItems: "start", padding: "0 14px 16px" }}>
          <div style={{ minWidth: 68, display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 calc(8px * var(--glow)) ${profile.avatar.glow})`, paddingTop: 16 }}>
            <CharacterAvatar size={104} animate config={profile.avatar} title={`${profile.name}'s character`} />
          </div>
          <div style={{ minWidth: 0, paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0, overflowWrap: "anywhere", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-title)", color: "var(--foreground-strong)" }}>{profile.name}</div>
              <button onClick={onEditProfile} style={{ flexShrink: 0, minHeight: 36, background: "none", border: "2px solid var(--teal-line)", cursor: "pointer", padding: "4px 8px" }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)" }}>{t("EDIT")}</div>
              </button>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)", marginTop: 4 }}>{t("LVL {level} — {title}", { level: activeMember.level, title: t(rankTitle(activeMember.level)) })}</div>
            <div className="mt-3">
              <XPBar current={activeMember.xp} max={activeMember.xpMax} color="var(--teal-fill)" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 4 }}>{t("{current} / {max} XP TO LVL {level}", { current: activeMember.xp.toLocaleString(), max: activeMember.xpMax.toLocaleString(), level: activeMember.level + 1 })}</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
          {[
            { label: t("TOTAL XP"), val: totalXp(activeMember.level, activeMember.xp).toLocaleString(), color: "var(--yellow)", icon: <IconTrophy size={12} color="var(--yellow)" /> },
            { label: t("DRILLS DONE"), val: (activeMember.timesSafe + activeMember.timesScammed).toLocaleString(), color: "var(--teal)", icon: <IconShield size={12} color="var(--teal)" /> },
            { label: t("CURRENT STREAK"), val: String(activeMember.streak), color: "var(--orange)", icon: <IconFlame size={12} color="var(--orange)" /> },
            { label: t("HOUSE RANK"), val: rank && members.length > 1 ? t("#{rank} OF {total}", { rank, total: members.length }) : "—", color: "var(--green)", icon: <IconStar size={12} color="var(--green)" /> },
          ].map((s) => (
            <div key={s.label} className="p-3" style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)" }}>
              <div className="flex items-center gap-1 mb-1">{s.icon}<div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{s.label}</div></div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div className="mx-4 mt-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <IconBadge size={16} color="var(--yellow)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--yellow)" }}>{t("ACHIEVEMENT BADGES")}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {achievements.map((a) => (
              <div key={a.id} className="flex flex-col items-center gap-2 p-3" style={{ backgroundColor: a.unlocked ? "var(--card)" : "var(--surface)", border: `3px solid ${a.unlocked ? line(a.color) : "var(--secondary)"}`, boxShadow: a.unlocked ? `3px 3px 0 ${line(a.color)}` : "none", opacity: a.unlocked ? 1 : 0.45, position: "relative" }}>
                {!a.unlocked && <div style={{ position: "absolute", top: 4, right: 4 }}><IconLock size={10} color="var(--border)" /></div>}
                <IconBadge size={28} color={a.unlocked ? ink(a.color) : "var(--border)"} />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: a.unlocked ? ink(a.color) : "var(--border)", textAlign: "center", lineHeight: 1.4 }}>{t(a.name)}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", textAlign: "center", marginTop: 12 }}>{t("{count} / {total} UNLOCKED", { count: achievements.filter((a) => a.unlocked).length, total: achievements.length })}</div>
        </div>

        {/* ── COIN REWARDS ────────────────────────────────────────────── */}
        <div className="mx-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <IconCoin size={16} color="var(--yellow)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--yellow)" }}>{t("COIN REWARDS")}</div>
          </div>

          {/* Coin balance card */}
          <div style={{ backgroundColor: "var(--card)", border: `4px solid ${memberCoins < 0 ? "var(--red-line)" : "var(--yellow-line)"}`, boxShadow: `4px 4px 0 ${memberCoins < 0 ? "var(--red-line)" : "var(--yellow-line)"}`, padding: "14px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", marginBottom: 6 }}>{t("TOTAL COINS")}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconCoin size={20} color={memberCoins < 0 ? "var(--red)" : "var(--yellow)"} />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-heading)", color: memberCoins < 0 ? "var(--red)" : "var(--yellow)" }}>
                  {memberCoins < 0 ? "-" : ""}{Math.abs(memberCoins).toLocaleString()}
                </div>
              </div>
              {memberCoins < 0 && (
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)", marginTop: 6 }}>{t("IN DEBT")}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("DAILY REWARD")}</div>
              <button
                onClick={() => onClaimDaily(activeMemberId)}
                disabled={memberAlreadyClaimed}
                style={{
                  backgroundColor: memberAlreadyClaimed ? "var(--surface)" : "var(--yellow-fill)",
                  border: `2px solid ${memberAlreadyClaimed ? "var(--border)" : "var(--outline)"}`,
                  boxShadow: memberAlreadyClaimed ? "none" : "2px 2px 0 var(--outline)",
                  padding: "5px 8px",
                  cursor: memberAlreadyClaimed ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <IconCoin size={10} color={memberAlreadyClaimed ? "var(--muted-foreground)" : "var(--on-fill)"} />
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: memberAlreadyClaimed ? "var(--muted-foreground)" : "var(--on-fill)" }}>
                  {memberAlreadyClaimed ? t("CLAIMED") : `+${DAILY_REWARD_AMOUNT}`}
                </span>
              </button>
            </div>
          </div>

          {/* Ways to earn */}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", letterSpacing: 1, marginBottom: 8 }}>{t("WAYS TO EARN")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: t("CALL DRILL WIN"), reward: "+50", icon: <IconPhone size={14} color="var(--orange)" /> },
              { label: t("SMS DRILL WIN"), reward: "+40", icon: <IconChatBubble size={14} color="var(--teal)" /> },
              { label: t("EMAIL DRILL WIN"), reward: "+60", icon: <IconEnvelope size={14} color="var(--violet)" /> },
              { label: t("HOUSE ROUND"), reward: "+30", icon: <IconShield size={14} color="var(--green)" /> },
              { label: t("SELL FURNITURE"), reward: t("VARIES"), icon: <IconSell size={14} color="var(--orange)" /> },
              { label: t("PAYDAY (SAFE)"), reward: "+350", icon: <IconBell size={14} color="var(--yellow)" /> },
            ].map(row => (
              <div key={row.label} style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)", padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                {row.icon}
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", textAlign: "center", lineHeight: 1.4 }}>{row.label}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <IconCoin size={8} color="var(--yellow)" />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--green)" }}>{row.reward}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent activity ledger */}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", letterSpacing: 1, marginBottom: 8 }}>{t("RECENT ACTIVITY")}</div>
          <div style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)" }}>
            {memberLedger.length === 0 ? (
              <div style={{ padding: "16px 12px", textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", lineHeight: 1.6 }}>
                {memberCoins === 0
                  ? <>{t("No transactions yet.")}<br />{t("Complete a drill to see activity here.")}</>
                  : t("New coins you earn or spend on this device will show up here.")}
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
                    borderBottom: i < memberLedger.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <IconCoin size={10} color={tx.delta >= 0 ? "var(--yellow)" : "var(--red)"} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8.5, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t(tx.label)}</div>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 2 }}>{formatRelativeTime(tx.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: tx.delta >= 0 ? "var(--green)" : "var(--red)", flexShrink: 0, marginLeft: 8 }}>
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
