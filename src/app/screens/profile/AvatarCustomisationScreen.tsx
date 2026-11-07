import { useState, type ReactNode } from "react";
import type { AvatarConfig } from "../../types/profile";
import {
  ACCESSORIES,
  AccessoryPreview,
  CharacterAvatar,
  HAIR_COLORS,
  HAIR_STYLES,
  HairPreview,
  OUTFITS,
  OutfitPreview,
  PROFILE_COLORS,
  SKIN_TONES,
} from "../../components/avatars/character";
import { PixelButton } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { useT } from "../../i18n";
import { tint } from "../../utils/color";

const mono = "'Share Tech Mono', monospace";
type CustomisationTab = "skin" | "hair" | "outfit" | "accessories" | "profile";

const TABS: ReadonlyArray<{ id: CustomisationTab; label: string; short: string }> = [
  { id: "skin", label: "Skin tone", short: "SKIN" },
  { id: "hair", label: "Hair", short: "HAIR" },
  { id: "outfit", label: "Outfit", short: "OUTFIT" },
  { id: "accessories", label: "Accessories", short: "EXTRAS" },
  { id: "profile", label: "Profile colour and glow", short: "GLOW" },
];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: 12 }}>
      <div style={{ fontFamily: mono, fontSize: "var(--text-heading)", color: "var(--violet)", letterSpacing: 1 }}>{title}</div>
      {note && <div style={{ fontFamily: mono, fontSize: 9, color: "var(--muted-foreground)", marginTop: 5, lineHeight: 1.4 }}>{note}</div>}
      <div style={{ marginTop: 10 }}>{children}</div>
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
        minHeight: 82,
        minWidth: 0,
        padding: "8px 4px 7px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: selected ? "color-mix(in srgb, var(--violet-fill) 13%, transparent)" : "var(--background)",
        border: `3px solid ${selected ? "var(--violet-line)" : "var(--border)"}`,
        boxShadow: selected ? "2px 2px 0 var(--violet-line)" : "none",
        color: selected ? "var(--foreground-strong)" : "var(--soft-foreground)",
        cursor: "pointer",
      }}
    >
      {children}
      <span style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.2, textAlign: "center" }}>{label}</span>
    </button>
  );
}

const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 } as const;

