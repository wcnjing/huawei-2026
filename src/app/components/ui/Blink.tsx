import { useState, useEffect } from "react";
import { loadAccessibility } from "../../services/storage";

// `min` is the dimmed opacity. Default 0 (a true blink) suits the scam-warning text,
// where vanishing is the point. Anything the user is meant to TAP should set a floor so
// it never fully disappears — an invisible call-to-action reads as "not there yet".
export function Blink({ children, ms = 600, min = 0 }: { children: React.ReactNode; ms?: number; min?: number }) {
  const [vis, setVis] = useState(true);
  const reduceMotion = loadAccessibility().reduceMotion
    || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (reduceMotion) {
      setVis(true);
      return;
    }
    const t = setInterval(() => setVis((v) => !v), ms);
    return () => clearInterval(t);
  }, [ms, reduceMotion]);
  return <span style={{ opacity: vis ? 1 : min, transition: `opacity ${Math.round(ms / 3)}ms linear` }}>{children}</span>;
}
