import { IconBell, IconChat, IconGear, IconSpeaker } from "../icons";

export function AppHeader({
  title,
  titleColor,
  hasUnreadNotifications = false,
  muted = false,
  onToggleMute,
  onChat,
  onNotifications,
  onSettings,
}: {
  title: string;
  titleColor: string;
  hasUnreadNotifications?: boolean;
  muted?: boolean;
  onToggleMute: () => void;
  onChat: () => void;
  onNotifications: () => void;
  onSettings: () => void;
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
        justifyContent: "space-between",
        flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: titleColor }}>
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={onToggleMute}
          aria-label={muted ? "Unmute music" : "Mute music"}
          aria-pressed={muted}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconSpeaker size={18} muted={muted} color={muted ? "#6b8ba4" : "#00ff88"} />
        </button>
        <button
          onClick={onChat}
          aria-label="Open family chat"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconChat size={18} color="#4ecdc4" />
        </button>
        <button
          onClick={onNotifications}
          aria-label="Open notifications"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", position: "relative" }}
        >
          <IconBell size={18} color="#ffe66d" />
          {hasUnreadNotifications && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 6,
                height: 6,
                backgroundColor: "#ff2d55",
                border: "1px solid #0a0e1a",
              }}
            />
          )}
        </button>
        <button
          onClick={onSettings}
          aria-label="Open settings"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
        >
          <IconGear size={18} color="#6b8ba4" />
        </button>
      </div>
    </div>
  );
}