import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";

const commitHash = (
  process.env.GITHUB_SHA ||
  execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" })
).trim().slice(0, 7);

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_GIT_COMMIT_HASH": JSON.stringify(commitHash),
  },
  build: {
    license: {
      fileName: "third-party-licenses.md",
    },
  },
  plugins: [
    solid(),
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
