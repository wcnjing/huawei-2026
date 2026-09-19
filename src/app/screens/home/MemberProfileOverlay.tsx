import type { FamilyMember } from "../../types/family";
import { FamilyChar } from "../../components/avatars";
import { XPBar, PixelButton } from "../../components/ui";
import { 
  IconBadge, IconBulb, IconCoin,  
  IconFlame, IconLock, IconShield, IconX
} from "../../components/icons";
import { useIdleFrame } from "../../hooks/useIdleFrame";

export function MemberProfileOverlay({
  member, onClose, onCustomize, coins,
}: { member: FamilyMember; onClose: () => void; onCustomize: (memberId: string) => void; coins: number }) {
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
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: member.primaryColor }}>{member.name}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4", marginTop: 4 }}>{member.role}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#e8f4f8", marginTop: 6 }}>LVL {member.level}</div>
            <div style={{ marginTop: 6 }}>
              <XPBar current={member.xp} max={member.xpMax} color={member.primaryColor} />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", marginTop: 3 }}>
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
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: coins < 0 ? "#ff2d55" : "#ffe66d" }}>
              {coins < 0 ? "-" : "+"}{Math.abs(coins)} COINS
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#6b8ba4", marginTop: 3 }}>
              {coins < 0 ? "IN DEBT — sell furniture to recover" : "Balance this week"}
            </div>
          </div>
          {coins < 0 && (
            <div style={{ backgroundColor: "#ff2d55", padding: "4px 6px", fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#0a0e1a" }}>IOU</div>
          )}
        </div>

        <div style={{ margin: "8px 16px 0", padding: "10px 12px", backgroundColor: member.safeThisWeek ? "rgba(0,255,136,0.06)" : "rgba(255,45,85,0.06)", border: `3px solid ${member.safeThisWeek ? "#00ff88" : "#ff2d55"}`, display: "flex", alignItems: "center", gap: 10 }}>
          <IconShield size={20} color={member.safeThisWeek ? "#00ff88" : "#ff2d55"} />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: member.safeThisWeek ? "#00ff88" : "#ff2d55" }}>
              {member.safeThisWeek ? "SAFE THIS WEEK" : "REVIEW THIS WEEK"}
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4", marginTop: 3 }}>
              Last drill: {member.recentDrillResult ?? "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 16px 0" }}>
          {[
            { label: "STREAK", val: member.streak === 0 ? "BROKEN" : `${member.streak}`, color: member.streak > 0 ? "#ff6b35" : "#ff2d55", icon: <IconFlame size={12} color={member.streak > 0 ? "#ff6b35" : "#ff2d55"} /> },
            { label: "SAFE", val: `${member.timesSafe}`, color: "#00ff88", icon: <IconShield size={12} color="#00ff88" /> },
            { label: "MISSED", val: `${member.timesScammed}`, color: "#ff2d55", icon: <IconBulb size={12} color="#ff2d55" /> },
          ].map((s) => (
            <div key={s.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "10px 8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                {s.icon}
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#6b8ba4" }}>{s.label}</div>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
        <div style={{ margin: "12px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconBadge size={12} color="#ffe66d" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d" }}>BADGES — {member.badgeCount}/{member.badgeTotal}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {badges.map((b, i) => (
              <div key={i} style={{ width: 32, height: 32, backgroundColor: b.unlocked ? "#111827" : "#0a0e1a", border: `2px solid ${b.unlocked ? b.color : "#1a2340"}`, boxShadow: b.unlocked ? `2px 2px 0 ${b.color}` : "none", opacity: b.unlocked ? 1 : 0.35, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {b.unlocked ? <IconBadge size={20} color={b.color} /> : <IconLock size={12} color="#2a3a5c" />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelButton
            onClick={() => { onClose(); onCustomize(member.id); }}
            color="#1a2340" textColor="#6b8ba4" size="md" full
          >
            CUSTOMIZE ROOM
          </PixelButton>
        </div>
      </div>
    </div>
  );
}