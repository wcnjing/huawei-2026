import type { AvatarConfig } from "../../types/profile";
import { PixelMascot } from "../../components/avatars";
import { PixelButton } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { useState } from "react";

export function AvatarCustomisationScreen({ avatar, onSave, onBack }: {
  avatar: AvatarConfig; onSave: (a: AvatarConfig) => void; onBack: () => void;
}) {
  // Local working copy so the preview updates live; committed on save/back.
  const [draft, setDraft] = useState<AvatarConfig>(avatar);
  const set = (patch: Partial<AvatarConfig>) => setDraft((d) => ({ ...d, ...patch }));
  const palette = ["#4ecdc4", "#ff6b35", "#c77dff", "#ffe66d", "#ff2d55", "#00ff88"];

  const save = () => { onSave(draft); onBack(); };

  const colorRows: { label: string; key: "color" | "glow" }[] = [
    { label: "AVATAR COLOUR", key: "color" },
    { label: "GLOW COLOUR", key: "glow" },
  ];
  const optionRows: { label: string; key: "hat" | "eyes" | "outfit"; opts: string[] }[] = [
    { label: "HELMET / HAT", key: "hat", opts: ["None", "Cap", "Helmet", "Crown"] },
    { label: "EYE STYLE", key: "eyes", opts: ["Default", "Shades", "Visor", "Goggles"] },
    { label: "OUTFIT", key: "outfit", opts: ["Standard", "Camo", "Neon", "Stealth"] },
  ];

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="AVATAR" titleColor="#c77dff" onBack={save} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex justify-center mb-4" style={{ padding: "16px", backgroundColor: "#111827", border: "3px solid #c77dff", boxShadow: `0 0 16px ${draft.glow}` }}>
          <PixelMascot size={80} animate color={draft.color} hat={draft.hat} eyes={draft.eyes} outfit={draft.outfit} />
        </div>
        {colorRows.map((row) => (
          <div key={row.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#c77dff", marginBottom: 8 }}>{row.label}</div>
            <div className="flex gap-3 flex-wrap">{palette.map((c) => (<button key={c} onClick={() => set({ [row.key]: c })} style={{ width: 32, height: 32, backgroundColor: c, border: `4px solid ${draft[row.key] === c ? "#fff" : "#0a0e1a"}`, cursor: "pointer" }} />))}</div>
          </div>
        ))}
        {optionRows.map((sec) => (
          <div key={sec.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#c77dff", marginBottom: 8 }}>{sec.label}</div>
            <div className="flex gap-2 flex-wrap">{sec.opts.map((opt) => { const on = draft[sec.key] === opt; return (
              <button key={opt} onClick={() => set({ [sec.key]: opt })} style={{ backgroundColor: on ? "#c77dff" : "#0a0e1a", border: `2px solid ${on ? "#c77dff" : "#2a3a5c"}`, padding: "4px 8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: on ? "#0a0e1a" : "#6b8ba4" }}>{opt}</button>
            ); })}</div>
          </div>
        ))}
        <div className="flex gap-3">
          <div style={{ flex: 1 }}><PixelButton onClick={save} color="#c77dff" textColor="#0a0e1a" size="sm" full>[ SAVE AVATAR ]</PixelButton></div>
          <div style={{ flex: 1 }}><PixelButton onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ CANCEL ]</PixelButton></div>
        </div>
      </div>
    </div>
  );
}