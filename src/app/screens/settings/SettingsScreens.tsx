import { useState } from "react";
import type { PlayerProfile } from "../../types/profile";
import type { AccessibilityPrefs, AppSettings } from "../../types/settings";
import { TOKEN_KEY, authHeaders, handleApiAuth, sessionToken, setSessionToken } from "../../services/api";
import { CONTACT_KEY, PROFILE_KEY, loadContact, saveContact } from "../../services/storage";
import { CharacterAvatar } from "../../components/avatars";
import { IconChevron } from "../../components/icons";
import { PixelButton, PixelSelect, PixelToggle, ThemeSwitch, ToggleSwitchB } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { LANGUAGES, useI18n, useT, type Language } from "../../i18n";
import { setPresurveyUser } from "../../data/presurvey";
import { ink } from "../../utils/color";

const TUTORIAL_KEY = "safespace_tutorial_seen";

export function SettingsScreen({ profile, settings, muted, onToggleMute, onSettings, onNav }: { profile: PlayerProfile; settings: AppSettings; muted: boolean; onToggleMute: () => void; onSettings: (s: Partial<AppSettings>) => void; onNav: (screen: string) => void }) {
  // Sound is NOT part of AppSettings: the audio module already persists it in
  // localStorage. The mute state is owned by App (which also drives the header mute
  // button) and passed down, so this toggle and the header can never disagree.
  const soundOn = !muted;
  const { language, setLanguage, t } = useI18n();
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const toggleAccordion = (key: string) => setOpenAccordion((prev) => (prev === key ? null : key));


  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--teal)", marginBottom: 14 }}>{t("APP SETTINGS")}</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: "var(--card)", border: "3px solid var(--border)", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)" }}>{t("SOUND")}</div>
          <ToggleSwitchB on={soundOn} onToggle={onToggleMute} color="var(--green-fill)" />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", backgroundColor: "var(--card)", border: "3px solid var(--border)", marginBottom: 8 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)" }}>{t("THEME")}</div>
          <ThemeSwitch label={t("Light theme")} />
        </div>

        <div style={{ padding: "14px 16px", backgroundColor: "var(--card)", border: "3px solid var(--border)", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <label htmlFor="language-select" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)" }}>{t("LANGUAGE")}</label>
            <PixelSelect
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              style={{ fontSize: "var(--text-body)", color: "var(--foreground)", backgroundColor: "var(--background)", border: "3px solid var(--teal)", minWidth: 150 }}
              chevronColor="var(--teal)"
            >
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </PixelSelect>
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.45, marginTop: 8 }}>
            {t("Changes the app and your drills, including real SMS and email drills.")}
          </div>
        </div>

        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", marginBottom: 14 }}>{t("ACCOUNT")}</div>

        <div style={{ padding: "14px 16px", backgroundColor: "var(--card)", border: "3px solid var(--border)", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <CharacterAvatar size={40} config={profile.avatar} title={`${profile.name}'s character`} />
          <div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground-strong)" }}>{profile.name}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)", marginTop: 4 }}>{t("LVL {level} — {title}", { level: 7, title: t("WATCHER") })}</div>
          </div>
        </div>

        {[
          { key: "account-settings", label: t("ACCOUNT") },
          { key: "presurvey", label: t("PREFERENCES") },
          { key: "house", label: t("HOUSE") },
          { key: "privacy-settings", label: t("PRIVACY") },
          { key: "accessibility-settings", label: t("ACCESSIBILITY") },
          { key: "about-settings", label: t("ABOUT") },
        ].map((row) => (
          <button
            key={row.key}
            onClick={() => onNav(row.key)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "var(--card)", border: "3px solid var(--border)", cursor: "pointer", marginBottom: 4 }}
          >
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)" }}>{row.label}</div>
            <div aria-hidden="true" style={{ display: "flex", transform: "rotate(-90deg)" }}>
              <IconChevron size={10} color="var(--muted-foreground)" />
            </div>
          </button>
        ))}

        <div style={{ marginBottom: 4, marginTop: 4 }}>
          <button onClick={() => toggleAccordion("reset")} aria-expanded={openAccordion === "reset"} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "14px 16px", backgroundColor: "var(--card)", border: "3px solid var(--border)", cursor: "pointer" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)" }}>{t("SIGN OUT THIS DEVICE")}</div>
            <div aria-hidden="true" style={{ transform: openAccordion === "reset" ? "rotate(180deg)" : "none", transition: "transform 0.15s", display: "flex" }}>
              <IconChevron size={10} color="var(--muted-foreground)" />
            </div>
          </button>
          {openAccordion === "reset" && (
            <div style={{ backgroundColor: "var(--background)", border: "3px solid var(--border)", borderTop: "none", padding: "14px 16px", animation: "slideUp 0.15s ease-out" }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--red)", marginBottom: 10, lineHeight: 1.5 }}>{t("Removes this device's session and saved contact prefill. Your server account and XP are kept.")}</div>
              <PixelButton onClick={() => {
                // Use the key constants, not literals — a renamed constant would otherwise
                // leave a key uncleared and this "sign out" would silently not sign out.
                try {
                  localStorage.removeItem(TOKEN_KEY);
                  localStorage.removeItem(PROFILE_KEY);
                  localStorage.removeItem(CONTACT_KEY);
                  localStorage.removeItem(TUTORIAL_KEY);
                  localStorage.removeItem("safespace_onboarding_stage");
                  setPresurveyUser(null);
                } catch { /* private mode: nothing to clear */ }
                location.reload();
              }} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full>{t("CONFIRM SIGN OUT")}</PixelButton>
            </div>
          )}
        </div>

        <div style={{ margin: "24px 0 8px", border: "3px solid var(--secondary)", padding: "18px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--border)", lineHeight: 2.4 }}>
            {t("DRILL MODE")} v2.0.0<br />
            {t("SCAM FIGHTER TRAINING")}<br />
            {t("© 2026 ALL RIGHTS RESERVED")}
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
  const t = useT();
  const [confirmDetach, setConfirmDetach] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [detachMessage, setDetachMessage] = useState("");
  const registered = !!sessionToken();
  const rows = [
    { label: t("USERNAME"), value: profile.name, color: "var(--foreground)" },
    // The email address is private (never sent to the client), so it isn't shown here —
    // set it in the email drill. We only surface whether the phone is verified.
    { label: t("PHONE"), value: registered ? t("VERIFIED") : t("NOT REGISTERED"), color: registered ? "var(--green)" : "var(--muted-foreground)" },
    { label: t("LINKED HOUSE PROFILES"), value: t("{count} MEMBERS", { count: 4 }), color: "var(--green)" },
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
      <SubPageHeader title={t("ACCOUNT")} titleColor="var(--teal)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {rows.map((row) => (
          <div key={row.label} style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", marginBottom: 4 }}>{row.label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: ink(row.color) }}>{row.value}</div>
          </div>
        ))}

        {registered && (
          <div style={{ backgroundColor: "color-mix(in srgb, var(--red-fill) 6%, transparent)", border: "3px solid var(--red)", padding: "14px 16px", marginTop: 18 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)", marginBottom: 7 }}>{t("VERIFIED PHONE")}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.55, marginBottom: 12 }}>
              {t("Removing your number signs out every device and stops all real call and SMS drills. Your progress and email are kept.")}
            </div>
            {confirmDetach ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)", lineHeight: 1.5, marginBottom: 2 }}>
                  {t("REMOVE YOUR VERIFIED PHONE?")}
                </div>
                <PixelButton onClick={detachPhone} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full disabled={detaching}>
                  {detaching ? t("REMOVING...") : t("YES, REMOVE NUMBER")}
                </PixelButton>
                <PixelButton onClick={() => setConfirmDetach(false)} color="var(--secondary)" textColor="var(--soft-foreground)" size="sm" full disabled={detaching}>{t("CANCEL")}</PixelButton>
              </div>
            ) : (
              <PixelButton onClick={() => { setConfirmDetach(true); setDetachMessage(""); }} color="var(--red-fill)" textColor="var(--on-danger)" size="sm" full>
                {t("REMOVE VERIFIED NUMBER")}
              </PixelButton>
            )}
          </div>
        )}

        {detachMessage && (
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: registered ? "var(--red)" : "var(--green)", lineHeight: 1.5, marginTop: 12 }}>
            {t(detachMessage)}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrivacySettingsScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("PRIVACY")} titleColor="var(--teal)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "var(--surface)", border: "3px solid var(--teal)", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)", marginBottom: 6 }}>{t("DATA PRIVACY")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6 }}>
            {t("Your name, verified phone number, optional email, drill outcomes and XP are stored by the service so real drills and progress can work. Room customisation and most display preferences stay in this browser.")}
          </div>
        </div>
        {[
          [t("REAL DRILLS"), t("Calls and SMS are sent only to your verified number. Email drills require the inbox owner to click a verification link first.")],
          [t("SENSITIVE DATA"), t("Never enter real passwords, OTPs, card details or payment information during a drill. For real calls, Vapi processes a short transcript to score the drill; audio recording is disabled, and SafeSpace stores the outcome rather than the transcript.")],
          [t("YOUR CONTROL"), t("You can remove your verified phone from Account settings at any time. This signs out active sessions and stops phone-based drills.")],
        ].map(([label, copy]) => (
          <div key={label} style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)", marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.6 }}>{copy}</div>
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
  const t = useT();
  const rows: { key: keyof AccessibilityPrefs; label: string; description: string }[] = [
    { key: "reduceMotion", label: t("REDUCE MOTION"), description: t("Stops flashing, spinning and animated transitions.") },
    { key: "largerText", label: t("LARGER TEXT"), description: t("Makes text another 20% larger across the app.") },
    { key: "highContrast", label: t("HIGH CONTRAST"), description: t("Strengthens colour and border contrast across the app.") },
    { key: "disableScanlines", label: t("DISABLE CRT SCANLINES"), description: t("Removes the decorative screen-line overlay.") },
  ];
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("ACCESSIBILITY")} titleColor="var(--teal)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        {rows.map(row => (
          <div key={row.key} className="accessibility-option px-4 py-3" style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", marginBottom: 8, gap: 12 }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--foreground)" }}>{row.label}</div>
            <PixelToggle on={prefs[row.key]} onToggle={() => onChange({ [row.key]: !prefs[row.key] })} />
            <div className="accessibility-option-description" style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)", lineHeight: 1.45 }}>{row.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AboutSettingsScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("ABOUT")} titleColor="var(--yellow)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--green)", marginBottom: 6 }}>{t("DRILL MODE")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--teal)", marginBottom: 4 }}>{t("SCAM FIGHTER TRAINING")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)" }}>v2.0.0</div>
        </div>
        <div style={{ backgroundColor: "color-mix(in srgb, var(--orange-fill) 10%, transparent)", border: "3px solid var(--orange)", padding: "12px 14px" }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--orange)", marginBottom: 6 }}>{t("DISCLAIMER")}</div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", lineHeight: 1.6 }}>{t("This app is a training simulation. It does not detect real scams automatically. All scenarios are fictional educational examples.")}</div>
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
