import { useState } from "react";
import { apiPost, setSessionToken, type ApiResult } from "../../services/api";
import { loadContact, saveContact } from "../../services/storage";
import { IconPhone, IconWarning } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { useT } from "../../i18n";

export function RegisterScreen({ mode, name, devMode = false, onDone, onDevSkip, onNewPlayer, onBack }: {
  mode: "new" | "returning";
  name: string;
  devMode?: boolean;
  onDone: (name: string, userId?: string) => void;
  onDevSkip?: (name: string, userId?: string) => void;
  // Omitted where signing up as somebody new would be wrong — the drill opt-in re-verify
  // belongs to a player who already has an account and a session to protect.
  onNewPlayer?: () => void;
  onBack: () => void;
}) {
  const t = useT();
  // Seed from saved contact so returning users don't retype their details.
  const saved = loadContact();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [newName, setNewName] = useState("");
  const [phone, setPhone] = useState(mode === "new" && devMode ? "+65" : saved.phone);
  const [email, setEmail] = useState(mode === "new" && devMode ? "" : saved.email);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [noAccount, setNoAccount] = useState(false);

  // Explicit save — persist the details locally without sending an OTP. Lets the user
  // store their email for email drills, or keep a number on file, before verifying.
  const handleSave = () => {
    saveContact({ name: mode === "new" ? newName.trim() : name.trim(), phone: phone.trim(), email: email.trim() });
    setMsg("SAVED — details stored on this device.");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px", backgroundColor: "#0a0e1a",
    border: "3px solid #2a3a5c", color: "#e8f4f8",
    fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", outline: "none",
  };
  const label = (text: string) => (
    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 8 }}>{text}</div>
  );

  async function sendCode() {
    if (mode === "new" && !/^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u.test(newName.trim())) {
      setMsg("Enter your name before continuing.");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg("Enter a valid email address before continuing.");
      return;
    }
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
          ...(mode === "new" ? { name: newName.trim() } : {}),
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
        : (mode === "new" ? newName.trim() : name.trim());
      saveContact({ name: verifiedName, phone: phone.trim(), email: email.trim() });
      setMsg("VERIFIED! You're registered.");
      setTimeout(() => onDone(verifiedName, d.userId), 1000);
    } catch { setMsg("Network error"); }
    setBusy(false);
  }

  async function skipWithDemoAccount() {
    if (!devMode || !onDevSkip) return;
    setBusy(true); setMsg("");
    const demoPhone = "+6594000001";
    try {
      const request = async (withName: boolean) => {
        const response = await fetch("/api/verify/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: demoPhone, code: "000000", ...(withName ? { name: "DEV PLAYER" } : {}) }),
        });
        return { response, data: await response.json().catch(() => ({})) };
      };
      let result = await request(false);
      if (result.response.status === 404 && result.data.code === "NO_ACCOUNT") result = await request(true);
      if (!result.response.ok || !result.data.token) {
        setMsg(result.data.error || "Could not open the demo account.");
        return;
      }
      setSessionToken(result.data.token);
      const demoName = typeof result.data.name === "string" ? result.data.name : "DEV PLAYER";
      saveContact({ name: demoName, phone: demoPhone, email: "" });
      onDevSkip(demoName, result.data.userId);
    } catch {
      setMsg("Could not reach the local demo server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #2a3a5c", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4" }}>{mode === "new" ? t("SIGN UP") : t("SIGN IN")}</div>
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#2a3a5c" }}>{t("OPT IN")}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "#9bb0c8", lineHeight: 1.3 }}>
          {t("Verify your phone. We only ever call this number, and you can stop anytime.")}
        </div>
        <PixelPanel accent="#4ecdc4" className="w-full">
          {step === "phone" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {mode === "new" && <div>{label(t("WHAT SHOULD WE CALL YOU?"))}<input style={inputStyle} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("YOUR NAME")} maxLength={30} autoComplete="name" /></div>}
              <div>{label(t("PHONE NUMBER"))}<input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+6591234567" inputMode="tel" /></div>
              <div>{label(t("EMAIL (OPTIONAL — FOR EMAIL DRILLS)"))}<input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" type="email" autoCapitalize="none" /></div>
              {mode === "new" && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#8da4b8", lineHeight: 1.5 }}>{t("Email drills will ask you to verify your inbox separately.")}</div>}
              <PixelButton onClick={sendCode} color="#4ecdc4" size="lg" full disabled={busy}>{busy ? t("SENDING...") : t("[ SEND CODE ]")}</PixelButton>
              <PixelButton onClick={handleSave} color="#1a2340" textColor="#4ecdc4" size="sm" full disabled={busy}>{t("[ SAVE DETAILS ]")}</PixelButton>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>{label(t("CODE SENT TO {phone}", { phone }))}<input style={{ ...inputStyle, letterSpacing: 8, textAlign: "center" }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" /></div>
              {devCode && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d", textAlign: "center" }}>{t("DEV CODE: {code}", { code: devCode })}</div>}
              <PixelButton onClick={verify} color="#00ff88" size="lg" full disabled={busy || code.length < 6}>{busy ? t("CHECKING...") : t("[ VERIFY ]")}</PixelButton>
              <PixelButton onClick={() => { setStep("phone"); setMsg(""); setNoAccount(false); }} color="#1a2340" textColor="#6b8ba4" size="sm" full>{t("CHANGE NUMBER")}</PixelButton>
            </div>
          )}
          {msg && <div style={{ marginTop: 12, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: msg.includes("VERIFIED") ? "#00ff88" : "#ff6b35", textAlign: "center" }}>{t(msg)}</div>}
          {noAccount && onNewPlayer && (
            <div style={{ marginTop: 12 }}>
              <PixelButton onClick={onNewPlayer} color="#00ff88" size="md" full>{t("[ NEW PLAYER ]")}</PixelButton>
            </div>
          )}
        </PixelPanel>
        {devMode && onDevSkip && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <PixelButton onClick={skipWithDemoAccount} color="#c77dff" textColor="#0a0e1a" size="md" full disabled={busy}>{t("[ DEV: SKIP TO APP ]")}</PixelButton>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#8da4b8", lineHeight: 1.5, textAlign: "center" }}>{t("Use the form to preview registration, or enter with a local demo account.")}</div>
        </div>}
        <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="md" full>{t("BACK")}</PixelButton>
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
