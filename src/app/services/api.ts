// src/app/services/api.ts

import type { DrillType } from "../types/drills";

import type { NameUpdateResult } from "../types/profile";

import { notifySessionExpired, sessionToken, setSessionToken } from "./session";

export { TOKEN_KEY, sessionToken, setSessionToken } from "./session";

export function authHeaders(): Record<string, string> {
  const token = sessionToken();

  return token
    ? { authorization: `Bearer ${token}` }
    : {};
}

export function handleApiAuth(
  response: Response,
): boolean {
  if (
    response.status !== 401 ||
    !sessionToken()
  ) {
    return false;
  }

  setSessionToken(null);
  notifySessionExpired();

  return true;
}

export async function apiGet<T>(
  path: string,
): Promise<T | null> {
  try {
    const response = await fetch(path, {
      headers: authHeaders(),
    });

    handleApiAuth(response);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export type ApiResult<T> = {
  ok: boolean;
  status: number;
  data: T & { error?: string; code?: string };
};

export async function apiPost<T = unknown>(
  path: string,
  body: unknown = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });

    handleApiAuth(response);
    const data = await response.json().catch(() => ({}));

    return {
      ok: response.ok,
      status: response.status,
      data,
    } as ApiResult<T>;
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Could not reach the server." },
    } as ApiResult<T>;
  }
}

export async function reportOutcome(outcome: string, channel: DrillType, attemptId: string): Promise<number | null> {
  try {
    const r = await fetch("/api/drills/practice-result", {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify({ outcome, channel, attemptId, idempotencyKey: attemptId }),
    });
    handleApiAuth(r);
    if (!r.ok) return null;
    const data = await r.json();
    return data?.record?.xpGained ?? data?.xpGained ?? null;
  } catch {
    return null;
  }
}

export async function updateVerifiedNameRequest(
  name: string,
): Promise<NameUpdateResult> {
  const clean = name.trim();

  if (!clean) {
    return {
      ok: false,
      error: "Name is required.",
    };
  }

  try {
    const response = await fetch("/api/me/name", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        name: clean,
      }),
    });

    handleApiAuth(response);

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        error:
          data.error ??
          "Could not update your name.",
      };
    }

    const canonicalName =
      data?.name ??
      data?.user?.name ??
      data?.profile?.name ??
      clean;

    return {
      ok: true,
      name: String(canonicalName).trim(),
    };
  } catch {
    return {
      ok: false,
      error:
        "Could not reach the server. Your drill name was not changed.",
    };
  }
}
