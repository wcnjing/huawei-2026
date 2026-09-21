import { useState, useEffect, useRef } from "react";
import type { ConversationLine, DrillFlag } from "../../../types/drills";
import { FLAG_MAP } from "../../../data/scamFlags";
import { PixelAvatar } from "../../../components/avatars";
import { PixelButton, AnnotatedMessage, FlagTooltip, Blink } from "../../../components/ui";
import { PixelPhone } from "./PixelPhone";
import { IconWarning } from "../../../components/icons";

const CONVERSATION: ConversationLine[] = [
  { who: "caller", text: "Hello! This is David from the IRS Fraud Division.", highlights: [{ phrase: "IRS Fraud Division", flagId: "impersonation" }] },
  { who: "caller", text: "We detected suspicious activity on your tax account." },
  { who: "you", text: "Uh, okay. What kind of activity?" },
  { who: "caller", text: "You owe $2,400 in back taxes. You must pay immediately to avoid arrest.", highlights: [{ phrase: "avoid arrest", flagId: "arrest_threat" }] },
  { who: "you", text: "Arrest? That sounds scary..." },
  { who: "caller", text: "Yes. You need to pay with gift cards RIGHT NOW to clear this up.", highlights: [{ phrase: "pay with gift cards", flagId: "gift_card" }, { phrase: "RIGHT NOW", flagId: "urgency" }] },
  { who: "caller", text: "Buy $2,400 in iTunes gift cards and read me the numbers.", highlights: [{ phrase: "iTunes gift cards", flagId: "gift_card" }] },
  { who: "you", text: "Gift cards? That doesn't sound right..." },
  { who: "caller", text: "This is your FINAL warning. Officers are being dispatched to your address.", highlights: [{ phrase: "FINAL warning", flagId: "urgency" }, { phrase: "Officers are being dispatched", flagId: "escalation" }] },
];

export function CallScreen({ onHangUp, onResult, onDistress }: { activeMemberId: string; onHangUp: (win: boolean) => void; onResult: (win: boolean) => void; onDistress: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [callerSpeaking, setCallerSpeaking] = useState(true);
  const [activeFlag, setActiveFlag] = useState<DrillFlag | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleLines >= CONVERSATION.length) return;
    const delay = visibleLines === 0 ? 1000 : 2200;
    const t = setTimeout(() => {
      setVisibleLines((v) => v + 1);
      setCallerSpeaking(CONVERSATION[visibleLines]?.who === "caller");
    }, delay);
    return () => clearTimeout(t);
  }, [visibleLines]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleLines]);

  useEffect(() => {
    if (visibleLines >= CONVERSATION.length) {
      const t = setTimeout(() => onResult(false), 3000);
      return () => clearTimeout(t);
    }
  }, [visibleLines]);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  const handleFlagTap = (flagId: string) => {
    const flag = FLAG_MAP[flagId];
    if (!flag) return;
    setActiveFlag(activeFlag?.id === flagId ? null : flag);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#111827", borderBottom: "4px solid #2a3a5c" }}>
        <div className="flex items-center gap-2">
          <div style={{ width: 8, height: 8, backgroundColor: callerSpeaking ? "#ff6b35" : "#00ff88", animation: "pulse-dot 1s ease-in-out infinite" }} />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: callerSpeaking ? "#ff6b35" : "#00ff88" }}>
            {callerSpeaking ? "CALLER SPEAKING" : "LISTENING..."}
          </div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d" }}>{mins}:{secs}</div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "3px solid #1a2340" }}>
        <PixelPhone />
        <div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffffff" }}>UNKNOWN CALLER</div>
          <div className="flex items-center gap-1 mt-1">
            <IconWarning size={10} color="#ff6b35" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff6b35" }}>SCAM DRILL ACTIVE</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }} onClick={() => setActiveFlag(null)}>
        <div ref={scrollRef} className="flex flex-col gap-3" style={{ height: "100%", overflowY: "auto", padding: "16px 16px 8px", scrollbarWidth: "none" }}>
          {CONVERSATION.slice(0, visibleLines).map((line, i) => {
            const hasFlags = (line.highlights?.length ?? 0) > 0;
            return (
              <div key={i} className={`flex ${line.who === "you" ? "justify-end" : "justify-start"}`}>
                {line.who === "caller" && <div className="mr-2 mt-1 flex-shrink-0"><PixelAvatar rank={9} size={24} /></div>}
                <div style={{ maxWidth: "72%", backgroundColor: line.who === "you" ? "#1a3a2a" : "#1a2340", border: `3px solid ${line.who === "you" ? "#00ff88" : hasFlags ? "#ff2d55" : "#ff6b35"}`, padding: "8px 10px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: line.who === "you" ? "#00ff88" : "#e8f4f8", lineHeight: 1.6 }}>
                  <AnnotatedMessage text={line.text} highlights={line.highlights} onFlagTap={handleFlagTap} />
                  {hasFlags && line.who === "caller" && (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <IconWarning size={9} color="#ff2d55" />
                      <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff2d55" }}>TAP RED TEXT</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {visibleLines < CONVERSATION.length && (
            <div className="flex justify-start">
              <div className="mr-2"><PixelAvatar rank={9} size={24} /></div>
              <div style={{ backgroundColor: "#1a2340", border: "3px solid #ff6b35", padding: "8px 14px" }}>
                <Blink ms={400}><span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35" }}>...</span></Blink>
              </div>
            </div>
          )}
        </div>
        {activeFlag && <FlagTooltip flag={activeFlag} onClose={() => setActiveFlag(null)} />}
      </div>
      <div className="px-4 py-4" style={{ borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
        <PixelButton onClick={() => onHangUp(true)} color="#ff2d55" textColor="#ffffff" size="lg" full>
          [ HANG UP — DEFEAT SCAMMER ]
        </PixelButton>
        {/* Distress off-ramp — always available, never scored. Quiet styling on purpose:
            it should be findable without competing with the primary action. */}
        <button onClick={onDistress} style={{ width: "100%", marginTop: 10, background: "none", border: "2px solid #2a3a5c", cursor: "pointer", padding: "8px" }}>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>THIS IS TOO MUCH — STOP THE DRILL</span>
        </button>
      </div>
    </div>
  );
}
