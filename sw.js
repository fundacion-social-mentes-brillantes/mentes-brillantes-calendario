/* Service Worker - Gestor Mentes Brillantes
 * Estrategia pensada para una app con datos en vivo (Firestore):
 *  - Navegación (HTML): network-first → siempre intenta lo más fresco, cae a caché si no hay red.
 *  - Estáticos mismo-origen (iconos, logos): cache-first con refresco en segundo plano.
 *  - Peticiones cross-origin (Firebase, Google Fonts, CDNs): NO se interceptan (van directo a la red).
 * Subir el número de versión invalida cachés viejas.
 */
const CACHE = 'mb-cal-v2';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32.png',
  '/assets/mentes-brillantes-logo.jpeg',
  '/assets/mentes-brillantes-logo-dorado.jpeg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => { /* si falta algún recurso no abortamos la instalación */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // No interceptar otros orígenes (Firebase / fuentes / CDN): que vayan directo a la red.
  if (url.origin !== self.location.origin) return;

  // Navegación: network-first con respaldo en caché para uso offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    );
    return;
  }

  // Estáticos mismo-origen: cache-first, refrescando en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
