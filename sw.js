/* Cache-first for the shell, network-only for everything else.
   The shell is one file, so "stale shell" is the only failure mode that matters: BUILD_ID
   below changes on every build, which renames the cache and evicts the old one. Never
   intercept the Apps Script origin -- those are POSTs carrying sales. */
var BUILD = '0ff69b49f039';
var CACHE = 'croma-pos-' + BUILD;
var SHELL = ['./', 'index.html', 'manifest.webmanifest'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;                                  // sales are POSTs
  if (r.url.indexOf('script.google.com') !== -1) return;           // never cache the API
  if (r.url.indexOf('script.googleusercontent.com') !== -1) return;
  e.respondWith(caches.match(r).then(function (hit) {
    if (hit) return hit;
    return fetch(r).then(function (res) {
      // Only the shell is precached; opportunistically keep same-origin GETs (nothing
      // else is same-origin today, but a future asset should not need a code change).
      if (res && res.ok && r.url.indexOf(self.location.origin) === 0) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(r, copy); });
      }
      return res;
    });
  }));
});
