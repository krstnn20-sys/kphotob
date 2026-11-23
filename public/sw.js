
const CACHE_NAME = "kixclicks-offline-v2";
const APP_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const response = await fetch(APP_URL, { cache: "reload" });
      if (!response.ok) throw new Error("Could not cache Kix Clicks.");

      await cache.put(APP_URL, response.clone());

      const html = await response.clone().text();
      const assets = [
        ...new Set(
          html.match(/\/_next\/static\/[^"' \t\r\n<>]+/g) || []
        ),
      ];

      await Promise.all(
        assets.map(async (asset) => {
          try {
            const file = await fetch(asset, { cache: "reload" });
            if (file.ok) await cache.put(asset, file);
          } catch {}
        })
      );

      for (const asset of ["/manifest.json", "/icon.svg"]) {
        try {
          const file = await fetch(asset);
          if (file.ok) await cache.put(asset, file);
        } catch {}
      }

      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("kixclicks-") && key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_URL, response.clone());
          }

          return response;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match(APP_URL)) ||
            new Response("Kix Clicks is not available offline yet.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      })()
    );
    return;
  }

  if (
    request.destination === "image" ||
    request.destination === "font" ||
    request.destination === "style" ||
    request.destination === "script" ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/icon.svg"
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      })()
    );
  }
});
