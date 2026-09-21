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
      className="subpage-header"
      style={{
        padding: "10px 16px",
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
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>{"< BACK"}</div>
      </button>
      <div className="subpage-title" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-label)", color: titleColor }}>{title}</div>
    </div>
  );
}
