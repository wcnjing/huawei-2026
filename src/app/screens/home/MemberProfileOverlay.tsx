import { useT } from "../../i18n";
import type { FamilyMember } from "../../types/family";
import { MemberChar } from "../../components/avatars";
import { XPBar, PixelButton } from "../../components/ui";
import { 
  IconBadge, IconBulb, IconCoin,  
  IconFlame, IconLock, IconShield, IconX
} from "../../components/icons";
import { useSelfId } from "../../hooks/useSelfId";
import { fill, ink, tint, line } from "../../utils/color";

export function MemberProfileOverlay({
  member, onClose, onCustomize, coins, canRemove, onRemove,
}: { member: FamilyMember; onClose: () => void; onCustomize: (memberId: string) => void; coins: number; canRemove: boolean; onRemove: () => void }) {
  const t = useT();
  const selfId = useSelfId();
  const badges = Array.from({ length: member.badgeTotal }, (_, i) => ({
    unlocked: i < member.badgeCount,
    color: ["var(--green)", "var(--orange)", "var(--teal)", "var(--yellow)", "var(--red)", "var(--violet)", "var(--teal)", "var(--orange)", "var(--muted-foreground)"][i],
  }));
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 100, backgroundColor: "var(--scrim)", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: "var(--background)", border: `4px solid ${line(member.primaryColor)}`, boxShadow: `0 -6px 0 ${tint(member.primaryColor, 40)}`, maxHeight: "88%", overflowY: "auto", scrollbarWidth: "none", animation: "slideUp 0.2s ease-out" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 40, height: 4, backgroundColor: "var(--border)" }} />
        </div>
        <div style={{ padding: "0 16px 14px", borderBottom: `3px solid ${tint(member.primaryColor, 20)}`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ minWidth: 56, display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 calc(8px * var(--glow)) ${ink(member.primaryColor)})` }}>
            <MemberChar member={member} size={88} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: ink(member.primaryColor) }}>{member.name}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 4 }}>{t(member.role)}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--foreground)", marginTop: 6 }}>{t("LVL {level}", { level: member.level })}</div>
            <div style={{ marginTop: 6 }}>
              <XPBar current={member.xp} max={member.xpMax} color={fill(member.primaryColor)} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>
                {member.xp.toLocaleString()} / {member.xpMax.toLocaleString()} XP
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", alignSelf: "flex-start", padding: 4 }}>
            <IconX size={16} color="var(--muted-foreground)" />
          </button>
        </div>

        {member.id === selfId && (
          <div style={{ margin: "12px 16px 0", padding: "10px 12px", backgroundColor: coins < 0 ? "color-mix(in srgb, var(--red-fill) 6%, transparent)" : "color-mix(in srgb, var(--yellow-fill) 6%, transparent)", border: `3px solid ${coins < 0 ? "var(--red-line)" : "var(--yellow-line)"}`, display: "flex", alignItems: "center", gap: 10 }}>
            <IconCoin size={20} color={coins < 0 ? "var(--red)" : "var(--yellow)"} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: coins < 0 ? "var(--red)" : "var(--yellow)" }}>
                {t("{amount} COINS", { amount: `${coins < 0 ? "-" : "+"}${Math.abs(coins)}` })}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>
                {coins < 0 ? t("IN DEBT — sell furniture to recover") : t("Balance this week")}
              </div>
            </div>
            {coins < 0 && (
              <div style={{ backgroundColor: "var(--red-fill)", padding: "4px 6px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{t("IOU")}</div>
            )}
          </div>
        )}

        <div style={{ margin: "8px 16px 0", padding: "10px 12px", backgroundColor: member.safeThisWeek ? "color-mix(in srgb, var(--green-fill) 6%, transparent)" : "color-mix(in srgb, var(--red-fill) 6%, transparent)", border: `3px solid ${member.safeThisWeek ? "var(--green-line)" : "var(--red-line)"}`, display: "flex", alignItems: "center", gap: 10 }}>
          <IconShield size={20} color={member.safeThisWeek ? "var(--green)" : "var(--red)"} />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: member.safeThisWeek ? "var(--green)" : "var(--red)" }}>
              {member.safeThisWeek ? t("SAFE THIS WEEK") : t("REVIEW THIS WEEK")}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>
              {t("Last drill: {result}", { result: member.recentDrillResult ? t(member.recentDrillResult) : "—" })}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 16px 0" }}>
          {[
            { label: "STREAK", val: member.streak === 0 ? t("BROKEN") : `${member.streak}`, color: member.streak > 0 ? "var(--orange)" : "var(--red)", icon: <IconFlame size={12} color={member.streak > 0 ? "var(--orange)" : "var(--red)"} /> },
            { label: "SAFE", val: `${member.timesSafe}`, color: "var(--green)", icon: <IconShield size={12} color="var(--green)" /> },
            { label: "MISSED", val: `${member.timesScammed}`, color: "var(--red)", icon: <IconBulb size={12} color="var(--red)" /> },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "10px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                {s.icon}
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{t(s.label)}</div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconBadge size={12} color="var(--yellow)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)" }}>{t("BADGES — {count}/{total}", { count: member.badgeCount, total: member.badgeTotal })}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {badges.map((b, i) => (
              <div key={i} style={{ width: 32, height: 32, backgroundColor: b.unlocked ? "var(--card)" : "var(--background)", border: `2px solid ${b.unlocked ? b.color : "var(--secondary)"}`, boxShadow: b.unlocked ? `2px 2px 0 ${b.color}` : "none", opacity: b.unlocked ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {b.unlocked ? <IconBadge size={20} color={b.color} /> : <IconLock size={12} color="var(--border)" />}
              </div>
            ))}
          </div>
        </div>
        {(member.id === selfId || canRemove) && (
          <div style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {member.id === selfId && (
              <PixelButton
                onClick={() => { onClose(); onCustomize(member.id); }}
                color="var(--secondary)" textColor="var(--muted-foreground)" size="md" full
              >
                {t("CUSTOMIZE ROOM")}
              </PixelButton>
            )}
            {canRemove && (
              <PixelButton onClick={() => { if (window.confirm(t("Remove {name} from the house?", { name: member.name }))) { onRemove(); onClose(); } }} color="var(--red-fill)" textColor="var(--on-fill)" size="sm" full>
                {t("REMOVE FROM HOUSE")}
              </PixelButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
