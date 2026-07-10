/* Service Worker لتطبيق "متابع اللوحات" — بيخلي التطبيق يشتغل بدون إنترنت بعد أول زيارة */
const CACHE_NAME = 'plates-tracker-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&family=Tajawal:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // بحث العناوين (Nominatim): دايمًا من الشبكة، مش بنخزنه (بيانات وقت الاستخدام فقط)
  if (/nominatim\.openstreetmap\.org$/.test(url.hostname)) {
    return;
  }

  // بلاطات الخريطة: كاش-أولاً مع تحديث بالخلفية، عشان تظهر تقريبيًا في المناطق اللي اتفتحت قبل كده
  if (/tile\.openstreetmap\.org$/.test(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(req).then(cached => {
          const network = fetch(req).then(res => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // كل حاجة تانية (الواجهة، الخطوط، المكتبات، ملفات قارئ اللغة العربية): كاش-أولاً
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.ok) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
