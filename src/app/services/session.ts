// src/app/services/session.ts

export const TOKEN_KEY = "safespace_session_token";

export function sessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Private mode or storage failure: remain anonymous.
  }
}

export function notifySessionExpired(): void {
  try {
    window.dispatchEvent(
      new Event("safespace-session-expired"),
    );
  } catch {
    // Window may be unavailable during tests or SSR.
  }
}
