import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { DEFAULT_AVATAR_CONFIG } from "./app/components/avatars/character";
import { setSessionToken } from "./app/services/session";
import { loadProfile, saveProfile } from "./app/services/storage";
import type { AvatarConfig } from "./app/types/profile";
import { LanguageProvider } from "./app/i18n";
import "./styles/index.css";

const params = new URLSearchParams(window.location.search);
const characterDevRequested = params.get("character-dev") === "1";
const isLoopback = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const characterDev = import.meta.env.DEV && isLoopback && characterDevRequested;

type DevLogin = { token: string };
type DevHouse = { house: { inviteCode: string | null } | null };

async function jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `${path} returned ${response.status}`);
  return data as T;
}

async function devLogin(phone: string, name: string, avatar: AvatarConfig): Promise<string> {
  const result = await jsonRequest<DevLogin>("/api/verify/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone, code: "000000", name, avatar }),
  });
  return result.token;
}

const auth = (token: string): HeadersInit => ({ authorization: `Bearer ${token}` });

async function seedCharacterHouse(ownerToken: string): Promise<void> {
  let ownerHouse = await jsonRequest<DevHouse>("/api/house", { headers: auth(ownerToken) });
  if (!ownerHouse.house) {
    ownerHouse = await jsonRequest<DevHouse>("/api/house", {
      method: "POST",
      headers: { ...auth(ownerToken), "content-type": "application/json" },
      body: JSON.stringify({ name: "PIXEL HOUSE" }),
    });
  }
  const code = ownerHouse.house?.inviteCode;
  if (!code) return;

  const housemates: Array<{ phone: string; name: string; avatar: AvatarConfig }> = [
    {
      phone: "+6594000002",
      name: "MAYA",
      avatar: { ...DEFAULT_AVATAR_CONFIG, skinTone: "tan", hairStyle: "pigtails", hairColor: "espresso", outfit: "yellow-skirt", color: "#ffe66d", glow: "#ff6b35" },
    },
    {
      phone: "+6594000003",
      name: "JUN",
      avatar: { ...DEFAULT_AVATAR_CONFIG, skinTone: "golden", hairStyle: "fluffy", hairColor: "silver", outfit: "overalls", color: "#c77dff", glow: "#4ecdc4" },
    },
  ];

  await Promise.all(housemates.map(async (housemate) => {
    const token = await devLogin(housemate.phone, housemate.name, housemate.avatar);
    const state = await jsonRequest<DevHouse>("/api/house", { headers: auth(token) });
    if (state.house) return;
    await jsonRequest<DevHouse>("/api/house/join", {
      method: "POST",
      headers: { ...auth(token), "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }));
}

function CharacterDevBootstrap() {
  const [state, setState] = useState<{ ready: boolean; error: string | null }>({ ready: false, error: null });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const stored = loadProfile();
        const name = stored.name === "PLAYER_001" ? "CHARACTER TESTER" : stored.name;
        const token = await devLogin("+6594000001", name, stored.avatar);
        setSessionToken(token);
        saveProfile({ name, avatar: stored.avatar });
        await seedCharacterHouse(token);
        if (active) setState({ ready: true, error: null });
      } catch (error) {
        if (active) setState({ ready: false, error: error instanceof Error ? error.message : "Could not start character mode." });
      }
    })();
    return () => { active = false; };
  }, []);

  if (state.error) {
    return (
      <div className="safespace-app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0a0e1a", color: "#ff6b35", fontFamily: "'Share Tech Mono', monospace", textAlign: "center" }}>
        <div>CHARACTER MODE COULD NOT START<br /><br />{state.error}<br /><br />Check the terminal, then reload.</div>
      </div>
    );
  }
  if (!state.ready) {
    return (
      <div className="safespace-app" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a0e1a", color: "#c77dff", fontFamily: "'Share Tech Mono', monospace" }}>
        PREPARING CHARACTER MODE…
      </div>
    );
  }
  return <App initialScreen="avatar-customisation" />;
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    {characterDev ? <CharacterDevBootstrap /> : <App />}
  </LanguageProvider>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
