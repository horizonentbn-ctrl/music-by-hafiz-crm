const CACHE_NAME = "mh-crm-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
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

// Network-first for API calls (Apps Script), cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (url.includes("script.google.com")) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ success: false, error: "Offline" }), { headers: { "Content-Type": "application/json" } }))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
