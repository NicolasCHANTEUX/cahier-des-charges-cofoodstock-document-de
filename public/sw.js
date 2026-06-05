const CACHE_NAME = "ecofoodstock-v2";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [OFFLINE_URL, "/manifest.webmanifest", "/icon-192.svg", "/icon-512.svg", "/apple-touch-icon.svg"];
const APP_SHELL_SET = new Set(APP_SHELL);

function isLocalDevelopment() {
  return ["localhost", "127.0.0.1", "::1"].includes(self.location.hostname);
}

self.addEventListener("install", (event) => {
  if (isLocalDevelopment()) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  if (isLocalDevelopment()) {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith("ecofoodstock-")).map((key) => caches.delete(key))))
        .then(() => self.clients.claim())
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const sameOrigin = url.origin === self.location.origin;

  if (isLocalDevelopment() || !sameOrigin || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/api/")) {
    return;
  }

  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (APP_SHELL_SET.has(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        });
      })
    );
  }
});
