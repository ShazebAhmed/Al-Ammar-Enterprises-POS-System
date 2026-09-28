// Service worker: when a page cannot load because the phone is offline, show a
// friendly offline page instead of the browser's error. Nothing else is cached,
// so prices, stock and orders always come fresh from the server.
const CACHE = "alammar-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});

// Order notifications (see lib/push.js). The message is JSON:
// { title, body, url, tag }. The admin panel's address shows the Admin app's icon.
const ADMIN = self.location.hostname.startsWith("alammar-admin.");
const ICON = ADMIN ? "/icons/admin-192.png" : "/icons/icon-192.png";
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(
      data.title || (ADMIN ? "Al Ammar Admin" : "Al Ammar Store"),
      {
        body: data.body || "",
        icon: ICON,
        badge: ICON,
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url: data.url || "/" },
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin)
    .href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find((w) => w.url === url);
        if (open) return open.focus();
        // Reuse the open app window (the order the alert is about opens in it).
        const any = windows.find((w) => "navigate" in w);
        if (any) return any.navigate(url).then((w) => (w || any).focus());
        return self.clients.openWindow(url);
      }),
  );
});
