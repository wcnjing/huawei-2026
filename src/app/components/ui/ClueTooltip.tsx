import type { FamilyClue } from "../../types/drills";
import { IconX, IconBulb } from "../icons";

export function ClueTooltip({ clue, onClose }: { clue: FamilyClue; onClose: () => void }) {
  return (
    <div style={{ position: "absolute", top: "25%", left: 12, right: 12, zIndex: 60, backgroundColor: "#111827", border: "4px solid #ffe66d", boxShadow: "4px 4px 0 #ffe66d", animation: "slideUp 0.2s ease-out" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "3px solid #2a3a5c" }}>
        <div className="flex items-center gap-2"><IconBulb size={12} color="#ffe66d" /><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#ffe66d" }}>CLUE</div></div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX size={14} color="#6b8ba4" /></button>
      </div>
      <div className="px-4 py-3 flex flex-col gap-2">
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ff6b35" }}>{clue.label}</div>
        <div style={{ backgroundColor: "rgba(255,107,53,0.15)", border: "2px solid #ff6b35", padding: "6px 8px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ff6b35" }}>"{clue.text}"</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#e8f4f8", lineHeight: 1.6 }}>{clue.explanation}</div>
      </div>
    </div>
  );
}