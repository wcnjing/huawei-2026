import { useState, useEffect } from "react";
import { playSfx } from "../../services/audio";

const isCompactViewport = () =>
  typeof window !== "undefined" && (window.innerWidth <= 520 || window.innerHeight <= 520);

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(isCompactViewport);
  useEffect(() => {
    const onResize = () => setCompact(isCompactViewport());
    onResize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const inner: React.CSSProperties = compact
    ? { width: "100%", height: "100dvh", backgroundColor: "var(--background)" }
    : {
        width: "min(390px, 100vw)",
        height: "min(844px, 100dvh)",
        backgroundColor: "var(--background)",
        border: "6px solid var(--border)",
        boxShadow: "8px 8px 0px var(--shadow-pixel), 0 0 calc(40px * var(--glow)) color-mix(in srgb, var(--green-line) 15%, transparent)",
      };

  return (
    <div
      className="flex items-center justify-center w-full bg-[var(--page-backdrop)]"
      style={{ height: compact ? "100dvh" : undefined, minHeight: compact ? undefined : "100vh" }}
    >
      {/* One delegated listener instead of wiring sound into a button component.
          PixelButton is only one of the app's button *looks* — there are ~59 raw <button>
          elements too, including the bottom nav and the call accept/decline, which is
          most of what anyone actually presses. Capture phase so a handler that stops
          propagation can't silence the click. */}
      <div
        data-phone-frame
        className="relative overflow-hidden flex flex-col"
        style={inner}
        onClickCapture={(e) => {
          const el = (e.target as HTMLElement | null)?.closest?.("button");
          if (el && !(el as HTMLButtonElement).disabled) playSfx("press");
        }}
      >
        {children}
      </div>
    </div>
  );
}
