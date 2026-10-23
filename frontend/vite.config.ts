import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared/src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // web3.js is a large dependency; silence the non-fatal chunk-size warning.
    chunkSizeWarningLimit: 900,
  },
});
