/*
  sw.js — "Service worker" de la versión web (iPhone y navegador).
  Guarda una copia de la app para que abra aunque no haya internet.
  Siempre intenta primero bajar la versión nueva; si no hay señal, usa la copia.
  No toca las llamadas al servidor de cuentas (esas siempre van por internet).
  En la app de Android (APK) este archivo no se usa.
*/
var VERSION = 'racha-web-4.0.1';
var BASICOS = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'tema.js', 'logic.js', 'config.js', 'api.js', 'sonidos.js', 'camara.js', 'app.js',
  'cuenta.js', 'social.js', 'gym.js', 'reloj.js', 'ajustes.js', 'pwa.js',
  'fonts/nunito.woff2', 'iconos/icono-192.png', 'iconos/apple-touch-icon.png', 'privacypolicy.html'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(BASICOS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nombres) {
      return Promise.all(nombres.filter(function (n) { return n !== VERSION; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var pedido = e.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(pedido).then(function (resp) {
      if (resp.ok) {
        var copia = resp.clone();
        caches.open(VERSION).then(function (c) { c.put(pedido, copia); });
      }
      return resp;
    }).catch(function () {
      return caches.match(pedido, { ignoreSearch: true }).then(function (guardado) {
        if (guardado) return guardado;
        if (pedido.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    })
  );
});
