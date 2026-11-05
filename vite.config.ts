import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Read .env the same way the backend does, so a PORT set there (for when 3000 is taken on
  // your machine) moves the dev proxy too. Only PORT and DEV_API_TARGET are used here.
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = process.env.DEV_API_TARGET || env.DEV_API_TARGET || `http://localhost:${env.PORT || 3000}`;

  return {
    plugins: [react(), tailwindcss()],
    // In dev (`npm run dev`), proxy the API to the backend so /api works the same
    // as when the backend serves the built app in production (`npm start`).
    server: {
      proxy: {
        "/api": apiTarget,
      },
    },
  };
});
