import { useState, useEffect } from "react";
import { Blink } from "../../../components/ui";
import { IconEnvelope, IconWarning } from "../../../components/icons";

const EMAIL_INBOX_ITEMS = [
  { id: "campus", sender: "Campus Rewards Office", subject: "IMPORTANT: Claim Your $300 Digital Safety Reward", preview: "You have been selected for a limited-time cyber safety reward…", time: "NOW", isScam: true },
  { id: "tips", sender: "Cyber Tips Weekly", subject: "How to spot fake links", preview: "This week's safety tip…", time: "3h" },
  { id: "family", sender: "Family Group", subject: "Weekend lunch", preview: "Mum: Are we free this Sunday?", time: "5h" },
  { id: "school", sender: "School Portal", subject: "Assignment reminder", preview: "Your submission is due soon.", time: "1d" },
  { id: "game", sender: "Game Updates", subject: "New badge unlocked", preview: "You are close to your next rank.", time: "2d" },
];

export function EmailInboxScreen({ onOpenScam, onBack }: { activeMemberId: string; onOpenScam: () => void; onBack: () => void }) {
  const [toast, setToast] = useState("");
  const [glowFrame, setGlowFrame] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setGlowFrame((f) => !f), 900);
    return () => clearInterval(t);
  }, []);

  const handleNonScam = () => {
    setToast("This email is safe. Open the important email to continue.");
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className="flex flex-col h-full" style={{ position: "relative" }}>
      <div className="flex items-center justify-between px-4" style={{ backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", minHeight: 56, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4" }}>{"< BACK"}</div>
        </button>
        <div className="flex items-center gap-2">
          <IconEnvelope size={16} color="#c77dff" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 11, color: "#c77dff" }}>MAILBOX</div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ff6b35" }}>DRILL ACTIVE</div>
      </div>
      <div className="px-4 py-2" style={{ borderBottom: "2px solid #1a2340" }}>
        <div style={{ backgroundColor: "#111827", border: "2px solid #2a3a5c", padding: "6px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#2a3a5c" }}>
          Search mail…
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "rgba(255,107,53,0.1)", borderBottom: "2px solid #ff6b35", flexShrink: 0 }}>
        <IconWarning size={12} color="#ff6b35" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ff6b35" }}>
          New important email detected. Inspect before clicking.
        </div>
      </div>
      {toast && (
        <div style={{ backgroundColor: "#1a2340", border: "2px solid #4ecdc4", padding: "8px 12px", margin: "8px 12px", position: "absolute", top: 160, left: 0, right: 0, zIndex: 20, animation: "slideUp 0.2s ease-out" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#4ecdc4", lineHeight: 1.6 }}>{toast}</div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {EMAIL_INBOX_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => item.isScam ? onOpenScam() : handleNonScam()}
            style={{
              display: "block", width: "100%", textAlign: "left", background: "none",
              border: "none", borderBottom: "2px solid #1a2340", cursor: "pointer",
              padding: "12px 16px",
              backgroundColor: item.isScam ? (glowFrame ? "rgba(255,107,53,0.08)" : "rgba(255,45,85,0.05)") : "#0a0e1a",
              boxShadow: item.isScam ? `inset 0 0 ${glowFrame ? "16px" : "6px"} rgba(255,107,53,0.12)` : "none",
              transition: "background-color 0.45s, box-shadow 0.45s",
            }}
          >
            <div className="flex items-start gap-3">
              <div style={{ width: 36, height: 36, backgroundColor: item.isScam ? "#ff6b35" : "#2a3a5c", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item.isScam ? <IconWarning size={18} color="#0a0e1a" /> : <IconEnvelope size={16} color="#6b8ba4" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between mb-1">
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: item.isScam ? 6 : 5, color: item.isScam ? "#ff6b35" : "#e8f4f8" }}>{item.sender}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: item.isScam ? "#ff6b35" : "#6b8ba4" }}>{item.time}</div>
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: item.isScam ? "#ff2d55" : "#e8f4f8", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.subject}
                </div>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#6b8ba4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.preview}
                </div>
                {item.isScam && (
                  <div className="flex gap-2 mt-1">
                    <div style={{ backgroundColor: "#ff6b35", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#0a0e1a" }}>
                      <Blink ms={500}>IMPORTANT</Blink>
                    </div>
                    <div style={{ backgroundColor: "#ff2d55", padding: "1px 5px", fontFamily: "'Share Tech Mono', monospace", fontSize: 7, color: "#ffffff" }}>UNREAD</div>
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