
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { CharacterLabScreen } from "./app/screens/profile/CharacterLabScreen.tsx";
  import "./styles/index.css";

  const characterLabRequested = new URLSearchParams(window.location.search).get("character-lab") === "1";
  const isLoopback = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const showCharacterLab = import.meta.env.DEV && isLoopback && characterLabRequested;

  createRoot(document.getElementById("root")!).render(showCharacterLab ? <CharacterLabScreen /> : <App />);

  // Registered only in production: in dev the Vite server already owns the page,
  // and a worker sitting in front of it confuses hot reload. Failure is non-fatal
  // — without it the app still runs, it just won't offer to install.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
