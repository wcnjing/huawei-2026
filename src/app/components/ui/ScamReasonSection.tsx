import { IconWarning } from "../icons";
import { useState } from "react";
import type { DrillFlag } from "../../types/drills";

export function ScamReasonSection({ flags }: { flags: DrillFlag[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: "3px solid #ff2d55" }}>
        <IconWarning size={16} color="#ff2d55" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff2d55", letterSpacing: 1 }}>WHY IT WAS A SCAM</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {flags.map((flag, i) => {
          const isOpen = expanded === flag.id;
          return (
            <button key={flag.id} onClick={() => setExpanded(isOpen ? null : flag.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", padding: 0, border: "none", cursor: "pointer" }}>
              <div style={{ backgroundColor: isOpen ? "rgba(255,45,85,0.10)" : "#111827", border: `3px solid ${isOpen ? "#ff2d55" : "#2a3a5c"}`, boxShadow: isOpen ? "3px 3px 0 #ff2d55" : "none", padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, backgroundColor: "#ff2d55", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#0a0e1a" }}>{i + 1}</span>
                  </div>
                  <IconWarning size={14} color={isOpen ? "#ff2d55" : "#6b8ba4"} />
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isOpen ? "#ff2d55" : "#e8f4f8", flex: 1 }}>{flag.name}</div>
                  <svg width={10} height={8} viewBox="0 0 5 4" style={{ imageRendering: "pixelated", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <rect x={0} y={0} width={1} height={1} fill="#6b8ba4" />
                    <rect x={1} y={1} width={1} height={1} fill="#6b8ba4" />
                    <rect x={2} y={2} width={1} height={1} fill="#6b8ba4" />
                    <rect x={3} y={1} width={1} height={1} fill="#6b8ba4" />
                    <rect x={4} y={0} width={1} height={1} fill="#6b8ba4" />
                  </svg>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "2px solid rgba(255,45,85,0.3)", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6 }}>
                    {flag.explanation}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
