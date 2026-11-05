import { useT } from "../../i18n";
import { IconHouse, IconPerson, IconStore, IconTrophy } from "../icons";
import type { Tab } from "../../types/navigation";

export function BottomNav({ activeTab, drillActive = false, onTab, onDrillSelect }: { activeTab: Tab; drillActive?: boolean; onTab: (t: Tab) => void; onDrillSelect: () => void }) {
  const t = useT();
  const leftItems: { tab: Tab; icon: React.ReactNode; label: string; activeColor: string }[] = [
    { tab: "home", icon: <IconHouse size={18} color={!drillActive && activeTab === "home" ? "var(--green)" : "var(--muted-foreground)"} />, label: "HOME", activeColor: "var(--green)" },
    { tab: "leaderboard", icon: <IconTrophy size={18} color={!drillActive && activeTab === "leaderboard" ? "var(--yellow)" : "var(--muted-foreground)"} />, label: "RANKS", activeColor: "var(--yellow)" },
  ];
  const rightItems: { tab: Tab; icon: React.ReactNode; label: string; activeColor: string }[] = [
    { tab: "store", icon: <IconStore size={18} color={!drillActive && activeTab === "store" ? "var(--violet)" : "var(--muted-foreground)"} />, label: "STORE", activeColor: "var(--violet)" },
    { tab: "profile", icon: <IconPerson size={18} color={!drillActive && activeTab === "profile" ? "var(--teal)" : "var(--muted-foreground)"} />, label: "PROFILE", activeColor: "var(--teal)" },
  ];
  return (
    <div data-tour="bottom-nav" className="bottom-nav flex items-stretch" style={{ borderTop: "4px solid var(--border)", backgroundColor: "var(--background)", flexShrink: 0 }}>
      {leftItems.map((item) => (
        <button key={item.tab} data-tour={item.tab === "leaderboard" ? "nav-ranks" : undefined} onClick={() => onTab(item.tab)} className="flex-1 flex flex-col items-center justify-center gap-1" style={{ background: "none", border: "none", borderTop: !drillActive && activeTab === item.tab ? `4px solid ${item.activeColor}` : "4px solid transparent", cursor: "pointer", paddingTop: 6 }}>
          {item.icon}
          <div className="bottom-nav-label" style={{ fontFamily: "'Share Tech Mono', monospace", color: !drillActive && activeTab === item.tab ? item.activeColor : "var(--soft-foreground)" }}>{t(item.label)}</div>
        </button>
      ))}
      <div data-tour="nav-drill" className="flex items-center justify-center px-1" style={{ flexShrink: 0 }}>
        <button className="bottom-nav-drill" aria-current={drillActive ? "page" : undefined} onClick={onDrillSelect} style={{ backgroundColor: "var(--green-fill)", border: drillActive ? "4px solid var(--foreground)" : "4px solid var(--outline)", boxShadow: "0 -4px 0 color-mix(in srgb, var(--green-line) 40%, var(--background)), 4px 0 0 color-mix(in srgb, var(--green-line) 40%, var(--background)), -4px 0 0 color-mix(in srgb, var(--green-line) 40%, var(--background))", cursor: "pointer", width: 64, height: 64, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--on-fill)", lineHeight: 1 }}>▶</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{t("DRILL")}</div>
        </button>
      </div>
      {rightItems.map((item) => (
        <button key={item.tab} data-tour={item.tab === "store" ? "nav-store" : undefined} onClick={() => onTab(item.tab)} className="flex-1 flex flex-col items-center justify-center gap-1" style={{ background: "none", border: "none", borderTop: !drillActive && activeTab === item.tab ? `4px solid ${item.activeColor}` : "4px solid transparent", cursor: "pointer", paddingTop: 6 }}>
          {item.icon}
          <div className="bottom-nav-label" style={{ fontFamily: "'Share Tech Mono', monospace", color: !drillActive && activeTab === item.tab ? item.activeColor : "var(--soft-foreground)" }}>{t(item.label)}</div>
        </button>
      ))}
    </div>
  );
}
