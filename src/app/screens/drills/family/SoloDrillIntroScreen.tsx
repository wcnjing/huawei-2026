import { useEffect, useState } from "react";
import { IconBulb, IconShield } from "../../../components/icons";
import { PixelButton } from "../../../components/ui";
import { SOLO_COUNTS, SOLO_DEFAULT_COUNT } from "../../../data/drillPool";
import { SAFETY_TIPS } from "../../../data/safetyTips";
import { ink } from "../../../utils/color";
import type { PresurveyResponses } from "../../../data/presurvey";
import { useT } from "../../../i18n";
import { CountPicker } from "./CountPicker";

/** How long the player waits before being offered ready-made questions instead. */
const SKIP_OFFER_MS = 6000;
const TIP_MS = 4000;

export function SoloDrillIntroScreen({ onStart, onBack, onSkipWait, preferences, loading = false }: { onStart: (count: number) => void; onBack: () => void; onSkipWait?: () => void; preferences?: PresurveyResponses; loading?: boolean }) {
  const t = useT();
  const [count, setCount] = useState<number>(SOLO_DEFAULT_COUNT);
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!loading) { setWaited(0); return; }
    const started = Date.now();
    const timer = window.setInterval(() => setWaited(Date.now() - started), 500);
    return () => window.clearInterval(timer);
  }, [loading]);
  const tip = SAFETY_TIPS[Math.floor(waited / TIP_MS) % SAFETY_TIPS.length];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "var(--background)", borderBottom: "4px solid var(--border)", minHeight: 56, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--teal)" }}>{t("INDIVIDUAL DRILL")}</div>
        <IconShield size={14} color="var(--teal)" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground-strong)", marginBottom: 14, lineHeight: 1.7 }}>
          {t("Practise on your own. Each question is a message — decide what to do.")}
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)", marginBottom: 14, lineHeight: 1.5 }}>
          {t(preferences && (preferences.interests.length || preferences.activities.length)
            ? "Practice mix guided by your selected interests and activities."
            : "Balanced practice mix across scam types.")}
        </div>
        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--teal-line)", padding: "12px 14px", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)", marginBottom: 10 }}>{t("QUESTIONS PER ROUND")}</div>
          <CountPicker options={SOLO_COUNTS} value={count} onChange={setCount} color="var(--teal)" label={t("QUESTIONS PER ROUND")} />
        </div>
        {/* While a round is being written, the wait panel takes this slot so it stays in view. */}
        {loading ? (
          <div role="status" aria-live="polite" style={{ backgroundColor: "var(--card)", border: "3px solid var(--teal-line)", padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)", marginBottom: 8 }}>{t("WRITING FRESH QUESTIONS FOR YOU — THIS CAN TAKE UP TO 30 SECONDS")}</div>
            <div aria-hidden style={{ height: 8, backgroundColor: "var(--background)", border: "2px solid var(--border)", marginBottom: 12, overflow: "hidden" }}>
              {/* Eases toward full over ~30s; it never claims to be done before the round arrives. */}
              <div style={{ height: "100%", width: `${Math.round(95 * (1 - Math.exp(-waited / 12000)))}%`, backgroundColor: "var(--teal-fill)", transition: "width 0.5s linear" }} />
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: ink(tip.color), marginBottom: 4 }}>{t("TIP")} · {t(tip.title)}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>{t(tip.text)}</div>
            {onSkipWait && waited >= SKIP_OFFER_MS && (
              <div style={{ marginTop: 12 }}>
                <PixelButton onClick={onSkipWait} color="var(--border)" textColor="var(--foreground)" size="sm" full>{t("[ PLAY READY-MADE QUESTIONS NOW ]")}</PixelButton>
              </div>
            )}
          </div>
        ) : (
          <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)", marginBottom: 8 }}>{t("HOW IT WORKS")}</div>
            {["Inspect links and senders before deciding.", "Some messages are safe — read carefully!", "Use a hint if you're stuck.", "Wrong choices teach you what to watch for."].map((line) => (
              <div key={line} className="flex items-start gap-2 mb-2">
                <IconBulb size={10} color="var(--yellow)" />
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>{t(line)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <PixelButton onClick={() => { if (!loading) onStart(count); }} disabled={loading} color="var(--teal-fill)" textColor="var(--on-fill)" size="lg" full>{loading ? t("WRITING YOUR QUESTIONS…") : t("[ START {count} QUESTIONS ]", { count })}</PixelButton>
          <PixelButton onClick={onBack} color="var(--border)" textColor="var(--foreground)" size="sm" full>{t("[ BACK ]")}</PixelButton>
        </div>
      </div>
    </div>
  );
}
