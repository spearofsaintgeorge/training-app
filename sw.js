/* Foundation Training System — offline service worker (v3) */
const CACHE = 'argus-training-shell-v3';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const NET_TIMEOUT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Pages: network-first so updates land on the next open with signal; after a few seconds
   without an answer, serve the cached page and let the network refresh the cache behind it.
   Everything else: cache-first. */
function pageResponse(req) {
  return caches.open(CACHE).then(cache => {
    const fallback = () => cache.match(req, {ignoreSearch: true}).then(hit => hit || cache.match('./index.html'));
    const net = fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'}).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') {
        const copy = resp.clone();
        cache.put('./index.html', copy).catch(() => {});
      }
      return resp;
    });
    return new Promise(resolve => {
      let settled = false;
      const finish = r => { if (!settled && r) { settled = true; resolve(r); } };
      const timer = setTimeout(() => { fallback().then(finish); }, NET_TIMEOUT_MS);
      net.then(resp => {
        clearTimeout(timer);
        if (resp.ok) finish(resp);
        else fallback().then(hit => finish(hit || resp));
      }).catch(() => {
        clearTimeout(timer);
        fallback().then(hit => finish(hit || Response.error()));
      });
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) { e.respondWith(pageResponse(req)); return; }
  e.respondWith(
    caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(resp => {
      if (resp && resp.ok && resp.type === 'basic') {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return resp;
    }))
  );
});
