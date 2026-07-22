// Minimal service worker. Chrome will not treat the app as installable (no
// home-screen launch in standalone mode) unless one is registered with a fetch
// handler, so this exists purely to satisfy that.
//
// It deliberately caches NOTHING. A stale cached bundle served to a judge
// mid-demo is a far worse failure than one extra network round-trip, and the
// app is useless offline anyway — every drill needs the backend.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
