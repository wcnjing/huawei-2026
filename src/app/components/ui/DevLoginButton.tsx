import { useState } from "react";
import { apiPost, setSessionToken } from "../../services/api";

/** Only a browser pointed at this machine ever sees the developer shortcut. */
export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname);
}

/**
 * Developer shortcut on the sign-in screens: skips the phone code and signs in as the
 * "DEV" account (with a ready-made DEV HOUSE). Hidden unless the app is opened on
 * localhost, and the server refuses it anywhere else (server/dev-login.js).
 */
export function DevLoginButton({ onSignedIn }: { onSignedIn: (name: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!isLocalhost()) return null;

  const signIn = async () => {
    setBusy(true); setMsg("");
    const r = await apiPost<{ token?: string; name?: string }>("/api/dev/login");
    setBusy(false);
    if (!r.ok || !r.data.token) {
      setMsg(r.status === 404
        ? "Dev login is off: run the local server (npm run server), not production."
        : r.data.error ?? "Could not reach the local server.");
      return;
    }
    setSessionToken(r.data.token);
    onSignedIn(r.data.name ?? "DEV");
  };

  return (
    <div style={{ width: "100%", border: "2px dashed #ffe66d", padding: 10, backgroundColor: "rgba(255,230,109,0.06)" }}>
      <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 8, textAlign: "center" }}>
        DEVELOPER · LOCALHOST ONLY
      </div>
      <button
        type="button"
        onClick={() => { void signIn(); }}
        disabled={busy}
        style={{
          width: "100%", padding: "10px 12px", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)",
          backgroundColor: "#1a2340", color: "#ffe66d", border: "3px solid #ffe66d", cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "SIGNING IN…" : "[ SKIP LOGIN · DEV MODE ]"}
      </button>
      {msg && (
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff6b35", marginTop: 8, textAlign: "center", lineHeight: 1.4 }}>{msg}</div>
      )}
    </div>
  );
}
