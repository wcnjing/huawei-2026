import { useEffect, useRef, useState } from "react";
import type { ContactInfo } from "../../../types/profile";
import type { RealDrillCompletion } from "../../../types/drills";
import type { ApiResult } from "../../../services/api";
import { apiPost, authHeaders, handleApiAuth, sessionToken } from "../../../services/api";
import { loadContact, saveContact } from "../../../services/storage";
import { IconChatBubble, IconCheck, IconEnvelope, IconLink, IconPhone, IconRealEmail, IconShield, IconTelegram, IconWarning } from "../../../components/icons";
import { PixelButton, PixelPanel } from "../../../components/ui";
import { SubPageHeader } from "../../../components/layout";

export const TELEGRAM_BOT_URL = "https://t.me/drillmodebot";

export function TelegramDrillIntroScreen({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="TELEGRAM DRILL" titleColor="#00d4ff" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.8))" }}>
            <IconTelegram size={64} color="#00d4ff" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00d4ff", textAlign: "center", textShadow: "3px 3px 0 #003a4a" }}>
            REAL BOT DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Talk to a real scam-fighter bot on Telegram.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #00d4ff", boxShadow: "3px 3px 0 #00d4ff", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#00d4ff", marginBottom: 10 }}>WHAT HAPPENS NEXT</div>
          {[
            "You will be sent to Telegram.",
            "Start a chat with our drill bot.",
            "Complete the scenarios in Telegram.",
            "Come back to the app when done.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#00d4ff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff6b35", marginBottom: 4 }}>COIN REWARDS</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", lineHeight: 1.5 }}>
              Coins for this drill require backend integration. They will not be credited yet.
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "#0d1a24", border: "2px solid #2a3a5c", padding: "10px 12px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <IconLink size={12} color="#00d4ff" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00d4ff", flex: 1, wordBreak: "break-all" }}>
            {TELEGRAM_BOT_URL}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelButton onClick={onOpen} color="#00d4ff" textColor="#0a0e1a" size="lg" full>[ OPEN TELEGRAM ]</PixelButton>
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC PHONE DRILL INTRO — explains flow, disabled until backend
// ─────────────────────────────────────────────────────────────────────────
export function RealisticPhoneDrillIntroScreen({ onBack, onRegister, onStarted, onSelfReport, scheduleBlocked, scheduleNextLabel }: {
  onBack: () => void;
  onRegister: () => void;
  onStarted: (drillId?: string) => void;
  onSelfReport: (win: boolean, drillId: string | null) => void;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  const [phase, setPhase] = useState<"idle" | "calling" | "sent">("idle");
  const [msg, setMsg] = useState("");
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);
  const [drillId, setDrillId] = useState<string | null>(null);
  const registered = !!sessionToken();

  const placeCall = async () => {
    setPhase("calling"); setMsg(""); setDeliveryUnconfirmed(false);
    try {
      // No body — the server dials the session user's OWN verified number, never one
      // from the request. That's the invariant that stops this dialling strangers.
      const r = await fetch("/api/drills/fire", { method: "POST", headers: { ...authHeaders() } });
      handleApiAuth(r);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setMsg(d.error || "Could not place the call.");
        setPhase("idle"); return;
      }
      const id = d.drillId ?? d.attemptId ?? d.attempt?.id ?? d.record?.id ?? d.id;
      if (!id) {
        setMsg("The call request may have been accepted, but its drill ID was missing. Do not retry; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setDrillId(null);
        onStarted();
        setPhase("sent");
        return;
      }
      setDrillId(id);
      setDeliveryUnconfirmed(d.deliveryConfirmed === false || d.status === "delivery-unconfirmed");
      onStarted(id);
      setPhase("sent");
    } catch {
      setMsg("The connection dropped while starting the call, so delivery is unknown. Do not retry; refresh later to recover any result.");
      setDeliveryUnconfirmed(true);
      onStarted();
      setPhase("sent");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL PHONE DRILL" titleColor="#00ff88" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(0,255,136,0.8))" }}>
            <IconPhone size={64} color="#00ff88" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88", textAlign: "center", textShadow: "3px 3px 0 #003a1f" }}>
            LIVE CALL DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Receive a simulated scam call on your real phone.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #00ff88", boxShadow: "3px 3px 0 #00ff88", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#00ff88", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We call your registered phone number.",
            "Answer the call as you normally would.",
            "Decide whether to engage, verify, or hang up.",
            "Return to the app to see your result.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#00ff88", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "rgba(255,107,53,0.08)", border: "3px solid #ff6b35", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="#ff6b35" />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ff6b35", marginBottom: 4 }}>TRAINING CALL</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", lineHeight: 1.5 }}>
              This is a simulated security drill. We will never ask for real passwords, OTPs, card details, transfers, or payments.
            </div>
          </div>
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "rgba(255,230,109,0.08)" : "rgba(0,255,136,0.08)", border: `3px solid ${deliveryUnconfirmed ? "#ffe66d" : "#00ff88"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="#ffe66d" /> : <IconShield size={16} color="#00ff88" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: deliveryUnconfirmed ? "#ffe66d" : "#00ff88", marginBottom: 6 }}>
                {deliveryUnconfirmed ? "CALL DELIVERY NOT CONFIRMED" : "CALL REQUEST ACCEPTED"}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? "The provider may have accepted the call, but SafeSpace could not confirm it. Do not retry — we will keep checking this drill for a result."
                  : "Your phone should ring shortly. Answer it and stay sharp — hang up if it asks for anything real."}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 4 }}>REGISTER FIRST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                Verify your phone so the drill only ever calls the number you own.
              </div>
            </div>
          </div>
        ) : null}

        {msg && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff2d55", marginBottom: 12 }}>{msg}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                HOW DID THE CALL GO?
              </div>
              <PixelButton onClick={() => onSelfReport(true, drillId)} color="#00ff88" textColor="#0a0e1a" size="lg" full>[ I HUNG UP / STAYED SAFE ]</PixelButton>
              <PixelButton onClick={() => onSelfReport(false, drillId)} color="#ff2d55" textColor="#ffffff" size="md" full>I ENGAGED / GAVE INFO</PixelButton>
            </>
          ) : registered && scheduleBlocked ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", textAlign: "center", lineHeight: 1.5 }}>
                OUTSIDE YOUR DRILL WINDOW · OPENS {scheduleNextLabel}
              </div>
              <PixelButton onClick={() => {}} color="#1a2340" textColor="#6b8ba4" size="lg" full disabled>[ CALL ME NOW ]</PixelButton>
            </>
          ) : registered ? (
            <PixelButton onClick={placeCall} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={phase === "calling"}>
              {phase === "calling" ? "CALLING..." : "[ CALL ME NOW ]"}
            </PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>[ REGISTER TO CONTINUE ]</PixelButton>
          )}
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC SMS DRILL INTRO — fires a real text to the user's own number
// ─────────────────────────────────────────────────────────────────────────
export function RealisticSmsDrillIntroScreen({ onBack, onRegister, onOutcome }: {
  onBack: () => void;
  onRegister: () => void;
  onOutcome: (drillId: string, outcome: "reported" | "clicked_link") => Promise<RealDrillCompletion>;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");
  const [msg, setMsg] = useState("");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);
  const registered = !!sessionToken();

  const sendText = async () => {
    setPhase("sending"); setMsg(""); setDeliveryUnconfirmed(false);
    try {
      // No number in the body — the server texts the session user's OWN verified number.
      const r = await fetch("/api/drills/sms", { method: "POST", headers: { ...authHeaders() } });
      handleApiAuth(r);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setMsg(d.error === "SMS drills are not configured"
          ? "SMS delivery isn't configured on this server yet."
          : (d.error || "Could not send the text."));
        setPhase("idle"); return;
      }
      const id = d.drillId ?? d.attemptId ?? d.attempt?.id ?? d.record?.id ?? d.id;
      if (!id) {
        setMsg("The text request may have been accepted, but its drill ID was missing. Do not resend; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setPhase("sent");
        return;
      }
      setDeliveryUnconfirmed(d.deliveryConfirmed === false || d.status === "delivery-unconfirmed");
      setDrillId(id);
      setPhase("sent");
    } catch {
      setMsg("The connection dropped while sending, so delivery is unknown. Do not resend; refresh later to recover any result.");
      setDeliveryUnconfirmed(true);
      setPhase("sent");
    }
  };

  const complete = async (outcome: "reported" | "clicked_link") => {
    if (!drillId || completing) return;
    setCompleting(true);
    setMsg("");
    const result = await onOutcome(drillId, outcome);
    if (!result.ok) setMsg(result.error || "Could not save this result. Please try again.");
    setCompleting(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL SMS DRILL" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(78,205,196,0.8))" }}>
            <IconChatBubble size={64} color="#4ecdc4" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4", textAlign: "center", textShadow: "3px 3px 0 #08312e" }}>
            LIVE SMS DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "#4ecdc4", textAlign: "center", lineHeight: 1.4 }}>
            Get a simulated scam text on your real phone.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #4ecdc4", boxShadow: "3px 3px 0 #4ecdc4", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We text your registered number.",
            "It reads like a scam — that's the point.",
            "Spot the red flags in your real messages app.",
            "A follow-up text reveals it was a drill.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#4ecdc4", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "rgba(255,230,109,0.08)" : "rgba(0,255,136,0.08)", border: `3px solid ${deliveryUnconfirmed ? "#ffe66d" : "#00ff88"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="#ffe66d" /> : <IconShield size={16} color="#00ff88" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: deliveryUnconfirmed ? "#ffe66d" : "#00ff88", marginBottom: 6 }}>
                {deliveryUnconfirmed ? "TEXT DELIVERY NOT CONFIRMED" : "TEXT REQUEST ACCEPTED"}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? drillId
                    ? "The provider may have accepted the text, but SafeSpace could not confirm it. Do not resend. If it arrives, use the actions below; a reveal text should follow."
                    : "Delivery is unknown and the drill ID could not be recovered. Do not resend. If the text arrives, its safety reveal should still follow, but this attempt cannot be scored in the app."
                  : "Check your messages, then come back and tell us how it went — a reveal text also follows to confirm it was a drill."}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 4 }}>REGISTER FIRST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                Verify your phone so the drill only ever texts the number you own.
              </div>
            </div>
          </div>
        ) : null}

        {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff2d55", marginBottom: 12 }}>{msg}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            drillId ? <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {deliveryUnconfirmed ? "IF THE TEXT ARRIVED, HOW DID IT GO?" : "HOW DID IT GO?"}
              </div>
              <PixelButton onClick={() => complete("reported")} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={completing || !drillId}>[ {deliveryUnconfirmed ? "IF IT ARRIVED: I SPOTTED IT" : "I SPOTTED THE SCAM"} ]</PixelButton>
              <PixelButton onClick={() => complete("clicked_link")} color="#ff2d55" textColor="#ffffff" size="md" full disabled={completing || !drillId}>{deliveryUnconfirmed ? "IF IT ARRIVED: I CLICKED / REPLIED" : "I CLICKED / REPLIED"}</PixelButton>
            </> : (
              <PixelButton onClick={onBack} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ DONE — DO NOT RESEND ]</PixelButton>
            )
          ) : registered ? (
            // This is an explicit, consented manual send. The schedule only limits
            // surprise drills; applying it here made "TEXT ME NOW" unusable for most
            // of the day even though the SMS service itself was healthy.
            <PixelButton onClick={sendText} color="#4ecdc4" textColor="#0a0e1a" size="lg" full disabled={phase === "sending"}>
              {phase === "sending" ? "SENDING..." : "[ TEXT ME NOW ]"}
            </PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>[ REGISTER TO CONTINUE ]</PixelButton>
          )}
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: REALISTIC EMAIL DRILL INTRO — explains flow, disabled until backend
// ─────────────────────────────────────────────────────────────────────────
export function RealisticEmailDrillIntroScreen({ onBack, onRegister, onOutcome, scheduleBlocked, scheduleNextLabel }: {
  onBack: () => void;
  onRegister: () => void;
  onOutcome: (drillId: string, outcome: "reported" | "submitted_details") => Promise<RealDrillCompletion>;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  // "idle" shows the intro; tapping send opens the email popup (or nudges to register if
  // there's no session). "sent" is the success state.
  const [phase, setPhase] = useState<"idle" | "ask-email" | "verify-email" | "sent">("idle");
  const [email, setEmail] = useState(() => loadContact().email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [deliveryUnconfirmed, setDeliveryUnconfirmed] = useState(false);

  const registered = !!sessionToken();

  const onSendTap = () => {
    setMsg("");
    setPhase("ask-email");
  };

  const startEmailVerification = async () => {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setMsg("Enter a valid email address."); return; }
    setBusy(true); setMsg("");
    try {
      const verify = await fetch("/api/me/email/verification/start", {
        method: "POST", headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ email: addr }),
      });
      handleApiAuth(verify);
      const data = await verify.json().catch(() => ({}));
      if (!verify.ok || data.ok === false) {
        setMsg(data.error || "Could not send the verification email.");
        setBusy(false);
        return;
      }
      const contact = loadContact();
      saveContact({ ...contact, email: addr });
      if (data.verified) {
        setMsg("That inbox is already verified. Sending your drill...");
        await checkVerificationAndSend();
        return;
      }
      setPhase("verify-email");
      setMsg("Verification sent. Open the link in that inbox, then return here.");
    } catch {
      setMsg("The connection dropped, so the verification email may still arrive. Check your inbox before trying again.");
    }
    setBusy(false);
  };

  const checkVerificationAndSend = async () => {
    setBusy(true);
    setMsg("");
    setDeliveryUnconfirmed(false);
    let fireRequestStarted = false;
    try {
      const status = await fetch("/api/me/email/status", { headers: { ...authHeaders() } });
      handleApiAuth(status);
      const statusData = await status.json().catch(() => ({}));
      if (!status.ok) {
        setMsg(statusData.error || "Could not check email verification.");
        setBusy(false);
        return;
      }
      if (!statusData.verified) {
        setMsg("Not verified yet. Click the link in your email, then check again.");
        setBusy(false);
        return;
      }

      fireRequestStarted = true;
      const fire = await fetch("/api/drills/email", { method: "POST", headers: { ...authHeaders() } });
      handleApiAuth(fire);
      const fd = await fire.json().catch(() => ({}));
      if (!fire.ok || fd.ok === false) {
        setMsg(fd.error === "email drills are not configured"
          ? "Email delivery isn't configured on this server yet."
          : (fd.error || "Could not send the email."));
        setBusy(false); return;
      }
      const id = fd.drillId ?? fd.attemptId ?? fd.attempt?.id ?? fd.record?.id ?? fd.id;
      if (!id) {
        setMsg("The email request may have been accepted, but its drill ID was missing. Do not resend; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setPhase("sent");
        setBusy(false);
        return;
      }
      setDeliveryUnconfirmed(fd.deliveryConfirmed === false || fd.status === "delivery-unconfirmed");
      setDrillId(id);
      setPhase("sent");
    } catch {
      if (fireRequestStarted) {
        setMsg("The connection dropped while sending, so delivery is unknown. Do not resend; refresh later to recover any result.");
        setDeliveryUnconfirmed(true);
        setPhase("sent");
      } else {
        setMsg("Network error — check your connection.");
      }
    }
    setBusy(false);
  };

  const complete = async (outcome: "reported" | "submitted_details") => {
    if (!drillId || busy) return;
    setBusy(true);
    setMsg("");
    const result = await onOutcome(drillId, outcome);
    if (!result.ok) setMsg(result.error || "Could not save this result. Please try again.");
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="REAL EMAIL DRILL" titleColor="#ff6b35" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 12px rgba(255,107,53,0.8))" }}>
            <IconRealEmail size={64} color="#ff6b35" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", textAlign: "center", textShadow: "3px 3px 0 #4a1a08" }}>
            REAL INBOX DRILL
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "#ffe66d", textAlign: "center", lineHeight: 1.4 }}>
            Get a simulated phishing email in your real mailbox.
          </div>
        </div>

        <div style={{ backgroundColor: "#111827", border: "3px solid #ff6b35", boxShadow: "3px 3px 0 #ff6b35", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35", marginBottom: 10 }}>HOW IT WORKS</div>
          {[
            "We send a test email to your own address.",
            "It looks like a scam — that's the point.",
            "Spot the red flags in your real email client.",
            "Every drill email has a reveal + report link.",
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "#ff6b35", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#0a0e1a" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "rgba(255,230,109,0.08)" : "rgba(0,255,136,0.08)", border: `3px solid ${deliveryUnconfirmed ? "#ffe66d" : "#00ff88"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="#ffe66d" /> : <IconShield size={16} color="#00ff88" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: deliveryUnconfirmed ? "#ffe66d" : "#00ff88", marginBottom: 6 }}>
                {deliveryUnconfirmed ? "EMAIL DELIVERY NOT CONFIRMED" : "EMAIL REQUEST ACCEPTED"}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? drillId
                    ? "The provider may have accepted the email, but SafeSpace could not confirm it. Do not resend. If it arrives, handle it normally and use the actions below."
                    : "Delivery is unknown and the drill ID could not be recovered. Do not resend. If the email arrives, use its signed reveal or report link; this app screen cannot score it."
                  : "Check your inbox (and spam), handle it as you would a real one, then tell us how it went below."}
              </div>
            </div>
          </div>
        ) : phase === "verify-email" ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconRealEmail size={16} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d", marginBottom: 6 }}>VERIFY YOUR INBOX</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                We sent a verification link to {email}. Click it before sending a drill.
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "rgba(255,230,109,0.08)", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="#ffe66d" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginBottom: 4 }}>REGISTER FIRST</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.5 }}>
                Verify your phone so drills go only to you — never to an address someone types in.
              </div>
            </div>
          </div>
        ) : null}

        {msg && phase !== "ask-email" && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: msg.startsWith("Verification sent") ? "#00ff88" : "#ff6b35", marginBottom: 12, lineHeight: 1.5 }}>
            {msg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            drillId ? <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {deliveryUnconfirmed ? "IF THE EMAIL ARRIVED, HOW DID IT GO?" : "HOW DID IT GO?"}
              </div>
              <PixelButton onClick={() => complete("reported")} color="#00ff88" textColor="#0a0e1a" size="lg" full disabled={busy || !drillId}>[ {deliveryUnconfirmed ? "IF IT ARRIVED: I SPOTTED IT" : "I SPOTTED THE SCAM"} ]</PixelButton>
              <PixelButton onClick={() => complete("submitted_details")} color="#ff2d55" textColor="#ffffff" size="md" full disabled={busy || !drillId}>{deliveryUnconfirmed ? "IF IT ARRIVED: I CLICKED / REPLIED" : "I CLICKED / REPLIED"}</PixelButton>
            </> : (
              <PixelButton onClick={onBack} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ DONE — DO NOT RESEND ]</PixelButton>
            )
          ) : phase === "verify-email" ? (
            <>
              <PixelButton onClick={checkVerificationAndSend} color="#ffe66d" textColor="#0a0e1a" size="lg" full disabled={busy}>
                {busy ? "CHECKING..." : "[ CHECK VERIFICATION & SEND ]"}
              </PixelButton>
              <PixelButton onClick={() => { setPhase("ask-email"); setMsg(""); }} color="#1a2340" textColor="#6b8ba4" size="sm" full disabled={busy}>USE A DIFFERENT EMAIL</PixelButton>
            </>
          ) : registered && scheduleBlocked ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", textAlign: "center", lineHeight: 1.5 }}>
                OUTSIDE YOUR DRILL WINDOW · OPENS {scheduleNextLabel}
              </div>
              <PixelButton onClick={() => {}} color="#1a2340" textColor="#6b8ba4" size="lg" full disabled>[ SEND DRILL EMAIL ]</PixelButton>
            </>
          ) : registered ? (
            <PixelButton onClick={onSendTap} color="#ff6b35" textColor="#0a0e1a" size="lg" full>[ SEND DRILL EMAIL ]</PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="#4ecdc4" textColor="#0a0e1a" size="lg" full>[ REGISTER TO CONTINUE ]</PixelButton>
          )}
          <PixelButton onClick={onBack} color="#1a2340" textColor="#6b8ba4" size="sm" full>BACK TO DRILLS</PixelButton>
        </div>
      </div>

      {/* The inbox must be verified through a link before the drill can be sent. */}
      {phase === "ask-email" && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }} onClick={() => !busy && setPhase("idle")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, backgroundColor: "#0a0e1a", border: "4px solid #ff6b35", boxShadow: "6px 6px 0 rgba(255,107,53,0.4)", padding: "18px 16px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", marginBottom: 10 }}>YOUR EMAIL</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8", marginBottom: 12, lineHeight: 1.5 }}>
              We'll email a verification link first. The drill can only be sent after the inbox owner clicks it.
            </div>
            <input
              autoFocus value={email} inputMode="email" autoCapitalize="none" placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) startEmailVerification(); }}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", background: "#111827", border: "3px solid #2a3a5c", padding: "10px 12px", outline: "none", marginBottom: 10 }}
            />
            {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff2d55", marginBottom: 10 }}>{msg}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><PixelButton onClick={startEmailVerification} color="#ff6b35" textColor="#0a0e1a" size="sm" full disabled={busy}>{busy ? "SENDING..." : "[ VERIFY ]"}</PixelButton></div>
              <div style={{ flex: 1 }}><PixelButton onClick={() => { if (!busy) { setPhase("idle"); setMsg(""); } }} color="#2a3a5c" textColor="#e8f4f8" size="sm" full>CANCEL</PixelButton></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
