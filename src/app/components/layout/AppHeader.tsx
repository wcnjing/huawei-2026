import { useT } from "../../i18n";
import { IconBell, IconBulb, IconChat, IconGear, IconSpeaker } from "../icons";

export function AppHeader({
  title,
  titleColor,
  unreadNotificationCount = 0,
  hasUnreadChatMessages = false,
  muted = false,
  onToggleMute,
  onChat,
  onNotifications,
  onSettings,
  onTutorial,
}: {
  title: string;
  titleColor: string;
  unreadNotificationCount?: number;
  hasUnreadChatMessages?: boolean;
  muted?: boolean;
  onToggleMute: () => void;
  onChat: () => void;
  onNotifications: () => void;
  onSettings: () => void;
  onTutorial: () => void;
}) {
  const t = useT();
  return (
    <div
      className="app-header"
      style={{
        padding: "8px 16px",
        minHeight: 52,
        backgroundColor: "var(--background)",
        borderBottom: "4px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div className="app-header-title" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-label)", color: titleColor }}>
        {title}
      </div>
      <div className="app-header-actions" style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          className="app-header-help"
          onClick={onTutorial}
          aria-label={t("How to play: open the app tutorial")}
          title={t("How to play")}
        >
          <IconBulb size={18} color="var(--violet)" />
        </button>
        <button
          onClick={onToggleMute}
          aria-label={muted ? t("Unmute music") : t("Mute music")}
          aria-pressed={muted}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconSpeaker size={18} muted={muted} color={muted ? "var(--muted-foreground)" : "var(--green)"} />
        </button>
        <button
          onClick={onChat}
          aria-label={hasUnreadChatMessages ? t("Open house chat (new messages)") : t("Open house chat")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", position: "relative" }}
        >
          <IconChat size={18} color="var(--teal)" />
          {hasUnreadChatMessages && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 1,
                right: 0,
                width: 7,
                height: 7,
                backgroundColor: "var(--red-fill)",
                border: "1px solid var(--outline)",
              }}
            />
          )}
        </button>
        <button
          onClick={onNotifications}
          aria-label={unreadNotificationCount > 0
            ? t("Open notifications ({count} unread)", { count: unreadNotificationCount })
            : t("Open notifications")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", position: "relative" }}
        >
          <IconBell size={18} color="var(--yellow)" />
          {unreadNotificationCount > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: -2,
                right: -4,
                minWidth: 14,
                height: 14,
                padding: "0 2px",
                boxSizing: "border-box",
                backgroundColor: "var(--red-fill)",
                border: "1px solid var(--outline)",
                color: "var(--foreground-strong)",
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 7,
                lineHeight: "12px",
                textAlign: "center",
              }}
            >
              {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
            </span>
          )}
        </button>
        <button
          onClick={onSettings}
          aria-label={t("Open settings")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconGear size={18} color="var(--muted-foreground)" />
        </button>
      </div>
    </div>
  );
}
