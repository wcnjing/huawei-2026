import { useEffect, useRef, useState } from "react";
import type { ContactInfo } from "../../../types/profile";
import type { RealDrillCompletion, RealEmailScenario } from "../../../types/drills";
import type { ApiResult } from "../../../services/api";
import { apiPost, authHeaders, handleApiAuth, sessionToken } from "../../../services/api";
import { loadContact, saveContact } from "../../../services/storage";
import { IconChatBubble, IconCheck, IconEnvelope, IconLink, IconPhone, IconRealEmail, IconShield, IconTelegram, IconWarning } from "../../../components/icons";
import { PixelButton, PixelPanel } from "../../../components/ui";
import { SubPageHeader } from "../../../components/layout";
import { useI18n } from "../../../i18n";

export const TELEGRAM_BOT_URL = "https://t.me/drillmodebot";

export function TelegramDrillIntroScreen({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("TELEGRAM DRILL")} titleColor="var(--cyan)" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 calc(12px * var(--glow)) color-mix(in srgb, var(--cyan) 80%, transparent))" }}>
            <IconTelegram size={64} color="var(--cyan)" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--cyan)", textAlign: "center", textShadow: "3px 3px 0 color-mix(in srgb, var(--cyan) 25%, var(--background))" }}>
            {t("REAL BOT DRILL")}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "var(--teal)", textAlign: "center", lineHeight: 1.4 }}>
            {t("Talk to a real scam-fighter bot on Telegram.")}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--cyan-line)", boxShadow: "3px 3px 0 var(--cyan-line)", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--cyan)", marginBottom: 10 }}>{t("WHAT HAPPENS NEXT")}</div>
          {[
            t("You will be sent to Telegram."),
            t("Start a chat with our drill bot."),
            t("Complete the scenarios in Telegram."),
            t("Come back to the app when done."),
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "var(--cyan-fill)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 8%, transparent)", border: "3px solid var(--orange-line)", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="var(--orange)" />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--orange)", marginBottom: 4 }}>{t("COIN REWARDS")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", lineHeight: 1.5 }}>
              {t("Coins for this drill require backend integration. They will not be credited yet.")}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "color-mix(in srgb, var(--cyan) 8%, var(--background))", border: "2px solid var(--border)", padding: "10px 12px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <IconLink size={12} color="var(--cyan)" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--cyan)", flex: 1, wordBreak: "break-all" }}>
            {TELEGRAM_BOT_URL}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <PixelButton onClick={onOpen} color="var(--cyan-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ OPEN TELEGRAM ]")}</PixelButton>
          <PixelButton onClick={onBack} color="var(--secondary)" textColor="var(--muted-foreground)" size="sm" full>{t("BACK TO DRILLS")}</PixelButton>
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
  const { t, language } = useI18n();
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
      const r = await fetch("/api/drills/fire", { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ language }) });
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
      <SubPageHeader title={t("REAL PHONE DRILL")} titleColor="var(--green)" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 calc(12px * var(--glow)) color-mix(in srgb, var(--green) 80%, transparent))" }}>
            <IconPhone size={64} color="var(--green)" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--green)", textAlign: "center", textShadow: "3px 3px 0 color-mix(in srgb, var(--green) 22%, var(--background))" }}>
            {t("LIVE CALL DRILL")}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "var(--teal)", textAlign: "center", lineHeight: 1.4 }}>
            {t("Receive a simulated scam call on your real phone.")}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--green-line)", boxShadow: "3px 3px 0 var(--green-line)", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--green)", marginBottom: 10 }}>{t("HOW IT WORKS")}</div>
          {[
            t("We call your registered phone number."),
            t("Answer the call as you normally would."),
            t("Decide whether to engage, verify, or hang up."),
            t("Return to the app to see your result."),
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "var(--green-fill)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 8%, transparent)", border: "3px solid var(--orange-line)", padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <IconWarning size={14} color="var(--orange)" />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--orange)", marginBottom: 4 }}>{t("TRAINING CALL")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", lineHeight: 1.5 }}>
              {t("This is a simulated security drill. We will never ask for real passwords, OTPs, card details, transfers, or payments.")}
            </div>
          </div>
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "color-mix(in srgb, var(--yellow-fill) 8%, transparent)" : "color-mix(in srgb, var(--green-fill) 8%, transparent)", border: `3px solid ${deliveryUnconfirmed ? "var(--yellow-line)" : "var(--green-line)"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="var(--yellow)" /> : <IconShield size={16} color="var(--green)" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: deliveryUnconfirmed ? "var(--yellow)" : "var(--green)", marginBottom: 6 }}>
                {deliveryUnconfirmed ? t("CALL DELIVERY NOT CONFIRMED") : t("CALL REQUEST ACCEPTED")}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? t("The provider may have accepted the call, but SafeSpace could not confirm it. Do not retry — we will keep checking this drill for a result.")
                  : t("Your phone should ring shortly. Answer it and stay sharp — hang up if it asks for anything real.")}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--yellow-fill) 8%, transparent)", border: "3px solid var(--yellow-line)", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="var(--yellow)" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)", marginBottom: 4 }}>{t("REGISTER FIRST")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {t("Verify your phone so the drill only ever calls the number you own.")}
              </div>
            </div>
          </div>
        ) : null}

        {msg && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--red)", marginBottom: 12 }}>{t(msg)}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {t("HOW DID THE CALL GO?")}
              </div>
              <PixelButton onClick={() => onSelfReport(true, drillId)} color="var(--green-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ I HUNG UP / STAYED SAFE ]")}</PixelButton>
              <PixelButton onClick={() => onSelfReport(false, drillId)} color="var(--red-fill)" textColor="var(--on-danger)" size="md" full>{t("I ENGAGED / GAVE INFO")}</PixelButton>
            </>
          ) : registered && scheduleBlocked ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", textAlign: "center", lineHeight: 1.5 }}>
                {t("OUTSIDE YOUR DRILL WINDOW · OPENS {scheduleNextLabel}", { scheduleNextLabel })}
              </div>
              <PixelButton onClick={() => {}} color="var(--secondary)" textColor="var(--muted-foreground)" size="lg" full disabled>{t("[ CALL ME NOW ]")}</PixelButton>
            </>
          ) : registered ? (
            <PixelButton onClick={placeCall} color="var(--green-fill)" textColor="var(--on-fill)" size="lg" full disabled={phase === "calling"}>
              {phase === "calling" ? t("CALLING...") : t("[ CALL ME NOW ]")}
            </PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="var(--teal-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ REGISTER TO CONTINUE ]")}</PixelButton>
          )}
          <PixelButton onClick={onBack} color="var(--secondary)" textColor="var(--muted-foreground)" size="sm" full>{t("BACK TO DRILLS")}</PixelButton>
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
  const { t, language } = useI18n();
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
      const r = await fetch("/api/drills/sms", { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ language }) });
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
      <SubPageHeader title={t("REAL SMS DRILL")} titleColor="var(--teal)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 calc(12px * var(--glow)) color-mix(in srgb, var(--teal) 80%, transparent))" }}>
            <IconChatBubble size={64} color="var(--teal)" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--teal)", textAlign: "center", textShadow: "3px 3px 0 color-mix(in srgb, var(--teal) 20%, var(--background))" }}>
            {t("LIVE SMS DRILL")}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "var(--teal)", textAlign: "center", lineHeight: 1.4 }}>
            {t("Get a simulated scam text on your real phone.")}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--teal-line)", boxShadow: "3px 3px 0 var(--teal-line)", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)", marginBottom: 10 }}>{t("HOW IT WORKS")}</div>
          {[
            t("We text your registered number."),
            t("It reads like a scam — that's the point."),
            t("Spot the red flags in your real messages app."),
            t("A follow-up text reveals it was a drill."),
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "var(--teal-fill)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "color-mix(in srgb, var(--yellow-fill) 8%, transparent)" : "color-mix(in srgb, var(--green-fill) 8%, transparent)", border: `3px solid ${deliveryUnconfirmed ? "var(--yellow-line)" : "var(--green-line)"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="var(--yellow)" /> : <IconShield size={16} color="var(--green)" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: deliveryUnconfirmed ? "var(--yellow)" : "var(--green)", marginBottom: 6 }}>
                {deliveryUnconfirmed ? t("TEXT DELIVERY NOT CONFIRMED") : t("TEXT REQUEST ACCEPTED")}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? drillId
                    ? t("The provider may have accepted the text, but SafeSpace could not confirm it. Do not resend. If it arrives, use the actions below; a reveal text should follow.")
                    : t("Delivery is unknown and the drill ID could not be recovered. Do not resend. If the text arrives, its safety reveal should still follow, but this attempt cannot be scored in the app.")
                  : t("Check your messages, then come back and tell us how it went — a reveal text also follows to confirm it was a drill.")}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--yellow-fill) 8%, transparent)", border: "3px solid var(--yellow-line)", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="var(--yellow)" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)", marginBottom: 4 }}>{t("REGISTER FIRST")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {t("Verify your phone so the drill only ever texts the number you own.")}
              </div>
            </div>
          </div>
        ) : null}

        {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--red)", marginBottom: 12 }}>{t(msg)}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            drillId ? <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {deliveryUnconfirmed ? t("IF THE TEXT ARRIVED, HOW DID IT GO?") : t("HOW DID IT GO?")}
              </div>
              <PixelButton onClick={() => complete("reported")} color="var(--green-fill)" textColor="var(--on-fill)" size="lg" full disabled={completing || !drillId}>[ {deliveryUnconfirmed ? t("IF IT ARRIVED: I SPOTTED IT") : t("I SPOTTED THE SCAM")} ]</PixelButton>
              <PixelButton onClick={() => complete("clicked_link")} color="var(--red-fill)" textColor="var(--on-danger)" size="md" full disabled={completing || !drillId}>{deliveryUnconfirmed ? t("IF IT ARRIVED: I CLICKED / REPLIED") : t("I CLICKED / REPLIED")}</PixelButton>
            </> : (
              <PixelButton onClick={onBack} color="var(--yellow-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ DONE — DO NOT RESEND ]")}</PixelButton>
            )
          ) : registered ? (
            // This is an explicit, consented manual send. The schedule only limits
            // surprise drills; applying it here made "TEXT ME NOW" unusable for most
            // of the day even though the SMS service itself was healthy.
            <PixelButton onClick={sendText} color="var(--teal-fill)" textColor="var(--on-fill)" size="lg" full disabled={phase === "sending"}>
              {phase === "sending" ? t("SENDING...") : t("[ TEXT ME NOW ]")}
            </PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="var(--teal-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ REGISTER TO CONTINUE ]")}</PixelButton>
          )}
          <PixelButton onClick={onBack} color="var(--secondary)" textColor="var(--muted-foreground)" size="sm" full>{t("BACK TO DRILLS")}</PixelButton>
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
  onOutcome: (drillId: string, outcome: "reported" | "submitted_details", scenario: RealEmailScenario | null) => Promise<RealDrillCompletion>;
  scheduleBlocked: boolean;
  scheduleNextLabel: string;
}) {
  // "idle" shows the intro; tapping send opens the email popup (or nudges to register if
  // there's no session). "sent" is the success state.
  const { t, language } = useI18n();
  const [phase, setPhase] = useState<"idle" | "ask-email" | "verify-email" | "sent">("idle");
  const [email, setEmail] = useState(() => loadContact().email);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<RealEmailScenario | null>(null);
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
        body: JSON.stringify({ email: addr, language }),
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
      const fire = await fetch("/api/drills/email", { method: "POST", headers: { "content-type": "application/json", ...authHeaders() }, body: JSON.stringify({ language }) });
      handleApiAuth(fire);
      const fd = await fire.json().catch(() => ({}));
      if (!fire.ok || fd.ok === false) {
        setMsg(fd.error === "email drills are not configured"
          ? "Email delivery isn't configured on this server yet."
          : (fd.error || "Could not send the email."));
        setBusy(false); return;
      }
      const id = fd.drillId ?? fd.attemptId ?? fd.attempt?.id ?? fd.record?.id ?? fd.id;
      const sentScenario = fd.scenario;
      setScenario(sentScenario && typeof sentScenario.id === "string"
        && typeof sentScenario.sender === "string" && typeof sentScenario.subject === "string"
        ? {
          id: sentScenario.id,
          sender: sentScenario.sender,
          subject: sentScenario.subject,
          flags: Array.isArray(sentScenario.flags) ? sentScenario.flags.filter((f: unknown) => typeof f === "string") : undefined,
          advice: typeof sentScenario.advice === "string" ? sentScenario.advice : null,
        }
        : null);
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
    const result = await onOutcome(drillId, outcome, scenario);
    if (!result.ok) setMsg(result.error || "Could not save this result. Please try again.");
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("REAL EMAIL DRILL")} titleColor="var(--orange)" onBack={onBack} />

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none", padding: "20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ filter: "drop-shadow(0 0 calc(12px * var(--glow)) color-mix(in srgb, var(--orange) 80%, transparent))" }}>
            <IconRealEmail size={64} color="var(--orange)" />
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", textAlign: "center", textShadow: "3px 3px 0 color-mix(in srgb, var(--orange) 25%, var(--background))" }}>
            {t("REAL INBOX DRILL")}
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: "var(--text-heading)", color: "var(--yellow)", textAlign: "center", lineHeight: 1.4 }}>
            {t("Get a simulated phishing email in your real mailbox.")}
          </div>
        </div>

        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--orange-line)", boxShadow: "3px 3px 0 var(--orange-line)", padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)", marginBottom: 10 }}>{t("HOW IT WORKS")}</div>
          {[
            t("We send a test email to your own address."),
            t("It looks like a scam — that's the point."),
            t("Spot the red flags in your real email client."),
            t("Every drill email has a reveal + report link."),
          ].map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 16, height: 16, backgroundColor: "var(--orange-fill)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--on-fill)" }}>{i + 1}</span>
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6, flex: 1 }}>{line}</div>
            </div>
          ))}
        </div>

        {phase === "sent" ? (
          <div style={{ backgroundColor: deliveryUnconfirmed ? "color-mix(in srgb, var(--yellow-fill) 8%, transparent)" : "color-mix(in srgb, var(--green-fill) 8%, transparent)", border: `3px solid ${deliveryUnconfirmed ? "var(--yellow-line)" : "var(--green-line)"}`, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            {deliveryUnconfirmed ? <IconWarning size={16} color="var(--yellow)" /> : <IconShield size={16} color="var(--green)" />}
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: deliveryUnconfirmed ? "var(--yellow)" : "var(--green)", marginBottom: 6 }}>
                {deliveryUnconfirmed ? t("EMAIL DELIVERY NOT CONFIRMED") : t("EMAIL REQUEST ACCEPTED")}
              </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {deliveryUnconfirmed
                  ? drillId
                    ? t("The provider may have accepted the email, but SafeSpace could not confirm it. Do not resend. If it arrives, handle it normally and use the actions below.")
                    : t("Delivery is unknown and the drill ID could not be recovered. Do not resend. If the email arrives, use its signed reveal or report link; this app screen cannot score it.")
                  : t("Check your inbox (and spam), handle it as you would a real one, then tell us how it went below.")}
              </div>
            </div>
          </div>
        ) : phase === "verify-email" ? (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--yellow-fill) 8%, transparent)", border: "3px solid var(--yellow-line)", padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconRealEmail size={16} color="var(--yellow)" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--yellow)", marginBottom: 6 }}>{t("VERIFY YOUR INBOX")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {t("We sent a verification link to {email}. Click it before sending a drill.", { email })}
              </div>
            </div>
          </div>
        ) : !registered ? (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--yellow-fill) 8%, transparent)", border: "3px solid var(--yellow-line)", padding: "12px 14px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <IconWarning size={14} color="var(--yellow)" />
            <div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)", marginBottom: 4 }}>{t("REGISTER FIRST")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.5 }}>
                {t("Verify your phone so drills go only to you — never to an address someone types in.")}
              </div>
            </div>
          </div>
        ) : null}

        {msg && phase !== "ask-email" && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: msg.startsWith("Verification sent") ? "var(--green)" : "var(--orange)", marginBottom: 12, lineHeight: 1.5 }}>
            {t(msg)}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phase === "sent" ? (
            drillId ? <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", textAlign: "center", marginBottom: 2, lineHeight: 1.5 }}>
                {deliveryUnconfirmed ? t("IF THE EMAIL ARRIVED, HOW DID IT GO?") : t("HOW DID IT GO?")}
              </div>
              <PixelButton onClick={() => complete("reported")} color="var(--green-fill)" textColor="var(--on-fill)" size="lg" full disabled={busy || !drillId}>[ {deliveryUnconfirmed ? t("IF IT ARRIVED: I SPOTTED IT") : t("I SPOTTED THE SCAM")} ]</PixelButton>
              <PixelButton onClick={() => complete("submitted_details")} color="var(--red-fill)" textColor="var(--on-danger)" size="md" full disabled={busy || !drillId}>{deliveryUnconfirmed ? t("IF IT ARRIVED: I CLICKED / REPLIED") : t("I CLICKED / REPLIED")}</PixelButton>
            </> : (
              <PixelButton onClick={onBack} color="var(--yellow-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ DONE — DO NOT RESEND ]")}</PixelButton>
            )
          ) : phase === "verify-email" ? (
            <>
              <PixelButton onClick={checkVerificationAndSend} color="var(--yellow-fill)" textColor="var(--on-fill)" size="lg" full disabled={busy}>
                {busy ? t("CHECKING...") : t("[ CHECK VERIFICATION & SEND ]")}
              </PixelButton>
              <PixelButton onClick={() => { setPhase("ask-email"); setMsg(""); }} color="var(--secondary)" textColor="var(--muted-foreground)" size="sm" full disabled={busy}>{t("USE A DIFFERENT EMAIL")}</PixelButton>
            </>
          ) : registered && scheduleBlocked ? (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", textAlign: "center", lineHeight: 1.5 }}>
                {t("OUTSIDE YOUR DRILL WINDOW · OPENS {scheduleNextLabel}", { scheduleNextLabel })}
              </div>
              <PixelButton onClick={() => {}} color="var(--secondary)" textColor="var(--muted-foreground)" size="lg" full disabled>{t("[ SEND DRILL EMAIL ]")}</PixelButton>
            </>
          ) : registered ? (
            <PixelButton onClick={onSendTap} color="var(--orange-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ SEND DRILL EMAIL ]")}</PixelButton>
          ) : (
            <PixelButton onClick={onRegister} color="var(--teal-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ REGISTER TO CONTINUE ]")}</PixelButton>
          )}
          <PixelButton onClick={onBack} color="var(--secondary)" textColor="var(--muted-foreground)" size="sm" full>{t("BACK TO DRILLS")}</PixelButton>
        </div>
      </div>

      {/* The inbox must be verified through a link before the drill can be sent. */}
      {phase === "ask-email" && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "var(--scrim)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }} onClick={() => !busy && setPhase("idle")}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 320, backgroundColor: "var(--background)", border: "4px solid var(--orange-line)", boxShadow: "6px 6px 0 color-mix(in srgb, var(--orange-line) 40%, transparent)", padding: "18px 16px" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--orange)", marginBottom: 10 }}>{t("YOUR EMAIL")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", marginBottom: 12, lineHeight: 1.5 }}>
              {t("We'll email a verification link first. The drill can only be sent after the inbox owner clicks it.")}
            </div>
            <input
              autoFocus value={email} inputMode="email" autoCapitalize="none" placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !busy) startEmailVerification(); }}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", background: "var(--card)", border: "3px solid var(--border)", padding: "10px 12px", outline: "none", marginBottom: 10 }}
            />
            {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--red)", marginBottom: 10 }}>{t(msg)}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><PixelButton onClick={startEmailVerification} color="var(--orange-fill)" textColor="var(--on-fill)" size="sm" full disabled={busy}>{busy ? t("SENDING...") : t("[ VERIFY ]")}</PixelButton></div>
              <div style={{ flex: 1 }}><PixelButton onClick={() => { if (!busy) { setPhase("idle"); setMsg(""); } }} color="var(--border)" textColor="var(--foreground)" size="sm" full>{t("CANCEL")}</PixelButton></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
