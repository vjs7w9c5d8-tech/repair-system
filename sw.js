"use strict";

// 每次變更快取資源時更新版本；新版本須由使用者按更新後接管。
const CACHE_PREFIX = `repair-pwa:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
].map((path) => new URL(path, self.registration.scope).href);
const INDEX = SHELL[0];
const SDK =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(
        SHELL.map((url) => new Request(url, { cache: "reload" })),
      );
      // CDN 失敗不阻止本機頁面快取；成功後可離線初始化表單。
      try {
        const response = await fetch(SDK, {
          mode: "cors",
          cache: "reload",
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) await cache.put(SDK, response);
      } catch {
        // 未快取 SDK 時仍可離線開頁，表單會顯示載入失敗提示。
      }
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const start = new URL(self.registration.scope);
  const isHome =
    request.mode === "navigate" &&
    url.origin === start.origin &&
    (url.pathname === start.pathname ||
      url.pathname === new URL(INDEX).pathname);
  // 僅快取固定靜態資源，不攔截 Supabase API、不保存報修清單或表單。
  if (!isHome && !SHELL.includes(url.href) && url.href !== SDK) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const key = isHome ? INDEX : request.url;
      const cached = await cache.match(key);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && request.url === SDK)
        await cache.put(SDK, response.clone());
      return response;
    })(),
  );
});
