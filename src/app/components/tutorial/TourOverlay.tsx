import { useEffect, useRef, useState } from "react";
import { PixelMascot } from "../avatars";
import { PixelButton } from "../ui";

type TourStep = { target: string | null; actionTarget?: string; frameTarget?: string; scrollTarget?: string; accent: string; title: string; body: string; screen?: "home" | "drill-select" | "leaderboard" | "store"; placement?: "below" | "bottom" };

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    accent: "#00ff88",
    title: "HI, I'M PIXI!",
    body: "Scammers practise on our households every day. Let me show you around so your house can practise back.",
  },
  {
    target: "safety-bar",
    accent: "#ff6b35",
    title: "HOUSE SAFETY",
    body: "Your household's week at a glance. A shield means they stayed safe; a red heart means a scam got through.",
  },
  {
    target: "payday-tile",
    accent: "#ffe66d",
    title: "PAYDAY SUNDAY",
    body: "Tap your coin tile to collect your weekly pay and see your personal coin balance.",
  },
  {
    target: "self-room",
    accent: "#c77dff",
    title: "THE HOUSE",
    body: "Tap inside it to view your profile. Use Customize to design your room.",
    placement: "below",
  },
  {
    target: "nav-drill",
    accent: "#4ecdc4",
    title: "PICK A DRILL",
    body: "Open Drill to start a six-round House Drill together, or choose a call, text, Telegram, or email scenario.",
  },
  {
    target: "drill-page",
    screen: "drill-select",
    accent: "#00d4ff",
    title: "THE DRILL PAGE",
    body: "Choose a House Drill or practise with Scam Call, Text, Telegram, or Phishing Email.",
    placement: "bottom",
  },
  {
    target: null,
    screen: "drill-select",
    accent: "#74f0ff",
    title: "ALWAYS SAFE",
    body: "Every drill ends by telling you it was a drill, and you're NEVER punished for stopping. Say 'stop' or 'is this a drill?' any time and it ends — no penalty.",
  },
  {
    target: "bottom-nav",
    screen: "drill-select",
    accent: "#4d8cff",
    title: "EXPLORE",
    body: "Visit Home, climb the leaderboard in Ranks, spend coins in Store, and customise your character in Profile.",
  },
  {
    target: "ranks-page",
    actionTarget: "ranks-shame",
    frameTarget: "nav-ranks",
    screen: "leaderboard",
    accent: "#ff4fd8",
    title: "RANKS",
    body: "Hall of Fame celebrates safe practice; Hall of Shame shows where your house can learn.",
    placement: "bottom",
  },
  {
    target: "store-page",
    frameTarget: "nav-store",
    scrollTarget: "store-scroll",
    screen: "store",
    accent: "#ff9f1c",
    title: "STORE",
    body: "Buy furniture here to decorate your room.",
    placement: "bottom",
  },
];

