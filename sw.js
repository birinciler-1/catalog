/* Service Worker: يجعل التطبيق يعمل بدون إنترنت
   - ملفات التطبيق: تُعرض من الذاكرة فوراً وتتحدث في الخلفية
   - data/products.json (الأسعار): الشبكة أولاً، وإن لم يوجد إنترنت تُعرض آخر نسخة محفوظة
   - الصور: تُحفظ عند أول عرض وتبقى (تتبقى بين التحديثات)
   غيّر VERSION عند تعديل ملفات التطبيق نفسها لإجبار التحديث. */
const VERSION = '2026-11-07.1';
const SHELL_CACHE = 'shell-' + VERSION;
const IMG_CACHE = 'images-v1';
const DATA_CACHE = 'data-v1';
const LIB_CACHE = 'lib-v1';
const QR_LIB = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';   // قارئ الباركود: يُحفظ ليعمل بدون إنترنت
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL_CACHE)).addAll(SHELL);
    try {                                                     // محاولة حفظ مكتبة الباركود (لا تُفشل التثبيت إن لم يتوفر إنترنت)
      const lc = await caches.open(LIB_CACHE);
      if (!(await lc.match(QR_LIB))) { const r = await fetch(QR_LIB, { mode: 'cors', credentials: 'omit' }); if (r.ok) await lc.put(QR_LIB, r); }
    } catch (err) { /* ستُحفظ عند أول استعمال */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('shell-') && k !== SHELL_CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'unpkg.com' && url.pathname.includes('html5-qrcode')) return e.respondWith(libFirst(req));
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/data/products.json')) {
    e.respondWith(networkFirst(req, DATA_CACHE, 15000));
  } else if (url.pathname.includes('/images/')) {
    e.respondWith(cacheFirst(req, IMG_CACHE));
  } else {
    e.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
  }
});

async function networkFirst(req, cacheName, ms) {
  const cache = await caches.open(cacheName);
  const key = new URL(req.url); key.search = '';
  const net = fetch(req).then(res => {
    if (res.ok) cache.put(key.href, res.clone());
    return res;
  });
  const cached = await cache.match(key.href);
  if (!cached) return net;
  return Promise.race([
    net.catch(() => cached),
    new Promise(r => setTimeout(() => r(cached), ms))
  ]);
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) return hit;
  const res = await net;
  if (res) return res;
  if (req.mode === 'navigate') {
    const home = await cache.match('index.html');
    if (home) return home;
  }
  return new Response('', { status: 504 });
}

async function libFirst(req) {
  const cache = await caches.open(LIB_CACHE);
  const hit = await cache.match(QR_LIB);
  if (hit) return hit;
  let res;
  try { res = await fetch(QR_LIB, { mode: 'cors', credentials: 'omit' }); } catch { res = await fetch(req); }
  if (res && res.ok) cache.put(QR_LIB, res.clone()).catch(() => { });
  return res;
}
