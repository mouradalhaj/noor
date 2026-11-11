/* نور — Service Worker (v3.5.0)
   الاستراتيجية:
   - index.html (التنقل): شبكة أولًا network-first — تحديثات التطبيق الدورية تصل فورًا عند توفر النت،
     والنسخة المخزنة تُستخدم فقط عند انقطاع الاتصال.
   - الموارد الأخرى (الخطوط وغيرها): الكاش أولًا مع تحديث في الخلفية (stale-while-revalidate).
   لذلك لا يحتاج هذا الملف إلى أي تعديل مع كل تحديث — اسم الكاش ثابت والتنظيف تلقائي. */
const CACHE = 'noor-v3.5.0';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  // صفحة التطبيق: شبكة أولًا مع بديل دون اتصال
  if (req.mode === 'navigate' || (sameOrigin && /\/index\.html$/.test(url.pathname))) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', cp)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // البقية: كاش أولًا + تحديث في الخلفية
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const cp = res.clone();
            caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
