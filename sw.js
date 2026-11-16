/* نور — Service Worker (v3.9.0)
   الاستراتيجية:
   - index.html (التنقل): شبكة أولًا network-first — تحديثات التطبيق الدورية تصل فورًا عند توفر النت،
     والنسخة المخزنة تُستخدم فقط عند انقطاع الاتصال.
   - الموارد الأخرى (الخطوط وغيرها): الكاش أولًا مع تحديث في الخلفية (stale-while-revalidate).
   من v3.6.0: يُسمّى الكاش باسم الإصدار مع كل تحديث، وعند التفعيل يُنقّى تلقائيًا كلُّ كاشٍ قديم فلا يثقل ذاكرة الأجهزة. */
const CACHE = 'noor-v3.15.0';
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

/* v3.13.0: إشعارات Web Push — تصل بعد إغلاق التطبيق عبر خادم نور الاختياري */
const NOTIF_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="#0d261d"/><circle cx="96" cy="96" r="58" fill="none" stroke="#d9b661" stroke-width="7"/><circle cx="96" cy="96" r="7" fill="#f2d992"/><path d="M96 52v14M96 126v14M52 96h14M126 96h14" stroke="#f2d992" stroke-width="7" stroke-linecap="round"/></svg>'
  );

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { try { d = { title: 'نور', body: e.data ? e.data.text() : '' }; } catch (_2) {} }
  e.waitUntil(
    self.registration.showNotification(d.title || 'نور', {
      body: d.body || 'به نورٍ تسير — نور في جيبك',
      tag: d.tag || 'noor',
      icon: NOTIF_ICON,
      badge: NOTIF_ICON,
      renotify: true,
      data: { url: './' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});

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
