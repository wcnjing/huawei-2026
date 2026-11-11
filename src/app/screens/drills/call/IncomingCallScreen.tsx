import { useState, useEffect } from "react";
import { IconBell, IconCheck, IconWarning, IconX } from "../../../components/icons";
import { PixelPhone } from "./PixelPhone";
import { Blink } from "../../../components/ui";
import { useT } from "../../../i18n";

export function IncomingCallScreen({ onAccept, onDecline }: { activeMemberId: string; onAccept: () => void; onDecline: () => void }) {
  const t = useT();
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(t);
  }, []);
  return (
      <div className="flex flex-col items-center justify-between flex-1 px-6 py-12" data-theme="dark" style={{ background: "linear-gradient(180deg, var(--background) 0%, var(--surface) 50%, var(--background) 100%)" }}>
        <div className="flex flex-col items-center gap-2">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", letterSpacing: 2 }}>{t("INCOMING CALL")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)", border: "2px solid var(--orange-line)", padding: "4px 8px", backgroundColor: "color-mix(in srgb, var(--orange-fill) 10%, transparent)", display: "flex", alignItems: "center", gap: 6 }}>
            <IconWarning size={12} color="var(--orange)" />
            {t("UNKNOWN CALLER")}
          </div>
        </div>
        <div className="flex flex-col items-center gap-6">
          <div style={{ opacity: pulse ? 1 : 0.6, transition: "opacity 0.4s" }}>
            <PixelPhone ringing />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-heading)", color: "var(--foreground-strong)", textAlign: "center" }}>
            +1 (???)<br />???-????
          </div>
          <Blink ms={900}>
            <div className="flex items-center gap-2" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)" }}>
              <IconBell size={14} color="var(--orange)" />
              {t("RINGING...")}
            </div>
          </Blink>
          <div style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 10%, transparent)", border: "3px solid var(--red-line)", padding: "8px 12px", width: "100%" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", lineHeight: 1.5 }}>
              {t("DRILL MODE ACTIVE — This is a simulated scam call. Can you hang tough?")}
            </div>
          </div>
        </div>
        <div className="flex gap-12 items-center">
          <div className="flex flex-col items-center gap-3">
            <button onClick={onDecline} onMouseDown={(e) => (e.currentTarget.style.transform = "translate(4px,4px)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} style={{ width: 72, height: 72, backgroundColor: "var(--red-fill)", border: "4px solid var(--outline)", boxShadow: "4px 4px 0 var(--outline)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.05s" }}>
              <IconX size={32} color="var(--foreground-strong)" />
            </button>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>{t("DECLINE")}</div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={onAccept} onMouseDown={(e) => (e.currentTarget.style.transform = "translate(4px,4px)")} onMouseUp={(e) => (e.currentTarget.style.transform = "none")} style={{ width: 72, height: 72, backgroundColor: "var(--green-fill)", border: "4px solid var(--outline)", boxShadow: "4px 4px 0 var(--outline)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.05s" }}>
              <IconCheck size={32} color="var(--on-fill)" />
            </button>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--green)" }}>{t("ACCEPT")}</div>
          </div>
        </div>
      </div>
  );
}
