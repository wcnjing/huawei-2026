import { useState, type ReactNode } from "react";
import { PixelButton } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import {
  ACTIVITIES, AGE_RANGES, CHANNELS, DEFAULT_DRILL_PREFERENCES, INTERESTS, SITUATIONS,
  type DrillPreferences,
} from "../../data/drillPreferences";
import { useT } from "../../i18n";

const mono = "'Share Tech Mono', monospace";

export function DrillPreferencesScreen({ preferences, onSave, onBack, onboarding = false }: {
  preferences: DrillPreferences;
  onSave: (preferences: DrillPreferences) => void;
  onBack?: () => void;
  onboarding?: boolean;
}) {
  const t = useT();
  const [draft, setDraft] = useState<DrillPreferences>(preferences);
  const [step, setStep] = useState(0);
  const change = (patch: Partial<DrillPreferences>) => setDraft(previous => ({ ...previous, ...patch }));
  const toggle = (key: "activities" | "interests" | "channels", id: string) => {
    change({ [key]: draft[key].includes(id) ? draft[key].filter(value => value !== id) : [...draft[key], id] });
  };
  const finish = (value = draft) => onSave({ ...value, completed: true });
  const chip = (label: string, selected: boolean, action: () => void) => (
    <button key={label} type="button" aria-pressed={selected} onClick={action}
      style={{ minHeight: 44, padding: "9px 10px", border: `2px solid ${selected ? "#4ecdc4" : "#2a3a5c"}`, background: selected ? "#163538" : "#111827", color: selected ? "#e8f4f8" : "#9bb0c8", fontFamily: mono, fontSize: "var(--text-body)", lineHeight: 1.5, textAlign: "left", cursor: "pointer" }}>
      {selected ? "☑ " : "□ "}{t(label)}
    </button>
  );
  const section = (heading: string, children: ReactNode) => (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ color: "#4ecdc4", fontFamily: mono, fontSize: "var(--text-label)", lineHeight: 1.5, margin: "0 0 10px" }}>{t(heading)}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>{children}</div>
    </section>
  );
  const context = !onboarding || step === 0;
  const training = !onboarding || step === 1;

  return <div className="flex flex-col h-full">
    {onboarding ? <div style={{ padding: "14px 16px", borderBottom: "3px solid #2a3a5c", color: "#4ecdc4", fontFamily: mono, fontSize: "var(--text-body)", lineHeight: 1.5 }}>{t(step === 0 ? "MAKE DRILLS MORE RELEVANT" : "CHOOSE YOUR TRAINING")} · {step + 1}/2</div>
      : <SubPageHeader title={t("PREFERENCES")} titleColor="#4ecdc4" onBack={onBack || (() => {})} />}
    <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
      <p style={{ color: "#9bb0c8", fontFamily: mono, fontSize: "var(--text-body)", lineHeight: 1.5, margin: "0 0 20px" }}>
        {t("Preferences are optional. They help us recommend drills that are more relevant to you.")}
      </p>
      {context && <>
        {section("AGE RANGE", AGE_RANGES.map(value => chip(value, draft.ageRange === value, () => change({ ageRange: draft.ageRange === value ? "" : value }))))}
        {section("CURRENT SITUATION", SITUATIONS.map(value => chip(value, draft.situation === value, () => change({ situation: draft.situation === value ? "" : value }))))}
        {section("WHAT DO YOU REGULARLY DO?", ACTIVITIES.map(item => chip(item.label, draft.activities.includes(item.id), () => toggle("activities", item.id))))}
      </>}
      {training && <>
        {section("WHAT WOULD YOU LIKE TO PRACTISE?", INTERESTS.map(item => chip(item.label, draft.interests.includes(item.id), () => toggle("interests", item.id))))}
        {section("HOW WOULD YOU LIKE TO PRACTISE?", CHANNELS.map(channel => chip(channel === "call" ? "Phone calls" : channel === "sms" ? "SMS" : "Email", draft.channels.includes(channel), () => toggle("channels", channel))))}
        {section("MORE OPTIONS", chip("Occasionally show other scam types", draft.includeOtherTypes, () => change({ includeOtherTypes: !draft.includeOtherTypes })))}
      </>}
      {onboarding ? <>
        <PixelButton onClick={() => step === 0 ? setStep(1) : finish()} color="#00ff88" size="lg" full>{t(step === 0 ? "[ CONTINUE ]" : "[ SAVE & CONTINUE ]")}</PixelButton>
        <div style={{ marginTop: 10 }}><PixelButton onClick={() => finish(step === 0 ? DEFAULT_DRILL_PREFERENCES : { ...draft, interests: [], channels: [...DEFAULT_DRILL_PREFERENCES.channels], includeOtherTypes: true })} color="#1a2340" textColor="#9bb0c8" size="sm" full>{t("SKIP — I'LL PERSONALISE LATER")}</PixelButton></div>
      </> : <PixelButton onClick={() => finish()} color="#00ff88" size="lg" full>{t("[ SAVE PREFERENCES ]")}</PixelButton>}
    </div>
  </div>;
}
