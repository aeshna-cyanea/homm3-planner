#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const PROJECT_DIR = __dirname;
const DIST_DIR = path.join(PROJECT_DIR, "dist");
const STAGING_DIR = path.join(PROJECT_DIR, "dist.tmp");

const APP_FILES = [
  "index.html",
  "production.css",
  "production.js",
  "creatures.json",
  "manifest.webmanifest",
  "service-worker.js",
  "icons/android-chrome-192x192.png",
  "icons/android-chrome-512x512.png",
  "icons/castle.svg",
];

const DEPENDENCY_FILES = [
  [
    "node_modules/@tarekraafat/autocomplete.js/dist/autoComplete.min.js",
    "lib/autoComplete.min.js",
  ],
  ["node_modules/@tarekraafat/autocomplete.js/LICENSE", "lib/autoComplete.LICENSE"],
];

function copyFile(sourceName, destinationName) {
  const source = path.join(PROJECT_DIR, sourceName);
  const destination = path.join(STAGING_DIR, destinationName);
  if (!fs.existsSync(source)) {
    throw new Error("Missing build input: " + sourceName);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function buildSite() {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  try {
    for (const file of APP_FILES) copyFile(file, file);
    for (const [source, destination] of DEPENDENCY_FILES) {
      copyFile(source, destination);
    }
    fs.writeFileSync(path.join(STAGING_DIR, ".nojekyll"), "", "utf8");

    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    fs.renameSync(STAGING_DIR, DIST_DIR);
    console.log("Built " + DIST_DIR);
  } finally {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
}

try {
  buildSite();
} catch (error) {
  console.error("Build failed: " + error.message);
  process.exitCode = 1;
}
