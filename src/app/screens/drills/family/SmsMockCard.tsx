import { InspectableLink } from "../../../components/ui";
import type { FamilyScenario } from "../../../types/drills";

export function SmsMockCard({ scenario, showWarning, onSenderTap }: {
  scenario: FamilyScenario; showWarning: boolean; onSenderTap: () => void;
}) {
  const avatarColor = scenario.isScam ? "#f4a261" : "#4ecdc4";
  return (
    <div style={{ maxWidth: 270, margin: "0 auto", border: "4px solid #2a3a5c", boxShadow: "4px 4px 0 #2a3a5c" }}>
      <div style={{ backgroundColor: "#1a1a2e", padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: "var(--text-body)", color: "#aaa" }}>9:41</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[6, 9, 12].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, backgroundColor: "#aaa" }} />
          ))}
          <div style={{ width: 3, height: 12, backgroundColor: "#aaa", marginLeft: 4 }} />
        </div>
      </div>
      <button onClick={onSenderTap} style={{ width: "100%", backgroundColor: "#f0f0f2", borderBottom: "1px solid #ddd", padding: "8px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}>
        <div style={{ fontFamily: "monospace", fontSize: "var(--text-title)", color: "#555", lineHeight: 1 }}>‹</div>
        <div style={{ width: 28, height: 28, backgroundColor: avatarColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: "bold", color: "#fff" }}>{scenario.sender[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", fontWeight: 600, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scenario.sender}</div>
          <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#888" }}>Tap to inspect sender</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", border: "1px solid #4ecdc4", padding: "2px 4px", flexShrink: 0 }}>INFO</div>
      </button>
      <div style={{ backgroundColor: "#f5f5f7", padding: "12px 10px", minHeight: 100 }}>
        <div style={{ textAlign: "center", fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#999", marginBottom: 10 }}>{scenario.timestamp}</div>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div style={{ backgroundColor: "#e5e5ea", borderRadius: "14px 14px 14px 2px", padding: "10px 12px", maxWidth: "85%", wordBreak: "break-word" }}>
            <div style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#1a1a1a", lineHeight: 1.55 }}>
              {scenario.message.split(/(https?:\/\/\S+)/g).map((part, i) =>
                /^https?:\/\//.test(part) ? (
                  <div key={i} style={{ marginTop: 4 }}>
                    <InspectableLink label={part} url={part} showWarning={showWarning} />
                  </div>
                ) : <span key={i}>{part}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
