import { fill, line } from "../../../utils/color";

export function CountPicker({ options, value, onChange, color = "var(--green)", label }: {
  options: readonly number[]; value: number; onChange: (n: number) => void; color?: string; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((n) => {
        const on = n === value;
        // The picked count is a neon fill (with the dark edge in light); the others sit on
        // the page colour, so they read as buttons in both themes.
        return (
          <button
            key={n}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(n)}
            style={{
              minWidth: 44, minHeight: 44, padding: "6px 10px", cursor: "pointer",
              backgroundColor: on ? fill(color) : "var(--background)",
              border: `3px solid ${on ? line(color) : "var(--border)"}`,
              fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)",
              color: on ? "var(--on-fill)" : "var(--foreground)",
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
