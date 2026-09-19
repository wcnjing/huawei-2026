import type { DrillFlag } from "../../types/drills";
import { IconX, IconWarning } from "../icons";

export function FlagTooltip({ flag, onClose }: { flag: DrillFlag; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        backgroundColor: "rgba(10,14,26,0.95)",
        borderTop: "3px solid #ff2d55",
        padding: "12px 16px 16px",
        backdropFilter: "blur(4px)",
        animation: "slideUp 0.15s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flexShrink: 0, marginTop: 2 }}>
          <IconWarning size={16} color="#ff2d55" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ff2d55", marginBottom: 6, letterSpacing: 1 }}>
            {flag.name}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#e8f4f8", lineHeight: 1.5 }}>
            {flag.explanation}
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", flexShrink: 0, padding: 4 }}>
          <IconX size={12} color="#6b8ba4" />
        </button>
      </div>
    </div>
  );
}