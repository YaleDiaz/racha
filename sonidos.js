/*
  sonidos.js — Sonidos suaves de la interfaz, hechos con el sintetizador del navegador (Web Audio).
  No usan archivos, así que la app no pesa más. Se apagan en Configuración → Sonidos.

  Sonido.tocar('hecho')   ← nombres disponibles abajo en SONIDOS
*/
(function (raiz) {
  // Cada sonido es una lista de notas: [frecuencia (Hz), cuándo empieza (s), duración (s), forma, volumen]
  var DO6 = 1046.5, MI6 = 1318.5, SOL6 = 1568, LA5 = 880, SI5 = 987.8, MI5 = 659.3, SOL5 = 784, RE6 = 1174.7, DO7 = 2093;
  var SONIDOS = {
    hecho: [[LA5, 0, 0.12], [MI6, 0.07, 0.24]],                                   // "ding-ding" al marcar
    desmarcar: [[MI5, 0, 0.1, 'triangle', 0.08]],
    foto: [[DO6, 0, 0.07], [SOL6, 0.05, 0.18]],
    dia: [[DO6, 0, 0.12], [MI6, 0.09, 0.12], [SOL6, 0.18, 0.12], [DO7, 0.27, 0.42]], // día completo
    logro: [[SOL5, 0, 0.1], [SI5, 0.08, 0.1], [RE6, 0.16, 0.1], [SOL6, 0.24, 0.4]],
    nivel: [[SOL5, 0, 0.14, 'triangle'], [DO6, 0.12, 0.14, 'triangle'], [MI6, 0.24, 0.14, 'triangle'], [SOL6, 0.36, 0.5, 'triangle']],
    record: [[MI6, 0, 0.09], [SOL6, 0.08, 0.09], [DO7, 0.16, 0.38], [MI6, 0.16, 0.38, 'triangle', 0.06]],
    reto: [[RE6, 0, 0.1], [SOL6, 0.09, 0.1], [RE6, 0.18, 0.1], [SOL6, 0.27, 0.4]],
    meta: [[MI6, 0, 0.1], [SOL6, 0.1, 0.32]],
    escudo: [[330, 0, 0.18, 'triangle'], [494, 0.12, 0.3, 'triangle']],
    medalla: [[DO6, 0, 0.12], [MI6, 0.1, 0.12], [SOL6, 0.2, 0.12], [DO7, 0.3, 0.2], [SOL6, 0.48, 0.12], [DO7, 0.58, 0.5]],
    aviso: [[SI5, 0, 0.09, 'sine', 0.09], [MI6, 0.08, 0.2, 'sine', 0.09]],
    descanso: [[LA5, 0, 0.14], [LA5, 0.28, 0.14], [MI6, 0.56, 0.36]],
    error: [[300, 0, 0.12, 'triangle', 0.09], [240, 0.1, 0.18, 'triangle', 0.09]]
  };

  var contexto = null;
  var activo = true;

  function obtenerContexto() {
    var Clase = raiz.AudioContext || raiz.webkitAudioContext;
    if (!Clase) return null;
    if (!contexto) {
      try { contexto = new Clase(); } catch (e) { return null; }
    }
    if (contexto.state === 'suspended' && contexto.resume) contexto.resume().catch(function () {});
    return contexto;
  }

  // Una nota con "ataque" rápido y caída suave, para que suene redondo y no chillón
  function nota(ctx, frecuencia, inicio, duracion, forma, volumen) {
    var t = ctx.currentTime + 0.01 + inicio;
    var osc = ctx.createOscillator();
    var gan = ctx.createGain();
    osc.type = forma || 'sine';
    osc.frequency.setValueAtTime(frecuencia, t);
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(volumen || 0.13, t + 0.012);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(gan);
    gan.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duracion + 0.05);
  }

  function tocar(nombre) {
    if (!activo) return;
    var notas = SONIDOS[nombre];
    if (!notas) return;
    var ctx = obtenerContexto();
    if (!ctx) return;
    try {
      notas.forEach(function (n) { nota(ctx, n[0], n[1], n[2], n[3], n[4]); });
    } catch (e) { /* si el teléfono no deja reproducir, no pasa nada */ }
  }

  raiz.Sonido = {
    tocar: tocar,
    activar: function (si) { activo = !!si; },
    nombres: Object.keys(SONIDOS)
  };
})(this);
