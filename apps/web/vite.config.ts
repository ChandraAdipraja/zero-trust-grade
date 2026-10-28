import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const gatewayUrl = process.env.GATEWAY_ORIGIN ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/auth": { target: gatewayUrl, changeOrigin: true },
      "/nilai": { target: gatewayUrl, changeOrigin: true },
      "/kelas": { target: gatewayUrl, changeOrigin: true },
      "/transkrip": { target: gatewayUrl, changeOrigin: true },
      "/audit": { target: gatewayUrl, changeOrigin: true },
    },
  },
});
