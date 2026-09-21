import { useState } from "react";
import type { PlayerProfile } from "../../types/profile";
import type { AccessibilityPrefs, AppSettings } from "../../types/settings";
import { TOKEN_KEY, authHeaders, handleApiAuth, sessionToken, setSessionToken } from "../../services/api";
import { CONTACT_KEY, PROFILE_KEY, loadContact, saveContact } from "../../services/storage";
import { PixelMascot } from "../../components/avatars";
import { PixelButton, PixelToggle, ToggleSwitchB } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";

const TUTORIAL_KEY = "safespace_tutorial_seen";

export function SettingsScreen({ profile, settings, muted, onToggleMute, onSettings, onNav }: { profile: PlayerProfile; settings: AppSettings; muted: boolean; onToggleMute: () => void; onSettings: (s: Partial<AppSettings>) => void; onNav: (screen: string) => void }) {
  // Sound is NOT part of AppSettings: the audio module already persists it in
  // localStorage. The mute state is owned by App (which also drives the header mute
  // button) and passed down, so this toggle and the header can never disagree.
  const soundOn = !muted;
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const toggleAccordion = (key: string) => setOpenAccordion((prev) => (prev === key ? null : key));

  const NavChevron = () => (
    <svg width={8} height={8} viewBox="0 0 4 4" style={{ imageRendering: "pixelated" }}>
      <rect x={0} y={1} width={1} height={1} fill="#6b8ba4" />
      <rect x={1} y={2} width={1} height={1} fill="#6b8ba4" />
      <rect x={2} y={3} width={1} height={1} fill="#6b8ba4" />
      <rect x={3} y={2} width={1} height={1} fill="#6b8ba4" />
    </svg>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4", marginBottom: 14 }}>APP SETTINGS</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#e8f4f8" }}>SOUND</div>
          <ToggleSwitchB on={soundOn} onToggle={onToggleMute} color="#00ff88" />
        </div>

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", marginBottom: 14 }}>ACCOUNT</div>

        <div style={{ padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <PixelMascot size={36} color={profile.avatar.color} hat={profile.avatar.hat} eyes={profile.avatar.eyes} outfit={profile.avatar.outfit} />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffffff" }}>{profile.name}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginTop: 4 }}>LVL 7 — WATCHER</div>
          </div>
        </div>

        {[
          { key: "account-settings", label: "ACCOUNT" },
          { key: "house", label: "HOUSE" },
          { key: "privacy-settings", label: "PRIVACY" },
          { key: "accessibility-settings", label: "ACCESSIBILITY" },
          { key: "about-settings", label: "ABOUT" },
        ].map((row) => (
          <button
            key={row.key}
            onClick={() => onNav(row.key)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", cursor: "pointer", marginBottom: 4 }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#e8f4f8" }}>{row.label}</div>
            <NavChevron />
          </button>
        ))}

        <div style={{ marginBottom: 4, marginTop: 4 }}>
          <button onClick={() => toggleAccordion("reset")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "#111827", border: "3px solid #2a3a5c", cursor: "pointer" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff2d55" }}>SIGN OUT THIS DEVICE</div>
            <div style={{ transform: openAccordion === "reset" ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "flex" }}>
              <NavChevron />
            </div>
          </button>
          {openAccordion === "reset" && (
            <div style={{ backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", borderTop: "none", padding: "14px 16px", animation: "slideUp 0.15s ease-out" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff2d55", marginBottom: 10, lineHeight: 1.5 }}>Removes this device's session and saved contact prefill. Your server account and XP are kept.</div>
              <PixelButton onClick={() => {
                // Use the key constants, not literals — a renamed constant would otherwise
                // leave a key uncleared and this "sign out" would silently not sign out.
                try {
                  localStorage.removeItem(TOKEN_KEY);
                  localStorage.removeItem(PROFILE_KEY);
                  localStorage.removeItem(CONTACT_KEY);
                  localStorage.removeItem(TUTORIAL_KEY);
                } catch { /* private mode: nothing to clear */ }
                location.reload();
              }} color="#ff2d55" textColor="#ffffff" size="sm" full>CONFIRM SIGN OUT</PixelButton>
            </div>
          )}
        </div>

        <div style={{ margin: "24px 0 8px", border: "3px solid #1a2340", padding: "18px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#2a3a5c", lineHeight: 2.4 }}>
            DRILL MODE v2.0.0<br />
            SCAM FIGHTER TRAINING<br />
            © 2026 ALL RIGHTS RESERVED
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS SUB-SCREENS
// ─────────────────────────────────────────────────────────────────────────
export function AccountSettingsScreen({ profile, onBack }: { profile: PlayerProfile; onBack: () => void }) {
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [detachMessage, setDetachMessage] = useState("");
  const registered = !!sessionToken();
  const rows = [
    { label: "USERNAME", value: profile.name, color: "#e8f4f8" },
    // The email address is private (never sent to the client), so it isn't shown here —
    // set it in the email drill. We only surface whether the phone is verified.
    { label: "PHONE", value: registered ? "VERIFIED" : "NOT REGISTERED", color: registered ? "#00ff88" : "#6b8ba4" },
    { label: "LINKED HOUSE PROFILES", value: "4 MEMBERS", color: "#00ff88" },
  ];

  const detachPhone = async () => {
    setDetaching(true);
    setDetachMessage("");
    try {
      const r = await fetch("/api/me/phone/detach", {
        method: "POST",
        headers: { ...authHeaders() },
      });
      handleApiAuth(r);
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        setDetachMessage(d.error || "Could not remove the verified number.");
        setDetaching(false);
        return;
      }

      setSessionToken(null);
      saveContact({ ...loadContact(), phone: "+65" });
      setConfirmDetach(false);
      setDetachMessage("PHONE REMOVED — verify a number again to use real drills.");
    } catch {
      setDetachMessage("We couldn't confirm whether removal finished. Reopen Account settings before trying again.");
    }
    setDetaching(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ACCOUNT" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {rows.map((row) => (
          <div key={row.label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 4 }}>{row.label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: row.color }}>{row.value}</div>
          </div>
        ))}

        {registered && (
          <div style={{ backgroundColor: "rgba(255,45,85,0.06)", border: "3px solid #ff2d55", padding: "14px 16px", marginTop: 18 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff2d55", marginBottom: 7 }}>VERIFIED PHONE</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", lineHeight: 1.55, marginBottom: 12 }}>
              Removing your number signs out every device and stops all real call and SMS drills. Your progress and email are kept.
            </div>
            {confirmDetach ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d", lineHeight: 1.5, marginBottom: 2 }}>
                  REMOVE YOUR VERIFIED PHONE?
                </div>
                <PixelButton onClick={detachPhone} color="#ff2d55" textColor="#ffffff" size="sm" full disabled={detaching}>
                  {detaching ? "REMOVING..." : "YES, REMOVE NUMBER"}
                </PixelButton>
                <PixelButton onClick={() => setConfirmDetach(false)} color="#1a2340" textColor="#b4c6d4" size="sm" full disabled={detaching}>CANCEL</PixelButton>
              </div>
            ) : (
              <PixelButton onClick={() => { setConfirmDetach(true); setDetachMessage(""); }} color="#ff2d55" textColor="#ffffff" size="sm" full>
                REMOVE VERIFIED NUMBER
              </PixelButton>
            )}
          </div>
        )}

        {detachMessage && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: registered ? "#ff2d55" : "#00ff88", lineHeight: 1.5, marginTop: 12 }}>
            {detachMessage}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrivacySettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="PRIVACY" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#0d1526", border: "3px solid #4ecdc4", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginBottom: 6 }}>DATA PRIVACY</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6 }}>
            Your name, verified phone number, optional email, drill outcomes and XP are stored by the service so real drills and progress can work. Room customisation and most display preferences stay in this browser.
          </div>
        </div>
        {[
          ["REAL DRILLS", "Calls and SMS are sent only to your verified number. Email drills require the inbox owner to click a verification link first."],
          ["SENSITIVE DATA", "Never enter real passwords, OTPs, card details or payment information during a drill. For real calls, Vapi processes a short transcript to score the drill; audio recording is disabled, and SafeSpace stores the outcome rather than the transcript."],
          ["YOUR CONTROL", "You can remove your verified phone from Account settings at any time. This signs out active sessions and stops phone-based drills."],
        ].map(([label, copy]) => (
          <div key={label} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#b4c6d4", lineHeight: 1.6 }}>{copy}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AccessibilitySettingsScreen({
  prefs, onChange, onBack,
}: {
  prefs: AccessibilityPrefs;
  onChange: (patch: Partial<AccessibilityPrefs>) => void;
  onBack: () => void;
}) {
  const rows: { key: keyof AccessibilityPrefs; label: string; description: string }[] = [
    { key: "reduceMotion", label: "REDUCE MOTION", description: "Stops flashing, spinning and animated transitions." },
    { key: "largerText", label: "LARGER TEXT", description: "Makes text another 20% larger across the app." },
    { key: "highContrast", label: "HIGH CONTRAST", description: "Strengthens colour and border contrast across the app." },
    { key: "disableScanlines", label: "DISABLE CRT SCANLINES", description: "Removes the decorative screen-line overlay." },
  ];
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ACCESSIBILITY" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {rows.map(row => (
          <div key={row.key} className="accessibility-option px-4 py-3" style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", marginBottom: 8, gap: 12 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#e8f4f8" }}>{row.label}</div>
            <PixelToggle on={prefs[row.key]} onToggle={() => onChange({ [row.key]: !prefs[row.key] })} />
            <div className="accessibility-option-description" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#8da4b8", lineHeight: 1.45 }}>{row.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="ABOUT" titleColor="#ffe66d" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88", marginBottom: 6 }}>DRILL MODE</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginBottom: 4 }}>SCAM FIGHTER TRAINING</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8" }}>v2.0.0</div>
        </div>
        <div style={{ backgroundColor: "rgba(255,107,53,0.1)", border: "3px solid #ff6b35", padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff6b35", marginBottom: 6 }}>DISCLAIMER</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", lineHeight: 1.6 }}>This app is a training simulation. It does not detect real scams automatically. All scenarios are fictional educational examples.</div>
        </div>
      </div>
    </div>
  );
}





// ─────────────────────────────────────────────────────────────────────────
// SCREEN: PLAY WITH OTHERS — create a house or join one with a code.
// Shown only while the player has no house; once they do, the same route shows
// HouseSettingsScreen instead.
// ─────────────────────────────────────────────────────────────────────────
