const APP_VER = new URL(self.location.href).searchParams.get("appver") || "base";
const CACHE_PREFIX = "nap-check-cache-";
const CACHE_NAME = `${CACHE_PREFIX}${APP_VER}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./child.json",
  "./manifest.json",
  "./sw.js",
  "./jszip.min.js",
  "./icon-192.png",
  "./icon-512.png",
  "./version.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) {
    event.respondWith(fetch(req));
    return;
  }

  if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("version.json")) {
    event.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match("./index.html");
        if (cached) return cached;

        const response = await fetch(req);
        if (response && response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", response.clone());
        }
        return response;
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const response = await fetch(req);
        if (response && response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, response.clone());
        }
        return response;
      } catch (error) {
        const fallback = await caches.match(`.${url.pathname}`);
        if (fallback) return fallback;
        throw error;
      }
    })()
  );
});
