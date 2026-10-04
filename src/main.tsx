import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { sessionToken, setSessionToken } from "./app/services/session";
import { LanguageProvider } from "./app/i18n";
import "./styles/index.css";

const url = new URL(window.location.href);
const isLoopback = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const devMode = import.meta.env.DEV && isLoopback && url.searchParams.get("dev-mode") === "1";

// The dev command opens with reset=1 to start signed out. This only drops the local
// session token; saved profile, contact, preferences, and tutorial progress remain.
if (devMode && url.searchParams.get("reset") === "1") {
  setSessionToken(null);
  url.searchParams.delete("reset");
  window.history.replaceState(null, "", url);
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <App devMode={devMode} initialScreen={devMode ? (sessionToken() ? "home" : "start") : "title"} />
  </LanguageProvider>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
