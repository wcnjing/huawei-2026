
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { LanguageProvider } from "./app/i18n";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  );

  // Registered only in production: in dev the Vite server already owns the page,
  // and a worker sitting in front of it confuses hot reload. Failure is non-fatal
  // — without it the app still runs, it just won't offer to install.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
  