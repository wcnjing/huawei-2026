import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In dev (`npm run dev`), proxy the API to the backend so /api works the same
  // as when the backend serves the built app in production (`npm start`).
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
