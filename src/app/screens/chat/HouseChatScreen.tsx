import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeDraft, type useHouseChat } from "../../hooks/useHouseChat";
import type { Avatar } from "../../services/house";
import { useI18n } from "../../i18n";

type HouseChat = ReturnType<typeof useHouseChat>;

export type HouseChatScreenProps = {
  chat: HouseChat;
  selfId: string;
  selfName: string;
  houseName: string;
  hasHouse: boolean;
  identityKey: string;
  reduceMotion: boolean;
  onBack(): void;
  onJoinHouse(): void;
  renderAvatar(avatar: Avatar): ReactNode;
};

const BOTTOM_THRESHOLD = 80;
const NUDGE_WINDOW_MS = 24 * 60 * 60 * 1000;

function dayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function remainingSeconds(retryAt: number, now: number) {
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}

export function HouseChatScreen({
  chat,
  selfId,
  selfName,
  houseName,
  hasHouse,
  identityKey,
  reduceMotion,
  onBack,
  onJoinHouse,
  renderAvatar,
}: HouseChatScreenProps) {
  const { t, language } = useI18n();
  const locale = language === "en" ? "en-SG" : `${language}-SG`;
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(Date.now);
  const [newMessages, setNewMessages] = useState(false);
  const [dismissedNudge, setDismissedNudge] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const forceBottomRef = useRef(false);
  const anchorRef = useRef<{ key: string; top: number; firstKey: string | null } | null>(null);
  const lastMessageIdRef = useRef<string | null | undefined>(undefined);
  const validDraft = normalizeDraft(draft);
  const count = Array.from(draft.replace(/\r\n/g, "\n").trim()).length;
  const disabled = !hasHouse || chat.accessDenied;
  const rows = useMemo(() => {
    const messages = chat.messages.map(message => ({
      kind: "message" as const,
      key: `message:${message.id}`,
      ...message,
    }));
    const pending = chat.pending.map(message => ({
      kind: "pending" as const,
      key: `pending:${message.clientKey}`,
      senderName: selfName,
      senderAvatar: null,
      ...message,
    }));
    const merged: Array<(typeof messages)[number] | (typeof pending)[number]> = [];
    let pendingIndex = 0;
    for (const message of messages) {
      while (pendingIndex < pending.length && pending[pendingIndex].createdAt <= message.createdAt) {
        merged.push(pending[pendingIndex]);
        pendingIndex += 1;
      }
      merged.push(message);
    }
    merged.push(...pending.slice(pendingIndex));
    return merged;
  }, [chat.messages, chat.pending, selfName]);
  const cooldownActive = chat.pending.some(item => item.status === "failed" && item.retryAt > now);
  // The latest "finished a drill" line from the last day that this player hasn't followed up
  // on yet. Derived from the messages already loaded, so it needs no extra request.
  const nudge = useMemo(() => {
    const event = [...chat.messages].reverse().find(message => message.type === "drill_finished");
    if (!event || event.id === dismissedNudge) return null;
    const at = Date.parse(event.createdAt);
    if (now - at > NUDGE_WINDOW_MS) return null;
    const followedUp = chat.pending.length > 0 || chat.messages.some(message =>
      message.type === "message" && message.senderId === selfId && Date.parse(message.createdAt) > at);
    return followedUp ? null : event;
  }, [chat.messages, chat.pending, dismissedNudge, now, selfId]);

  useEffect(() => {
    setDraft("");
    setNewMessages(false);
    anchorRef.current = null;
  }, [identityKey, chat.accessDenied]);

  useEffect(() => {
    if (!cooldownActive) return;
    const timer = window.setTimeout(() => setNow(Date.now()), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownActive, now]);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    const lastMessageId = chat.messages.at(-1)?.id ?? null;
    const previousMessageId = lastMessageIdRef.current;
    lastMessageIdRef.current = lastMessageId;
    const messageArrived = lastMessageId !== null && lastMessageId !== previousMessageId;
    const anchor = anchorRef.current;
    if (anchor) {
      if ((rows[0]?.key ?? null) !== anchor.firstKey) {
        anchorRef.current = null;
        const element = [...history.querySelectorAll<HTMLElement>("[data-chat-row-key]")]
          .find(candidate => candidate.dataset.chatRowKey === anchor.key);
        if (element) history.scrollTop += element.getBoundingClientRect().top - anchor.top;
      } else if (messageArrived) {
        setNewMessages(true);
      }
      return;
    }
    if (!messageArrived && !forceBottomRef.current) return;
    const hadMessages = previousMessageId !== undefined && previousMessageId !== null;
    if (!hadMessages || forceBottomRef.current || nearBottomRef.current) {
      forceBottomRef.current = false;
      setNewMessages(false);
      history.scrollTo({
        top: history.scrollHeight,
        behavior: reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    } else {
      setNewMessages(true);
    }
  }, [chat.messages, reduceMotion, rows]);

  const send = () => {
    if (disabled || !validDraft) return;
    forceBottomRef.current = true;
    if (chat.send(draft)) setDraft("");
    else forceBottomRef.current = false;
  };

  const loadOlder = async () => {
    const history = historyRef.current;
    if (history) {
      const historyBounds = history.getBoundingClientRect();
      const elements = [...history.querySelectorAll<HTMLElement>("[data-chat-row-key]")];
      const element = elements.find(candidate => candidate.getBoundingClientRect().bottom > historyBounds.top)
        ?? elements[0];
      const key = element?.dataset.chatRowKey;
      anchorRef.current = element && key ? {
        key,
        top: element.getBoundingClientRect().top,
        firstKey: rows[0]?.key ?? null,
      } : null;
    }
    await chat.loadOlder();
  };

  const scrollToLatest = () => {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTo({
      top: history.scrollHeight,
      behavior: reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    nearBottomRef.current = true;
    setNewMessages(false);
  };

  let previousDay = "";
  const deliveryStatus = chat.pending.some(item => item.status === "sending")
    ? t("Sending message")
    : chat.pending.some(item => item.status === "failed")
      ? t("One or more messages failed to send")
      : chat.loading && rows.length > 0
        ? t("Checking for new messages")
        : "";

  return (
    <section className="house-chat" aria-label={houseName ? t("{house} chat", { house: houseName }) : t("House chat")}>
      <header className="house-chat__header">
        <button type="button" className="house-chat__icon-button" onClick={onBack} aria-label={t("Close house chat")}>×</button>
        <div>
          <h1>{t("HOUSE CHAT")}</h1>
          <p>{houseName || t("PRIVATE HOUSE CONVERSATION")}</p>
        </div>
      </header>

      {nudge && !disabled && (
        <div className="house-chat__nudge" role="status">
          <p>
            {nudge.senderId === selfId
              ? "You finished a drill. Tell your house how it went?"
              : `${nudge.senderName} finished a drill. Ask how it went?`}
          </p>
          <div className="house-chat__nudge-actions">
            <button
              type="button"
              onClick={() => {
                if (!draft.trim()) {
                  setDraft(nudge.senderId === selfId
                    ? "Just finished a drill! "
                    : `Nice one on the drill, ${nudge.senderName}! How did it go? `);
                }
                composerRef.current?.focus();
              }}
            >
              Say something
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setDismissedNudge(nudge.id)}>×</button>
          </div>
        </div>
      )}

      <div
        ref={historyRef}
        role="region"
        className="house-chat__history"
        aria-label={t("Message history")}
        onScroll={event => {
          const element = event.currentTarget;
          nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD;
          if (nearBottomRef.current) setNewMessages(false);
        }}
      >
        {chat.hasOlder && (
          <button type="button" className="house-chat__load" disabled={chat.loadingOlder} onClick={() => void loadOlder()}>
            {chat.loadingOlder ? t("Loading...") : chat.olderError ? t("Try loading older messages") : t("Load older messages")}
          </button>
        )}
        {chat.olderError && <p className="house-chat__error" role="status">{t(chat.olderError)}</p>}
        {chat.loading && rows.length === 0 && <p className="house-chat__empty">{t("Loading messages...")}</p>}
        {!chat.loading && rows.length === 0 && hasHouse && !chat.accessDenied && (
          <p className="house-chat__empty">{t("No messages yet. Start the conversation.")}</p>
        )}
        {rows.map(row => {
          const currentDay = dayKey(row.createdAt);
          const showDay = currentDay !== previousDay;
          previousDay = currentDay;
          if (row.kind === "message" && row.type === "drill_finished") {
            return (
              <div key={row.key} className="house-chat__entry" data-chat-row-key={row.key}>
                {showDay && <div className="house-chat__day">{dayFormatter.format(new Date(row.createdAt))}</div>}
                <p className="house-chat__event">
                  {row.senderId === selfId ? "You" : row.senderName} {row.text}
                  <time dateTime={row.createdAt}> · {timeFormatter.format(new Date(row.createdAt))}</time>
                </p>
              </div>
            );
          }
          const own = row.senderId === selfId;
          const failed = row.kind === "pending" && row.status === "failed";
          const wait = failed ? remainingSeconds(row.retryAt, now) : 0;
          return (
            <div key={row.key} className="house-chat__entry" data-chat-row-key={row.key}>
              {showDay && <div className="house-chat__day">{dayFormatter.format(new Date(row.createdAt))}</div>}
              <article className={`house-chat__message${own ? " house-chat__message--own" : ""}`}>
                <div className="house-chat__avatar" aria-hidden="true">
                  {row.senderAvatar ? renderAvatar(row.senderAvatar) : <span>{selfName.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="house-chat__bubble">
                  <div className="house-chat__meta">
                    <strong>{row.senderName}</strong>
                    <time dateTime={row.createdAt}>{timeFormatter.format(new Date(row.createdAt))}</time>
                  </div>
                  <p className="house-chat__text">{row.text}</p>
                  <div className="house-chat__delivery">
                    {row.kind === "message" && own && t("Sent")}
                    {row.kind === "pending" && row.status === "sending" && t("Sending")}
                    {failed && (
                      <>
                        <span>{row.error ? t(row.error) : t("Failed to send.")}</span>
                        <button
                          type="button"
                          disabled={wait > 0}
                          onClick={() => chat.retry(row.clientKey)}
                        >
                          {wait > 0 ? t("Retry in {seconds}s", { seconds: wait }) : t("Retry")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>

      {newMessages && <button type="button" className="house-chat__new" onClick={scrollToLatest}>{t("New messages")}</button>}

      <div className="house-chat__status" aria-live="polite">{deliveryStatus}</div>
      {chat.error && <div className="house-chat__status house-chat__error" role="status">{t(chat.error)}</div>}
      {disabled ? (
        <div className="house-chat__no-access">
          <p>{t("Create or join a house to use chat.")}</p>
          <button type="button" onClick={onJoinHouse}>{t("Create or join a house")}</button>
        </div>
      ) : (
        <div className="house-chat__composer">
          <label htmlFor="chat-message">{t("Message")}</label>
          <textarea
            ref={composerRef}
            id="chat-message"
            rows={3}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className="house-chat__composer-actions">
            <span className={count > 1000 ? "house-chat__count house-chat__count--invalid" : "house-chat__count"}>{count}/1000</span>
            <button type="button" disabled={!validDraft} onClick={send}>{t("Send")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
