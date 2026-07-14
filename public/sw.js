// Koru Service Worker — notificaciones push y background sync
// Mobile-first: funciona en PWA standalone

const CACHE_NAME = "koru-v1";
const STATIC_ASSETS = ["/", "/index.html", "/favicon.svg"];

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
    data = { title: "Koru", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Koru", {
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
