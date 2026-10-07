import { useEffect } from "react";
import type { Notification } from "../../types/notifications";
import { useT } from "../../i18n";
import { IconX } from "../../components/icons";
import { iconForNotifKind } from "./NotificationScreens";

const TOAST_MS = 5000;

/** A banner that drops down under the bell when a new notification arrives. */
export function NotificationToast({
  notification,
  onOpen,
  onDismiss,
}: {
  notification: Notification;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const { icon, accent } = iconForNotifKind(notification.kind);

  // Restarts for each new notification, so the latest one always gets its full time.
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, TOAST_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        top: 56,
        left: 12,
        right: 12,
        zIndex: 60,
        display: "flex",
        alignItems: "stretch",
        backgroundColor: "#111827",
        border: `2px solid ${accent}`,
        boxShadow: "4px 4px 0 #0a0e1a",
        animation: "slideDown 0.25s steps(4)",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("Open notification: {title}", { title: t(notification.title) })}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ width: 28, height: 28, border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#e8f4f8", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t(notification.title)}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#4ecdc4", marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t(notification.body)}
          </div>
        </div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: accent, flexShrink: 0 }}>
          {t("VIEW ▸")}
        </div>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("Dismiss notification")}
        style={{ background: "none", border: "none", borderLeft: "2px solid #1a2340", cursor: "pointer", padding: "0 10px", display: "flex", alignItems: "center" }}
      >
        <IconX size={12} color="#6b8ba4" />
      </button>
    </div>
  );
}
