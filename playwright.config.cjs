const { defineConfig } = require("@playwright/test");
const { existsSync } = require("node:fs");

const chromeExecutable = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  "/usr/bin/google-chrome-stable",
  "/opt/google/chrome/chrome",
].find((candidate) => candidate && existsSync(candidate));

module.exports = defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: chromeExecutable ? { executablePath: chromeExecutable } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173/production.html",
    reuseExistingServer: true,
  },
});
