import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { normalizeDraft, type useHouseChat } from "./chat";
import type { Avatar } from "./house";
import "./chat.css";

type HouseChat = ReturnType<typeof useHouseChat>;

export type HouseChatScreenProps = {
  chat: HouseChat;
  selfId: string;
  selfName: string;
  houseName: string;
  hasHouse: boolean;
  identityKey: string;
  onBack(): void;
  onJoinHouse(): void;
  renderAvatar(avatar: Avatar): ReactNode;
};

const BOTTOM_THRESHOLD = 80;
const dayFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

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
  onBack,
  onJoinHouse,
  renderAvatar,
}: HouseChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [now, setNow] = useState(Date.now);
  const [newMessages, setNewMessages] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const forceBottomRef = useRef(false);
  const anchorRef = useRef<{ height: number; top: number; firstKey: string | null } | null>(null);
  const lastItemRef = useRef<string | null>(null);
  const validDraft = normalizeDraft(draft);
  const count = Array.from(draft.replace(/\r\n/g, "\n").trim()).length;
  const disabled = !hasHouse || chat.accessDenied;
  const rows = useMemo(() => [
    ...chat.messages.map(message => ({ kind: "message" as const, key: `message:${message.id}`, ...message })),
    ...chat.pending.map(message => ({
      kind: "pending" as const,
      key: `pending:${message.clientKey}`,
      senderName: selfName,
      senderAvatar: null,
      ...message,
    })),
  ], [chat.messages, chat.pending, selfName]);
  const cooldownActive = chat.pending.some(item => item.status === "failed" && item.retryAt > now);

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
    if (anchorRef.current && (rows[0]?.key ?? null) !== anchorRef.current.firstKey) {
      const anchor = anchorRef.current;
      anchorRef.current = null;
      history.scrollTop = anchor.top + history.scrollHeight - anchor.height;
      return;
    }
    const lastItem = rows.at(-1)?.key ?? null;
    if (lastItem === lastItemRef.current) return;
    const hadItems = lastItemRef.current !== null;
    lastItemRef.current = lastItem;
    if (!hadItems || forceBottomRef.current || nearBottomRef.current) {
      forceBottomRef.current = false;
      setNewMessages(false);
      history.scrollTo({
        top: history.scrollHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    } else {
      setNewMessages(true);
    }
  }, [rows]);

  const send = () => {
    if (disabled || !validDraft) return;
    forceBottomRef.current = true;
    if (chat.send(draft)) setDraft("");
    else forceBottomRef.current = false;
  };

  const loadOlder = async () => {
    const history = historyRef.current;
    if (history) {
      anchorRef.current = {
        height: history.scrollHeight,
        top: history.scrollTop,
        firstKey: rows[0]?.key ?? null,
      };
    }
    await chat.loadOlder();
  };

  const scrollToLatest = () => {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTo({
      top: history.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    nearBottomRef.current = true;
    setNewMessages(false);
  };

  let previousDay = "";
  const deliveryStatus = chat.pending.some(item => item.status === "sending")
    ? "Sending message"
    : chat.pending.some(item => item.status === "failed")
      ? "One or more messages failed to send"
      : chat.loading && rows.length > 0
        ? "Checking for new messages"
        : "";

  return (
    <section className="house-chat" aria-label={`${houseName || "House"} chat`}>
      <header className="house-chat__header">
        <button type="button" className="house-chat__icon-button" onClick={onBack} aria-label="Close house chat">×</button>
        <div>
          <h1>HOUSE CHAT</h1>
          <p>{houseName || "PRIVATE HOUSE CONVERSATION"}</p>
        </div>
      </header>

      <div
        ref={historyRef}
        role="region"
        className="house-chat__history"
        aria-label="Message history"
        onScroll={event => {
          const element = event.currentTarget;
          nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD;
          if (nearBottomRef.current) setNewMessages(false);
        }}
      >
        {chat.hasOlder && (
          <button type="button" className="house-chat__load" disabled={chat.loadingOlder} onClick={() => void loadOlder()}>
            {chat.loadingOlder ? "Loading..." : chat.olderError ? "Try loading older messages" : "Load older messages"}
          </button>
        )}
        {chat.olderError && <p className="house-chat__error" role="status">{chat.olderError}</p>}
        {chat.loading && rows.length === 0 && <p className="house-chat__empty">Loading messages...</p>}
        {!chat.loading && rows.length === 0 && hasHouse && !chat.accessDenied && (
          <p className="house-chat__empty">No messages yet. Start the conversation.</p>
        )}
        {rows.map(row => {
          const currentDay = dayKey(row.createdAt);
          const showDay = currentDay !== previousDay;
          previousDay = currentDay;
          const own = row.senderId === selfId;
          const failed = row.kind === "pending" && row.status === "failed";
          const wait = failed ? remainingSeconds(row.retryAt, now) : 0;
          return (
            <div key={row.key} className="house-chat__entry">
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
                    {row.kind === "message" && own && "Sent"}
                    {row.kind === "pending" && row.status === "sending" && "Sending"}
                    {failed && (
                      <>
                        <span>{row.error || "Failed to send."}</span>
                        <button
                          type="button"
                          disabled={wait > 0}
                          onClick={() => chat.retry(row.clientKey)}
                        >
                          {wait > 0 ? `Retry in ${wait}s` : "Retry"}
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

      {newMessages && <button type="button" className="house-chat__new" onClick={scrollToLatest}>New messages</button>}

      <div className="house-chat__status" aria-live="polite">{deliveryStatus}</div>
      {chat.error && <div className="house-chat__status house-chat__error" role="status">{chat.error}</div>}
      {disabled ? (
        <div className="house-chat__no-access">
          <p>Create or join a house to use chat.</p>
          <button type="button" onClick={onJoinHouse}>Create or join a house</button>
        </div>
      ) : (
        <div className="house-chat__composer">
          <label htmlFor="chat-message">Message</label>
          <textarea
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
            <button type="button" disabled={!validDraft} onClick={send}>Send</button>
          </div>
        </div>
      )}
    </section>
  );
}
