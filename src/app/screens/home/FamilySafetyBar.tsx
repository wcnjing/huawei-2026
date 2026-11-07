import { useT } from "../../i18n";
import { IconShield } from "../../components/icons";
import { useMembers } from "../../hooks/useMembers";

export function FamilySafetyBar({ onPayday, paydayClaimedThisWeek }: { onPayday: () => void; paydayClaimedThisWeek: boolean }) {
  const t = useT();
  const members = useMembers();
  const safeCount = members.filter((m) => m.safeThisWeek).length;
  const allSafe = members.length > 0 && safeCount === members.length;
  return (
    <div style={{ backgroundColor: "var(--card)", borderBottom: "4px solid var(--border)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ filter: `drop-shadow(0 0 calc(6px * var(--glow)) ${allSafe ? "var(--green)" : "var(--orange)"})`, flexShrink: 0 }}>
        <IconShield size={32} color={allSafe ? "var(--green)" : "var(--orange)"} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: allSafe ? "var(--green)" : "var(--orange)", marginBottom: 4 }}>{t("HOUSE SAFETY")}</div>
        <div className="house-safety-members" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {members.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ filter: `drop-shadow(0 0 calc(3px * var(--glow)) ${m.safeThisWeek ? "var(--green)" : "var(--red)"})` }}>
                <IconShield size={10} color={m.safeThisWeek ? "var(--green)" : "var(--red)"} />
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{m.name.slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={`home-payday-tile${paydayClaimedThisWeek ? " is-collected" : ""}`}
        data-tour="payday-tile"
        onClick={onPayday}
        aria-label={paydayClaimedThisWeek ? t("Payday Sunday, weekly pay collected. View payday.") : t("Payday Sunday, collect your weekly pay.")}
        title={t("Open Payday Sunday")}
      >
        <div className="home-payday-label">{paydayClaimedThisWeek ? t("PAY COLLECTED") : t("COLLECT PAY")}</div>
      </button>
    </div>
  );
}
