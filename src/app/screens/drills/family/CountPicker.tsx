export function CountPicker({ options, value, onChange, color = "var(--green)", label }: {
  options: readonly number[]; value: number; onChange: (n: number) => void; color?: string; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((n) => {
        const on = n === value;
        return (
          <button
            key={n}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(n)}
            style={{
              minWidth: 44, minHeight: 44, padding: "6px 10px", cursor: "pointer",
              backgroundColor: on ? color : "var(--on-fill)",
              border: `3px solid ${on ? color : "var(--border)"}`,
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
