import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/health": "http://localhost:4000",
      "/shorten": "http://localhost:4000",
    },
  },
});
