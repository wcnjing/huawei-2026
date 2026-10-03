import { useState } from "react";
import { normalizeAvatarConfig } from "../../components/avatars";
import { PhoneFrame, Scanlines } from "../../components/layout";
import type { AvatarConfig } from "../../types/profile";
import { AvatarCustomisationScreen } from "./AvatarCustomisationScreen";

const CHARACTER_LAB_KEY = "safespace_character_lab_avatar";

function loadLabAvatar(): AvatarConfig {
  try {
    return normalizeAvatarConfig(JSON.parse(localStorage.getItem(CHARACTER_LAB_KEY) ?? "null"));
  } catch {
    return normalizeAvatarConfig(null);
  }
}

function saveLabAvatar(avatar: AvatarConfig) {
  try { localStorage.setItem(CHARACTER_LAB_KEY, JSON.stringify(avatar)); } catch { /* private mode */ }
}

/** Development-only character preview. It never mounts the authenticated app or calls its APIs. */
export function CharacterLabScreen() {
  const [avatar, setAvatar] = useState(loadLabAvatar);
  const update = (next: AvatarConfig) => {
    setAvatar(next);
    saveLabAvatar(next);
  };

  return (
    <div className="safespace-app">
      <Scanlines />
      <PhoneFrame>
        <div className="flex flex-col flex-1 overflow-hidden">
          <div style={{ flexShrink: 0, padding: "6px 10px", background: "#c77dff", color: "#0a0e1a", fontFamily: "'Share Tech Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textAlign: "center" }}>
            LOCAL CHARACTER LAB · NO SIGN-IN · SAVED ON THIS DEVICE
          </div>
          <div className="flex-1 overflow-hidden">
            <AvatarCustomisationScreen
              avatar={avatar}
              onChange={update}
              onSave={update}
              onBack={() => window.location.assign("/?character-lab=1")}
            />
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}
