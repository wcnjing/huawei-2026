import { useState } from "react";
import { IconBulb, IconShield } from "../../../components/icons";
import { PixelButton } from "../../../components/ui";
import { SOLO_COUNT } from "../../../data/drillPool";
import type { DrillPreferences } from "../../../data/drillPreferences";
import { useT } from "../../../i18n";
import { CountPicker } from "./CountPicker";

const COUNTS = Array.from({ length: SOLO_COUNT.max - SOLO_COUNT.min + 1 }, (_, i) => SOLO_COUNT.min + i);

export function SoloDrillIntroScreen({ onStart, onBack, preferences }: { onStart: (count: number) => void; onBack: () => void; preferences?: DrillPreferences }) {
  const t = useT();
  const [count, setCount] = useState<number>(SOLO_COUNT.default);
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4" }}>{t("INDIVIDUAL DRILL")}</div>
        <IconShield size={14} color="#4ecdc4" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffffff", marginBottom: 14, lineHeight: 1.7 }}>
          {t("Practise on your own. Each question is a message — decide what to do.")}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 14, lineHeight: 1.5 }}>
          {t(preferences && (preferences.interests.length || preferences.activities.length)
            ? "Practice mix guided by your selected interests and activities."
            : "Balanced practice mix across scam types.")}
        </div>
        <div style={{ backgroundColor: "#111827", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginBottom: 10 }}>{t("QUESTIONS PER ROUND")}</div>
          <CountPicker options={COUNTS} value={count} onChange={setCount} color="#4ecdc4" label={t("QUESTIONS PER ROUND")} />
        </div>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginBottom: 8 }}>{t("HOW IT WORKS")}</div>
          {["Inspect links and senders before deciding.", "Some messages are safe — read carefully!", "Use a hint if you're stuck.", "Wrong choices teach you what to watch for."].map((line) => (
            <div key={line} className="flex items-start gap-2 mb-2">
              <IconBulb size={10} color="#ffe66d" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>{t(line)}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <PixelButton onClick={() => onStart(count)} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>{t("[ START {count} QUESTIONS ]", { count })}</PixelButton>
          <PixelButton onClick={onBack} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>{t("[ BACK ]")}</PixelButton>
        </div>
      </div>
    </div>
  );
}
