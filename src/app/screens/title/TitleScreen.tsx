import { useEffect, useState } from "react";

import { Blink, PixelButton } from "../../components/ui";
import { PixelMascot } from "../../components/avatars";
import { Stars } from "../../components/layout";

export function TitleScreen({ onNext }: { onNext: () => void }) {
  const [glitch, setGlitch] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-between h-full px-6 py-10 overflow-hidden">
      <Stars />
      <div className="relative z-10 flex flex-col items-center gap-2 mt-8">
        <div
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "var(--text-hero)",
            color: "#00ff88",
            textShadow: glitch
              ? "4px 0 #ff2d55, -4px 0 #4ecdc4"
              : "4px 4px 0 #006633, 0 0 20px rgba(0,255,136,0.5)",
            letterSpacing: 2,
            lineHeight: 1.3,
            textAlign: "center",
          }}
        >
          DRILL<br />MODE
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", letterSpacing: 3, marginTop: 4 }}>
          SCAM FIGHTER
        </div>
        <div className="flex gap-2 mt-2">
          {["#ff6b35", "#ffe66d", "#00ff88", "#4ecdc4", "#ff2d55"].map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4">
        <PixelMascot size={128} animate />
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-title)", color: "#ffe66d", textAlign: "center" }}>
          DEFEND YOUR MIND.<br />DEFEAT THE SCAMMERS.
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 mb-4">
        <Blink ms={700} min={0.5}>
          <PixelButton onClick={onNext} color="#00ff88" size="lg">[ PRESS START ]</PixelButton>
        </Blink>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#2a3a5c" }}>
          v2.0.0 © 2026 DRILL MODE
        </div>
      </div>
    </div>
  );
}
