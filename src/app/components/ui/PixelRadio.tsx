export function PixelRadio({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(opt)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 14, height: 14, border: `3px solid ${value === opt ? "var(--green)" : "var(--border)"}`, backgroundColor: value === opt ? "var(--green-fill)" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {value === opt && <div style={{ width: 6, height: 6, backgroundColor: "var(--background)" }} />}
          </div>
          <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: value === opt ? "var(--green)" : "var(--muted-foreground)" }}>{opt}</span>
        </button>
      ))}
    </div>
  );
}
