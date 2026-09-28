// Service worker de Agenda Diaria del Asesor.
//
// Estrategia: RED PRIMERO, caché como respaldo — nunca al revés.
// - Si hay internet en el momento de abrir la app, siempre se va a buscar la
//   versión más reciente al servidor (y de paso se actualiza lo guardado).
// - Solo si la red falla (sin datos / sin wifi en ese instante) se usa la
//   última copia guardada, para que al menos abra algo en vez de pantalla
//   negra o el error de "sin conexión" de Chrome.
// Esto evita el problema clásico de las apps con caché: quedarse pegado en
// una versión vieja aunque ya haya una nueva — aquí eso solo pasa mientras
// de verdad no hay señal, y se autocorrige solo en el siguiente open con red.
//
// IMPORTANTE: subir CACHE_VERSION cada vez que se publique un cambio grande,
// para que los cachés viejos se limpien solos en el siguiente open.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `agenda-asesor-${CACHE_VERSION}`;
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png?v=2',
  './icons/icon-512.png?v=2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Solo manejamos GET dentro del mismo origen — todo lo demás (POST al buzón, etc.)
  // pasa de largo tal cual, directo a la red, sin tocarlo.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((networkResp) => {
        // Red disponible: usamos esa respuesta y actualizamos la copia guardada.
        const copy = networkResp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return networkResp;
      })
      .catch(() =>
        // Sin red en este momento: usamos lo último que se guardó.
        // Si tampoco hay nada guardado (primera vez, sin internet), se cae al
        // comportamiento normal del navegador (su propia pantalla de error).
        caches.match(req).then((cached) => cached || Promise.reject('sin caché'))
      )
  );
});
