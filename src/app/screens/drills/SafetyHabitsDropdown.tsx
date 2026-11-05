import { SAFETY_TIPS } from "../../data/safetyTips";
import { IconBadge, IconChevron } from "../../components/icons";
import { useState } from "react";
import { useT } from "../../i18n";
import { ink, line } from "../../utils/color";

export function SafetyHabitsDropdown() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelId = "safety-habits-panel";
  return (
    <div style={{ marginTop: 4 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex items-start gap-3"
        style={{ width: "100%", textAlign: "left", backgroundColor: "color-mix(in srgb, var(--orange-fill) 8%, transparent)", border: "3px solid var(--orange-line)", padding: "12px 14px", cursor: "pointer" }}
      >
        <IconBadge size={22} color="var(--yellow)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center justify-between" style={{ gap: 8 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", letterSpacing: 1 }}>{t("SAFETY HABITS")}</div>
            <div aria-hidden="true" style={{ display: "flex", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
              <IconChevron size={14} color="var(--orange)" />
            </div>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5, marginTop: 6 }}>
            {t("A missed drill is private. Use it to practise the next response — never to rank or shame someone.")}
          </div>
        </div>
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-3" style={{ marginTop: 10 }}>
          {SAFETY_TIPS.map((tip) => (
            <div key={tip.num} className="flex items-start gap-3" style={{ backgroundColor: "var(--card)", border: `3px solid ${line(tip.color)}`, padding: 14 }}>
              <div style={{ width: 34, height: 34, flexShrink: 0, border: `2px solid ${line(tip.color)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: ink(tip.color) }}>{tip.num}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: ink(tip.color), letterSpacing: 1, marginBottom: 4 }}>{t(tip.title)}</div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.5 }}>{t(tip.text)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
