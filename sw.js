const CACHE_NAME = "nap-check-v7";

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
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
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

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("./index.html", response.clone());
          }
          return response;
        } catch (error) {
          const cachedPage = await caches.match("./index.html");
          if (cachedPage) return cachedPage;
          throw error;
        }
      })()
    );
    return;
  }

  if (isSameOrigin) {
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
          const fallback = await caches.match(url.pathname);
          if (fallback) return fallback;

          const dotFallback = await caches.match(`.${url.pathname}`);
          if (dotFallback) return dotFallback;

          throw error;
        }
      })()
    );
    return;
  }

  event.respondWith(fetch(req));
});