function SpeechBubble({ step, index, total, onNext, onSkip, onBack, style, innerRef, scrollComplete, shameVisited }: {
  step: TourStep; index: number; total: number;
  onNext: () => void; onSkip: () => void; onBack: () => void;
  scrollComplete: boolean;
  shameVisited: boolean;
  style?: React.CSSProperties;
  innerRef?: React.RefObject<HTMLDivElement>;
}) {
  const last = index === total - 1;
  return (
    <div ref={innerRef} style={{ position: "fixed", zIndex: 10001, width: 300, ...style }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: -4 }}>
        <PixelMascot size={step.target === "drill-page" ? 32 : 44} animate />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: step.accent, padding: "5px 8px", marginBottom: 8, backgroundColor: "#111827", boxShadow: "3px 3px 0 #0a0e1a" }}>
          {step.title}
        </div>
      </div>
      <div style={{ backgroundColor: "#111827", border: `4px solid ${step.accent}`, boxShadow: `4px 4px 0 #0a0e1a`, padding: step.target === "drill-page" ? 10 : 14 }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
          {step.body}
        </div>
        {(step.target === "drill-page" || step.scrollTarget) && !scrollComplete && (
          <div style={{ marginTop: 10, color: "#ffe66d", font: "11px 'Share Tech Mono', monospace", letterSpacing: 1, textAlign: "center" }}>
            SCROLL DOWN TO CONTINUE ↓
          </div>
        )}
        {step.actionTarget === "ranks-shame" && !shameVisited && (
          <div style={{ marginTop: 10, color: step.accent, font: "11px 'Share Tech Mono', monospace", letterSpacing: 1, textAlign: "center" }}>
            TAP HALL OF SHAME TO CONTINUE
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, backgroundColor: i === index ? step.accent : "#2a3a5c" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {index > 0 && <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm">BACK</PixelButton>}
            {!(((step.target === "drill-page" || step.scrollTarget) && !scrollComplete) || (step.actionTarget === "ranks-shame" && !shameVisited)) && <PixelButton onClick={onNext} color={step.accent} size="sm">{last ? "DONE" : "NEXT"}</PixelButton>}
          </div>
        </div>
      </div>
      <button onClick={onSkip} style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 2px" }}>
        <div style={{ display: "inline-block", padding: "5px 8px", backgroundColor: "#111827", boxShadow: "3px 3px 0 #0a0e1a", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>SKIP TOUR</div>
      </button>
    </div>
  );
}

export function TourOverlay({ onDone, onScreenChange }: { onDone: () => void; onScreenChange: (screen: "home" | "drill-select" | "leaderboard" | "store") => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [actionRect, setActionRect] = useState<DOMRect | null>(null);
  const [frameRect, setFrameRect] = useState<DOMRect | null>(null);
  const [phoneRect, setPhoneRect] = useState<DOMRect | null>(null);
  const [soloRoomTarget, setSoloRoomTarget] = useState(false);
  const [scrollComplete, setScrollComplete] = useState(false);
  const [shameVisited, setShameVisited] = useState(false);
  const [bubbleH, setBubbleH] = useState(250); // estimate until measured
  const bubbleRef = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);
  const step = TOUR_STEPS[index];
  const scrollTarget = step.scrollTarget ?? (step.target === "drill-page" ? "drill-page" : null);

  // Measure the bubble so placement can react to its real height, not a guess.
  useEffect(() => {
    const h = bubbleRef.current?.getBoundingClientRect().height;
    if (h && Math.abs(h - bubbleH) > 2) setBubbleH(h);
  });

  useEffect(() => {
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const phone = document.querySelector("[data-phone-frame]")?.getBoundingClientRect() ?? null;
      setPhoneRect(phone);
      const action = step.actionTarget ? document.querySelector(`[data-tour="${step.actionTarget}"]`) : null;
      const frame = step.frameTarget ? document.querySelector(`[data-tour="${step.frameTarget}"]`) : null;
      setActionRect(action?.getBoundingClientRect() ?? null);
      setFrameRect(frame?.getBoundingClientRect() ?? null);
      if (!step.target) { setRect(null); setSoloRoomTarget(false); return; }
      const soloRoom = step.target === "self-room" ? document.querySelector('[data-tour="solo-room"]') : null;
      const el = document.querySelector(`[data-tour="${step.target}"]`) ?? soloRoom;
      setSoloRoomTarget(!!soloRoom && el === soloRoom);
      if (!el) return setRect(null); // target missing -> fall back to a centred bubble
      setRect(el.getBoundingClientRect());
    };
    // Scroll the target into view, then measure. Deliberately an INSTANT scroll: with
    // smooth scrolling the measurement ran mid-animation and the spotlight landed where
    // the element used to be.
    if (step.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`) ?? (step.target === "self-room" ? document.querySelector('[data-tour="solo-room"]') : null);
      el?.scrollIntoView({ block: step.placement === "below" || step.target === "drill-page" ? "start" : "center", behavior: "auto" });
    }
    const t = setTimeout(measure, step.target ? 90 : 0);
    window.addEventListener("resize", measure);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [index, step.target, step.actionTarget, step.frameTarget, step.placement]);

  useEffect(() => {
    if (!scrollTarget) { setScrollComplete(false); return; }
    const page = document.querySelector<HTMLElement>(`[data-tour="${scrollTarget}"]`);
    if (!page) return;
    // Start the tutorial at the top each time this step is entered, so Next
    // only appears after the learner has explored the full drill menu.
    page.scrollTop = 0;
    const update = () => {
      const atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 12;
      const scrolledAViewport = scrollTarget === "store-scroll" && page.scrollTop >= page.clientHeight - 12;
      setScrollComplete(atBottom || scrolledAViewport);
    };
    page.addEventListener("scroll", update, { passive: true });
    update();
    return () => page.removeEventListener("scroll", update);
  }, [index, step.target, scrollTarget]);

  const goToStep = (nextIndex: number) => {
    const nextStep = TOUR_STEPS[nextIndex];
    if (!nextStep) return;
    if (nextStep.actionTarget === "ranks-shame") setShameVisited(false);
    onScreenChange(nextStep.screen ?? "home");
    setIndex(nextIndex);
  };
  const next = () => (index === TOUR_STEPS.length - 1 ? onDone() : goToStep(index + 1));
  const passDrillScroll = (deltaY: number) => {
    if (!scrollTarget) return;
    const page = document.querySelector<HTMLElement>(`[data-tour="${scrollTarget}"]`);
    if (page) page.scrollTop += deltaY;
  };
  const passRanksClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (step.actionTarget !== "ranks-shame" || !actionRect) return;
    const { clientX, clientY } = event;
    if (clientX < actionRect.left || clientX > actionRect.right || clientY < actionRect.top || clientY > actionRect.bottom) return;
    document.querySelector<HTMLButtonElement>('[data-tour="ranks-shame"]')?.click();
    setActionRect(null);
    setShameVisited(true);
  };
  const pad = 6;

  // Keep the tutorial bubble inside the app's phone frame, not just the browser window.
  const bounds = phoneRect ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const bubbleWidth = soloRoomTarget || step.target === "ranks-page"
    ? Math.min(420, Math.max(220, bounds.width - 16))
    : step.target === "drill-page"
    ? Math.min(344, Math.max(220, bounds.width - 24))
    : Math.min(300, Math.max(220, bounds.width - 24));
  const minLeft = bounds.left + 8;
  const maxLeft = Math.max(minLeft, bounds.right - bubbleWidth - 8);
  const minTop = bounds.top + 8;
  const maxTop = Math.max(minTop, bounds.bottom - bubbleH - 8);
  const bubbleMaxHeight = Math.max(160, bounds.height - 16);
  const frameInset = 8;
  let bubbleStyle: React.CSSProperties = {
    left: bounds.left + bounds.width / 2,
    top: bounds.top + bounds.height / 2,
    transform: "translate(-50%,-50%)",
    width: bubbleWidth,
    maxHeight: bubbleMaxHeight,
    overflowY: "auto",
  };
  if (rect) {
    const gap = pad + 14;
    let top;
    if (soloRoomTarget) top = rect.bottom + gap;
    else if (step.target === "ranks-page" || step.target === "store-page") top = rect.bottom - bubbleH - 8;
    else if (step.placement === "bottom") top = bounds.bottom - bubbleH - 8;
    else if (step.placement === "below") top = rect.bottom + gap;
    else if (rect.bottom + gap + bubbleH <= bounds.bottom - 8) top = rect.bottom + gap;
    else if (rect.top - gap - bubbleH >= bounds.top + 8) top = rect.top - gap - bubbleH;
    else top = minTop; // target fills the phone — pin it inside the frame
    bubbleStyle = {
      left: Math.min(Math.max(rect.left + rect.width / 2 - bubbleWidth / 2, minLeft), maxLeft),
      top: Math.max(minTop, Math.min(top, maxTop)),
      width: bubbleWidth,
      maxHeight: bubbleMaxHeight,
      overflowY: "auto",
    };
  }

  return (
    <>
      {/* Block pointer input everywhere behind the tour, including the spotlight cutout. */}
      <div style={{ position: "fixed", zIndex: 9999, inset: 0, background: "transparent" }} />
      {/* The mask keeps the main page, the required action, and the matching nav tab visible together. */}
      <svg
        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
        preserveAspectRatio="none"
        onClick={passRanksClick}
        onWheel={(event) => { if (scrollTarget) { event.preventDefault(); passDrillScroll(event.deltaY); } }}
        onTouchStart={(event) => { if (scrollTarget) touchY.current = event.touches[0]?.clientY ?? null; }}
        onTouchMove={(event) => {
          if (!scrollTarget) return;
          event.preventDefault();
          const currentY = event.touches[0]?.clientY;
          if (currentY != null && touchY.current != null) passDrillScroll(touchY.current - currentY);
          touchY.current = currentY ?? null;
        }}
        onTouchEnd={() => { touchY.current = null; }}
        style={{ position: "fixed", zIndex: 10000, inset: 0, width: "100vw", height: "100vh", pointerEvents: "all", cursor: scrollTarget ? "ns-resize" : "default", touchAction: scrollTarget ? "none" : undefined }}
      >
        <defs>
          <mask id="tour-spotlight-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={window.innerWidth} height={window.innerHeight}>
            <rect width={window.innerWidth} height={window.innerHeight} fill="white" />
            {[rect, ...(shameVisited ? [] : [actionRect])].filter((item): item is DOMRect => !!item).map((item, i) => (
              <rect key={`cutout-${i}`} x={item.left - pad} y={item.top - pad} width={item.width + pad * 2} height={item.height + pad * 2} fill="black" />
            ))}
            {frameRect && <rect x={frameRect.left + frameInset} y={frameRect.top + frameInset} width={Math.max(1, frameRect.width - frameInset * 2)} height={Math.max(1, frameRect.height - frameInset * 2)} fill="black" />}
          </mask>
        </defs>
        <rect width={window.innerWidth} height={window.innerHeight} fill="rgba(4,6,12,0.88)" mask="url(#tour-spotlight-mask)" />
        {rect && <rect x={rect.left - pad} y={rect.top - pad} width={rect.width + pad * 2} height={rect.height + pad * 2} fill="none" stroke={step.accent} strokeWidth="3" />}
        {actionRect && !shameVisited && <rect x={actionRect.left - pad} y={actionRect.top - pad} width={actionRect.width + pad * 2} height={actionRect.height + pad * 2} fill="none" stroke="#ffe66d" strokeWidth="4" strokeDasharray="8 5">
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="0.8s" repeatCount="indefinite" />
        </rect>}
        {frameRect && <rect x={frameRect.left + frameInset} y={frameRect.top + frameInset} width={Math.max(1, frameRect.width - frameInset * 2)} height={Math.max(1, frameRect.height - frameInset * 2)} fill="none" stroke={step.accent} strokeWidth="3" />}
      </svg>
      <SpeechBubble
        step={step} index={index} total={TOUR_STEPS.length}
        onNext={next} onBack={() => goToStep(Math.max(0, index - 1))} onSkip={onDone}
        scrollComplete={scrollComplete}
        shameVisited={shameVisited}
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
