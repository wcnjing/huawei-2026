import { useState, useEffect } from "react";
import { Blink } from "../../../components/ui";
import { IconEnvelope, IconWarning } from "../../../components/icons";
import { useT } from "../../../i18n";

const EMAIL_INBOX_ITEMS = [
  { id: "campus", sender: "Campus Rewards Office", subject: "IMPORTANT: Claim Your $300 Digital Safety Reward", preview: "You have been selected for a limited-time cyber safety reward…", time: "NOW", isScam: true },
  { id: "tips", sender: "Cyber Tips Weekly", subject: "How to spot fake links", preview: "This week's safety tip…", time: "3h" },
  { id: "family", sender: "Family Group", subject: "Weekend lunch", preview: "Mum: Are we free this Sunday?", time: "5h" },
  { id: "school", sender: "School Portal", subject: "Assignment reminder", preview: "Your submission is due soon.", time: "1d" },
  { id: "game", sender: "Game Updates", subject: "New badge unlocked", preview: "You are close to your next rank.", time: "2d" },
];

export function EmailInboxScreen({ onOpenScam, onBack }: { activeMemberId: string; onOpenScam: () => void; onBack: () => void }) {
  const t = useT();
  const [toast, setToast] = useState("");
  const [glowFrame, setGlowFrame] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setGlowFrame((f) => !f), 900);
    return () => clearInterval(t);
  }, []);

  const handleNonScam = () => {
    setToast(t("This email is safe. Open the important email to continue."));
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "var(--background)", borderBottom: "4px solid var(--border)", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("< BACK")}</div>
        </button>
        <div className="flex items-center gap-2">
          <IconEnvelope size={16} color="var(--violet)" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--violet)" }}>{t("MAILBOX")}</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--orange)" }}>{t("DRILL ACTIVE")}</div>
      </div>
      <div className="px-4 py-2" style={{ borderBottom: "2px solid var(--secondary)" }}>
        <div style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)", padding: "6px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--border)" }}>
          {t("Search mail…")}
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 10%, transparent)", borderBottom: "2px solid var(--orange-line)", flexShrink: 0 }}>
        <IconWarning size={12} color="var(--orange)" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--orange)" }}>
          {t("New important email detected. Inspect before clicking.")}
        </div>
      </div>
      {toast && (
        <div style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--teal-line)", padding: "8px 12px", margin: "8px 12px", position: "absolute", top: 160, left: 0, right: 0, zIndex: 20, animation: "slideUp 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--teal)", lineHeight: 1.6 }}>{toast}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {EMAIL_INBOX_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => item.isScam ? onOpenScam() : handleNonScam()}
            style={{
              display: "block", width: "100%", textAlign: "left", background: "none",
              border: "none", borderBottom: "2px solid var(--secondary)", cursor: "pointer",
              padding: "12px 16px",
              backgroundColor: item.isScam ? (glowFrame ? "color-mix(in srgb, var(--orange-fill) 8%, transparent)" : "color-mix(in srgb, var(--red-fill) 5%, transparent)") : "var(--background)",
              boxShadow: item.isScam ? `inset 0 0 ${glowFrame ? "16px" : "6px"} color-mix(in srgb, var(--orange-line) 12%, transparent)` : "none",
              transition: "background-color 0.45s, box-shadow 0.45s",
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{ width: 36, height: 36, backgroundColor: item.isScam ? "var(--orange-fill)" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.isScam ? <IconWarning size={18} color="var(--on-fill)" /> : <IconEnvelope size={16} color="var(--muted-foreground)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: item.isScam ? 6 : 5, color: item.isScam ? "var(--orange)" : "var(--foreground)" }}>{t(item.sender)}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: item.isScam ? "var(--orange)" : "var(--muted-foreground)" }}>{t(item.time)}</div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: item.isScam ? "var(--red)" : "var(--foreground)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t(item.subject)}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t(item.preview)}
                </div>
                {item.isScam && (
                  <div className="flex gap-2 mt-1">
                    <div style={{ backgroundColor: "var(--orange-fill)", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>
                      <Blink ms={500}>{t("IMPORTANT")}</Blink>
                    </div>
                    <div style={{ backgroundColor: "var(--red-fill)", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-danger)" }}>{t("UNREAD")}</div>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
