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
      <SubPageHeader title={t("EDIT PROFILE")} titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
        <div style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 6 }}>{t("USERNAME")}</div>
          {editingName ? (
            <div className="flex gap-2 items-center" style={{ marginBottom: 4 }}>
              <input
                autoFocus
                value={draftName}
                maxLength={30}
                onChange={(e) => { setDraftName(e.target.value); setNameError(""); }}
                disabled={savingName}
                onKeyDown={(e) => { if (e.key === "Enter" && !savingName) void commitName(); if (e.key === "Escape" && !savingName) { setDraftName(profile.name); setNameError(""); setEditingName(false); } }}
                style={{ flex: 1, minWidth: 0, fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", background: "#0a0e1a", border: `2px solid ${nameError ? "#ff2d55" : "#4ecdc4"}`, padding: "6px 8px", outline: "none" }}
              />
              <PixelButton onClick={() => { void commitName(); }} color="#00ff88" textColor="#0a0e1a" size="sm" disabled={savingName}>
                {savingName ? t("SAVING...") : t("OK")}
              </PixelButton>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8", marginBottom: 8 }}>{profile.name}</div>
              <PixelButton onClick={() => { setDraftName(profile.name); setEditingName(true); }} color="#4ecdc4" textColor="#0a0e1a" size="sm">{t("CHANGE NAME")}</PixelButton>
            </>
          )}
          {nameError && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ff2d55", lineHeight: 1.5, marginTop: 8 }}>{nameError}</div>}
        </div>
        <button onClick={onAvatar} style={{ width: "100%", backgroundColor: "#111827", border: "3px solid #c77dff", padding: "10px 14px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, display: "flex", justifyContent: "center", filter: `drop-shadow(0 0 6px ${profile.avatar.glow})` }}>
            <CharacterAvatar size={64} config={profile.avatar} title={`${profile.name}'s character`} />
          </div>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#c77dff", marginBottom: 4 }}>{t("CHANGE AVATAR")}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8" }}>{t("Customise your pixel character")}</div></div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#c77dff" }}>›</div>
        </button>
        <button onClick={onHouse} style={{ width: "100%", backgroundColor: "#111827", border: "3px solid #00ff88", padding: "12px 14px", cursor: "pointer", textAlign: "left", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#00ff88", marginBottom: 4 }}>{t("CUSTOMISE HOUSE")}</div><div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#9bb0c8" }}>{t("Sell furniture and buy wallpapers")}</div></div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88" }}>›</div>
        </button>
        <div style={{ backgroundColor: "#111827", border: "3px solid #ffe66d", padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d", marginBottom: 10 }}>{t("PROFILE TITLE")}</div>
          <PixelRadio options={titleLabels} value={t(profileTitle)} onChange={(label) => setProfileTitle(PROFILE_TITLES[titleLabels.indexOf(label)] ?? profileTitle)} />
        </div>
        <PixelButton onClick={onBack} color="#00ff88" textColor="#0a0e1a" size="sm" full>{t("[ SAVE PROFILE ]")}</PixelButton>
      </div>
    </div>
  );
}
