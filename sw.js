// Argus service worker — keeps the app itself available offline.
// Map tiles are cached by the page (js/map.js), not here.
const VERSION = "argus-app-v1.0.1";
const FILES = [
	"./", "index.html", "css/app.css", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
	"vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
	"vendor/leaflet/images/marker-icon.png", "vendor/leaflet/images/marker-shadow.png", "vendor/leaflet/images/layers.png",
	"data/signatures.js", "data/companies.js", "data/fastpair.js",
	"js/native.js", "js/util.js", "js/i18n.js", "js/store.js", "js/signatures.js", "js/decode.js", "js/geo.js", "js/scanner.js",
	"js/alerts.js", "js/reports.js", "js/map.js", "js/hunt.js", "js/ui.js", "js/app.js",
];

self.addEventListener("install", (e) => {
	e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
	e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("argus-app-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// App files: network first (so updates arrive), cache when offline.
self.addEventListener("fetch", (e) => {
	const url = new URL(e.request.url);
	if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
	e.respondWith(fetch(e.request).then((res) => {
		if (res.ok) {
			const copy = res.clone();
			caches.open(VERSION).then((c) => c.put(e.request, copy));
		}
		return res;
	}).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
