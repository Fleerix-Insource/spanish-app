const CACHE_PREFIX = 'espanol';
const CACHE_VERSION = 2;
const CACHE = CACHE_PREFIX + '-v' + CACHE_VERSION;
const URLS = ['index.html','style.css','app.js','curriculum.js','manifest.json','icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith(CACHE_PREFIX)).map(k => caches.delete(k)))).then(() => clients.claim()));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if (res && res.status === 200) { const c = caches.open(CACHE).then(cache => { cache.put(e.request, res.clone()); }); }
    return res;
  })));
});
