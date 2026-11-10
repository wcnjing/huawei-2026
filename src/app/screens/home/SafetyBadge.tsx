import { useT } from "../../i18n";
import { IconShield } from "../../components/icons";

export function SafetyBadge({ safe, size = 20 }: { safe: boolean; size?: number }) {
  const t = useT();
  const color = safe ? "var(--green)" : "var(--red)";
  const glow = safe ? "0 0 calc(8px * var(--glow)) color-mix(in srgb, var(--green) 80%, transparent)" : "0 0 calc(8px * var(--glow)) color-mix(in srgb, var(--red) 80%, transparent)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ filter: `drop-shadow(${glow})` }}>
        <IconShield size={size} color={color} />
      </div>
      <div style={{ fontFamily: "var(--font-family-ui)", fontSize: "var(--font-ui-micro)", color, letterSpacing: 0.5 }}>
        {safe ? t("SAFE") : t("SCAMMED")}
      </div>
    </div>
  );
}
