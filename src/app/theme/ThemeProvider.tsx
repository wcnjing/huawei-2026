import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/*
 * Dark or light theme. Dark is the default; the player's choice is remembered on their device
 * (Settings → Theme). The small script in index.html applies the saved theme before the app
 * first paints (so there's no dark flash), and this provider takes over from there.
 * Colours for each theme are in src/styles/tokens.css.
 */
export type Theme = "dark" | "light";
export const THEME_KEY = "safespace_theme";

function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: "dark",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(currentTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // The phone's status bar follows the app background.
    const background = getComputedStyle(root).getPropertyValue("--background").trim();
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: not remembered */ }
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
