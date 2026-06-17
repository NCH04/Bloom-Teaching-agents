import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the backend through a relative `/session` prefix.
// In dev, Vite proxies those calls (including the SSE stream) to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/session": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
