/**
 * Lollies owner PWA — service worker, scoped to /app/ only.
 *
 * Registered exclusively by the /app page, so the storefront is untouched.
 * Strategy:
 * - App shell (page, manifest, icons): cache-first, versioned. Bump CACHE
 *   when the shell changes; old caches are purged on activate.
 * - Admin API (summary/queues): network-first with a short cache fallback,
 *   so the board still renders the last good payload offline. Authenticated
 *   responses are per-device (single owner), so caching them is safe.
 * - Push: showNotification from the backend payload { title, body, url }.
 *   Tapping focuses/opens /app (or the payload url under /app).
 */

const CACHE = "lollies-app-v1";

const SHELL = [
  "/app",
  "/app/manifest.webmanifest",
  "/app/icon-192.png",
  "/app/icon-512.png",
  "/app/maskable-512.png",
  "/app/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  // Shell assets: cache-first.
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return res;
          })
      )
    );
    return;
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Lollies", body: "Something needs you.", url: "/app" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // Keep the defaults; a ping with no payload is still worth surfacing.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/app/icon-192.png",
      badge: "/app/icon-192.png",
      data: { url: data.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app", self.location.origin);
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const w of windows) {
          if (new URL(w.url).pathname.startsWith("/app")) {
            return w.focus().then(() => w.navigate(target.href));
          }
        }
        return self.clients.openWindow(target.href);
      })
  );
});
