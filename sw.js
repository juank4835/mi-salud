// ===========================================================
//  Service Worker — caché del esqueleto para uso offline
// ===========================================================
const CACHE = "mi-salud-v12";
const ASSETS = [
  ".",
  "index.html",
  "css/styles.css",
  "manifest.webmanifest",
  "icons/icon.svg",
  "js/app.js",
  "js/ui.js",
  "js/auth.js",
  "js/db.js",
  "js/storage.js",
  "js/firebase.js",
  "js/firebase-config.js",
  "js/views/inicio.js",
  "js/views/medicamentos.js",
  "js/views/citas.js",
  "js/views/examenes.js",
  "js/views/diario.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Solo manejamos peticiones propias (mismo origen). Firebase pasa directo a la red.
  if (url.origin !== location.origin) return;
  if (e.request.method !== "GET") return;

  // RED PRIMERO: con internet siempre traemos lo último (y refrescamos caché).
  // Sin internet, caemos a la copia guardada. Así la app no se queda "vieja".
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match("index.html")))
  );
});
