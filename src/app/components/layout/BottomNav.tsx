import { IconHouse, IconPerson, IconStore, IconTrophy } from "../icons";
import type { Tab } from "../../types/navigation";

export function BottomNav({ activeTab, drillActive = false, onTab, onDrillSelect }: { activeTab: Tab; drillActive?: boolean; onTab: (t: Tab) => void; onDrillSelect: () => void }) {
  const leftItems: { tab: Tab; icon: React.ReactNode; label: string; activeColor: string }[] = [
    { tab: "home", icon: <IconHouse size={18} color={!drillActive && activeTab === "home" ? "#00ff88" : "#52647e"} />, label: "HOME", activeColor: "#00ff88" },
    { tab: "leaderboard", icon: <IconTrophy size={18} color={!drillActive && activeTab === "leaderboard" ? "#ffe66d" : "#52647e"} />, label: "RANKS", activeColor: "#ffe66d" },
  ];
  const rightItems: { tab: Tab; icon: React.ReactNode; label: string; activeColor: string }[] = [
    { tab: "store", icon: <IconStore size={18} color={!drillActive && activeTab === "store" ? "#c77dff" : "#52647e"} />, label: "STORE", activeColor: "#c77dff" },
    { tab: "profile", icon: <IconPerson size={18} color={!drillActive && activeTab === "profile" ? "#4ecdc4" : "#52647e"} />, label: "PROFILE", activeColor: "#4ecdc4" },
  ];
  return (
    <div data-tour="bottom-nav" className="flex items-stretch" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a", minHeight: 68, flexShrink: 0 }}>
      {leftItems.map((item) => (
        <button key={item.tab} onClick={() => onTab(item.tab)} className="flex-1 flex flex-col items-center justify-center gap-1" style={{ background: "none", border: "none", borderTop: !drillActive && activeTab === item.tab ? `4px solid ${item.activeColor}` : "4px solid transparent", cursor: "pointer", paddingTop: 6 }}>
          {item.icon}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: !drillActive && activeTab === item.tab ? item.activeColor : "#52647e" }}>{item.label}</div>
        </button>
      ))}
      <div data-tour="nav-drill" className="flex items-center justify-center px-1" style={{ flexShrink: 0 }}>
        <button aria-current={drillActive ? "page" : undefined} onClick={onDrillSelect} style={{ backgroundColor: "#00ff88", border: drillActive ? "4px solid #e8f4f8" : "4px solid #0a0e1a", boxShadow: "0 -4px 0 #006633, 4px 0 0 #006633, -4px 0 0 #006633", cursor: "pointer", width: 58, height: 58, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 6 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 14, color: "#0a0e1a", lineHeight: 1 }}>▶</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 6, color: "#0a0e1a" }}>DRILL</div>
        </button>
      </div>
      {rightItems.map((item) => (
        <button key={item.tab} onClick={() => onTab(item.tab)} className="flex-1 flex flex-col items-center justify-center gap-1" style={{ background: "none", border: "none", borderTop: !drillActive && activeTab === item.tab ? `4px solid ${item.activeColor}` : "4px solid transparent", cursor: "pointer", paddingTop: 6 }}>
          {item.icon}
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: !drillActive && activeTab === item.tab ? item.activeColor : "#52647e" }}>{item.label}</div>
        </button>
      ))}
    </div>
  );
}
