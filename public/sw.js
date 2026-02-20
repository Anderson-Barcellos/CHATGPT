// Minimal service worker for PWA install prompt
// No offline caching — app requires API connectivity
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);
