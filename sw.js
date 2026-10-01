/* Cho phép mở ứng dụng khi mất mạng: lưu sẵn các file giao diện trên máy. */
const VERSION = 'v1';
const SHELL_CACHE = 'so-tap-hoa-shell-' + VERSION;
const LIB_CACHE = 'so-tap-hoa-lib-' + VERSION;
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest',
  'js/util.js', 'js/idb.js', 'js/xlsx-lite.js', 'js/sync.js', 'js/views.js', 'js/app.js', 'icons/icon-192.png'];
const LIB_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

const LIB_PRECACHE = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL))
      .then(() => caches.open(LIB_CACHE))
      .then(c => Promise.all(LIB_PRECACHE.map(u => fetch(new Request(u, { mode: 'no-cors' })).then(r => c.put(u, r)).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== LIB_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/supabase/i.test(url.hostname)) return;                       // dữ liệu luôn đi qua mạng
  if (url.origin === location.origin) {                              // file của ứng dụng: dùng bản lưu, cập nhật ngầm
    e.respondWith(caches.open(SHELL_CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const r = await net;
      if (r) return r;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    }));
    return;
  }
  if (LIB_HOSTS.indexOf(url.hostname) >= 0) {                        // thư viện và phông chữ: lưu lần đầu, dùng lại
    e.respondWith(caches.open(LIB_CACHE).then(async cache => {
      const hit = await cache.match(req); if (hit) return hit;
      try { const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }
      catch (err) { return Response.error(); }
    }));
  }
});
