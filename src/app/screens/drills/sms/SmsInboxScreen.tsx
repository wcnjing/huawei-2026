import { useEffect, useState } from "react";
import { IconChatBubble, IconPerson, IconWarning } from "../../../components/icons";
import { Blink } from "../../../components/ui";
import { SMS_INBOX_ITEMS } from "./smsScenario";

export function SMSInboxScreen({ onOpenScam, onBack }: { activeMemberId: string; onOpenScam: () => void; onBack: () => void }) {
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
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>{"< BACK"}</div>
        </button>
        <div className="flex items-center gap-2">
          <IconChatBubble size={16} color="#4ecdc4" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4" }}>MESSAGES</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>
          <Blink ms={700}>1 NEW</Blink>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "rgba(255,107,53,0.1)", borderBottom: "2px solid #ff6b35" }}>
        <IconWarning size={12} color="#ff6b35" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff6b35" }}>
          DRILL MODE — 1 suspicious message detected
        </div>
      </div>
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {SMS_INBOX_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => item.isScam ? onOpenScam() : handleNonScam(item.id)}
            style={{
              display: "block", width: "100%", textAlign: "left", background: "none",
              border: "none", borderBottom: "2px solid #1a2340", cursor: "pointer",
              padding: "12px 16px",
              backgroundColor: item.isScam ? (glowFrame ? "rgba(255,45,85,0.06)" : "rgba(255,107,53,0.06)") : "#0a0e1a",
              animation: shaking === item.id ? "shake 0.5s ease" : "none",
              boxShadow: item.isScam ? `inset 0 0 ${glowFrame ? "12px" : "4px"} rgba(255,45,85,0.15)` : "none",
              transition: "background-color 0.4s, box-shadow 0.4s",
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{ width: 40, height: 40, backgroundColor: item.isScam ? "#ff2d55" : "#2a3a5c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: item.isScam ? "2px solid #ff2d55" : "2px solid #1a2340" }}>
                {item.isScam ? <IconWarning size={20} color="#ffffff" /> : <IconPerson size={20} color="#6b8ba4" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: item.isScam ? 7 : 6, color: item.isScam ? "#ff2d55" : "#e8f4f8" }}>{item.sender}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: item.isScam ? "#ff6b35" : "#6b8ba4" }}>{item.time}</div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: item.isScam ? "#ff6b35" : "#6b8ba4", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.preview}
                </div>
                {item.isScam && (
                  <div className="flex items-center gap-2 mt-1">
                    <div style={{ backgroundColor: "#ff2d55", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffffff" }}>
                      <Blink ms={600}>IMPORTANT</Blink>
                    </div>
                    <div style={{ backgroundColor: "#ff6b35", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#0a0e1a" }}>UNREAD</div>
                  </div>
                )}
              </div>
            </div>
            {shaking === item.id && (
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginTop: 6, textAlign: "center" }}>
                Not part of this drill.
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
