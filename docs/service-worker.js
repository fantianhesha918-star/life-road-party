const CACHE_NAME = "liferoad-cache-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./ui.js",
  "./cpu.js",
  "./game-engine.js",
  "./game-data.js",
  "./shop-data.js",
  "./profile.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// キャッシュ優先だと更新のたびにCACHE_NAMEを上げない限り古い版を配信し続けてしまうため、
// ネットワーク優先(取得できたら常に最新を使い、キャッシュに保存)・オフライン時のみキャッシュに
// フォールバックする方式にする(2026-08-04変更)。
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isSameOriginGet = event.request.method === "GET" && url.origin === self.location.origin;
  if (!isSameOriginGet) return; // Firestore通信(POST等)・外部CDNはこのアプリのキャッシュ対象外、素通しする

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
      )
  );
});
