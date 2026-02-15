/* <REPO_NAME> Service Worker */

const CACHE_NAME = "<REPO_NAME>-v1";

// ★あなたのファイル構成に合わせて追加（index.html は必須）
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
  "./icon-192.png",
  "./icon-512.png"
 ];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // URL直打ち/リロード対策：ナビゲーションは index.html を返す
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const networkRes = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", networkRes.clone());
        return networkRes;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // それ以外：キャッシュ優先 → なければネット → 取れたらキャッシュ
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const networkRes = await fetch(req);
      if (networkRes && networkRes.ok) cache.put(req, networkRes.clone());
      return networkRes;
    } catch {
      return Response.error();
    }
  })());
});
