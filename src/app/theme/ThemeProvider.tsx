import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/*
 * Dark or light theme. Until the player picks (the sun/moon switch on the language step or in
 * Settings → Theme), the app follows the device's light/dark setting, live. Once they pick,
 * their choice is remembered on this device and wins over the device setting.
 * The small script in index.html applies the same rule before the app first paints (so there's
 * no flash), and this provider takes over from there.
 * Colours for each theme are in src/styles/tokens.css.
 */
export type Theme = "dark" | "light";
export const THEME_KEY = "safespace_theme";
const SYSTEM_LIGHT = "(prefers-color-scheme: light)";

function storedTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null; // private mode: nothing stored, so the device decides
  }
}

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia?.(SYSTEM_LIGHT).matches ? "light" : "dark";
}

function currentTheme(): Theme {
  if (typeof document !== "undefined" && document.documentElement.dataset.theme) {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
  }
  return storedTheme() ?? systemTheme();
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(currentTheme);
  const [picked, setPicked] = useState(() => storedTheme() !== null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // The phone's status bar follows the app background.
    const background = getComputedStyle(root).getPropertyValue("--background").trim();
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  }, [theme]);

  // No choice yet: follow the device when it switches (e.g. an automatic sunset switch).
  useEffect(() => {
    if (picked || typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(SYSTEM_LIGHT);
    const follow = () => setThemeState(query.matches ? "light" : "dark");
    query.addEventListener?.("change", follow);
    return () => query.removeEventListener?.("change", follow);
  }, [picked]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setPicked(true);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: not remembered */ }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
