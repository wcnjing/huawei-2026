import { useTheme } from "../../theme/ThemeProvider";
import { IconMoon, IconSun } from "../icons";

/**
 * The sun/moon switch. The square knob slides (in three pixel steps) to the active end and
 * shows that end's icon: a moon for dark, a sun for light.
 * The same component is on the website (drill-mode-site/src/components/ui/ThemeSwitch.tsx).
 */
export function ThemeSwitch({ label }: { label: string }) {
  const { theme, setTheme } = useTheme();
  const light = theme === "light";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={light}
      aria-label={label}
      title={label}
      onClick={() => setTheme(light ? "dark" : "light")}
      style={{ position: "relative", width: 60, height: 28, flexShrink: 0, padding: 0, cursor: "pointer", background: "var(--secondary)", border: "2px solid var(--border-strong)", boxSizing: "border-box" }}
    >
      <span aria-hidden="true" style={{ position: "absolute", left: 5, top: 6 }}><IconSun size={12} color="var(--muted-foreground)" /></span>
      <span aria-hidden="true" style={{ position: "absolute", right: 5, top: 6 }}><IconMoon size={12} color="var(--muted-foreground)" /></span>
      <span
        aria-hidden="true"
        style={{
          position: "absolute", top: 2, left: 2, width: 24, height: 20, boxSizing: "border-box",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: light ? "translateX(0)" : "translateX(30px)",
          transition: "transform 180ms steps(3, end)",
          background: light ? "var(--yellow-fill)" : "var(--card)",
          border: `2px solid ${light ? "var(--outline)" : "var(--violet-line)"}`,
        }}
      >
        {light ? <IconSun size={12} color="var(--on-fill)" /> : <IconMoon size={12} color="var(--violet)" />}
      </span>
    </button>
  );
}
