import { SAFETY_TIPS } from "../../data/safetyTips";
import { IconBadge } from "../../components/icons";
import { useState } from "react";

export function SafetyHabitsDropdown() {
  const [open, setOpen] = useState(false);
  const panelId = "safety-habits-panel";
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-start gap-3"
        style={{ width: "100%", textAlign: "left", backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", cursor: "pointer" }}
      >
        <IconBadge size={22} color="#ffe66d" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", letterSpacing: 1 }}>SAFETY HABITS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35" }}>{open ? "▲" : "▼"}</div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5, marginTop: 6 }}>
            A missed drill is private. Use it to practise the next response — never to rank or shame someone.
          </div>
        </div>
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-3" style={{ marginTop: 10 }}>
          {SAFETY_TIPS.map((tip) => (
            <div key={tip.num} className="flex items-start gap-3" style={{ backgroundColor: "#111827", border: `3px solid ${tip.color}`, padding: 14 }}>
              <div style={{ width: 34, height: 34, flexShrink: 0, border: `2px solid ${tip.color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: tip.color }}>{tip.num}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: tip.color, letterSpacing: 1, marginBottom: 4 }}>{tip.title}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", lineHeight: 1.5 }}>{tip.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
