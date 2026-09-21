import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { handleApiAuth, sessionToken } from "./api";
import { createChatController, type ChatController } from "./chat-controller";
import type {
  ChatMessage,
  ChatPage,
  ChatSnapshot,
  ChatTransport,
  PendingMessage,
} from "./chat-state";

export type {
  ChatMessage,
  ChatPage,
  ChatSnapshot,
  ChatTransport,
  PendingMessage,
} from "./chat-state";
export { mergeMessages, normalizeDraft } from "./chat-state";
export { createChatController } from "./chat-controller";

const REQUEST_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 5_000;

const EMPTY_MESSAGES: ChatMessage[] = [];
const EMPTY_PENDING: PendingMessage[] = [];
Object.freeze(EMPTY_MESSAGES);
Object.freeze(EMPTY_PENDING);

const EMPTY_SNAPSHOT: ChatSnapshot = Object.freeze({
  messages: EMPTY_MESSAGES,
  pending: EMPTY_PENDING,
  loading: false,
  loadingOlder: false,
  hasOlder: false,
  error: null,
  olderError: null,
  accessDenied: false,
});

const EMPTY_ACTIONS = {
  send: (_text: string) => false,
  retry: (_clientKey: string) => {},
  refresh: async () => {},
  loadOlder: async () => {},
};

const EMPTY_RESULT = Object.freeze({ ...EMPTY_SNAPSHOT, ...EMPTY_ACTIONS });

type ErrorPayload = { error?: unknown };

export class ChatRequestError extends Error {
  readonly status: number;
  readonly retryAt: number;

  constructor(message: string, status = 0, retryAt = 0) {
    super(message);
    this.name = "ChatRequestError";
    this.status = status;
    this.retryAt = retryAt;
  }
}

function retryAtFrom(response: Response, now: number): number {
  const header = response.headers.get("Retry-After");
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return now + Math.ceil(seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(now, date) : 0;
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = response.status === 429
    ? "Too many messages. Wait before retrying."
    : response.status === 403
      ? "You no longer have access to this house chat."
      : response.status === 401
        ? "Your session has expired."
        : "Could not load or send messages.";
  try {
    const payload = await response.json() as ErrorPayload;
    return typeof payload.error === "string" && payload.error ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

function linkedRequest(signal: AbortSignal) {
  const controller = new AbortController();
  const relayAbort = () => controller.abort(signal.reason);
  if (signal.aborted) relayAbort();
  else signal.addEventListener("abort", relayAbort, { once: true });
  const timer = window.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    cleanup() {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", relayAbort);
    },
  };
}

export function createChatTransport(capturedToken: string, now: () => number = Date.now): ChatTransport {
  const request = async <T>(
    houseId: string,
    cursor: { before?: string; after?: string } | undefined,
    input: { text: string; clientKey: string } | undefined,
    signal: AbortSignal,
  ): Promise<T> => {
    const query = cursor?.before
      ? `?before=${encodeURIComponent(cursor.before)}`
      : cursor?.after
        ? `?after=${encodeURIComponent(cursor.after)}`
        : "";
    const method = input === undefined ? "GET" : "POST";
    const linked = linkedRequest(signal);
    try {
      const response = await fetch(`/api/houses/${encodeURIComponent(houseId)}/chat/messages${query}`, {
        method,
        headers: { authorization: `Bearer ${capturedToken}`, "content-type": "application/json" },
        body: input === undefined ? undefined : JSON.stringify(input),
        signal: linked.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401 && capturedToken === sessionToken()) handleApiAuth(response);
        throw new ChatRequestError(
          await errorMessage(response),
          response.status,
          response.status === 429 ? retryAtFrom(response, now()) : 0,
        );
      }
      return await response.json() as T;
    } catch (error) {
      if (error instanceof ChatRequestError) throw error;
      if (linked.signal.aborted && !signal.aborted) {
        throw new ChatRequestError("The chat request timed out.");
      }
      throw error;
    } finally {
      linked.cleanup();
    }
  };

  return {
    get: (houseId, cursor, signal) => request<ChatPage>(houseId, cursor, undefined, signal),
    post: (houseId, input, signal) => request(houseId, undefined, input, signal),
  };
}

type ControllerLease = {
  key: string;
  controller: ChatController;
  users: number;
  disposeTimer: number | null;
};

let lease: ControllerLease | null = null;

function acquireController(
  key: string,
  create: () => ChatController,
): ControllerLease {
  if (lease?.key === key) return lease;
  if (lease) {
    if (lease.disposeTimer !== null) window.clearTimeout(lease.disposeTimer);
    lease.controller.dispose();
  }
  lease = { key, controller: create(), users: 0, disposeTimer: null };
  return lease;
}

function retainController(selected: ControllerLease) {
  selected.users += 1;
  if (selected.disposeTimer !== null) {
    window.clearTimeout(selected.disposeTimer);
    selected.disposeTimer = null;
  }
  return () => {
    selected.users -= 1;
    if (selected.users > 0 || selected.disposeTimer !== null) return;
    // StrictMode immediately replays setup after cleanup. Deferring disposal lets
    // that setup reclaim the same live controller instead of reusing a dead one.
    selected.disposeTimer = window.setTimeout(() => {
      selected.disposeTimer = null;
      if (selected.users === 0) {
        selected.controller.dispose();
        if (lease === selected) lease = null;
      }
    }, 0);
  };
}

export function useHouseChat(options: {
  houseId: string | null;
  selfId: string | null;
  sessionKey: string | null;
  active: boolean;
  changeRevision: number;
  onAccessDenied(): void;
}): ChatSnapshot & {
  send(text: string): boolean;
  retry(clientKey: string): void;
  refresh(): Promise<void>;
  loadOlder(): Promise<void>;
} {
  const identity = options.houseId && options.selfId && options.sessionKey
    ? `${options.sessionKey.length}:${options.sessionKey}|${options.selfId.length}:${options.selfId}|${options.houseId}`
    : null;
  const accessDenied = useRef(options.onAccessDenied);
  accessDenied.current = options.onAccessDenied;
  const selected = useMemo(() => {
    if (!identity || !options.houseId || !options.selfId || !options.sessionKey) return null;
    const houseId = options.houseId;
    const selfId = options.selfId;
    const token = options.sessionKey;
    return acquireController(identity, () => createChatController({
      houseId,
      selfId,
      transport: createChatTransport(token),
      onAccessDenied: () => accessDenied.current(),
      uuid: () => crypto.randomUUID(),
      now: Date.now,
    }));
  }, [identity, options.houseId, options.selfId, options.sessionKey]);
  const controller = selected?.controller ?? null;
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
    controller?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
  );

  useEffect(() => selected ? retainController(selected) : undefined, [selected]);

  useEffect(() => {
    if (!controller || !options.active) return;
    let timer: number | null = null;
    const stopTimer = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
    };
    const syncVisibility = () => {
      stopTimer();
      if (document.visibilityState !== "visible") {
        controller.pause();
        return;
      }
      void controller.refresh();
      timer = window.setInterval(() => void controller.refresh(), POLL_INTERVAL_MS);
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") void controller.refresh();
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("focus", onFocus);
      stopTimer();
      controller.pause();
    };
  }, [controller, options.active, options.changeRevision]);

  if (!controller) return EMPTY_RESULT;
  return {
    ...snapshot,
    send: controller.send,
    retry: controller.retry,
    refresh: controller.refresh,
    loadOlder: controller.loadOlder,
  };
}
