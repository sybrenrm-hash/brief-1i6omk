// App shell: cache-first, bumped by VERSION. Briefs: network-first, cached copy when offline.
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const DATA = "briefs";
const FONTS = "fonts";
const SHELL_FILES = [
  "./", "index.html", "app.css", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("shell-") && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;

  if (url.pathname.includes("/briefs/")) {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(res => { if (res.ok) caches.open(DATA).then(c => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(hit => hit || Response.error()))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() =>
      req.mode === "navigate" ? caches.match("index.html") : Response.error()))
  );
});
