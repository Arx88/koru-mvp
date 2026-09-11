// Michi Service Worker — notificaciones push y background sync
// Mobile-first: funciona en PWA standalone

// 🐱 v8.5 — michi-v10: sistema de Stickers de actitud (15 webp en
// /assets/stickers/) + tono más cercano/cool/gracioso. El SW no intercepta
// fetch, pero se bumpea la caché siguiendo la convención de release: al
// cambiar sw.js el navegador reinstala y el activate limpia cachés viejas.
const CACHE_NAME = "michi-v10";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/assets/art-09.webp",
  "/assets/art-17.webp",
  "/assets/art-11.webp",
  "/assets/art-12.webp",
  "/assets/art-13.webp",
  "/assets/art-19.webp",
  "/assets/user-reference.webp",
  "/assets/michi-world/banner-aventurero.webp",
  "/assets/michi-world/banner-companion-01.webp",
  "/assets/michi-world/banner-companion-02.webp",
  "/assets/michi-world/banner-companion-03.webp",
  "/assets/michi-world/banner-companion-04.webp",
  "/assets/michi-world/banner-companion-05.webp",
  "/assets/michi-world/banner-companion-06.webp",
  "/assets/michi-world/banner-companion-07.webp",
  "/assets/michi-world/banner-companion-08.webp",
  "/assets/michi-world/banner-companion-09.webp",
  "/assets/michi-world/banner-companion-10.webp",
  "/assets/michi-world/banner-companion-11.webp",
  "/assets/michi-world/banner-companion-12.webp",
  "/assets/michi-world/banner-companion-13.webp",
  "/assets/michi-world/banner-companion-14.webp",
  "/assets/michi-world/banner-companion-15.webp",
  "/assets/michi-world/banner-companion-16.webp",
  "/assets/michi-world/banner-companion-17.webp",
  "/assets/michi-world/banner-companion-18.webp",
  "/assets/michi-world/banner-companion-19.webp",
  "/assets/michi-world/banner-companion-20.webp",
  "/assets/michi-world/banner-cool.webp",
  "/assets/michi-world/banner-corazones.webp",
  "/assets/michi-world/banner-dormilon.webp",
  "/assets/michi-world/banner-explorador.webp",
  "/assets/michi-world/banner-gamer.webp",
  "/assets/michi-world/banner-mago.webp",
  "/assets/michi-world/banner-playita.webp",
  "/assets/stickers/hi.webp",
  "/assets/stickers/good-morning.webp",
  "/assets/stickers/love.webp",
  "/assets/stickers/nice.webp",
  "/assets/stickers/okey.webp",
  "/assets/stickers/so-happy.webp",
  "/assets/stickers/hahaha.webp",
  "/assets/stickers/wow.webp",
  "/assets/stickers/omg.webp",
  "/assets/stickers/tough-guy.webp",
  "/assets/stickers/verguenza.webp",
  "/assets/stickers/tasty.webp",
  "/assets/stickers/cook.webp",
  "/assets/stickers/working-on-it.webp",
  "/assets/stickers/zzz.webp",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notifications (para futuro push server)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Michi", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Michi", {
      body: data.body ?? "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.tag,
      data: data.data ?? {},
    })
  );
});

// Notification click → focus app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Open new window if app not open
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })
  );
});

// Periodic Background Sync (Chrome/Edge — cuando soporta)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "koru-reminder-check") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        // Notify all open clients to check reminders
        clients.forEach((client) => {
          client.postMessage({ type: "CHECK_REMINDERS" });
        });
      })
    );
  }
});

// Regular sync (fallback)
self.addEventListener("sync", (event) => {
  if (event.tag === "koru-reminder-check") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "CHECK_REMINDERS" });
        });
      })
    );
  }
});
