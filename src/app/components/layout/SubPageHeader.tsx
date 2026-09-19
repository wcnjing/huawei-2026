export function SubPageHeader({
  title,
  titleColor,
  onBack,
}: {
  title: string;
  titleColor: string;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        padding: "0 16px",
        minHeight: 52,
        backgroundColor: "#0a0e1a",
        borderBottom: "4px solid #2a3a5c",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
        aria-label="Go back"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
      >
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#6b8ba4" }}>{"< BACK"}</div>
      </button>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: titleColor }}>{title}</div>
    </div>
  );
}