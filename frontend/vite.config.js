import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.VITE_PROXY_TARGET || "http://backend:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["perversive-unsceptered-sueann.ngrok-free.dev"],
    proxy: {
      "/auth": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/documents": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/admin": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/audit": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/file-storage": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
