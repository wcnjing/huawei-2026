import { useState } from "react";

export function InspectableLink({ label, url, onReveal, showWarning = true }: { label: string; url: string; onReveal?: () => void; showWarning?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      <button onClick={() => { setRevealed((r) => !r); if (!revealed) onReveal?.(); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        <span style={{ fontFamily: "sans-serif", fontSize: "var(--text-body)", color: "#1a73e8", textDecoration: "underline" }}>{label}</span>
      </button>
      {revealed && (
        <div style={{ marginTop: 6, backgroundColor: showWarning ? "rgba(255,45,85,0.08)" : "rgba(78,205,196,0.08)", border: `2px solid ${showWarning ? "#ff2d55" : "#4ecdc4"}`, padding: "8px 10px", animation: "slideUp 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: showWarning ? "#ff2d55" : "#4ecdc4", marginBottom: 4 }}>ACTUAL URL:</div>
          <div style={{ fontFamily: "monospace", fontSize: "var(--text-body)", color: showWarning ? "#ff6b35" : "#4ecdc4", wordBreak: "break-all" }}>{url}</div>
          {showWarning && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55", marginTop: 4 }}>⚠ SUSPICIOUS DOMAIN — DO NOT VISIT</div>}
        </div>
      )}
    </div>
  );
}
