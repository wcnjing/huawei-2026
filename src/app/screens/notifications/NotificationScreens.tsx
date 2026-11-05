import type { Notification, NotificationKind } from "../../types/notifications";
import { MemberChar } from "../../components/avatars";
import { IconBell, IconCheck, IconCoin, IconHouse, IconShield, IconStar, IconWarning, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { useMemberMap } from "../../hooks/useMembers";
import { formatNotifTimestamp } from "../../utils/date";
import { useI18n, useT } from "../../i18n";
import { ink } from "../../utils/color";

const DATE_LOCALES = { en: "en-SG", zh: "zh-SG", ms: "ms-SG", ta: "ta-SG" } as const;

export function iconForNotifKind(kind: NotificationKind): { icon: React.ReactNode; accent: string } {
  if (kind.startsWith("drill-win")) {
    return { icon: <IconCheck size={14} color="var(--green)" />, accent: "var(--green)" };
  }
  if (kind.startsWith("drill-lose")) {
    return { icon: <IconWarning size={14} color="var(--red)" />, accent: "var(--red)" };
  }
  if (kind === "family-drill-complete") {
    return { icon: <IconShield size={14} color="var(--cyan)" />, accent: "var(--cyan)" };
  }
  if (kind === "payday") {
    return { icon: <IconCoin size={14} color="var(--yellow)" />, accent: "var(--yellow)" };
  }
  if (kind === "house") {
    return { icon: <IconHouse size={14} color="var(--green)" />, accent: "var(--green)" };
  }
  return { icon: <IconStar size={14} color="var(--yellow)" />, accent: "var(--yellow)" };
}



export function NotificationsScreen({
  notifications, onOpen, onMarkAllRead, onBack,
}: {
  notifications: Notification[];
  onOpen: (id: string) => void;
  onMarkAllRead: () => void;
  onBack: () => void;
}) {
  const t = useT();
  const memberMap = useMemberMap();
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "var(--background)", borderBottom: "4px solid var(--yellow)", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="var(--muted-foreground)" />
        </button>
        <IconBell size={16} color="var(--yellow)" />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)" }}>{t("NOTIFICATIONS")}</div>
        <div style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: unreadCount > 0 ? "var(--red)" : "var(--muted-foreground)" }}>
          {unreadCount > 0 ? t("{count} UNREAD", { count: unreadCount }) : t("ALL READ")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {notifications.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <IconBell size={40} color="var(--border)" />
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("NO NOTIFICATIONS YET")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.5, maxWidth: 260 }}>
              {t("Complete drills, collect payday, or claim daily rewards to see activity here.")}
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
                    borderBottom: "2px solid var(--secondary)",
                    borderLeft: isUnread ? `4px solid ${accent}` : "4px solid transparent",
                    backgroundColor: isUnread ? "color-mix(in srgb, var(--yellow-fill) 3%, transparent)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ width: 28, height: 28, backgroundColor: "var(--card)", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: isUnread ? "var(--foreground)" : "var(--muted-foreground)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t(n.title)}
                      </div>
                      {isUnread && (
                        <div style={{ width: 6, height: 6, backgroundColor: "var(--red-fill)", flexShrink: 0, marginTop: 2 }} />
                      )}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: isUnread ? "var(--teal)" : "var(--border-strong)", marginTop: 4, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t(n.body)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                      {member && (
                        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: ink(member.primaryColor) }}>
                          {t(member.name)}
                        </div>
                      )}
                      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--border)" }}>
                        {formatNotifTimestamp(n.timestamp, t)}
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
        <div style={{ padding: "10px 12px", borderTop: "4px solid var(--border)", backgroundColor: "var(--background)" }}>
          <PixelButton
            onClick={onMarkAllRead}
            color={unreadCount > 0 ? "var(--yellow-fill)" : "var(--secondary)"}
            textColor={unreadCount > 0 ? "var(--on-fill)" : "var(--muted-foreground)"}
            size="sm"
            full
            disabled={unreadCount === 0}
          >
            {unreadCount > 0 ? t("MARK ALL READ ({count})", { count: unreadCount }) : t("ALL CAUGHT UP")}
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
  const { language, t } = useI18n();
  const { icon, accent } = iconForNotifKind(notification.kind);
  const memberMap = useMemberMap();
  const member = notification.memberId !== "family" ? memberMap[notification.memberId] : null;
  const fullTimestamp = new Date(notification.timestamp).toLocaleString(DATE_LOCALES[language], {
    weekday: "short", hour: "2-digit", minute: "2-digit",
  }).toUpperCase();

  // Determine follow-up action
  const isDrillOutcome = notification.kind.startsWith("drill-");
  const isFamilyDrill = notification.kind === "family-drill-complete";
  const actionLabel = isDrillOutcome
    ? t("TRAIN AGAIN")
    : isFamilyDrill
      ? t("PLAY HOUSE DRILL AGAIN")
      : null;
  const actionHandler = isDrillOutcome
    ? () => onAction("train")
    : isFamilyDrill
      ? () => onAction("family-drill")
      : null;

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "var(--background)", borderBottom: `4px solid ${accent}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("< BACK")}</div>
        </button>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: accent }}>{t("NOTIFICATION")}</div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "16px" }}>
        <div style={{ backgroundColor: "var(--card)", border: `4px solid ${accent}`, boxShadow: `4px 4px 0 ${accent}`, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, backgroundColor: "var(--background)", border: `2px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: accent, lineHeight: 1.5 }}>
                {t(notification.title)}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 4 }}>
                {fullTimestamp}
              </div>
            </div>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6, paddingTop: 12, borderTop: "2px solid var(--border)" }}>
            {t(notification.body)}
          </div>
        </div>

        {member && (
          <div style={{ marginTop: 14, backgroundColor: "var(--background)", border: `3px solid ${ink(member.primaryColor)}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <MemberChar member={member} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)" }}>{t("MEMBER")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: ink(member.primaryColor), marginTop: 3 }}>
                {t(member.name)}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>
                {t(member.role)}
              </div>
            </div>
          </div>
        )}

        {actionLabel && actionHandler && (
          <div style={{ marginTop: 20 }}>
            <PixelButton onClick={actionHandler} color={accent} textColor="var(--on-fill)" size="md" full>
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
