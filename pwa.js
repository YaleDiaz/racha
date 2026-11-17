/*
  pwa.js — Lo que hace falta para usar Racha como app en iPhone (y en cualquier navegador).
  - Registra sw.js para que la app abra aunque no haya internet.
  - En Safari del iPhone, si todavía no la agregaron a la pantalla de inicio,
    muestra una pantalla con los pasos para instalarla.
  En la app de Android (APK) no hace nada.
*/
(function () {
  var cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) return;

  var CLAVE_OCULTO = 'racha.avisoInstalar';

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin copia offline, no pasa nada */ });
    });
  }

  var ua = navigator.userAgent || '';
  var esIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var instalada = navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (esIOS) document.documentElement.classList.add('es-ios');
  if (!esIOS || instalada) return;

  try { if (localStorage.getItem(CLAVE_OCULTO)) return; } catch (e) { /* seguimos */ }

  // Pantalla completa encima de todo (también de la bienvenida), para que
  // la cuenta se cree ya dentro del ícono y no en la pestaña de Safari.
  var t = document.createElement('div');
  t.className = 'pantalla-instalar';
  t.setAttribute('role', 'dialog');
  t.setAttribute('aria-label', 'Instalar Racha');
  t.innerHTML =
    '<div class="instalar-caja">' +
    '<img src="iconos/apple-touch-icon.png" alt="" width="84" height="84">' +
    '<h2>Instala Racha en tu iPhone</h2>' +
    '<p class="nota">Así se abre en pantalla completa, como cualquier app.</p>' +
    '<ol>' +
    '<li><span class="paso">1</span><span>Toca <b>Compartir</b> <span class="icono-compartir" aria-hidden="true"></span> en Safari. Si no lo ves, toca <b>•••</b> primero.</span></li>' +
    '<li><span class="paso">2</span><span>Elige <b>Agregar a inicio</b> y luego <b>Agregar</b>.</span></li>' +
    '<li><span class="paso">3</span><span>Abre Racha desde el ícono nuevo y crea tu cuenta ahí.</span></li>' +
    '</ol>' +
    '<p class="nota">Lo que hagas en esta pestaña de Safari no pasa al ícono.</p>' +
    '<button class="boton boton-plano" type="button">Usar en Safari de todos modos</button>' +
    '</div>';
  t.querySelector('button').addEventListener('click', function () {
    try { localStorage.setItem(CLAVE_OCULTO, '1'); } catch (e) { /* nada */ }
    t.remove();
  });
  document.body.appendChild(t);
})();
