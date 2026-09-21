import { useState } from "react";
import type { AvatarConfig } from "../../types/profile";
import { apiPost, setSessionToken, type ApiResult } from "../../services/api";
import { loadContact, saveContact } from "../../services/storage";
import { PixelMascot } from "../../components/avatars";
import { IconPhone, IconWarning } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";

export function RegisterScreen({ mode, name, avatar, onDone, onNewPlayer, onBack }: {
  mode: "new" | "returning";
  name: string;
  avatar: AvatarConfig;
  onDone: (name: string) => void;
  // Omitted where signing up as somebody new would be wrong — the drill opt-in re-verify
  // belongs to a player who already has an account and a session to protect.
  onNewPlayer?: () => void;
  onBack: () => void;
}) {
  // Seed from saved contact so returning users don't retype their details.
  const saved = loadContact();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(saved.phone);
  const [email, setEmail] = useState(saved.email);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noAccount, setNoAccount] = useState(false);

  // Explicit save — persist the details locally without sending an OTP. Lets the user
  // store their email for email drills, or keep a number on file, before verifying.
  const handleSave = () => {
    saveContact({ name: name.trim(), phone: phone.trim(), email: email.trim() });
    setMsg("SAVED — details stored on this device.");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px", backgroundColor: "#0a0e1a",
    border: "3px solid #2a3a5c", color: "#e8f4f8",
    fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", outline: "none",
  };
  const label = (t: string) => (
    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 8 }}>{t}</div>
  );

  async function sendCode() {
    setBusy(true); setMsg(""); setNoAccount(false);
    try {
      const r = await fetch("/api/verify/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Could not send code"); setBusy(false); return; }
      setDevCode(d.devCode ?? null);
      setMsg(d.dev ? "DEV MODE — enter the code below" : "Code sent by SMS");
      setStep("code");
    } catch { setMsg("Network error"); }
    setBusy(false);
  }
  async function verify() {
    setBusy(true); setMsg(""); setNoAccount(false);
    try {
      const r = await fetch("/api/verify/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          email: email.trim() || undefined,
          ...(mode === "new" ? { name: name.trim(), avatar } : {}),
        }),
      });
      const d = await r.json();
      // The number verified, but nobody has signed up with it — offer the new-player path
      // rather than making the returning player guess what went wrong.
      if (r.status === 404 && d.code === "NO_ACCOUNT") {
        setNoAccount(true);
        setMsg("No account for this number yet.");
        setBusy(false);
        return;
      }
      if (!r.ok || !d.ok) { setMsg(d.error || "Incorrect code"); setBusy(false); return; }
      // Store the server-issued session token — this is what authorises real drills.
      if (d.token) setSessionToken(d.token);
      // Persist the verified details so they're remembered and available to email drills.
      const verifiedName = typeof d.name === "string" && d.name.trim()
        ? d.name.trim()
        : name.trim();
      saveContact({ name: verifiedName, phone: phone.trim(), email: email.trim() });
      setMsg("VERIFIED! You're registered.");
      setTimeout(() => onDone(verifiedName), 1000);
    } catch { setMsg("Network error"); }
    setBusy(false);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4" }}>{mode === "new" ? "SIGN UP" : "SIGN IN"}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#2a3a5c" }}>OPT IN</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "#9bb0c8", lineHeight: 1.3 }}>
          Verify your phone. We only ever call this number, and you can stop anytime.
        </div>
        <PixelPanel accent="#4ecdc4" className="w-full">
          {step === "phone" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label("PHONE NUMBER")}<input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+6591234567" inputMode="tel" /></div>
              <div>{label("EMAIL (OPTIONAL — FOR EMAIL DRILLS)")}<input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoCapitalize="none" /></div>
              <PixelButton onClick={sendCode} color="#4ecdc4" size="lg" full disabled={busy}>{busy ? "SENDING..." : "[ SEND CODE ]"}</PixelButton>
              <PixelButton onClick={handleSave} color="#1a2340" textColor="#4ecdc4" size="sm" full disabled={busy}>[ SAVE DETAILS ]</PixelButton>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label(`CODE SENT TO ${phone}`)}<input style={{ ...inputStyle, letterSpacing: 8, textAlign: "center", fontSize: "var(--text-display)" }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" /></div>
              {devCode && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d", textAlign: "center" }}>DEV CODE: {devCode}</div>}
              <PixelButton onClick={verify} color="#00ff88" size="lg" full disabled={busy || code.length < 6}>{busy ? "CHECKING..." : "[ VERIFY ]"}</PixelButton>
              <PixelButton onClick={() => { setStep("phone"); setMsg(""); setNoAccount(false); }} color="#1a2340" textColor="#6b8ba4" size="sm" full>CHANGE NUMBER</PixelButton>
            </div>
          )}
          {msg && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: msg.includes("VERIFIED") ? "#00ff88" : "#ff6b35", textAlign: "center" }}>{msg}</div>}
          {noAccount && onNewPlayer && (
            <div style={{ marginTop: 12 }}>
              <PixelButton onClick={onNewPlayer} color="#00ff88" size="md" full>[ NEW PLAYER ]</PixelButton>
            </div>
          )}
        </PixelPanel>
        <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>BACK</PixelButton>
      </div>
    </div>
  );
}







// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY ROUND
// ─────────────────────────────────────────────────────────────────────────

// "Ask family first" is cautious, not scammed. For a family anti-scam app, punishing
// the instinct to check with someone teaches the wrong lesson — and the SMS/email drills
// already praise that same instinct ("Good thinking!"), so the family drill has to agree.
// It's a partial win: safe framing, half XP, no coin penalty, plus a nudge toward the
// ideal action. Only "correct" counts toward the family-safe tally.







// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY SUMMARY
// ─────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────
