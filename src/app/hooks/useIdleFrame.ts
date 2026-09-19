import { loadAccessibility } from "../services/storage";
import { useState, useEffect } from "react";

export function useIdleFrame(fps = 2): number {
  const [frame, setFrame] = useState(0);
  const reduceMotion = loadAccessibility().reduceMotion
    || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (reduceMotion) {
      setFrame(0);
      return;
    }
    const t = setInterval(() => setFrame((f) => (f + 1) % 4), Math.floor(1000 / fps));
    return () => clearInterval(t);
  }, [fps, reduceMotion]);
  return reduceMotion ? 0 : frame;
}