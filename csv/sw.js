// CSV Fix offline cache: always asks GitHub for the newest copy first (skips the phone's HTTP cache),
// falls back to the saved copy when there is no signal in the field.
var V = 'csvfix-v45';
var G = 'csvfix-geoid18'; // geoid tiles: kept across updates, used offline once looked up
var FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png', './favicon-32.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(V).then(function (c) { return c.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); })); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== V && k !== G; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  if (e.request.url.indexOf('/geoid18/') >= 0 || e.request.url.indexOf('/nadcon5/') >= 0) { // never changes: cache first
    e.respondWith(caches.open(G).then(function (c) { return c.match(e.request).then(function (hit) { return hit || fetch(e.request).then(function (r) { if (r.ok) c.put(e.request, r.clone()); return r; }); }); }));
    return;
  }
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(function (r) {
    var copy = r.clone(); caches.open(V).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); }); }));
});
