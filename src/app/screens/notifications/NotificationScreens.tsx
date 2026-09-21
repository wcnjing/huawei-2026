import type { Notification, NotificationKind } from "../../types/notifications";
import { MemberChar } from "../../components/avatars";
import { IconBell, IconCheck, IconCoin, IconHouse, IconShield, IconStar, IconWarning, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { useMemberMap } from "../../hooks/useMembers";
import { formatNotifTimestamp } from "../../utils/date";

function iconForNotifKind(kind: NotificationKind): { icon: React.ReactNode; accent: string } {
  if (kind.startsWith("drill-win")) {
    return { icon: <IconCheck size={14} color="#00ff88" />, accent: "#00ff88" };
  }
  if (kind.startsWith("drill-lose")) {
    return { icon: <IconWarning size={14} color="#ff2d55" />, accent: "#ff2d55" };
  }
  if (kind === "family-drill-complete") {
    return { icon: <IconShield size={14} color="#00d4ff" />, accent: "#00d4ff" };
  }
  if (kind === "payday") {
    return { icon: <IconCoin size={14} color="#ffe66d" />, accent: "#ffe66d" };
  }
  if (kind === "house") {
    return { icon: <IconHouse size={14} color="#00ff88" />, accent: "#00ff88" };
  }
  return { icon: <IconStar size={14} color="#ffe66d" />, accent: "#ffe66d" };
}



export function NotificationsScreen({
  notifications, onOpen, onMarkAllRead, onBack,
}: {
  notifications: Notification[];
  onOpen: (id: string) => void;
  onMarkAllRead: () => void;
  onBack: () => void;
}) {
  const memberMap = useMemberMap();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #ffe66d", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="#6b8ba4" />
        </button>
        <IconBell size={16} color="#ffe66d" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d" }}>NOTIFICATIONS</div>
        <div style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: unreadCount > 0 ? "#ff2d55" : "#6b8ba4" }}>
          {unreadCount > 0 ? `${unreadCount} UNREAD` : "ALL READ"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <IconBell size={40} color="#2a3a5c" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>NO NOTIFICATIONS YET</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5, maxWidth: 260 }}>
              Complete drills, collect payday, or claim daily rewards to see activity here.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {notifications.map(n => {
              const { icon, accent } = iconForNotifKind(n.kind);
              const member = n.memberId !== "family" ? memberMap[n.memberId] : null;
              const isUnread = !n.read;
              return (
                <button
                  key={n.id}
                  onClick={() => onOpen(n.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "12px 14px",
                    background: "none",
                    border: "none",
                    borderBottom: "2px solid #1a2340",
                    borderLeft: isUnread ? `4px solid ${accent}` : "4px solid transparent",
                    backgroundColor: isUnread ? "rgba(255,230,109,0.03)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ width: 28, height: 28, backgroundColor: "#111827", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isUnread ? "#e8f4f8" : "#6b8ba4", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.title}
                      </div>
                      {isUnread && (
                        <div style={{ width: 6, height: 6, backgroundColor: "#ff2d55", flexShrink: 0, marginTop: 2 }} />
                      )}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: isUnread ? "#4ecdc4" : "#4a5c78", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {n.body}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      {member && (
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: member.primaryColor }}>
                          {member.name}
                        </div>
                      )}
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#2a3a5c" }}>
                        {formatNotifTimestamp(n.timestamp)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ padding: "10px 12px", borderTop: "4px solid #2a3a5c", backgroundColor: "#0a0e1a" }}>
          <PixelButton
            onClick={onMarkAllRead}
            color={unreadCount > 0 ? "#ffe66d" : "#1a2340"}
            textColor={unreadCount > 0 ? "#0a0e1a" : "#6b8ba4"}
            size="sm"
            full
            disabled={unreadCount === 0}
          >
            {unreadCount > 0 ? `MARK ALL READ (${unreadCount})` : "ALL CAUGHT UP"}
          </PixelButton>
        </div>
      )}
    </div>
  );
}

export function NotificationDetailScreen({
  notification, onBack, onAction,
}: {
  notification: Notification;
  onBack: () => void;
  onAction: (action: "train" | "family-drill") => void;
}) {
  const { icon, accent } = iconForNotifKind(notification.kind);
  const memberMap = useMemberMap();
  const member = notification.memberId !== "family" ? memberMap[notification.memberId] : null;
  const fullTimestamp = new Date(notification.timestamp).toLocaleString(undefined, {
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).toUpperCase();

  // Determine follow-up action
  const isDrillOutcome = notification.kind.startsWith("drill-");
  const isFamilyDrill = notification.kind === "family-drill-complete";
  const actionLabel = isDrillOutcome
    ? "TRAIN AGAIN"
    : isFamilyDrill
      ? "PLAY HOUSE DRILL AGAIN"
      : null;
  const actionHandler = isDrillOutcome
    ? () => onAction("train")
    : isFamilyDrill
      ? () => onAction("family-drill")
      : null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: `4px solid ${accent}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>{"< BACK"}</div>
        </button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: accent }}>NOTIFICATION</div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "16px" }}>
        <div style={{ backgroundColor: "#111827", border: `4px solid ${accent}`, boxShadow: `4px 4px 0 ${accent}`, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, backgroundColor: "#0a0e1a", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: accent, lineHeight: 1.5 }}>
                {notification.title}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 4 }}>
                {fullTimestamp}
              </div>
            </div>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, paddingTop: 12, borderTop: "2px solid #2a3a5c" }}>
            {notification.body}
          </div>
        </div>

        {member && (
          <div style={{ marginTop: 14, backgroundColor: "#0a0e1a", border: `3px solid ${member.primaryColor}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <MemberChar member={member} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8" }}>MEMBER</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: member.primaryColor, marginTop: 3 }}>
                {member.name}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 3 }}>
                {member.role}
              </div>
            </div>
          </div>
        )}

        {actionLabel && actionHandler && (
          <div style={{ marginTop: 20 }}>
            <PixelButton onClick={actionHandler} color={accent} textColor="#0a0e1a" size="md" full>
              [ {actionLabel} ]
            </PixelButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PAYDAY SUNDAY — now actually distributes coins via ledger
// ─────────────────────────────────────────────────────────────────────────
