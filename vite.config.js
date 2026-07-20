import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  build: {
    license: {
      fileName: "third-party-licenses.md",
    },
  },
  plugins: [
    VitePWA({
      manifest: false,
      registerType: "autoUpdate",
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{html,css,js,json,webmanifest,png,svg}"],
      },
    }),
  ],
});
