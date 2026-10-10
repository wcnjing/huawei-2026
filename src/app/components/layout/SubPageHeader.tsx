import type { ReactNode } from "react";
import { useT } from "../../i18n";
export function SubPageHeader({
  title,
  titleColor,
  onBack,
  actions,
}: {
  title: string;
  titleColor: string;
  onBack: () => void;
  /** Optional icon buttons on the right of the header. */
  actions?: ReactNode;
}) {
  const t = useT();
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
        aria-label={t("Go back")}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
      >
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>{t("< BACK")}</div>
      </button>
      <div className="subpage-title" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-label)", color: titleColor, ...(actions ? { flex: "1 1 0" } : {}) }}>{title}</div>
      {actions && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
