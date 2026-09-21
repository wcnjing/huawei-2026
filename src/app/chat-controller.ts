import {
  mergeMessages,
  normalizeDraft,
  type ChatMessage,
  type ChatSnapshot,
  type ChatTransport,
  type PendingMessage,
} from "./chat-state";

type ChatControllerOptions = {
  houseId: string;
  selfId: string;
  transport: ChatTransport;
  onAccessDenied(): void;
  uuid(): string;
  now(): number;
};

export type ChatController = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ChatSnapshot;
  refresh(): Promise<void>;
  loadOlder(): Promise<void>;
  send(text: string): boolean;
  retry(clientKey: string): void;
  pause(): void;
  dispose(): void;
};

const INITIAL_SNAPSHOT: ChatSnapshot = {
  messages: [],
  pending: [],
  loading: false,
  loadingOlder: false,
  hasOlder: false,
  error: null,
  olderError: null,
  accessDenied: false,
};

function publicError(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Could not reach the server.";
}

function errorStatus(error: unknown): number {
  if (!error || typeof error !== "object" || !("status" in error)) return 0;
  return Number(error.status) || 0;
}

function errorRetryAt(error: unknown): number {
  if (!error || typeof error !== "object" || !("retryAt" in error)) return 0;
  return Number(error.retryAt) || 0;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sameSend(message: ChatMessage, pending: PendingMessage): boolean {
  return message.houseId === pending.houseId
    && message.senderId === pending.senderId
    && message.clientKey === pending.clientKey;
}

export function createChatController(options: ChatControllerOptions): ChatController {
  let snapshot = INITIAL_SNAPSHOT;
  let disposed = false;
  let authorizationLost = false;
  let accessNotified = false;
  let afterCursor: string | null = null;
  let oldestCursor: string | null = null;
  let refreshAgain = false;
  let refreshPromise: Promise<void> | null = null;
  let olderPromise: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const postRequests = new Map<string, AbortController>();

  const publish = (patch: Partial<ChatSnapshot>) => {
    if (disposed) return;
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };

  const abortRequests = () => {
    for (const request of requests) request.abort();
    requests.clear();
    postRequests.clear();
  };

  const loseAuthorization = (status: number) => {
    if (disposed || authorizationLost) return;
    authorizationLost = true;
    abortRequests();
    afterCursor = null;
    oldestCursor = null;
    publish({
      ...INITIAL_SNAPSHOT,
      accessDenied: status === 403,
    });
    if (status === 403 && !accessNotified) {
      accessNotified = true;
      options.onAccessDenied();
    }
  };

  const handleAuthorizationError = (error: unknown): boolean => {
    const status = errorStatus(error);
    if (status !== 401 && status !== 403) return false;
    loseAuthorization(status);
    return true;
  };

  const beginRequest = () => {
    const request = new AbortController();
    requests.add(request);
    return request;
  };

  const finishRequest = (request: AbortController) => {
    requests.delete(request);
  };

  const acceptMessages = (messages: ChatMessage[]) => {
    const relevant = messages.filter(message => message.houseId === options.houseId);
    const pending = snapshot.pending.filter(item => !relevant.some(message => sameSend(message, item)));
    publish({ messages: mergeMessages(snapshot.messages, relevant), pending });
  };

  const refreshPass = async () => {
    const startedWithCursor = afterCursor;
    let cursor = startedWithCursor;
    while (!disposed && !authorizationLost) {
      const request = beginRequest();
      try {
        const result = await options.transport.get(
          options.houseId,
          cursor === null ? {} : { after: cursor },
          request.signal,
        );
        if (disposed || authorizationLost) return;
        if (result.houseId !== options.houseId) return;

        acceptMessages(result.messages);
        if (result.messages.length > 0) {
          const first = result.messages[0];
          const last = result.messages[result.messages.length - 1];
          const advanced = cursor !== last.id;
          if (oldestCursor === null) {
            oldestCursor = first.id;
            publish({ hasOlder: startedWithCursor === null ? result.hasMore : snapshot.hasOlder });
          }
          afterCursor = last.id;
          cursor = last.id;
          if (!advanced && startedWithCursor !== null) return;
        } else if (startedWithCursor === null) {
          publish({ hasOlder: false });
        }

        // A cursorless page's hasMore points backward. Only after-cursor pages
        // use it to describe another forward page that must be drained.
        if (startedWithCursor === null || !result.hasMore || result.messages.length === 0) return;
      } catch (error) {
        if (disposed || authorizationLost || isAbort(error)) return;
        if (!handleAuthorizationError(error)) publish({ error: publicError(error) });
        return;
      } finally {
        if (!disposed) finishRequest(request);
      }
    }
  };

  const refresh = (): Promise<void> => {
    if (disposed || authorizationLost) return Promise.resolve();
    if (refreshPromise) {
      refreshAgain = true;
      return refreshPromise;
    }

    publish({ loading: true, error: null });
    refreshPromise = (async () => {
      do {
        refreshAgain = false;
        await refreshPass();
      } while (refreshAgain && !disposed && !authorizationLost);
    })().finally(() => {
      if (disposed) return;
      refreshPromise = null;
      if (!authorizationLost) publish({ loading: false });
    });
    return refreshPromise;
  };

  const loadOlder = (): Promise<void> => {
    if (disposed || authorizationLost || olderPromise || !oldestCursor || !snapshot.hasOlder) {
      return olderPromise ?? Promise.resolve();
    }
    const before = oldestCursor;
    publish({ loadingOlder: true, olderError: null });
    const request = beginRequest();
    olderPromise = (async () => {
      try {
        const result = await options.transport.get(options.houseId, { before }, request.signal);
        if (disposed || authorizationLost || result.houseId !== options.houseId) return;
        acceptMessages(result.messages);
        if (result.messages.length > 0) oldestCursor = result.messages[0].id;
        publish({ hasOlder: result.hasMore });
      } catch (error) {
        if (disposed || authorizationLost || isAbort(error)) return;
        if (!handleAuthorizationError(error)) publish({ olderError: publicError(error) });
      } finally {
        if (disposed) return;
        finishRequest(request);
        olderPromise = null;
        if (!authorizationLost) publish({ loadingOlder: false });
      }
    })();
    return olderPromise;
  };

  const postPending = (pending: PendingMessage) => {
    if (disposed || authorizationLost || postRequests.has(pending.clientKey)) return;
    const request = beginRequest();
    postRequests.set(pending.clientKey, request);
    void options.transport.post(
      options.houseId,
      { text: pending.text, clientKey: pending.clientKey },
      request.signal,
    ).then(result => {
      if (disposed || authorizationLost) return;
      acceptMessages([result.message]);
    }).catch(error => {
      if (disposed || authorizationLost || isAbort(error)) return;
      if (handleAuthorizationError(error)) return;
      const next = snapshot.pending.map(item => item.clientKey === pending.clientKey
        ? {
            ...item,
            status: "failed" as const,
            error: publicError(error),
            retryAt: errorRetryAt(error),
          }
        : item);
      if (next.some((item, index) => item !== snapshot.pending[index])) publish({ pending: next });
    }).finally(() => {
      if (disposed) return;
      finishRequest(request);
      if (postRequests.get(pending.clientKey) === request) postRequests.delete(pending.clientKey);
    });
  };

  const send = (draft: string): boolean => {
    if (disposed || authorizationLost) return false;
    const text = normalizeDraft(draft);
    if (text === null) return false;
    const pending: PendingMessage = {
      clientKey: options.uuid(),
      houseId: options.houseId,
      senderId: options.selfId,
      text,
      createdAt: new Date(options.now()).toISOString(),
      status: "sending",
      error: null,
      retryAt: 0,
    };
    publish({ pending: [...snapshot.pending, pending] });
    postPending(pending);
    return true;
  };

  const retry = (clientKey: string) => {
    if (disposed || authorizationLost || postRequests.has(clientKey)) return;
    const pending = snapshot.pending.find(item => item.clientKey === clientKey);
    if (!pending || pending.status !== "failed" || pending.retryAt > options.now()) return;
    const sending = { ...pending, status: "sending" as const, error: null, retryAt: 0 };
    publish({ pending: snapshot.pending.map(item => item === pending ? sending : item) });
    postPending(sending);
  };

  const pause = () => {
    if (disposed || authorizationLost) return;
    refreshAgain = false;
    const sends = new Set(postRequests.values());
    for (const request of requests) {
      if (!sends.has(request)) request.abort();
    }
  };

  return {
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    refresh,
    loadOlder,
    send,
    retry,
    pause,
    dispose() {
      if (disposed) return;
      disposed = true;
      abortRequests();
      listeners.clear();
    },
  };
}
