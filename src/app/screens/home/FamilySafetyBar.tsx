import { IconShield, IconCoin } from "../../components/icons";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";

export function FamilySafetyBar({ coins }: { coins: Record<string, number> }) {
  const members = useMembers();
  const selfId = useSelfId();
  const safeCount = members.filter((m) => m.safeThisWeek).length;
  const allSafe = members.length > 0 && safeCount === members.length;
  const selfCoins = coins[selfId] ?? 0;
  return (
    <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ filter: `drop-shadow(0 0 6px ${allSafe ? "#00ff88" : "#ff6b35"})`, flexShrink: 0 }}>
        <IconShield size={32} color={allSafe ? "#00ff88" : "#ff6b35"} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: allSafe ? "#00ff88" : "#ff6b35", marginBottom: 4 }}>HOUSE SAFETY</div>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.4 }}>
          {safeCount}/{members.length} members safe this week
        </div>
        <div className="house-safety-members" style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ filter: `drop-shadow(0 0 3px ${m.safeThisWeek ? "#00ff88" : "#ff2d55"})` }}>
                <IconShield size={10} color={m.safeThisWeek ? "#00ff88" : "#ff2d55"} />
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{m.name.slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", padding: "6px 10px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconCoin size={12} color="#ffe66d" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: selfCoins >= 0 ? "#ffe66d" : "#ff2d55" }}>
            {selfCoins >= 0 ? "" : "-"}{Math.abs(selfCoins)}
          </div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>YOU</div>
      </div>
    </div>
  );
}
