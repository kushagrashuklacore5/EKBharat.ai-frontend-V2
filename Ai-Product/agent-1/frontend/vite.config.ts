import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies the WebSocket to the FastAPI backend so the frontend can use a
// same-origin ws:// URL during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/ws": { target: "ws://localhost:8000", ws: true },
      "/health": { target: "http://localhost:8000" },
    },
  },
  test: {
    environment: "node",
  },
});
