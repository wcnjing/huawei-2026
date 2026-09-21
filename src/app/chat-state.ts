import type { Avatar } from "./house";

export type ChatMessage = {
  id: string;
  houseId: string;
  senderId: string | null;
  senderName: string;
  senderAvatar: Avatar;
  text: string;
  createdAt: string;
  clientKey: string;
};

export type PendingMessage = {
  clientKey: string;
  houseId: string;
  senderId: string;
  text: string;
  createdAt: string;
  status: "sending" | "failed";
  error: string | null;
  retryAt: number;
};

export type ChatPage = {
  houseId: string;
  messages: ChatMessage[];
  hasMore: boolean;
};

export type ChatSnapshot = {
  messages: ChatMessage[];
  pending: PendingMessage[];
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  error: string | null;
  olderError: string | null;
  accessDenied: boolean;
};

export type ChatTransport = {
  get(
    houseId: string,
    cursor: { before?: string; after?: string },
    signal: AbortSignal,
  ): Promise<ChatPage>;
  post(
    houseId: string,
    input: { text: string; clientKey: string },
    signal: AbortSignal,
  ): Promise<{ message: ChatMessage }>;
};

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) =>
    BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
}

export function normalizeDraft(value: string): string | null {
  if (typeof value !== "string") return null;
  const body = value.replace(/\r\n/g, "\n");
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(body)
      || /[\uD800-\uDFFF]/u.test(body)) return null;
  const text = body.trim();
  return text && Array.from(text).length <= 1000 ? text : null;
}
