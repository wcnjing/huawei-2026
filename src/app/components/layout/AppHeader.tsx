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
        backgroundColor: "#0a0e1a",
        borderBottom: "4px solid #2a3a5c",
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
          <IconBulb size={18} color="#c77dff" />
        </button>
        <button
          onClick={onToggleMute}
          aria-label={muted ? t("Unmute music") : t("Mute music")}
          aria-pressed={muted}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconSpeaker size={18} muted={muted} color={muted ? "#6b8ba4" : "#00ff88"} />
        </button>
        <button
          onClick={onChat}
          aria-label={hasUnreadChatMessages ? t("Open house chat (new messages)") : t("Open house chat")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", position: "relative" }}
        >
          <IconChat size={18} color="#4ecdc4" />
          {hasUnreadChatMessages && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 1,
                right: 0,
                width: 7,
                height: 7,
                backgroundColor: "#ff2d55",
                border: "1px solid #0a0e1a",
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
          <IconBell size={18} color="#ffe66d" />
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
                backgroundColor: "#ff2d55",
                border: "1px solid #0a0e1a",
                color: "#ffffff",
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
          <IconGear size={18} color="#6b8ba4" />
        </button>
      </div>
    </div>
  );
}
