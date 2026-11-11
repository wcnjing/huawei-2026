import type { NameUpdateResult, PlayerProfile } from "../../types/profile";
import { PixelButton, PixelRadio } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { CharacterAvatar } from "../../components/avatars";
import { useState } from "react";
import { useT } from "../../i18n";

const PROFILE_TITLES = ["WATCHER", "SCAM BLOCKER", "LINK INSPECTOR", "HOUSE GUARDIAN"];

export function ProfileEditScreen({ profile, onRename, onBack, onAvatar, onHouse }: {
  profile: PlayerProfile; onRename: (name: string) => Promise<NameUpdateResult>;
  onBack: () => void; onAvatar: () => void; onHouse: () => void;
}) {
  const t = useT();
  const [profileTitle, setProfileTitle] = useState("WATCHER");
  const titleLabels = PROFILE_TITLES.map((title) => t(title));
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(profile.name);
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  const commitName = async () => {
    const clean = draftName.trim();
    if (!/^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u.test(clean)) {
      setNameError(t("Name is required and may use letters, spaces, apostrophes or hyphens."));
      return;
    }
    setNameError("");
    setSavingName(true);
    const result = await onRename(clean);
    setSavingName(false);
    if (!result.ok) {
      setNameError(result.error ? t(result.error) : t("Could not update your name."));
      return;
    }
    setDraftName(result.name || clean);
    setEditingName(false);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("EDIT PROFILE")} titleColor="var(--teal)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)", marginBottom: 6 }}>{t("USERNAME")}</div>
          {editingName ? (
            <div className="flex gap-2 items-center" style={{ marginBottom: 4 }}>
              <input
                autoFocus
                value={draftName}
                maxLength={30}
                onChange={(e) => { setDraftName(e.target.value); setNameError(""); }}
                disabled={savingName}
                onKeyDown={(e) => { if (e.key === "Enter" && !savingName) void commitName(); if (e.key === "Escape" && !savingName) { setDraftName(profile.name); setNameError(""); setEditingName(false); } }}
                style={{ flex: 1, minWidth: 0, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", background: "var(--background)", border: `2px solid ${nameError ? "var(--red-line)" : "var(--teal-line)"}`, padding: "6px 8px", outline: "none" }}
              />
              <PixelButton onClick={() => { void commitName(); }} color="var(--green-fill)" textColor="var(--on-fill)" size="sm" disabled={savingName}>
                {savingName ? t("SAVING...") : t("OK")}
              </PixelButton>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--foreground)", marginBottom: 8 }}>{profile.name}</div>
              <PixelButton onClick={() => { setDraftName(profile.name); setEditingName(true); }} color="var(--teal-fill)" textColor="var(--on-fill)" size="sm">{t("CHANGE NAME")}</PixelButton>
            </>
          )}
          {nameError && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--red)", lineHeight: 1.5, marginTop: 8 }}>{nameError}</div>}
        </div>
        <button onClick={onAvatar} style={{ width: "100%", backgroundColor: "var(--card)", border: "3px solid var(--violet-line)", padding: "10px 14px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 calc(6px * var(--glow)) ${profile.avatar.glow})` }}>
            <CharacterAvatar size={64} config={profile.avatar} title={`${profile.name}'s character`} />
          </div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--violet)", marginBottom: 4 }}>{t("CHANGE AVATAR")}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)" }}>{t("Customise your pixel character")}</div></div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--violet)" }}>›</div>
        </button>
        <button onClick={onHouse} style={{ width: "100%", backgroundColor: "var(--card)", border: "3px solid var(--green-line)", padding: "12px 14px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--green)", marginBottom: 4 }}>{t("CUSTOMISE HOUSE")}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--soft-foreground)" }}>{t("Sell furniture and buy wallpapers")}</div></div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--green)" }}>›</div>
        </button>
        <div style={{ backgroundColor: "var(--card)", border: "3px solid var(--yellow-line)", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--yellow)", marginBottom: 10 }}>{t("PROFILE TITLE")}</div>
          <PixelRadio options={titleLabels} value={t(profileTitle)} onChange={(label) => setProfileTitle(PROFILE_TITLES[titleLabels.indexOf(label)] ?? profileTitle)} />
        </div>
        <PixelButton onClick={onBack} color="var(--green-fill)" textColor="var(--on-fill)" size="sm" full>{t("[ SAVE PROFILE ]")}</PixelButton>
      </div>
    </div>
  );
}
