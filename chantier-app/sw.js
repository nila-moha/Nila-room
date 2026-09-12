// Service worker — permet d'ouvrir l'app (l'écran, les menus) même sans
// connexion. Les données elles-mêmes (projets, avancement, etc.) sont
// mises en cache séparément par Firestore (voir js/app.js,
// enablePersistence) — ce fichier ne s'occupe que de l'app elle-même.

const CACHE_NAME = 'bn-core-chantier-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/firebase-config.js',
  './js/logo-base64.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle our own app-shell files. Everything else (Firebase SDK,
  // Firestore/Storage traffic, Google Fonts) goes straight to the network —
  // Firestore already manages its own offline cache internally.
  if (url.origin !== location.origin) return;

  // Network first: whenever online, always fetch the latest app-shell
  // files so a new deploy is visible on the very next load, instead of
  // showing the cached (possibly outdated) version first and only
  // refreshing it in the background for the load after that. The cache
  // is only used as a fallback when there is no network at all.
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
