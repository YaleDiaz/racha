/*
  tema.js — Pone el modo claro u oscuro ANTES de dibujar la pantalla,
  para que no se vea un destello blanco al abrir la app en modo oscuro.
*/
(function () {
  var tema = 'auto';
  try { tema = (JSON.parse(localStorage.getItem('racha.ajustes')) || {}).tema || 'auto'; } catch (e) { /* sin ajustes guardados */ }
  if (tema === 'auto') {
    tema = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }
  document.documentElement.setAttribute('data-tema', tema);
})();
