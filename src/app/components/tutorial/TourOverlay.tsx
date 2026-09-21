import { useEffect, useRef, useState } from "react";
import { PixelMascot } from "../avatars";
import { PixelButton } from "../ui";

type TourStep = { target: string | null; accent: string; title: string; body: string };

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    accent: "#00ff88",
    title: "HI, I'M PIP!",
    body: "Scammers practise on our households every day. Let me show you around so your house can practise back.",
  },
  {
    target: "safety-bar",
    accent: "#ff6b35",
    title: "HOUSE SAFETY",
    body: "Your household's week at a glance. A shield means they stayed safe; a red heart means a scam got through.",
  },
  {
    target: "family-rooms",
    accent: "#c77dff",
    title: "THE HOUSE",
    body: "One room per person. Tap a room to see their level, XP and safe-streak. Everyone trains in their own room.",
  },
  {
    target: "start-drill",
    accent: "#00ff88",
    title: "TRAIN TOGETHER",
    body: "The house drill runs the whole household through six scam scenarios in one sitting — one round per person.",
  },
  {
    target: "nav-drill",
    accent: "#00ff88",
    title: "PICK A DRILL",
    body: "This button is the heart of it. Choose a call, SMS or email drill, spot the red flags, then report, ask someone you trust, or hang up.",
  },
  {
    target: "bottom-nav",
    accent: "#c77dff",
    title: "EXPLORE",
    body: "Climb the leaderboard in RANKS, spend your coins in STORE, and customise your character in PROFILE.",
  },
  {
    target: null,
    accent: "#ffe66d",
    title: "ALWAYS SAFE",
    body: "Every drill ends by telling you it was a drill, and you're NEVER punished for stopping. Say 'stop' or 'is this a drill?' any time and it ends — no penalty.",
  },
  {
    target: "opt-in",
    accent: "#4ecdc4",
    title: "GO LIVE",
    body: "Opt in and drills arrive for real, when you least expect them. We only ever contact the number you verify, and every drill tells you it was a drill.",
  },
];

function SpeechBubble({ step, index, total, onNext, onSkip, onBack, style, innerRef }: {
  step: TourStep; index: number; total: number;
  onNext: () => void; onSkip: () => void; onBack: () => void;
  style?: React.CSSProperties;
  innerRef?: React.RefObject<HTMLDivElement>;
}) {
  const last = index === total - 1;
  return (
    <div ref={innerRef} style={{ position: "fixed", zIndex: 10001, width: 300, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: -4 }}>
        <PixelMascot size={44} animate />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: step.accent, paddingBottom: 10 }}>
          {step.title}
        </div>
      </div>
      <div style={{ backgroundColor: "#111827", border: `4px solid ${step.accent}`, boxShadow: `4px 4px 0 #0a0e1a`, padding: 14 }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6 }}>
          {step.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, backgroundColor: i === index ? step.accent : "#2a3a5c" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {index > 0 && <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm">BACK</PixelButton>}
            <PixelButton onClick={onNext} color={step.accent} size="sm">{last ? "DONE" : "NEXT"}</PixelButton>
          </div>
        </div>
      </div>
      <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 2px" }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>SKIP TOUR</div>
      </button>
    </div>
  );
}

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [bubbleH, setBubbleH] = useState(250); // estimate until measured
  const bubbleRef = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index];

  // Measure the bubble so placement can react to its real height, not a guess.
  useEffect(() => {
    const h = bubbleRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - bubbleH) > 2) setBubbleH(h);
  });

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      if (!step.target) return setRect(null);
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) return setRect(null); // target missing -> fall back to a centred bubble
      setRect(el.getBoundingClientRect());
    };
    // Scroll the target into view, then measure. Deliberately an INSTANT scroll: with
    // smooth scrolling the measurement ran mid-animation and the spotlight landed where
    // the element used to be.
    if (step.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ block: "center", behavior: "auto" });
    }
    const t = setTimeout(measure, step.target ? 90 : 0);
    window.addEventListener("resize", measure);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [index, step.target]);

  const next = () => (index === TOUR_STEPS.length - 1 ? onDone() : setIndex(index + 1));
  const pad = 6;

  // Bubble placement: below the target if it fits, else above, else clamped into view.
  // The last case is real — the family-rooms target is taller than the phone, and an
  // un-clamped "above" pushed the bubble (and Pip) off the top of the screen entirely.
  let bubbleStyle: React.CSSProperties = {
    left: "50%", top: "50%", transform: "translate(-50%,-50%)",
  };
  if (rect) {
    const vh = window.innerHeight;
    const gap = pad + 14;
    let top;
    if (rect.bottom + gap + bubbleH <= vh - 8) top = rect.bottom + gap;
    else if (rect.top - gap - bubbleH >= 8) top = rect.top - gap - bubbleH;
    else top = 8; // target fills the screen — pin it rather than let it drift off
    bubbleStyle = {
      left: Math.min(Math.max(rect.left + rect.width / 2 - 150, 12), Math.max(12, window.innerWidth - 312)),
      top: Math.max(8, Math.min(top, vh - bubbleH - 8)),
    };
  }

  return (
    <>
      {/* Dim everything except the target. One element: a huge spread shadow around it. */}
      <div
        onClick={next}
        style={{
          position: "fixed", zIndex: 10000, cursor: "pointer",
          ...(rect
            ? {
                left: rect.left - pad, top: rect.top - pad,
                width: rect.width + pad * 2, height: rect.height + pad * 2,
                boxShadow: `0 0 0 9999px rgba(4,6,12,0.88)`,
                border: `3px solid ${step.accent}`,
              }
            : { inset: 0, backgroundColor: "rgba(4,6,12,0.88)" }),
        }}
      />
      <SpeechBubble
        step={step} index={index} total={TOUR_STEPS.length}
        onNext={next} onBack={() => setIndex(Math.max(0, index - 1))} onSkip={onDone}
        style={bubbleStyle}
        innerRef={bubbleRef}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: SIGN UP / SIGN IN (phone-ownership + consent via OTP; dev bypass code offline)
// The name and avatar are chosen on the character screen before this one, so a new
// account carries them into the verification call and this screen only asks for the
// things it must: the phone number, and an optional email for email drills.
// ─────────────────────────────────────────────────────────────────────────
