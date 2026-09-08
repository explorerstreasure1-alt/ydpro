// 7DİL — Telefon uygulama altyapısı (PWA) — offline cache v2 (ikon + dil düzeltmesi)
const CACHE = "7dil-v2";
const CORE = ["/", "/manifest.json", "/logo.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API'ler network-first, statik dosyalar cache-first
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          // başarılı API yanıtını cache'leme yok
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
            const clone = networkRes.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return networkRes;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
