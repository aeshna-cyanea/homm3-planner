"use strict";

const CACHE_PREFIX = "hota-production-planner-";
const CACHE_NAME = CACHE_PREFIX + "v3";
const APP_SHELL = [
  "./index.html",
  "./production.css",
  "./production.js",
  "./creatures.json",
  "./manifest.webmanifest",
  "./icons/android-chrome-192x192.png",
  "./icons/android-chrome-512x512.png",
  "./icons/castle.svg",
  "./lib/autoComplete.min.js",
];

self.addEventListener("install", function cacheAppShell(event) {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(function addAppShell(cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function activateImmediately() {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener("activate", function removeOldCaches(event) {
  event.waitUntil(
    caches
      .keys()
      .then(function deleteOldCaches(cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function isOldAppCache(cacheName) {
              return cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME;
            })
            .map(function deleteCache(cacheName) {
              return caches.delete(cacheName);
            }),
        );
      })
      .then(function controlOpenPages() {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", function serveCachedApp(event) {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function useCachedAppShell() {
        return caches.match("./index.html");
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function useCacheOrNetwork(cachedResponse) {
      if (cachedResponse) return cachedResponse;
      return fetch(request).then(function cacheRuntimeAsset(response) {
        if (!response.ok || response.type !== "basic") return response;
        const cachedCopy = response.clone();
        return caches
          .open(CACHE_NAME)
          .then(function storeRuntimeAsset(cache) {
            return cache.put(request, cachedCopy);
          })
          .then(function returnNetworkResponse() {
            return response;
          });
      });
    }),
  );
});