export function AvatarCustomisationScreen({ avatar, onSave, onBack, onChange, onboardingFinish }: {
  avatar: AvatarConfig;
  onSave: (avatar: AvatarConfig) => void;
  onBack: () => void;
  onChange?: (avatar: AvatarConfig) => void;
  onboardingFinish?: boolean;
}) {
  // Local working copy so the preview updates live; committed on save/back.
  const t = useT();
  const [draft, setDraft] = useState<AvatarConfig>(avatar);
  const [tab, setTab] = useState<CustomisationTab>("skin");
  const update = (patch: Partial<AvatarConfig>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onChange?.(next);
  };
  const save = () => { onSave(draft); onBack(); };
  const hairEnabled = draft.hairStyle !== "none";

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={onboardingFinish ? t("DESIGN YOUR CHARACTER") : t("AVATAR")} titleColor="var(--violet)" onBack={save} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, flexShrink: 0, minHeight: 174, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${tint(draft.color, 18)}, transparent 68%), var(--card)`, border: `3px solid ${draft.color}`, boxShadow: `0 0 calc(18px * var(--glow)) ${draft.glow}`, overflow: "hidden" }}>
          <CharacterAvatar config={draft} size={148} animate title="Character preview" />
        </div>
        <div role="tablist" aria-label="Character customisation categories" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", margin: "12px 0", border: "3px solid var(--border)", background: "var(--background)" }}>
          {TABS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-label={item.label}
              onClick={() => setTab(item.id)}
              style={{ minWidth: 0, padding: "10px 1px", border: "none", borderRight: index < TABS.length - 1 ? "2px solid var(--border)" : "none", borderBottom: tab === item.id ? "4px solid var(--violet-line)" : "4px solid transparent", background: tab === item.id ? "var(--secondary)" : "transparent", color: tab === item.id ? "var(--foreground-strong)" : "var(--muted-foreground)", fontFamily: mono, fontSize: "var(--text-caption)", lineHeight: 1.2, letterSpacing: -0.2, cursor: "pointer" }}
            >
              {item.short}
            </button>
          ))}
        </div>

        {tab === "skin" && (
          <Section title="SKIN TONE">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              {SKIN_TONES.map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  aria-label={tone.label}
                  aria-pressed={draft.skinTone === tone.id}
                  title={tone.label}
                  onClick={() => update({ skinTone: tone.id })}
                  style={{
                    minWidth: 0,
                    height: 52,
                    padding: 5,
                    background: draft.skinTone === tone.id ? "color-mix(in srgb, var(--violet-fill) 13%, transparent)" : "var(--background)",
                    border: `3px solid ${draft.skinTone === tone.id ? "var(--violet-line)" : "var(--border)"}`,
                    boxShadow: draft.skinTone === tone.id ? "2px 2px 0 var(--violet-line)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <span aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", background: tone.swatch, border: "2px solid var(--outline)" }} />
                </button>
              ))}
            </div>
          </Section>
        )}

        {tab === "hair" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Section title="HAIR COLOUR">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7, opacity: hairEnabled ? 1 : 0.35 }}>
                {HAIR_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    disabled={!hairEnabled}
                    aria-label={color.label}
                    aria-pressed={draft.hairColor === color.id}
                    onClick={() => update({ hairColor: color.id })}
                    style={{ height: 39, background: color.swatch, border: `4px solid ${draft.hairColor === color.id ? "var(--foreground-strong)" : "var(--outline)"}`, outline: draft.hairColor === color.id ? "2px solid var(--violet-line)" : "none", cursor: hairEnabled ? "pointer" : "not-allowed" }}
                  />
                ))}
              </div>
            </Section>
            <Section title="HAIRSTYLE">
              <div style={grid}>
                {HAIR_STYLES.map((style) => (
                  <Choice key={style.id} selected={draft.hairStyle === style.id} label={style.label} onClick={() => update({ hairStyle: style.id })}>
                    {style.id === "none" ? (
                      <span aria-hidden="true" style={{ width: 48, height: 48, display: "grid", placeItems: "center", border: "3px dashed var(--muted-foreground)", color: "var(--soft-foreground)", fontFamily: mono, fontSize: "var(--text-hero)" }}>∅</span>
                    ) : (
                      <HairPreview style={style.id} color={draft.hairColor} label={`${style.label} hairstyle`} />
                    )}
                  </Choice>
                ))}
              </div>
            </Section>
          </div>
        )}

        {tab === "outfit" && (
          <Section title="OUTFIT">
            <div style={grid}>
              {OUTFITS.map((outfit) => (
                <Choice key={outfit.id} selected={draft.outfit === outfit.id} label={outfit.label} onClick={() => update({ outfit: outfit.id })}>
                  <OutfitPreview outfit={outfit.id} label={`${outfit.label} outfit`} />
                </Choice>
              ))}
            </div>
          </Section>
        )}

        {tab === "accessories" && (
          <Section title="ACCESSORIES">
            <div style={grid}>
              {ACCESSORIES.map((accessory) => {
                const selected = draft.accessories.includes(accessory.id);
                return (
                  <Choice key={accessory.id} selected={selected} label={accessory.label} onClick={() => update({ accessories: selected ? draft.accessories.filter((id) => id !== accessory.id) : [...draft.accessories, accessory.id] })}>
                    <AccessoryPreview accessory={accessory.id} label={accessory.label} />
                  </Choice>
                );
              })}
            </div>
          </Section>
        )}

        {tab === "profile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Section title="PROFILE COLOUR">
              <div className="flex gap-3 flex-wrap">
                {PROFILE_COLORS.map((color) => (
                  <button key={color} type="button" aria-label={`Use ${color} profile colour`} aria-pressed={draft.color === color} onClick={() => update({ color })}
                    style={{ width: 40, height: 40, backgroundColor: color, border: `4px solid ${draft.color === color ? "var(--foreground-strong)" : "var(--outline)"}`, outline: draft.color === color ? "2px solid var(--violet-line)" : "none", cursor: "pointer" }} />
                ))}
              </div>
            </Section>
            <Section title="PROFILE GLOW">
              <div className="flex gap-3 flex-wrap">
                {PROFILE_COLORS.map((color) => (
                  <button key={color} type="button" aria-label={`Use ${color} profile glow`} aria-pressed={draft.glow === color} onClick={() => update({ glow: color })}
                    style={{ width: 40, height: 40, backgroundColor: "var(--card)", border: `4px solid ${draft.glow === color ? "var(--foreground-strong)" : "var(--outline)"}`, boxShadow: `inset 0 0 9px ${color}, 0 0 calc(8px * var(--glow)) ${color}`, outline: draft.glow === color ? "2px solid var(--violet-line)" : "none", cursor: "pointer" }} />
                ))}
              </div>
            </Section>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          {onboardingFinish ? (
            <PixelButton onClick={save} color="var(--green-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ ENTER DRILL MODE ]")}</PixelButton>
          ) : (
            <div className="flex gap-3">
              <div style={{ flex: 1 }}><PixelButton onClick={save} color="var(--violet-fill)" textColor="var(--on-fill)" size="sm" full>{t("[ SAVE AVATAR ]")}</PixelButton></div>
              <div style={{ flex: 1 }}><PixelButton onClick={onBack} color="var(--border)" textColor="var(--foreground)" size="sm" full>{t("[ CANCEL ]")}</PixelButton></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
