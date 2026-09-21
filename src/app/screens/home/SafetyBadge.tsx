import { IconShield } from "../../components/icons";

export function SafetyBadge({ safe, size = 20 }: { safe: boolean; size?: number }) {
  const color = safe ? "#00ff88" : "#ff2d55";
  const glow = safe ? "0 0 8px rgba(0,255,136,0.8)" : "0 0 8px rgba(255,45,85,0.8)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ filter: `drop-shadow(${glow})` }}>
        <IconShield size={size} color={color} />
      </div>
      <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-micro)", color, letterSpacing: 0.5 }}>
        {safe ? "SAFE" : "SCAMMED"}
      </div>
    </div>
  );
}
