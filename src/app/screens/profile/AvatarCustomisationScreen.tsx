import { useState, type ReactNode } from "react";
import type { AvatarConfig } from "../../types/profile";
import {
  ACCESSORIES,
  CharacterAvatar,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  PROFILE_COLORS,
  SKIN_TONES,
} from "../../components/avatars/character";
import { PixelButton } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";

const mono = "'Share Tech Mono', monospace";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px", marginBottom: 10 }}>
      <div style={{ fontFamily: mono, fontSize: "var(--text-caption)", color: "#c77dff", marginBottom: 10, letterSpacing: 1 }}>{title}</div>
      {children}
    </section>
  );
}

function Choice({ selected, label, onClick, children }: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      style={{
        minHeight: 72,
        minWidth: 0,
        padding: "7px 4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 5,
        background: selected ? "rgba(199,125,255,0.13)" : "#0a0e1a",
        border: `3px solid ${selected ? "#c77dff" : "#2a3a5c"}`,
        boxShadow: selected ? "2px 2px 0 #c77dff" : "none",
        color: selected ? "#ffffff" : "#9bb0c8",
        cursor: "pointer",
      }}
    >
      {children}
      <span style={{ fontFamily: mono, fontSize: 9, lineHeight: 1.2, textAlign: "center" }}>{label}</span>
    </button>
  );
}

export function AvatarCustomisationScreen({ avatar, onSave, onBack, onChange, onboarding }: {
  avatar: AvatarConfig;
  onSave: (avatar: AvatarConfig) => void;
  onBack: () => void;
  onChange?: (avatar: AvatarConfig) => void;
  onboarding?: { name: string; onName: (name: string) => void; onContinue: () => void };
}) {
  const [draft, setDraft] = useState<AvatarConfig>(avatar);
  const update = (patch: Partial<AvatarConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange?.(next);
  };
  const save = () => { onSave(draft); onBack(); };
  const nameOk = !!onboarding && /^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u.test(onboarding.name.trim());
  const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 } as const;

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={onboarding ? "DESIGN YOUR CHARACTER" : "YOUR CHARACTER"} titleColor="#c77dff" onBack={save} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {onboarding && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: mono, fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 8 }}>WHAT SHOULD WE CALL YOU?</div>
            <input
              maxLength={30}
              value={onboarding.name}
              onChange={(event) => onboarding.onName(event.target.value)}
              placeholder="YOUR NAME"
              autoComplete="nickname"
              style={{ width: "100%", padding: 12, backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", color: "#e8f4f8", fontFamily: mono, fontSize: "var(--text-body)", outline: "none" }}
            />
          </div>
        )}

        <div style={{ minHeight: 172, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, background: "radial-gradient(circle, rgba(199,125,255,.16), transparent 68%), #111827", border: "3px solid #c77dff", boxShadow: `0 0 16px ${draft.glow}`, overflow: "hidden" }}>
          <CharacterAvatar config={draft} size={144} animate title="Character preview" />
        </div>

        <Section title="SKIN TONE">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {SKIN_TONES.map((tone) => (
              <Choice key={tone.id} selected={draft.skinTone === tone.id} label={tone.label} onClick={() => update({ skinTone: tone.id })}>
                <span style={{ width: 30, height: 30, background: tone.swatch, border: "2px solid #0a0e1a" }} />
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="HAIR STYLE">
          <div style={grid}>
            {HAIR_STYLES.map((style) => (
              <Choice key={style.id} selected={draft.hairStyle === style.id} label={style.label} onClick={() => update({ hairStyle: style.id })}>
                <CharacterAvatar config={{ ...draft, hairStyle: style.id }} size={56} title={`${style.label} hairstyle`} />
              </Choice>
            ))}
          </div>
        </Section>

        <Section title="HAIR COLOUR">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {HAIR_COLORS.map((color) => (
              <button key={color.id} type="button" aria-label={color.label} aria-pressed={draft.hairColor === color.id} onClick={() => update({ hairColor: color.id })}
                style={{ height: 42, background: color.swatch, border: `4px solid ${draft.hairColor === color.id ? "#ffffff" : "#0a0e1a"}`, outline: draft.hairColor === color.id ? "2px solid #c77dff" : "none", cursor: "pointer" }} />
            ))}
          </div>
        </Section>

        <Section title="OUTFIT">
          <div style={grid}>
            {OUTFITS.map((outfit) => (
              <Choice key={outfit.id} selected={draft.outfit === outfit.id} label={outfit.label} onClick={() => update({ outfit: outfit.id })}>
                <CharacterAvatar config={{ ...draft, outfit: outfit.id }} size={64} title={`${outfit.label} outfit`} />
              </Choice>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontSize: "var(--text-caption)", color: "#6b8ba4", marginTop: 10, lineHeight: 1.4 }}>
            Every character stays fully dressed. Blue shirt + black pants is the default.
          </div>
        </Section>

        <Section title="ACCESSORIES">
          <div style={grid}>
            {ACCESSORIES.map((accessory) => {
              const selected = draft.accessories.includes(accessory.id);
              return (
                <Choice key={accessory.id} selected={selected} label={accessory.label} onClick={() => update({ accessories: selected ? draft.accessories.filter((id) => id !== accessory.id) : [...draft.accessories, accessory.id] })}>
                  <CharacterAvatar config={{ ...draft, accessories: [accessory.id] }} size={56} title={accessory.label} />
                </Choice>
              );
            })}
          </div>
        </Section>

        <Section title="PROFILE GLOW">
          <div className="flex gap-3 flex-wrap">
            {PROFILE_COLORS.map((color) => (
              <button key={color} type="button" aria-label={`Use ${color} profile glow`} aria-pressed={draft.glow === color} onClick={() => update({ glow: color, color })}
                style={{ width: 34, height: 34, backgroundColor: color, border: `4px solid ${draft.glow === color ? "#fff" : "#0a0e1a"}`, cursor: "pointer" }} />
            ))}
          </div>
        </Section>

        {onboarding ? (
          <PixelButton onClick={onboarding.onContinue} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={!nameOk}>[ CONTINUE ]</PixelButton>
        ) : (
          <div className="flex gap-3">
            <div style={{ flex: 1 }}><PixelButton onClick={save} color="#c77dff" textColor="#0a0e1a" size="sm" full>[ SAVE CHARACTER ]</PixelButton></div>
            <div style={{ flex: 1 }}><PixelButton onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>[ CANCEL ]</PixelButton></div>
          </div>
        )}
      </div>
    </div>
  );
}
