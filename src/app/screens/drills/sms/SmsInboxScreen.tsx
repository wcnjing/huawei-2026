import { useEffect, useState } from "react";
import { IconChatBubble, IconPerson, IconWarning } from "../../../components/icons";
import { Blink } from "../../../components/ui";
import { SMS_INBOX_ITEMS } from "./smsScenario";
import { useT } from "../../../i18n";

export function SMSInboxScreen({ onOpenScam, onBack }: { activeMemberId: string; onOpenScam: () => void; onBack: () => void }) {
  const t = useT();
  const [shaking, setShaking] = useState<string | null>(null);
  const [glowFrame, setGlowFrame] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setGlowFrame((f) => !f), 800);
    return () => clearInterval(t);
  }, []);

  const handleNonScam = (id: string) => {
    setShaking(id);
    setTimeout(() => setShaking(null), 600);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "var(--background)", borderBottom: "4px solid var(--border)", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("< BACK")}</div>
        </button>
        <div className="flex items-center gap-2">
          <IconChatBubble size={16} color="var(--teal)" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--teal)" }}>{t("MESSAGES")}</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--red)" }}>
          <Blink ms={700}>{t("1 NEW")}</Blink>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 10%, transparent)", borderBottom: "2px solid var(--orange-line)" }}>
        <IconWarning size={12} color="var(--orange)" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--orange)" }}>
          {t("DRILL MODE — 1 suspicious message detected")}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {SMS_INBOX_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => item.isScam ? onOpenScam() : handleNonScam(item.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", background: "none",
              border: "none", borderBottom: "2px solid var(--secondary)", cursor: "pointer",
              padding: "12px 16px",
              backgroundColor: item.isScam ? (glowFrame ? "color-mix(in srgb, var(--red-fill) 6%, transparent)" : "color-mix(in srgb, var(--orange-fill) 6%, transparent)") : "var(--background)",
              animation: shaking === item.id ? "shake 0.5s ease" : "none",
              boxShadow: item.isScam ? `inset 0 0 ${glowFrame ? "12px" : "4px"} color-mix(in srgb, var(--red-line) 15%, transparent)` : "none",
              transition: "background-color 0.4s, box-shadow 0.4s",
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, backgroundColor: item.isScam ? "var(--red-fill)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: item.isScam ? "2px solid var(--red-line)" : "2px solid var(--secondary)" }}>
                {item.isScam ? <IconWarning size={20} color="var(--foreground-strong)" /> : <IconPerson size={20} color="var(--muted-foreground)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: item.isScam ? 7 : 6, color: item.isScam ? "var(--red)" : "var(--foreground)" }}>{t(item.sender)}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: item.isScam ? "var(--orange)" : "var(--muted-foreground)" }}>{t(item.time)}</div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: item.isScam ? "var(--orange)" : "var(--muted-foreground)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t(item.preview)}
                </div>
                {item.isScam && (
                  <div className="flex items-center gap-2 mt-1">
                    <div style={{ backgroundColor: "var(--red-fill)", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-danger)" }}>
                      <Blink ms={600}>{t("IMPORTANT")}</Blink>
                    </div>
                    <div style={{ backgroundColor: "var(--orange-fill)", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{t("UNREAD")}</div>
                  </div>
                )}
              </div>
            </div>
            {shaking === item.id && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)", marginTop: 6, textAlign: "center" }}>
                {t("Not part of this drill.")}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
