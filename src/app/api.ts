// Backend API helpers.
// These keep the richer Figma UI connected to the existing demo backend, while
// still allowing the prototype to run with mock data when the backend is down.
// Session token issued by the server after phone verification. The server derives WHO
// we are from this token — the client never asserts a user id, because a drill places a
// real phone call and a client-supplied id would let anyone target anyone.
// Anonymous visitors simply have no token and act as the shared demo account.
export const TOKEN_KEY = "safespace_session_token";
export function sessionToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setSessionToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode: stay anonymous */ }
}
export function authHeaders(): Record<string, string> {
  const t = sessionToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

export function handleApiAuth(response: Response): boolean {
  if (response.status !== 401 || !sessionToken()) return false;
  setSessionToken(null);
  try { window.dispatchEvent(new Event("safespace-session-expired")); } catch { /* SSR/tests */ }
  return true;
}

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(path, { headers: authHeaders() });
    handleApiAuth(r);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export type ApiResult<T> = { ok: boolean; status: number; data: T & { error?: string; code?: string } };

export async function apiPost<T = unknown>(path: string, body: unknown = {}): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    handleApiAuth(r);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Could not reach the server." } as T & { error: string } };
  }
}
