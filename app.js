/*
  app.js — Todo lo que se ve y se toca en la pantalla principal.
  Flujo general:  estado (datos)  ->  pintar() dibuja  ->  tocas algo  ->  cambia el estado  ->  guardar() y pintar()

  Otras pantallas viven en su propio archivo:
    gym.js (Entrenar), social.js (Novedades y Liga), cuenta.js (cuenta y amigos),
    reloj.js (Health Connect) y ajustes.js (Configuración).
*/
(function () {
  var L = window.Logica;

  // ---------- Opciones para personalizar ----------
  var EMOJIS = ['💧', '📚', '🏃', '🏋️', '🧘', '🥗', '😴', '✍️', '💻', '🎸', '🎨', '🧹', '🦷', '🌱', '☀️', '💰'];
  var COLORES = ['#6C4DF5', '#FF8A1F', '#12B886', '#F0438F', '#1C9CF6', '#F5B400'];
  var DIAS = [ // en el orden en que se muestran (lunes primero)
    { n: 1, letra: 'L' }, { n: 2, letra: 'M' }, { n: 3, letra: 'M' }, { n: 4, letra: 'J' },
    { n: 5, letra: 'V' }, { n: 6, letra: 'S' }, { n: 0, letra: 'D' }
  ];
  var SUGERENCIAS = [
    { nombre: 'Tomar agua', emoji: '💧', color: '#1C9CF6' },
    { nombre: 'Leer 10 minutos', emoji: '📚', color: '#6C4DF5' },
    { nombre: 'Hacer ejercicio', emoji: '🏋️', color: '#FF8A1F' },
    { nombre: 'Dormir temprano', emoji: '😴', color: '#12B886' }
  ];
  var DEPORTES = [
    { id: 'gym', nombre: 'Gym', emoji: '🏋️' }, { id: 'correr', nombre: 'Correr', emoji: '🏃' },
    { id: 'futbol', nombre: 'Fútbol', emoji: '⚽' }, { id: 'bici', nombre: 'Bici', emoji: '🚴' },
    { id: 'natacion', nombre: 'Natación', emoji: '🏊' }, { id: 'box', nombre: 'Box', emoji: '🥊' },
    { id: 'basquet', nombre: 'Básquet', emoji: '🏀' }, { id: 'yoga', nombre: 'Yoga', emoji: '🧘' },
    { id: 'caminar', nombre: 'Caminar', emoji: '🚶' }, { id: 'otro', nombre: 'Otro', emoji: '🎯' }
  ];
  var MINUTOS = [15, 30, 45, 60, 90, 120];
  var AVATARES = ['🔥', '😎', '🦁', '🐺', '🦅', '🐯', '🤖', '👑', '⚡', '🌟', '💪', '🧠', '🐉', '🦊', '🥷', '🚀'];
  var METAS = [{ n: 20, t: 'Tranqui' }, { n: 50, t: 'Normal' }, { n: 100, t: 'En serio' }, { n: 150, t: 'Intensa' }];
  var PASOS = [0, 5000, 8000, 10000, 12000];
  var HITOS_RACHA = [7, 14, 30, 50, 100, 150, 200, 365];
  var MAX_ESCUDOS = 2;

  // Dibujo de la mascota (una flamita). Es un SVG, por eso se ve nítido en cualquier tamaño.
  var FLAMA = '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<path d="M52 5c4 17 27 28 27 55 0 19-13 34-29 34S21 79 21 60c0-13 7-22 14-30 1 9 5 14 10 14-3-13 0-28 7-39z" fill="#FF8A1F"/>' +
    '<path d="M50 44c7 9 17 15 17 28 0 12-8 20-17 20s-17-8-17-20c0-13 10-19 17-28z" fill="#FFD43B"/>' +
    '<ellipse cx="43" cy="69" rx="3.4" ry="4.6" fill="#241C3F"/><ellipse cx="57" cy="69" rx="3.4" ry="4.6" fill="#241C3F"/>' +
    '<path d="M44 78q6 6 12 0" fill="none" stroke="#241C3F" stroke-width="3" stroke-linecap="round"/></svg>';
  var PALOMITA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var CAMARA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.6" r="3.4"/></svg>';
  var ENGRANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/>' +
    '<path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4z"/></svg>';

  // ---------- Datos guardados en el teléfono ----------
  var CLAVE_GUARDADO = 'racha.v1';
  var estado = cargar();
  var vista = 'hoy';
  var mesVisto = null;      // mes que se ve en el calendario
  var borrador = null;      // hábito que se está creando o editando
  var borradorEntreno = null; // entrenamiento que se está registrando
  var colaCelebra = [];     // celebraciones pendientes de mostrar

  function estadoVacio() {
    return normalizar({ habitos: [], celebrado: null, entrenos: [], perfil: { nombre: '', avatar: '🔥' }, logrosVistos: [] });
  }
  // Completa datos de versiones anteriores de la app (o de un respaldo) con lo que les falte
  function normalizar(datos) {
    if (!datos || !Array.isArray(datos.habitos)) return null;
    if (!Array.isArray(datos.entrenos)) datos.entrenos = [];
    if (!datos.perfil) datos.perfil = { nombre: '', avatar: '🔥' };
    // Versión 4: escudos, retos, gym con rutinas, peso, medallas y meta diaria
    if (!datos.congelados || typeof datos.congelados !== 'object') datos.congelados = {};
    if (typeof datos.escudos !== 'number') datos.escudos = 1; // regalo de bienvenida
    ['retos', 'sesiones', 'rutinas', 'pesos', 'medallas'].forEach(function (k) {
      if (!Array.isArray(datos[k])) datos[k] = [];
    });
    if (!datos.metaXP) datos.metaXP = 50;
    datos.habitos.forEach(function (h) { if (!h.fotos || typeof h.fotos !== 'object') h.fotos = {}; });
    return datos;
  }
  function cargar() {
    try {
      var datos = normalizar(JSON.parse(localStorage.getItem(CLAVE_GUARDADO)));
      if (datos) return datos;
    } catch (e) { /* si no hay nada guardado, empezamos de cero */ }
    return estadoVacio();
  }
  function guardar() {
    try { localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(estado)); } catch (e) { /* sin espacio: seguimos en memoria */ }
    // Avisa a cuenta.js para que respalde los cambios en el servidor
    document.dispatchEvent(new Event('racha:guardado'));
  }

  // ---------- Configuración (ajustes.js la muestra en pantalla) ----------
  var CLAVE_AJUSTES = 'racha.ajustes';
  var ajustes = cargarAjustes();
  function cargarAjustes() {
    var base = { tema: 'auto', vibracion: true, recordatorios: true, mostrarEnLinea: true, sonidos: true, retos: true, avisosAmigos: true, reloj: false };
    try {
      var guardados = JSON.parse(localStorage.getItem(CLAVE_AJUSTES)) || {};
      Object.keys(base).forEach(function (k) { if (guardados[k] !== undefined) base[k] = guardados[k]; });
    } catch (e) { /* valores por defecto */ }
    return base;
  }
  function guardarAjustes() {
    try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin espacio */ }
    if (window.Sonido) window.Sonido.activar(ajustes.sonidos);
  }
  if (window.Sonido) window.Sonido.activar(ajustes.sonidos);

  // Número de amigos (lo guarda cuenta.js al iniciar sesión); cada uno da 25 puntos
  function numAmigos() {
    var s = window.Api && window.Api.sesion();
    return (s && s.token && s.amigos) || 0;
  }

  // ---------- Botón "atrás" de Android ----------
  // Cada hoja o pantalla que se abre encima guarda aquí cómo cerrarse.
  // Así "atrás" cierra lo de encima en lugar de salir de la app.
  var pila = [];
  function abrirCapa(cerrar) {
    pila.push(cerrar);
    history.pushState({ capa: pila.length }, '');
  }
  function cerrarCapa() {
    if (pila.length) history.back(); // el evento popstate de abajo hace el cierre
  }
  window.addEventListener('popstate', function () {
    var cerrar = pila.pop();
    if (cerrar) cerrar();
  });

  // ---------- Ayudantes ----------
  function $(id) { return document.getElementById(id); }
  // Crea un elemento HTML. Usa textContent para que lo que escriba el usuario nunca se ejecute como código.
  function crear(etiqueta, clase, texto) {
    var el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }
  function boton(texto, clase, alTocar) {
    var b = crear('button', clase, texto);
    b.type = 'button';
    if (alTocar) b.addEventListener('click', alTocar);
    return b;
  }
  function hoy() { return new Date(); }
  function claveHoy() { return L.clave(hoy()); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function miles(n) { return Math.round(n).toLocaleString('es-MX'); }
  function ahoraSegundos() { return Math.floor(Date.now() / 1000); }
  var relojAviso = null;
  function avisar(texto) {
    var caja = $('aviso');
    caja.textContent = texto;
    caja.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(function () { caja.hidden = true; }, 4000);
  }
  function vibrar(ms) {
    if (!ajustes.vibracion) return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no pasa nada */ }
  }
  function sonar(nombre) {
    if (ajustes.sonidos && window.Sonido && !document.hidden) window.Sonido.tocar(nombre);
  }
  // Publicar en Novedades (social.js se encarga de mandarlo cuando haya internet)
  function publicar(datos) { if (window.Social) window.Social.publicar(datos); }
  function borrarPublicacion(clave) { if (window.Social) window.Social.borrar(clave); }

  // Datos que usan las rachas y los logros
  function congelados() { return estado.congelados; }
  function rachaGeneral(fecha) { return L.rachaGeneral(estado.habitos, fecha || hoy(), estado.congelados); }
  function extraLogros() {
    return {
      congelados: estado.congelados,
      retos: estado.retos.length,
      records: L.records(estado.sesiones).length,
      medallas: estado.medallas.length
    };
  }
  function xpTotal() { return L.xpTotal(estado, numAmigos()); }
  function nivelActual() { return L.nivel(xpTotal()).nivel; }
  function puntosHoy() { var k = claveHoy(); return L.puntosDe(estado, k, k); }
  // Puntos de una semana: atras = 0 es esta semana, 1 la pasada…
  function lunesDe(atras) { return L.sumarDias(L.lunes(hoy()), -7 * (atras || 0)); }
  function puntosSemana(atras) {
    var lun = lunesDe(atras);
    return L.puntosDe(estado, L.clave(lun), L.clave(L.sumarDias(lun, 6)));
  }

  // Gráfica de línea sencilla. puntos = [{ etiqueta: "12 nov", valor: 72.4 }]
  function grafica(puntos, opciones) {
    var op = opciones || {};
    var caja = crear('div', 'grafica');
    if (puntos.length < 2) {
      caja.appendChild(crear('p', 'nota', op.vacia || 'Registra al menos 2 datos para ver tu gráfica.'));
      return caja;
    }
    var W = 320, H = 130, mx = 10, arriba = 16, abajo = 22;
    var valores = puntos.map(function (p) { return p.valor; });
    var min = Math.min.apply(null, valores), max = Math.max.apply(null, valores);
    if (max === min) { max += 1; min -= 1; }
    var x = function (i) { return mx + (i * (W - 2 * mx)) / (puntos.length - 1); };
    var y = function (v) { return arriba + ((max - v) * (H - arriba - abajo)) / (max - min); };
    var linea = puntos.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p.valor).toFixed(1); }).join(' ');
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('class', 'grafica-svg');
    function el(nombre, attrs, texto) {
      var e = document.createElementNS(ns, nombre);
      Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      if (texto !== undefined) e.textContent = texto;
      svg.appendChild(e);
      return e;
    }
    el('polyline', { points: linea, 'class': 'grafica-linea' });
    puntos.forEach(function (p, i) {
      el('circle', { cx: x(i), cy: y(p.valor), r: i === puntos.length - 1 ? 4.5 : 3, 'class': 'grafica-punto' });
    });
    var ultimo = puntos[puntos.length - 1];
    el('text', { x: W - mx, y: 11, 'text-anchor': 'end', 'class': 'grafica-max' }, 'máx ' + max.toLocaleString('es-MX') + (op.unidad || ''));
    el('text', { x: mx, y: H - 4, 'class': 'grafica-eje' }, puntos[0].etiqueta);
    el('text', { x: W - mx, y: H - 4, 'text-anchor': 'end', 'class': 'grafica-eje' }, ultimo.etiqueta);
    caja.appendChild(svg);
    return caja;
  }

  // ---------- Notificaciones del teléfono ----------
  // El plugin de notificaciones solo existe dentro de la app instalada (APK).
  // En el navegador de la computadora regresa null y simplemente no se programa nada.
  function notificaciones() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.LocalNotifications) || null;
  }

  // Canales de Android: cada uno con su propio sonido (los archivos están en res/raw)
  var canalesListos = null;
  function crearCanales() {
    var plugin = notificaciones();
    if (!plugin || !plugin.createChannel) return Promise.resolve();
    if (!canalesListos) {
      canalesListos = Promise.all([
        plugin.createChannel({ id: 'recordatorios', name: 'Recordatorios', description: 'Avisos de tus hábitos y de tu racha', importance: 4, sound: 'racha_aviso.wav', vibration: true, visibility: 1 }),
        plugin.createChannel({ id: 'retos', name: 'Retos sorpresa', description: 'Retos pequeños que dan puntos extra', importance: 4, sound: 'racha_reto.wav', vibration: true, visibility: 1 })
      ]).catch(function () { /* en teléfonos viejos no hay canales */ });
    }
    return canalesListos;
  }

  // Un aviso por cada día que toca de cada hábito con hora.
  function listaDeAvisos() {
    var lista = [];
    estado.habitos.forEach(function (h) {
      if (!h.hora) return;
      if (!h.nid) { estado.sigNid = (estado.sigNid || 0) + 1; h.nid = estado.sigNid; }
      var partes = h.hora.split(':');
      h.dias.forEach(function (dia) {
        lista.push({
          id: h.nid * 10 + dia,                       // número único por hábito y día
          title: h.emoji + ' ' + h.nombre,
          body: 'Es hora de cuidar tu racha 🔥',
          channelId: 'recordatorios',
          schedule: {
            on: { weekday: dia + 1, hour: Number(partes[0]), minute: Number(partes[1]) }, // el plugin cuenta domingo = 1
            allowWhileIdle: true
          },
          isExactNotification: false                  // así Android no pide un permiso extra de "alarmas"
        });
      });
    });
    return lista;
  }

  // Si hoy no has hecho nada y tienes racha, te avisa a las 8 de la noche
  function avisoDePeligro() {
    var ahora = hoy();
    var racha = rachaGeneral();
    var limite = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 20, 0, 0);
    if (racha === 0 || L.algoHecho(estado.habitos, ahora) || ahora >= limite) return [];
    return [{
      id: 8000001,
      title: '🔥 ¡Tu racha de ' + plural(racha, 'día', 'días') + ' está en peligro!',
      body: estado.escudos > 0 ? 'Completa un hábito hoy. Tienes un escudo 🛡️, pero mejor no gastarlo.' : 'Completa al menos un hábito antes de que acabe el día.',
      channelId: 'recordatorios',
      schedule: { at: limite, allowWhileIdle: true }
    }];
  }

  // Retos sorpresa de los próximos 14 días (salen a horas distintas)
  function listaDeRetos() {
    if (!ajustes.retos) return [];
    var lista = [];
    var ahora = hoy();
    for (var i = 0; i < 14; i++) {
      var dia = L.sumarDias(ahora, i);
      var r = L.retoDelDia(dia);
      if (!r) continue;
      if (estado.retos.some(function (x) { return x.fecha === r.fecha; })) continue;
      var p = r.hora.split(':');
      var momento = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), Number(p[0]), Number(p[1]), 0);
      if (momento <= ahora) continue;
      lista.push({
        id: 9000000 + Number(r.fecha.replace(/-/g, '').slice(2)),
        title: '⚡ Reto sorpresa: ' + r.texto,
        body: 'Gana ' + r.puntos + ' puntos. Sube tu foto como evidencia antes de que acabe el día.',
        channelId: 'retos',
        schedule: { at: momento, allowWhileIdle: true },
        extra: { tipo: 'reto', fecha: r.fecha }
      });
    }
    return lista;
  }

  // Borra los avisos anteriores y vuelve a programar todo (recordatorios, peligro y retos).
  function programarRecordatorios(avisarSiFalla) {
    var plugin = notificaciones();
    if (!plugin) return Promise.resolve();
    // Si apagaste los recordatorios en Configuración, solo quedan los retos
    var lista = (ajustes.recordatorios ? listaDeAvisos().concat(avisoDePeligro()) : []).concat(listaDeRetos());
    guardar();
    return crearCanales()
      .then(function () { return plugin.getPending(); })
      .then(function (r) {
        var pendientes = (r && r.notifications) || [];
        if (pendientes.length) return plugin.cancel({ notifications: pendientes.map(function (n) { return { id: n.id }; }) });
      })
      .then(function () { if (lista.length) return plugin.requestPermissions(); })
      .then(function (permiso) {
        if (!lista.length) return;
        if (permiso && permiso.display !== 'granted') {
          if (avisarSiFalla) avisar('Activa las notificaciones de Racha en los ajustes del teléfono para recibir recordatorios.');
          return;
        }
        return plugin.schedule({ notifications: lista });
      })
      .catch(function () {
        if (avisarSiFalla) avisar('No se pudo programar el recordatorio.');
      });
  }
  // Lo mismo, pero espera un poco (para no reprogramar en cada toque)
  var relojProgramar = null;
  function programarPronto() {
    clearTimeout(relojProgramar);
    relojProgramar = setTimeout(function () { programarRecordatorios(false); }, 2000);
  }

  // ---------- Escudos ----------
  // Si un día no hiciste nada, un escudo lo "congela" para que no se rompa tu racha.
  // Se revisa al abrir la app: de ayer hacia atrás (máximo 2 semanas) desde la última revisión.
  function revisarEscudos() {
    var ayer = L.sumarDias(hoy(), -1);
    var kAyer = L.clave(ayer);
    if (estado.escudosRevisado === kAyer) return;
    var desde = estado.escudosRevisado ? L.sumarDias(L.aFecha(estado.escudosRevisado), 1) : ayer;
    var limite = L.sumarDias(hoy(), -14);
    if (desde < limite) desde = limite;
    var usados = [];
    for (var d = desde; L.clave(d) <= kAyer; d = L.sumarDias(d, 1)) {
      if (!estado.habitos.length || !L.necesitaEscudo(estado.habitos, d, estado.congelados)) continue;
      if (estado.escudos <= 0) break; // sin escudos la racha se rompe; ya no hace falta revisar más
      estado.escudos--;
      estado.congelados[L.clave(d)] = true;
      usados.push(d);
    }
    estado.escudosRevisado = kAyer;
    guardar();
    if (usados.length) {
      colaCelebra.push({
        titulo: '¡Tu escudo te salvó!', emoji: '🛡️', sonido: 'escudo',
        texto: (usados.length === 1 ? 'El ' + usados[0].toLocaleDateString('es-MX', { weekday: 'long' }) + ' no hiciste ningún hábito'
          : usados.length + ' días no hiciste ningún hábito') + ', pero tu racha de ' + plural(rachaGeneral(), 'día', 'días') + ' sigue viva.'
      });
    }
  }

  // Cada 7 días de racha ganas un escudo (máximo 2 guardados)
  function revisarPremioEscudo() {
    var k = claveHoy();
    var racha = rachaGeneral();
    if (racha > 0 && racha % 7 === 0 && estado.escudoPremio !== k) {
      estado.escudoPremio = k;
      if (estado.escudos < MAX_ESCUDOS) {
        estado.escudos++;
        colaCelebra.push({ titulo: '¡Ganaste un escudo!', emoji: '🛡️', sonido: 'escudo', texto: 'Por tus ' + racha + ' días de racha. Si un día no puedes, cuidará tu racha.' });
      }
    }
  }

  function abrirInfoEscudos() {
    abrirHojaGenerica(function (hoja) {
      var caja = crear('div', 'centrada');
      caja.appendChild(crear('span', 'emoji-grande', '🛡️'));
      caja.appendChild(crear('h2', '', plural(estado.escudos, 'escudo', 'escudos')));
      caja.appendChild(crear('p', 'nota', 'Si un día no haces ningún hábito, un escudo se usa solo y tu racha no se rompe.'));
      caja.appendChild(crear('p', 'nota', 'Ganas 1 escudo cada 7 días de racha. Puedes guardar hasta ' + MAX_ESCUDOS + '.'));
      var dias = Object.keys(estado.congelados).sort().reverse().slice(0, 5);
      if (dias.length) {
        caja.appendChild(crear('p', 'nota', 'Días que cuidó un escudo: ' + dias.map(function (k) {
          return L.aFecha(k).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
        }).join(', ')));
      }
      caja.appendChild(boton('Entendido', 'boton boton-principal', cerrarCapa));
      hoja.appendChild(caja);
    });
  }

  // ---------- Pantalla HOY ----------
  function pintarHoy() {
    var fecha = hoy();
    var habitos = estado.habitos;

    $('fecha-hoy').textContent = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

    var racha = rachaGeneral(fecha);
    $('racha-general').textContent = racha;
    $('pastilla-racha').classList.toggle('apagada', racha === 0);
    $('pastilla-escudo').hidden = habitos.length === 0;
    $('num-escudos').textContent = estado.escudos;
    $('pastilla-escudo').classList.toggle('apagada', estado.escudos === 0);

    // Semana (lunes a domingo)
    var semana = $('semana');
    semana.textContent = '';
    var lunes = L.lunes(fecha);
    DIAS.forEach(function (d, i) {
      var dia = L.sumarDias(lunes, i);
      var est = L.estadoDia(habitos, dia);
      var caja = crear('div', 'dia');
      var k = L.clave(dia), kHoy = L.clave(fecha);
      if (k === kHoy) caja.classList.add('hoy');
      if (k > kHoy) caja.classList.add('futuro');
      else if (est.completo) caja.classList.add('completo');
      else if (est.hechos > 0) caja.classList.add('parcial');
      else if (estado.congelados[k]) caja.classList.add('congelado');
      caja.appendChild(crear('span', '', d.letra));
      caja.appendChild(crear('div', 'dia-circulo', estado.congelados[k] && est.hechos === 0 ? '🛡️' : String(dia.getDate())));
      semana.appendChild(caja);
    });

    var progreso = $('progreso-hoy');
    var lista = $('lista-habitos');
    progreso.textContent = '';
    lista.textContent = '';
    pintarMeta();
    pintarReto();

    // Sin hábitos: pantalla de bienvenida
    if (habitos.length === 0) {
      progreso.hidden = true;
      $('meta-hoy').hidden = true;
      var vacio = crear('div', 'vacio');
      var m = crear('span', 'mascota mascota-grande'); m.innerHTML = FLAMA;
      vacio.appendChild(m);
      vacio.appendChild(crear('h2', '', '¡Enciende tu primera racha!'));
      vacio.appendChild(crear('p', '', 'Agrega un hábito con el botón naranja o empieza con una de estas ideas:'));
      var sug = crear('div', 'sugerencias');
      SUGERENCIAS.forEach(function (s) {
        sug.appendChild(boton(s.emoji + ' ' + s.nombre, 'sugerencia', function () {
          estado.habitos.push(nuevoHabito(s.nombre, s.emoji, s.color, [0, 1, 2, 3, 4, 5, 6]));
          guardar(); pintar();
        }));
      });
      vacio.appendChild(sug);
      lista.appendChild(vacio);
      return;
    }

    // Tarjeta de progreso del día
    var est = L.estadoDia(habitos, fecha);
    progreso.hidden = false;
    var mm = crear('span', 'mascota mascota-media'); mm.innerHTML = FLAMA;
    var cont = crear('div', 'contenido');
    var titulo, sub;
    if (est.tocan === 0) { titulo = 'Hoy es día libre'; sub = 'No tienes hábitos programados para hoy.'; }
    else if (est.completo) { titulo = '¡Día completo!'; sub = 'Cumpliste todos tus hábitos de hoy.'; }
    else if (est.hechos === 0) { titulo = '¡Vamos por el primero!'; sub = plural(est.tocan, 'hábito te espera', 'hábitos te esperan') + ' hoy.'; }
    else { titulo = '¡Vas muy bien!'; sub = 'Llevas ' + est.hechos + ' de ' + est.tocan + ' hábitos de hoy.'; }
    cont.appendChild(crear('h2', '', titulo));
    cont.appendChild(crear('p', '', sub));
    var riel = crear('div', 'riel');
    var barra = crear('span');
    barra.style.width = (est.tocan ? Math.round((est.hechos / est.tocan) * 100) : 0) + '%';
    riel.appendChild(barra);
    cont.appendChild(riel);
    progreso.appendChild(mm);
    progreso.appendChild(cont);

    // Hábitos de hoy y los que hoy no tocan
    var tocan = habitos.filter(function (h) { return L.toca(h, fecha) || h.hechos[L.clave(fecha)]; });
    var noTocan = habitos.filter(function (h) { return tocan.indexOf(h) === -1; });
    tocan.forEach(function (h) { lista.appendChild(tarjetaHabito(h, fecha, true)); });
    if (noTocan.length) {
      lista.appendChild(crear('h3', 'titulo-seccion', 'Hoy no tocan'));
      noTocan.forEach(function (h) { lista.appendChild(tarjetaHabito(h, fecha, false)); });
    }
  }

  // Meta diaria de puntos
  function pintarMeta() {
    var caja = $('meta-hoy');
    caja.textContent = '';
    caja.hidden = false;
    var puntos = puntosHoy();
    var meta = estado.metaXP;
    var listo = puntos >= meta;
    caja.classList.toggle('cumplida', listo);
    caja.appendChild(crear('span', 'meta-rayo', listo ? '✅' : '⚡'));
    var cont = crear('span', 'meta-contenido');
    var fila = crear('span', 'meta-fila');
    fila.appendChild(crear('b', '', listo ? '¡Meta diaria cumplida!' : 'Meta diaria'));
    fila.appendChild(crear('span', '', Math.min(puntos, 9999) + ' / ' + meta + ' pts'));
    cont.appendChild(fila);
    var riel = crear('span', 'riel-meta');
    var barra = crear('span');
    barra.style.width = Math.min(100, Math.round((puntos / meta) * 100)) + '%';
    riel.appendChild(barra);
    cont.appendChild(riel);
    caja.appendChild(cont);
    caja.setAttribute('aria-label', 'Meta diaria: ' + puntos + ' de ' + meta + ' puntos. Toca para cambiarla.');
  }

  function abrirMeta() {
    abrirHojaGenerica(function (hoja) {
      hoja.appendChild(crear('h2', '', 'Tu meta diaria'));
      hoja.appendChild(crear('p', 'nota', 'Puntos que quieres ganar cada día. Hábito = 10, foto = +10, entrenamiento = 25, récord = 20 y los retos dan de 100 a 200.'));
      var opciones = crear('div', 'opciones-meta');
      METAS.forEach(function (m) {
        var b = boton('', 'opcion-meta' + (estado.metaXP === m.n ? ' elegido' : ''), function () {
          estado.metaXP = m.n;
          if (puntosHoy() < m.n && estado.metaCumplida === claveHoy()) estado.metaCumplida = null;
          guardar(); pintar(); cerrarCapa();
          avisar('Meta diaria: ' + m.n + ' puntos ⚡');
        });
        b.appendChild(crear('b', '', String(m.n)));
        b.appendChild(crear('span', '', m.t));
        opciones.appendChild(b);
      });
      hoja.appendChild(opciones);
      hoja.appendChild(boton('Cerrar', 'boton boton-plano', cerrarCapa));
    });
  }

  // ---------- Retos sorpresa ----------
  // El reto de hoy ya está disponible si pasó su hora (y si no apagaste los retos)
  function retoDeHoy() {
    if (!ajustes.retos) return null;
    var ahora = hoy();
    var r = L.retoDelDia(ahora);
    if (!r) return null;
    var p = r.hora.split(':');
    if (ahora.getHours() * 60 + ahora.getMinutes() < Number(p[0]) * 60 + Number(p[1])) return null; // todavía es sorpresa
    r.hecho = estado.retos.some(function (x) { return x.fecha === r.fecha; });
    return r;
  }

  function pintarReto() {
    var caja = $('reto-hoy');
    caja.textContent = '';
    var r = retoDeHoy();
    caja.hidden = !r;
    if (!r) return;
    caja.className = 'tarjeta-reto' + (r.hecho ? ' hecho' : '');
    var arriba = crear('div', 'reto-arriba');
    arriba.appendChild(crear('span', 'reto-etiqueta', r.hecho ? '✓ Reto completado' : '⚡ Reto sorpresa'));
    arriba.appendChild(crear('span', 'reto-puntos', '+' + r.puntos + ' pts'));
    caja.appendChild(arriba);
    var medio = crear('div', 'reto-medio');
    medio.appendChild(crear('span', 'reto-emoji', r.emoji));
    var textos = crear('div', 'reto-texto');
    textos.appendChild(crear('b', '', r.texto));
    textos.appendChild(crear('span', '', r.hecho ? 'Tus amigos ya pueden ver tu evidencia.' : 'Sube una foto como evidencia antes de que acabe el día.'));
    medio.appendChild(textos);
    caja.appendChild(medio);
    if (!r.hecho) {
      var b = boton('', 'boton boton-blanco', function () { completarReto(r, b); });
      b.innerHTML = CAMARA;
      b.appendChild(crear('span', '', 'Subir evidencia'));
      caja.appendChild(b);
    }
  }

  function completarReto(r, btn) {
    if (btn) btn.disabled = true;
    window.Camara.tomar().then(function (foto) {
      var nivelAntes = nivelActual();
      estado.retos.push({ id: r.id, fecha: r.fecha, puntos: r.puntos, texto: r.texto, emoji: r.emoji, momento: Date.now() });
      publicar({ clave: 'r:' + r.fecha, tipo: 'reto', titulo: 'completó el reto: ' + r.texto, emoji: r.emoji, puntos: r.puntos, momento: ahoraSegundos(), foto: foto });
      colaCelebra.push({ titulo: '¡Reto completado!', emoji: r.emoji, sonido: 'reto', texto: '+' + r.puntos + ' puntos. ' + (window.Cuenta && window.Cuenta.conectado() ? 'Tu evidencia ya está en Novedades.' : 'Crea una cuenta para que tus amigos vean tu evidencia.') });
      vibrar([30, 50, 30]);
      revisarAvances(nivelAntes);
      guardar(); pintar();
      siguienteCelebracion();
      programarPronto();
    }, function (e) {
      if (btn) btn.disabled = false;
      if (!e.cancelada) avisar(e.message);
    });
  }

  // ---------- Tarjeta de un hábito ----------
  function pasosHoy() { return window.Reloj ? window.Reloj.pasosHoy() : null; }

  function tarjetaHabito(h, fecha, tocaHoy) {
    var k = L.clave(fecha);
    var hecho = !!h.hechos[k];
    var conFoto = hecho && !!h.fotos[k];
    var racha = L.rachaHabito(h, fecha, estado.congelados);
    var tarjeta = crear('div', 'habito' + (hecho ? ' hecho' : '') + (tocaHoy ? '' : ' no-toca'));
    tarjeta.style.setProperty('--color', h.color);

    // Tocar el nombre abre la edición
    var info = crear('button', 'habito-info');
    info.type = 'button';
    info.setAttribute('aria-label', 'Editar ' + h.nombre);
    info.appendChild(crear('span', 'habito-icono', h.emoji));
    var texto = crear('span', 'habito-texto');
    texto.appendChild(crear('span', 'habito-nombre', h.nombre));
    var linea = racha > 0 ? '🔥 ' + plural(racha, 'día', 'días') + ' de racha' : (tocaHoy ? 'Empieza tu racha hoy' : 'Descanso');
    if (h.pasos && !hecho && tocaHoy) {
      var p = pasosHoy();
      linea = '👟 ' + (p === null ? 'Meta: ' + miles(h.pasos) + ' pasos' : miles(p) + ' / ' + miles(h.pasos) + ' pasos');
    }
    if (conFoto) linea += ' · 📸';
    if (h.hora) linea += ' · ⏰ ' + h.hora;
    texto.appendChild(crear('span', 'habito-racha' + (racha > 0 ? ' encendida' : ''), linea));
    info.appendChild(texto);
    info.addEventListener('click', function () { abrirHoja(h); });
    tarjeta.appendChild(info);

    // Ya cumplido y sin foto: botón de cámara para ganar 10 puntos más
    if (hecho && !conFoto && k === claveHoy()) {
      var cam = crear('button', 'boton-foto');
      cam.type = 'button';
      cam.setAttribute('aria-label', 'Agregar foto a ' + h.nombre + ' (+' + L.PUNTOS.foto + ' puntos)');
      cam.innerHTML = CAMARA;
      cam.appendChild(crear('small', '', '+' + L.PUNTOS.foto));
      cam.addEventListener('click', function () { agregarFoto(h, cam); });
      tarjeta.appendChild(cam);
    }

    // El botón de palomita marca o desmarca el día
    var marca = crear('button', 'palomita');
    marca.type = 'button';
    marca.setAttribute('aria-label', (hecho ? 'Desmarcar ' : 'Completar ') + h.nombre);
    marca.setAttribute('aria-pressed', String(hecho));
    marca.innerHTML = PALOMITA;
    marca.addEventListener('click', function () { alternar(h.id); });
    tarjeta.appendChild(marca);
    tarjeta.dataset.id = h.id;
    return tarjeta;
  }

  function buscarHabito(id) { return estado.habitos.filter(function (x) { return x.id === id; })[0]; }

  function publicarHabito(h, k, foto) {
    if (h.publico === false) return;
    var racha = L.rachaHabito(h, hoy(), estado.congelados);
    publicar({
      clave: 'h:' + h.id + ':' + k, tipo: 'habito',
      titulo: 'completó ' + h.nombre, emoji: h.emoji,
      detalle: (racha >= 2 ? '🔥 ' + plural(racha, 'día', 'días') + ' de racha' : '') + (h.marcadoPor === 'reloj' ? (racha >= 2 ? ' · ' : '') + '⌚ con su reloj' : ''),
      puntos: L.PUNTOS.habito + (h.fotos[k] ? L.PUNTOS.foto : 0),
      momento: ahoraSegundos(), foto: foto || undefined
    });
  }

  // Marca un hábito como hecho hoy. origen = 'reloj' cuando lo marcó el reloj.
  function marcar(h, origen) {
    var fecha = hoy();
    var k = L.clave(fecha);
    if (h.hechos[k]) return;
    var nivelAntes = nivelActual();
    var rachaAntes = rachaGeneral(fecha);
    h.hechos[k] = true;
    h.marcadoPor = origen || '';
    vibrar(25);
    sonar('hecho');

    var est = L.estadoDia(estado.habitos, fecha);
    if (est.completo && estado.celebrado !== k) {
      estado.celebrado = k;
      colaCelebra.push({ titulo: '¡Día completo!', sonido: 'dia', texto: 'Llevas ' + plural(rachaGeneral(fecha), 'día', 'días') + ' de racha. ¡No la sueltes!' });
    }
    var racha = rachaGeneral(fecha);
    if (racha > rachaAntes && HITOS_RACHA.indexOf(racha) !== -1) {
      publicar({ clave: 'racha:' + racha + ':' + k, tipo: 'racha', titulo: 'llegó a ' + racha + ' días de racha', emoji: '🔥', momento: ahoraSegundos() });
    }
    publicarHabito(h, k);
    revisarPremioEscudo();
    revisarAvances(nivelAntes);
  }

  function desmarcar(h) {
    var k = claveHoy();
    delete h.hechos[k];
    delete h.fotos[k];
    vibrar(10);
    sonar('desmarcar');
    borrarPublicacion('h:' + h.id + ':' + k);
  }

  function alternar(id) {
    var h = buscarHabito(id);
    if (!h) return;
    var k = claveHoy();
    if (h.hechos[k]) desmarcar(h); else marcar(h);
    guardar();
    pintar();
    programarPronto();
    if (h.hechos[k]) {
      var b = document.querySelector('.habito[data-id="' + id + '"] .palomita');
      if (b) b.classList.add('brinco');
      // Primera vez: le explicamos lo de la foto
      if (!estado.tipFoto) {
        estado.tipFoto = true;
        guardar();
        setTimeout(function () { avisar('📷 Toca la cámara para subir una foto y ganar +' + L.PUNTOS.foto + ' puntos.'); }, 500);
      }
    }
    siguienteCelebracion();
  }

  function agregarFoto(h, btn) {
    btn.disabled = true;
    window.Camara.tomar().then(function (foto) {
      var k = claveHoy();
      if (!h.hechos[k]) return;
      var nivelAntes = nivelActual();
      h.fotos[k] = true;
      sonar('foto');
      vibrar(20);
      if (h.publico !== false) publicarHabito(h, k, foto);
      revisarAvances(nivelAntes);
      guardar(); pintar();
      var conectado = window.Cuenta && window.Cuenta.conectado();
      avisar('📸 +' + L.PUNTOS.foto + ' puntos. ' + (h.publico === false ? 'Este hábito no se muestra en Novedades.'
        : conectado ? 'Tus amigos ya la ven en Novedades.' : 'Crea una cuenta para que tus amigos la vean.'));
      siguienteCelebracion();
    }, function (e) {
      btn.disabled = false;
      if (!e.cancelada) avisar(e.message);
    });
  }

  // ---------- Pantalla PROGRESO ----------
  function pintarProgreso() {
    var fecha = hoy();
    var habitos = estado.habitos;

    var mejor = habitos.reduce(function (m, h) { return Math.max(m, L.mejorRacha(h, fecha, estado.congelados)); }, 0);
    var cifras = $('cifras');
    cifras.textContent = '';
    [
      { clase: 'fuego', n: rachaGeneral(fecha), t: 'Racha actual' },
      { clase: 'morado', n: mejor, t: 'Mejor racha' },
      { clase: '', n: L.totalHechos(habitos), t: 'Completados' }
    ].forEach(function (c) {
      var caja = crear('div', 'cifra ' + c.clase);
      caja.appendChild(crear('strong', '', String(c.n)));
      caja.appendChild(crear('span', '', c.t));
      cifras.appendChild(caja);
    });

    // Calendario del mes
    if (!mesVisto) mesVisto = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    var cal = $('calendario');
    cal.textContent = '';
    var cabeza = crear('div', 'mes-cabeza');
    var antes = boton('‹', 'mes-flecha', function () { mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() - 1, 1); pintarProgreso(); });
    antes.setAttribute('aria-label', 'Mes anterior');
    var despues = boton('›', 'mes-flecha', function () { mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 1); pintarProgreso(); });
    despues.setAttribute('aria-label', 'Mes siguiente');
    despues.disabled = mesVisto.getFullYear() === fecha.getFullYear() && mesVisto.getMonth() === fecha.getMonth();
    cabeza.appendChild(antes);
    cabeza.appendChild(crear('h3', '', mesVisto.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })));
    cabeza.appendChild(despues);
    cal.appendChild(cabeza);

    var mes = crear('div', 'mes');
    DIAS.forEach(function (d) { mes.appendChild(crear('span', 'letra', d.letra)); });
    var huecos = (mesVisto.getDay() + 6) % 7; // casillas vacías antes del día 1
    for (var i = 0; i < huecos; i++) mes.appendChild(crear('span'));
    var diasDelMes = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 0).getDate();
    var kHoy = L.clave(fecha);
    for (var d = 1; d <= diasDelMes; d++) {
      var dia = new Date(mesVisto.getFullYear(), mesVisto.getMonth(), d);
      var k = L.clave(dia);
      var est = L.estadoDia(habitos, dia);
      var casilla = crear('span', 'casilla', String(d));
      if (k === kHoy) casilla.classList.add('hoy');
      if (k > kHoy) casilla.classList.add('futuro');
      else if (est.completo) casilla.classList.add('completo');
      else if (est.hechos > 0) casilla.classList.add('parcial');
      else if (estado.congelados[k]) casilla.classList.add('congelado');
      mes.appendChild(casilla);
    }
    cal.appendChild(mes);
    cal.appendChild(crear('p', 'nota', 'Naranja fuerte: día completo. Naranja claro: hiciste una parte. Azul: lo cuidó un escudo 🛡️.'));

    // Resumen por hábito
    var resumenH = $('resumen-habitos');
    resumenH.textContent = '';
    resumenH.appendChild(crear('h3', '', 'Tus hábitos'));
    if (habitos.length === 0) {
      resumenH.appendChild(crear('p', 'nota', 'Todavía no tienes hábitos. Agrega uno con el botón naranja.'));
      return;
    }
    habitos.forEach(function (h) {
      var fila = crear('div', 'fila-resumen');
      var icono = crear('span', 'habito-icono', h.emoji);
      icono.style.setProperty('--color', h.color);
      var datos = crear('div', 'datos');
      datos.appendChild(crear('b', '', h.nombre));
      datos.appendChild(crear('span', '', 'Mejor racha: ' + plural(L.mejorRacha(h, fecha, estado.congelados), 'día', 'días') +
        ' · ' + plural(Object.keys(h.hechos).length, 'vez', 'veces')));
      var numero = crear('div', 'numero', '🔥 ' + L.rachaHabito(h, fecha, estado.congelados));
      numero.appendChild(crear('small', '', 'racha actual'));
      fila.appendChild(icono); fila.appendChild(datos); fila.appendChild(numero);
      resumenH.appendChild(fila);
    });
  }

  // ---------- Crear / editar hábito ----------
  function nuevoHabito(nombre, emoji, color, dias, hora) {
    return {
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nombre: nombre, emoji: emoji, color: color, dias: dias, hora: hora || '',
      creado: L.clave(hoy()), hechos: {}, fotos: {}, publico: true, pasos: 0
    };
  }

  function abrirHoja(habito) {
    borrador = habito
      ? { id: habito.id, nombre: habito.nombre, emoji: habito.emoji, color: habito.color, dias: habito.dias.slice(), hora: habito.hora || '', publico: habito.publico !== false, pasos: habito.pasos || 0 }
      : { id: null, nombre: '', emoji: EMOJIS[0], color: COLORES[0], dias: [0, 1, 2, 3, 4, 5, 6], publico: true, pasos: 0 };

    $('hoja-titulo').textContent = habito ? 'Editar hábito' : 'Nuevo hábito';
    $('campo-nombre').value = borrador.nombre;
    $('campo-hora').value = borrador.hora || '';
    $('btn-quitar-hora').disabled = !borrador.hora;
    $('ayuda-hora').textContent = notificaciones()
      ? 'Te avisamos a esa hora los días que toca.'
      : 'Los recordatorios suenan en la app instalada en tu Android.';
    $('error-nombre').hidden = true;
    $('error-dias').hidden = true;
    var eliminar = $('btn-eliminar');
    eliminar.hidden = !habito;
    eliminar.classList.remove('confirmar');
    eliminar.textContent = 'Eliminar hábito';
    pintarOpciones();
    $('fondo-hoja').hidden = false;
    abrirCapa(ocultarHoja);
    if (!habito) setTimeout(function () { $('campo-nombre').focus(); }, 250);
  }

  function pintarOpciones() {
    var cajaEmoji = $('opciones-emoji');
    cajaEmoji.textContent = '';
    var lista = EMOJIS.indexOf(borrador.emoji) === -1 ? [borrador.emoji].concat(EMOJIS) : EMOJIS;
    lista.forEach(function (e) {
      cajaEmoji.appendChild(boton(e, 'opcion-emoji' + (e === borrador.emoji ? ' elegido' : ''), function () { borrador.emoji = e; pintarOpciones(); }));
    });

    var cajaColor = $('opciones-color');
    cajaColor.textContent = '';
    COLORES.forEach(function (c) {
      var b = boton(undefined, 'opcion-color' + (c === borrador.color ? ' elegido' : ''), function () { borrador.color = c; pintarOpciones(); });
      b.style.setProperty('--color', c);
      b.setAttribute('aria-label', 'Color ' + c);
      cajaColor.appendChild(b);
    });

    var cajaDias = $('opciones-dias');
    cajaDias.textContent = '';
    DIAS.forEach(function (d) {
      var elegido = borrador.dias.indexOf(d.n) !== -1;
      var b = boton(d.letra, 'opcion-dia' + (elegido ? ' elegido' : ''), function () {
        if (elegido) borrador.dias = borrador.dias.filter(function (x) { return x !== d.n; });
        else borrador.dias.push(d.n);
        $('error-dias').hidden = true;
        pintarOpciones();
      });
      b.setAttribute('aria-pressed', String(elegido));
      cajaDias.appendChild(b);
    });

    // Pasos del reloj (solo si el reloj está conectado)
    $('campo-pasos').hidden = !ajustes.reloj;
    var cajaPasos = $('opciones-pasos');
    cajaPasos.textContent = '';
    PASOS.forEach(function (n) {
      cajaPasos.appendChild(boton(n ? miles(n / 1000) + 'k' : 'No', 'opcion-minutos' + (n === borrador.pasos ? ' elegido' : ''), function () {
        borrador.pasos = n; pintarOpciones();
      }));
    });

    $('btn-publico').setAttribute('aria-checked', String(borrador.publico));
  }

  function cerrarHoja() { cerrarCapa(); }
  function ocultarHoja() {
    $('fondo-hoja').hidden = true;
    $('campo-nombre').blur();
    borrador = null;
  }

  function guardarHoja(evento) {
    evento.preventDefault();
    var nombre = $('campo-nombre').value.trim();
    $('error-nombre').hidden = nombre !== '';
    $('error-dias').hidden = borrador.dias.length > 0;
    if (nombre === '' || borrador.dias.length === 0) return;
    var hora = /^\d{2}:\d{2}/.test($('campo-hora').value) ? $('campo-hora').value.slice(0, 5) : '';

    if (borrador.id) {
      var h = buscarHabito(borrador.id);
      h.nombre = nombre; h.emoji = borrador.emoji; h.color = borrador.color; h.dias = borrador.dias.slice(); h.hora = hora;
      h.publico = borrador.publico; h.pasos = borrador.pasos;
    } else {
      var nuevo = nuevoHabito(nombre, borrador.emoji, borrador.color, borrador.dias.slice(), hora);
      nuevo.publico = borrador.publico; nuevo.pasos = borrador.pasos;
      estado.habitos.push(nuevo);
    }
    guardar();
    cerrarHoja();
    pintar();
    programarRecordatorios(hora !== '');
    if (window.Reloj) window.Reloj.revisarHabitos();
  }

  function eliminarHabito() {
    var b = $('btn-eliminar');
    // Primer toque: pide confirmación. Segundo toque: borra.
    if (!b.classList.contains('confirmar')) {
      b.classList.add('confirmar');
      b.textContent = '¿Seguro? Toca otra vez para borrar';
      return;
    }
    var id = borrador.id;
    estado.habitos = estado.habitos.filter(function (x) { return x.id !== id; });
    borrarPublicacion('h:' + id + ':' + claveHoy());
    guardar();
    cerrarHoja();
    pintar();
    programarRecordatorios(false);
  }

  // ---------- Registrar otro deporte (Entrenar) ----------
  function deporte(id) {
    return DEPORTES.filter(function (x) { return x.id === id; })[0] || DEPORTES[DEPORTES.length - 1];
  }

  function abrirEntreno() {
    borradorEntreno = { deporte: 'correr', minutos: 30 };
    $('campo-minutos').value = '';
    $('error-minutos').hidden = true;
    pintarOpcionesEntreno();
    $('fondo-entreno').hidden = false;
    abrirCapa(ocultarEntreno);
  }

  function pintarOpcionesEntreno() {
    var caja = $('opciones-deporte');
    caja.textContent = '';
    DEPORTES.forEach(function (d) {
      var b = boton(undefined, 'opcion-deporte' + (d.id === borradorEntreno.deporte ? ' elegido' : ''), function () {
        borradorEntreno.deporte = d.id; pintarOpcionesEntreno();
      });
      b.appendChild(crear('i', '', d.emoji));
      b.appendChild(crear('span', '', d.nombre));
      caja.appendChild(b);
    });
    var cajaMin = $('opciones-minutos');
    cajaMin.textContent = '';
    MINUTOS.forEach(function (n) {
      var b = boton(String(n), 'opcion-minutos' + (n === borradorEntreno.minutos ? ' elegido' : ''), function () {
        borradorEntreno.minutos = n; $('campo-minutos').value = ''; $('error-minutos').hidden = true; pintarOpcionesEntreno();
      });
      b.setAttribute('aria-label', n + ' minutos');
      cajaMin.appendChild(b);
    });
  }

  function cerrarEntreno() { cerrarCapa(); }
  function ocultarEntreno() {
    $('fondo-entreno').hidden = true;
    $('campo-minutos').blur();
    borradorEntreno = null;
  }

  // Agrega un entrenamiento (lo usan esta hoja, gym.js y reloj.js) y lo publica
  function agregarEntreno(datos, publicarlo) {
    var e = {
      id: datos.id || 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      deporte: datos.deporte, minutos: datos.minutos, fecha: datos.fecha || claveHoy()
    };
    ['sesionId', 'origen', 'nombre'].forEach(function (k) { if (datos[k]) e[k] = datos[k]; });
    estado.entrenos.push(e);
    if (publicarlo !== false) {
      var d = deporte(e.deporte);
      publicar({
        clave: 'e:' + e.id, tipo: 'entreno', titulo: 'entrenó ' + (e.nombre || d.nombre), emoji: d.emoji,
        detalle: e.minutos + ' min' + (e.origen === 'reloj' ? ' · ⌚ con su reloj' : '') + (datos.detalle ? ' · ' + datos.detalle : ''),
        puntos: L.PUNTOS.entreno + (datos.puntosExtra || 0), momento: ahoraSegundos()
      });
    }
    return e;
  }

  function borrarEntreno(id) {
    var e = estado.entrenos.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    estado.entrenos = estado.entrenos.filter(function (x) { return x.id !== id; });
    if (e.sesionId) estado.sesiones = estado.sesiones.filter(function (s) { return s.id !== e.sesionId; });
    if (e.origen === 'reloj') {
      estado.relojIgnorados = (estado.relojIgnorados || []).concat([e.id]).slice(-200); // que no se vuelva a importar
    }
    borrarPublicacion('e:' + id);
    guardar();
    pintar();
  }

  function guardarEntreno(evento) {
    evento.preventDefault();
    var minutos = Math.round(Number(borradorEntreno.minutos));
    if (!(minutos >= 1 && minutos <= 600)) { $('error-minutos').hidden = false; return; }
    var nivelAntes = nivelActual();
    agregarEntreno({ deporte: borradorEntreno.deporte, minutos: minutos });
    vibrar(25);
    sonar('hecho');
    revisarAvances(nivelAntes);
    guardar();
    cerrarEntreno();
    pintar();
    siguienteCelebracion();
  }

  // ---------- Perfil y logros ----------
  function pintarPerfil() {
    var fecha = hoy();
    var xp = xpTotal();
    var niv = L.nivel(xp);

    var cabeza = $('perfil-cabeza');
    // Si estás escribiendo tu nombre no se redibuja, para no quitarte el teclado
    if (!cabeza.contains(document.activeElement) || document.activeElement.tagName !== 'INPUT') {
      cabeza.textContent = '';
      var arriba = crear('div', 'perfil-arriba');
      arriba.appendChild(crear('div', 'perfil-avatar', estado.perfil.avatar));
      var cajaNombre = crear('div', 'perfil-nombre');
      var campo = crear('input');
      campo.type = 'text'; campo.maxLength = 24; campo.placeholder = 'Tu nombre';
      campo.value = estado.perfil.nombre;
      campo.setAttribute('aria-label', 'Tu nombre');
      campo.addEventListener('input', function () { estado.perfil.nombre = campo.value.trim(); guardar(); });
      cajaNombre.appendChild(campo);
      cajaNombre.appendChild(crear('span', '', 'Nivel ' + niv.nivel + ' · ' + miles(xp) + ' puntos'));
      arriba.appendChild(cajaNombre);
      var engrane = boton(undefined, 'btn-engrane', abrirAjustes);
      engrane.setAttribute('aria-label', 'Configuración');
      engrane.innerHTML = ENGRANE;
      arriba.appendChild(engrane);
      cabeza.appendChild(arriba);

      // Estado de la cuenta
      var s = window.Api && window.Api.sesion();
      var lineaCuenta = crear('div', 'linea-cuenta');
      if (s && s.token) {
        lineaCuenta.appendChild(crear('span', 'cuenta-ok', '✓ ' + s.usuario.correo));
      } else if (window.RACHA_API) {
        lineaCuenta.appendChild(crear('span', '', 'Sin cuenta: tu progreso solo vive en este teléfono.'));
        lineaCuenta.appendChild(boton('Crear cuenta', 'boton-chico boton-chico-principal', function () { if (window.Cuenta) window.Cuenta.abrir('crear'); }));
      }
      if (lineaCuenta.childNodes.length) cabeza.appendChild(lineaCuenta);

      var avatares = crear('div', 'avatares');
      AVATARES.forEach(function (a) {
        avatares.appendChild(boton(a, 'opcion-emoji' + (a === estado.perfil.avatar ? ' elegido' : ''), function () {
          estado.perfil.avatar = a; guardar(); pintarPerfil();
        }));
      });
      cabeza.appendChild(avatares);

      var nivel = crear('div', 'nivel');
      var texto = crear('div', 'nivel-texto');
      texto.appendChild(crear('b', '', 'Nivel ' + niv.nivel));
      texto.appendChild(crear('span', '', niv.avance + ' / ' + niv.meta + ' para el nivel ' + (niv.nivel + 1)));
      var riel = crear('div', 'riel-nivel');
      var barra = crear('span'); barra.style.width = niv.avance + '%';
      riel.appendChild(barra);
      nivel.appendChild(texto); nivel.appendChild(riel);
      cabeza.appendChild(nivel);

      // Vitrina: medallas de la liga, escudos y retos
      var vitrina = crear('div', 'vitrina');
      [['🥇', estado.medallas.length, estado.medallas.length === 1 ? 'medalla' : 'medallas'],
        ['🛡️', estado.escudos, estado.escudos === 1 ? 'escudo' : 'escudos'],
        ['⚡', estado.retos.length, estado.retos.length === 1 ? 'reto' : 'retos']
      ].forEach(function (v) {
        var c = crear('div', 'vitrina-item');
        c.appendChild(crear('span', '', v[0]));
        c.appendChild(crear('b', '', String(v[1])));
        c.appendChild(crear('small', '', v[2]));
        vitrina.appendChild(c);
      });
      cabeza.appendChild(vitrina);
    }

    var lista = L.logros(estado.habitos, estado.entrenos, fecha, numAmigos(), extraLogros());
    var caja = $('perfil-logros');
    caja.textContent = '';
    var cab = crear('div', 'logros-cabeza');
    cab.appendChild(crear('h3', '', 'Logros'));
    cab.appendChild(crear('span', '', lista.filter(function (l) { return l.logrado; }).length + ' de ' + lista.length));
    caja.appendChild(cab);
    var rejilla = crear('div', 'logros');
    lista.forEach(function (l) {
      var tarjeta = crear('div', 'logro' + (l.logrado ? ' logrado' : ''));
      tarjeta.appendChild(crear('div', 'medalla', l.emoji));
      tarjeta.appendChild(crear('b', '', l.titulo));
      tarjeta.appendChild(crear('p', '', l.desc));
      if (!l.logrado) {
        var riel = crear('div', 'riel-logro');
        var barra = crear('span'); barra.style.width = Math.round((l.valor / l.meta) * 100) + '%';
        riel.appendChild(barra);
        tarjeta.appendChild(riel);
      }
      tarjeta.appendChild(crear('small', '', l.logrado ? '¡Conseguido!' : l.valor + ' / ' + l.meta));
      rejilla.appendChild(tarjeta);
    });
    caja.appendChild(rejilla);
  }

  // Revisa si se desbloqueó algún logro nuevo y lo manda a celebrar.
  function revisarLogros() {
    var ganados = L.logros(estado.habitos, estado.entrenos, hoy(), numAmigos(), extraLogros()).filter(function (l) { return l.logrado; });
    var vistos = estado.logrosVistos || [];
    ganados.forEach(function (l) {
      if (vistos.indexOf(l.id) !== -1) return;
      vistos.push(l.id);
      colaCelebra.push({ titulo: '¡Logro desbloqueado!', texto: l.titulo + ': ' + l.desc.toLowerCase() + '.', emoji: l.emoji, sonido: 'logro' });
    });
    estado.logrosVistos = vistos;
  }

  // Después de ganar puntos: logros, meta diaria y nivel
  function revisarAvances(nivelAntes) {
    revisarLogros();
    var k = claveHoy();
    var puntos = puntosHoy();
    if (estado.metaCumplida !== k && puntos >= estado.metaXP) {
      estado.metaCumplida = k;
      colaCelebra.push({ titulo: '¡Meta diaria cumplida!', emoji: '⚡', sonido: 'meta', texto: 'Llevas ' + puntos + ' puntos hoy. Tu meta era ' + estado.metaXP + '.' });
    }
    var n = nivelActual();
    if (!estado.nivelMax) estado.nivelMax = nivelAntes || n;
    if (n > estado.nivelMax) {
      estado.nivelMax = n;
      colaCelebra.push({ titulo: '¡Subiste de nivel!', emoji: '⭐', sonido: 'nivel', texto: 'Ahora eres nivel ' + n + '. Tus amigos lo verán en Novedades.' });
    }
  }

  // Revisa logros (por ejemplo al agregar un amigo) y celebra solo si hay algo nuevo
  function revisarLogrosYCelebrar() {
    var antes = colaCelebra.length;
    revisarAvances(nivelActual());
    guardar();
    pintar();
    if (colaCelebra.length > antes && $('celebra').hidden) siguienteCelebracion();
  }

  // Para otros archivos: agrega una celebración y la muestra si no hay otra en pantalla
  function celebrar(c) {
    colaCelebra.push(c);
    if ($('celebra').hidden) siguienteCelebracion();
  }

  // ---------- Celebración ----------
  // Muestra la siguiente celebración pendiente (día completo, logro, nivel, escudo…).
  function siguienteCelebracion() {
    var capa = $('celebra');
    var c = colaCelebra.shift();
    if (!c) { capa.hidden = true; return; }
    $('celebra-titulo').textContent = c.titulo;
    $('celebra-texto').textContent = c.texto;
    $('celebra-mascota').hidden = !!c.emoji;
    $('celebra-emoji').hidden = !c.emoji;
    $('celebra-emoji').textContent = c.emoji || '';
    capa.querySelectorAll('.confeti').forEach(function (x) { x.remove(); });
    for (var i = 0; i < 36; i++) {
      var x = crear('i', 'confeti');
      x.style.left = Math.random() * 100 + '%';
      x.style.background = COLORES[i % COLORES.length];
      x.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
      x.style.animationDelay = (Math.random() * 0.5) + 's';
      capa.appendChild(x);
    }
    capa.hidden = false;
    vibrar([40, 60, 40]);
    setTimeout(function () { sonar(c.sonido || 'logro'); }, 120);
  }

  // ---------- Navegación ----------
  // Pantallas que vienen de otros archivos (Entrenar, Amigos, Configuración)
  var vistasExtra = {};
  function registrarVista(nombre, pintarla, alEntrar) {
    vistasExtra[nombre] = { pintar: pintarla, alEntrar: alEntrar };
  }

  function pintar() {
    pintarHoy();
    if (vista === 'progreso') pintarProgreso();
    if (vista === 'perfil') pintarPerfil();
    if (vistasExtra[vista]) vistasExtra[vista].pintar();
  }

  function cambiarVista(nueva) {
    vista = nueva;
    document.querySelectorAll('main.vista').forEach(function (v) { v.hidden = v.id !== 'vista-' + nueva; });
    $('btn-nuevo').hidden = nueva !== 'hoy';
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    var pestana = nueva === 'ajustes' ? 'perfil' : nueva; // Configuración vive dentro de Perfil
    document.querySelectorAll('.menu-btn').forEach(function (b) {
      b.classList.toggle('activo', b.dataset.vista === pestana);
    });
    mesVisto = null;
    window.scrollTo(0, 0);
    pintar();
    if (vistasExtra[nueva] && vistasExtra[nueva].alEntrar) vistasExtra[nueva].alEntrar();
  }

  function abrirAjustes() {
    cambiarVista('ajustes');
    abrirCapa(function () { if (vista === 'ajustes') cambiarVista('perfil'); });
  }

  // ---------- Hoja genérica (la usan los demás archivos) ----------
  // llenar(hoja) agrega el contenido. Se cierra con cerrarCapa() o con "atrás".
  function abrirHojaGenerica(llenar) {
    var hoja = $('hoja-generica');
    hoja.textContent = '';
    hoja.appendChild(crear('div', 'hoja-agarre'));
    llenar(hoja);
    $('fondo-generico').hidden = false;
    abrirCapa(function () {
      $('fondo-generico').hidden = true;
      hoja.textContent = '';
    });
  }

  // Resumen que ven tus amigos
  function resumen() {
    var fecha = hoy();
    var xp = xpTotal();
    var lunes = L.clave(L.lunes(fecha));
    return {
      xp: xp,
      nivel: L.nivel(xp).nivel,
      racha: rachaGeneral(fecha),
      logros: L.logros(estado.habitos, estado.entrenos, fecha, numAmigos(), extraLogros()).filter(function (l) { return l.logrado; }).length,
      minutosSemana: estado.entrenos.filter(function (e) { return e.fecha >= lunes; })
        .reduce(function (s, e) { return s + e.minutos; }, 0),
      medallas: estado.medallas.length
    };
  }

  // Puntos de esta semana y de la pasada, para la liga: { "2026-11-16": 120, "2026-11-09": 340 }
  function semanasLiga() {
    var r = {};
    r[L.clave(lunesDe(0))] = puntosSemana(0);
    r[L.clave(lunesDe(1))] = puntosSemana(1);
    return r;
  }

  // Marca como vistos los logros que ya se tenían, para no celebrarlos todos de golpe
  function marcarLogrosVistos(datos) {
    if (Array.isArray(datos.logrosVistos)) return;
    datos.logrosVistos = L.logros(datos.habitos, datos.entrenos, hoy(), numAmigos(), {
      congelados: datos.congelados, retos: datos.retos.length, records: L.records(datos.sesiones).length, medallas: datos.medallas.length
    }).filter(function (l) { return l.logrado; }).map(function (l) { return l.id; });
  }

  // Cambia todos los datos del teléfono (por ejemplo, al traer el respaldo de tu cuenta)
  function reemplazarEstado(datos) {
    var nuevo = normalizar(JSON.parse(JSON.stringify(datos))) || estadoVacio();
    marcarLogrosVistos(nuevo);
    estado = nuevo;
    estado.nivelMax = Math.max(estado.nivelMax || 0, nivelActual());
    guardar();
    programarRecordatorios(false);
    pintar();
  }

  function borrarDatosLocales() {
    try { localStorage.removeItem(CLAVE_GUARDADO); } catch (e) { /* nada */ }
    estado = estadoVacio();
    programarRecordatorios(false);
    pintar();
  }

  // Lo que otros archivos (cuenta.js, social.js, gym.js, reloj.js, ajustes.js) pueden usar
  window.Racha = {
    $: $, crear: crear, boton: boton, plural: plural, miles: miles, avisar: avisar, vibrar: vibrar, sonar: sonar, FLAMA: FLAMA, CAMARA: CAMARA,
    hoy: hoy, claveHoy: claveHoy, grafica: grafica, DEPORTES: DEPORTES, deporte: deporte, METAS: METAS,
    estado: function () { return estado; },
    vista: function () { return vista; },
    tieneDatos: function () { return estado.habitos.length > 0 || estado.entrenos.length > 0 || estado.sesiones.length > 0; },
    guardar: guardar, pintar: pintar, cambiarVista: cambiarVista, registrarVista: registrarVista,
    abrirCapa: abrirCapa, cerrarCapa: cerrarCapa, abrirHojaGenerica: abrirHojaGenerica,
    ajustes: ajustes, guardarAjustes: guardarAjustes, programarRecordatorios: programarRecordatorios,
    resumen: resumen, semanasLiga: semanasLiga, puntosSemana: puntosSemana, lunesDe: lunesDe,
    reemplazarEstado: reemplazarEstado, borrarDatosLocales: borrarDatosLocales,
    revisarLogrosYCelebrar: revisarLogrosYCelebrar, revisarAvances: revisarAvances, celebrar: celebrar,
    siguienteCelebracion: siguienteCelebracion, nivelActual: nivelActual, numAmigos: numAmigos, xpTotal: xpTotal,
    publicar: publicar, borrarPublicacion: borrarPublicacion, abrirEntreno: abrirEntreno,
    agregarEntreno: agregarEntreno, borrarEntreno: borrarEntreno, abrirMeta: abrirMeta,
    marcarPorReloj: function (id) {
      var h = buscarHabito(id);
      if (!h || h.hechos[claveHoy()]) return false;
      marcar(h, 'reloj');
      guardar(); pintar(); programarPronto(); siguienteCelebracion();
      return true;
    }
  };

  // ---------- Arranque ----------
  document.querySelectorAll('[data-flama]').forEach(function (el) { el.innerHTML = FLAMA; });
  document.querySelectorAll('.menu-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (vista === 'ajustes') cerrarCapa(); // salir de Configuración también quita su "atrás"
      cambiarVista(b.dataset.vista);
    });
  });
  $('fondo-generico').addEventListener('click', function (e) { if (e.target === this) cerrarCapa(); });
  $('btn-nuevo').addEventListener('click', function () { abrirHoja(null); });
  $('hoja').addEventListener('submit', guardarHoja);
  $('btn-cancelar').addEventListener('click', function () { cerrarHoja(); });
  $('btn-eliminar').addEventListener('click', eliminarHabito);
  $('btn-publico').addEventListener('click', function () { borrador.publico = !borrador.publico; pintarOpciones(); });
  $('campo-hora').addEventListener('input', function () { $('btn-quitar-hora').disabled = !this.value; });
  $('btn-quitar-hora').addEventListener('click', function () { $('campo-hora').value = ''; this.disabled = true; });
  $('fondo-hoja').addEventListener('click', function (e) { if (e.target === this) cerrarHoja(); });
  $('btn-celebra').addEventListener('click', siguienteCelebracion);
  $('hoja-entreno').addEventListener('submit', guardarEntreno);
  $('btn-cancelar-entreno').addEventListener('click', function () { cerrarEntreno(); });
  $('fondo-entreno').addEventListener('click', function (e) { if (e.target === this) cerrarEntreno(); });
  $('campo-minutos').addEventListener('input', function () {
    borradorEntreno.minutos = this.value === '' ? 0 : Number(this.value);
    $('error-minutos').hidden = true;
    pintarOpcionesEntreno();
  });
  $('pastilla-escudo').addEventListener('click', abrirInfoEscudos);
  $('meta-hoy').addEventListener('click', abrirMeta);

  // Al tocar la notificación de un reto, abre la pantalla Hoy
  var pluginNotif = notificaciones();
  if (pluginNotif && pluginNotif.addListener) {
    pluginNotif.addListener('localNotificationActionPerformed', function (ev) {
      var extra = ev && ev.notification && ev.notification.extra;
      if (extra && extra.tipo === 'reto') {
        if (vista !== 'hoy') cambiarVista('hoy');
        setTimeout(function () { var r = $('reto-hoy'); if (r && !r.hidden) r.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
      }
    });
  }

  // Si dejas la app abierta y cambia el día, se actualiza al volver
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    revisarEscudos();
    pintar();
    siguienteCelebracionSiHay();
  });
  function siguienteCelebracionSiHay() { if (colaCelebra.length && $('celebra').hidden) siguienteCelebracion(); }

  // Primera vez con esta versión: los logros que ya tenías se marcan sin celebrarlos todos de golpe
  if (!Array.isArray(estado.logrosVistos)) {
    marcarLogrosVistos(estado);
    guardar();
  }
  if (!estado.nivelMax) { estado.nivelMax = nivelActual(); guardar(); }

  revisarEscudos();
  pintar();
  siguienteCelebracionSiHay();
  // Programa recordatorios y retos un momento después de abrir (para no frenar el arranque)
  setTimeout(function () { programarRecordatorios(false); }, 1500);
})();
