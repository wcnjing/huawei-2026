import { FAMILY_MEMBERS } from "../../data/familyMembers";
import { IconShield, IconCoin } from "../../components/icons";

export function FamilySafetyBar({ coins }: { coins: Record<string, number> }) {
  const safeCount = FAMILY_MEMBERS.filter((m) => m.safeThisWeek).length;
  const allSafe = safeCount === FAMILY_MEMBERS.length;
  const totalCoins = Object.values(coins).reduce((a, b) => a + b, 0);
  return (
    <div style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ filter: `drop-shadow(0 0 6px ${allSafe ? "#00ff88" : "#ff6b35"})`, flexShrink: 0 }}>
        <IconShield size={32} color={allSafe ? "#00ff88" : "#ff6b35"} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-label)", color: allSafe ? "#00ff88" : "#ff6b35", marginBottom: 4, letterSpacing: 0.5, }}>FAMILY SAFETY</div>
        <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-body)", color: "#6b8ba4", lineHeight: 1.4 }}>
          {safeCount}/{FAMILY_MEMBERS.length} members safe this week
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {FAMILY_MEMBERS.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ filter: `drop-shadow(0 0 3px ${m.safeThisWeek ? "#00ff88" : "#ff2d55"})` }}>
                <IconShield size={12} color={m.safeThisWeek ? "#00ff88" : "#ff2d55"} />
              </div>
              <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-micro)", color: "#6b8ba4" }}>{m.name.slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", padding: "7px 10px", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <IconCoin size={14} color="#ffe66d" />
          <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-subheading)", color: totalCoins >= 0 ? "#ffe66d" : "#ff2d55" }}>
            {totalCoins >= 0 ? "" : "-"}{Math.abs(totalCoins)}
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-micro)", color: "#6b8ba4" }}>FAMILY</div>
      </div>
    </div>
  );
}