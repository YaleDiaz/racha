/*
  app.js — Todo lo que se ve y se toca en la pantalla.
  Flujo general:  estado (datos)  ->  pintar() dibuja  ->  tocas algo  ->  cambia el estado  ->  guardar() y pintar()
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

  // Dibujo de la mascota (una flamita). Es un SVG, por eso se ve nítido en cualquier tamaño.
  var FLAMA = '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<path d="M52 5c4 17 27 28 27 55 0 19-13 34-29 34S21 79 21 60c0-13 7-22 14-30 1 9 5 14 10 14-3-13 0-28 7-39z" fill="#FF8A1F"/>' +
    '<path d="M50 44c7 9 17 15 17 28 0 12-8 20-17 20s-17-8-17-20c0-13 10-19 17-28z" fill="#FFD43B"/>' +
    '<ellipse cx="43" cy="69" rx="3.4" ry="4.6" fill="#241C3F"/><ellipse cx="57" cy="69" rx="3.4" ry="4.6" fill="#241C3F"/>' +
    '<path d="M44 78q6 6 12 0" fill="none" stroke="#241C3F" stroke-width="3" stroke-linecap="round"/></svg>';
  var PALOMITA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
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
    return { habitos: [], celebrado: null, entrenos: [], perfil: { nombre: '', avatar: '🔥' }, logrosVistos: [] };
  }
  // Completa datos de versiones anteriores de la app (o de un respaldo) con lo que les falte
  function normalizar(datos) {
    if (!datos || !Array.isArray(datos.habitos)) return null;
    if (!Array.isArray(datos.entrenos)) datos.entrenos = [];
    if (!datos.perfil) datos.perfil = { nombre: '', avatar: '🔥' };
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
    var base = { tema: 'auto', vibracion: true, recordatorios: true, mostrarEnLinea: true };
    try {
      var guardados = JSON.parse(localStorage.getItem(CLAVE_AJUSTES)) || {};
      Object.keys(base).forEach(function (k) { if (guardados[k] !== undefined) base[k] = guardados[k]; });
    } catch (e) { /* valores por defecto */ }
    return base;
  }
  function guardarAjustes() {
    try { localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(ajustes)); } catch (e) { /* sin espacio */ }
  }

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
  function hoy() { return new Date(); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
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

  // ---------- Recordatorios (notificaciones del teléfono) ----------
  // El plugin de notificaciones solo existe dentro de la app instalada (APK).
  // En el navegador de la computadora regresa null y simplemente no se programa nada.
  function notificaciones() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.LocalNotifications) || null;
  }

  // Arma la lista de avisos: uno por cada día que toca de cada hábito con hora.
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

  // Borra los avisos anteriores y los vuelve a programar según los hábitos actuales.
  function programarRecordatorios(avisarSiFalla) {
    var plugin = notificaciones();
    if (!plugin) return Promise.resolve();
    // Si apagaste los recordatorios en Configuración, solo se borran los que había
    var lista = ajustes.recordatorios ? listaDeAvisos() : [];
    guardar();
    return plugin.getPending()
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

  // ---------- Pantalla HOY ----------
  function pintarHoy() {
    var fecha = hoy();
    var habitos = estado.habitos;

    $('fecha-hoy').textContent = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

    var racha = L.rachaGeneral(habitos, fecha);
    $('racha-general').textContent = racha;
    $('pastilla-racha').classList.toggle('apagada', racha === 0);

    // Semana (lunes a domingo)
    var semana = $('semana');
    semana.textContent = '';
    var lunes = L.sumarDias(fecha, -((fecha.getDay() + 6) % 7));
    DIAS.forEach(function (d, i) {
      var dia = L.sumarDias(lunes, i);
      var est = L.estadoDia(habitos, dia);
      var caja = crear('div', 'dia');
      var k = L.clave(dia), kHoy = L.clave(fecha);
      if (k === kHoy) caja.classList.add('hoy');
      if (k > kHoy) caja.classList.add('futuro');
      else if (est.completo) caja.classList.add('completo');
      else if (est.hechos > 0) caja.classList.add('parcial');
      caja.appendChild(crear('span', '', d.letra));
      caja.appendChild(crear('div', 'dia-circulo', String(dia.getDate())));
      semana.appendChild(caja);
    });

    var progreso = $('progreso-hoy');
    var lista = $('lista-habitos');
    progreso.textContent = '';
    lista.textContent = '';

    // Sin hábitos: pantalla de bienvenida
    if (habitos.length === 0) {
      progreso.hidden = true;
      var vacio = crear('div', 'vacio');
      var m = crear('span', 'mascota mascota-grande'); m.innerHTML = FLAMA;
      vacio.appendChild(m);
      vacio.appendChild(crear('h2', '', '¡Enciende tu primera racha!'));
      vacio.appendChild(crear('p', '', 'Agrega un hábito con el botón naranja o empieza con una de estas ideas:'));
      var sug = crear('div', 'sugerencias');
      SUGERENCIAS.forEach(function (s) {
        var b = crear('button', 'sugerencia', s.emoji + ' ' + s.nombre);
        b.type = 'button';
        b.addEventListener('click', function () {
          estado.habitos.push(nuevoHabito(s.nombre, s.emoji, s.color, [0, 1, 2, 3, 4, 5, 6]));
          guardar(); pintar();
        });
        sug.appendChild(b);
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

  function tarjetaHabito(h, fecha, tocaHoy) {
    var hecho = !!h.hechos[L.clave(fecha)];
    var racha = L.rachaHabito(h, fecha);
    var tarjeta = crear('div', 'habito' + (hecho ? ' hecho' : '') + (tocaHoy ? '' : ' no-toca'));
    tarjeta.style.setProperty('--color', h.color);

    // Tocar el nombre abre la edición
    var info = crear('button', 'habito-info');
    info.type = 'button';
    info.setAttribute('aria-label', 'Editar ' + h.nombre);
    info.appendChild(crear('span', 'habito-icono', h.emoji));
    var texto = crear('span', 'habito-texto');
    texto.appendChild(crear('span', 'habito-nombre', h.nombre));
    texto.appendChild(crear('span', 'habito-racha' + (racha > 0 ? ' encendida' : ''),
      (racha > 0 ? '🔥 ' + plural(racha, 'día', 'días') + ' de racha' : (tocaHoy ? 'Empieza tu racha hoy' : 'Descanso')) +
      (h.hora ? ' · ⏰ ' + h.hora : '')));
    info.appendChild(texto);
    info.addEventListener('click', function () { abrirHoja(h); });
    tarjeta.appendChild(info);

    // El botón de palomita marca o desmarca el día
    var boton = crear('button', 'palomita');
    boton.type = 'button';
    boton.setAttribute('aria-label', (hecho ? 'Desmarcar ' : 'Completar ') + h.nombre);
    boton.setAttribute('aria-pressed', String(hecho));
    boton.innerHTML = PALOMITA;
    boton.addEventListener('click', function () { alternar(h.id); });
    tarjeta.appendChild(boton);
    tarjeta.dataset.id = h.id;
    return tarjeta;
  }

  function alternar(id) {
    var fecha = hoy();
    var k = L.clave(fecha);
    var h = estado.habitos.filter(function (x) { return x.id === id; })[0];
    if (!h) return;
    if (h.hechos[k]) delete h.hechos[k]; else h.hechos[k] = true;
    vibrar(h.hechos[k] ? 25 : 10);

    var est = L.estadoDia(estado.habitos, fecha);
    var celebrar = h.hechos[k] && est.completo && estado.celebrado !== k;
    if (celebrar) {
      estado.celebrado = k;
      var racha = L.rachaGeneral(estado.habitos, fecha);
      colaCelebra.push({ titulo: '¡Día completo!', texto: 'Llevas ' + plural(racha, 'día', 'días') + ' de racha. ¡No la sueltes!' });
    }
    revisarLogros();
    guardar();
    pintar();

    if (h.hechos[k]) {
      var boton = document.querySelector('.habito[data-id="' + id + '"] .palomita');
      if (boton) boton.classList.add('brinco');
    }
    siguienteCelebracion();
  }

  // ---------- Pantalla PROGRESO ----------
  function pintarProgreso() {
    var fecha = hoy();
    var habitos = estado.habitos;

    var mejor = habitos.reduce(function (m, h) { return Math.max(m, L.mejorRacha(h, fecha)); }, 0);
    var cifras = $('cifras');
    cifras.textContent = '';
    [
      { clase: 'fuego', n: L.rachaGeneral(habitos, fecha), t: 'Racha actual' },
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
    var antes = crear('button', 'mes-flecha', '‹'); antes.type = 'button'; antes.setAttribute('aria-label', 'Mes anterior');
    var despues = crear('button', 'mes-flecha', '›'); despues.type = 'button'; despues.setAttribute('aria-label', 'Mes siguiente');
    var esMesActual = mesVisto.getFullYear() === fecha.getFullYear() && mesVisto.getMonth() === fecha.getMonth();
    despues.disabled = esMesActual;
    antes.addEventListener('click', function () { mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() - 1, 1); pintarProgreso(); });
    despues.addEventListener('click', function () { mesVisto = new Date(mesVisto.getFullYear(), mesVisto.getMonth() + 1, 1); pintarProgreso(); });
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
      mes.appendChild(casilla);
    }
    cal.appendChild(mes);
    cal.appendChild(crear('p', 'nota', 'Naranja fuerte: día completo. Naranja claro: hiciste una parte.'));

    // Resumen por hábito
    var resumen = $('resumen-habitos');
    resumen.textContent = '';
    resumen.appendChild(crear('h3', '', 'Tus hábitos'));
    if (habitos.length === 0) {
      resumen.appendChild(crear('p', 'nota', 'Todavía no tienes hábitos. Agrega uno con el botón naranja.'));
      return;
    }
    habitos.forEach(function (h) {
      var fila = crear('div', 'fila-resumen');
      var icono = crear('span', 'habito-icono', h.emoji);
      icono.style.setProperty('--color', h.color);
      var datos = crear('div', 'datos');
      datos.appendChild(crear('b', '', h.nombre));
      datos.appendChild(crear('span', '', 'Mejor racha: ' + plural(L.mejorRacha(h, fecha), 'día', 'días') +
        ' · ' + plural(Object.keys(h.hechos).length, 'vez', 'veces')));
      var numero = crear('div', 'numero', '🔥 ' + L.rachaHabito(h, fecha));
      numero.appendChild(crear('small', '', 'racha actual'));
      fila.appendChild(icono); fila.appendChild(datos); fila.appendChild(numero);
      resumen.appendChild(fila);
    });
  }

  // ---------- Crear / editar hábito ----------
  function nuevoHabito(nombre, emoji, color, dias, hora) {
    return {
      id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nombre: nombre, emoji: emoji, color: color, dias: dias, hora: hora || '',
      creado: L.clave(hoy()), hechos: {}
    };
  }

  function abrirHoja(habito) {
    borrador = habito
      ? { id: habito.id, nombre: habito.nombre, emoji: habito.emoji, color: habito.color, dias: habito.dias.slice(), hora: habito.hora || '' }
      : { id: null, nombre: '', emoji: EMOJIS[0], color: COLORES[0], dias: [0, 1, 2, 3, 4, 5, 6] };

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
      var b = crear('button', 'opcion-emoji' + (e === borrador.emoji ? ' elegido' : ''), e);
      b.type = 'button';
      b.addEventListener('click', function () { borrador.emoji = e; pintarOpciones(); });
      cajaEmoji.appendChild(b);
    });

    var cajaColor = $('opciones-color');
    cajaColor.textContent = '';
    COLORES.forEach(function (c) {
      var b = crear('button', 'opcion-color' + (c === borrador.color ? ' elegido' : ''));
      b.type = 'button';
      b.style.setProperty('--color', c);
      b.setAttribute('aria-label', 'Color ' + c);
      b.addEventListener('click', function () { borrador.color = c; pintarOpciones(); });
      cajaColor.appendChild(b);
    });

    var cajaDias = $('opciones-dias');
    cajaDias.textContent = '';
    DIAS.forEach(function (d) {
      var elegido = borrador.dias.indexOf(d.n) !== -1;
      var b = crear('button', 'opcion-dia' + (elegido ? ' elegido' : ''), d.letra);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(elegido));
      b.addEventListener('click', function () {
        if (elegido) borrador.dias = borrador.dias.filter(function (x) { return x !== d.n; });
        else borrador.dias.push(d.n);
        $('error-dias').hidden = true;
        pintarOpciones();
      });
      cajaDias.appendChild(b);
    });
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
      var h = estado.habitos.filter(function (x) { return x.id === borrador.id; })[0];
      h.nombre = nombre; h.emoji = borrador.emoji; h.color = borrador.color; h.dias = borrador.dias.slice(); h.hora = hora;
    } else {
      estado.habitos.push(nuevoHabito(nombre, borrador.emoji, borrador.color, borrador.dias.slice(), hora));
    }
    guardar();
    cerrarHoja();
    pintar();
    programarRecordatorios(hora !== '');
  }

  function eliminarHabito() {
    var boton = $('btn-eliminar');
    // Primer toque: pide confirmación. Segundo toque: borra.
    if (!boton.classList.contains('confirmar')) {
      boton.classList.add('confirmar');
      boton.textContent = '¿Seguro? Toca otra vez para borrar';
      return;
    }
    var id = borrador.id;
    estado.habitos = estado.habitos.filter(function (x) { return x.id !== id; });
    guardar();
    cerrarHoja();
    pintar();
    programarRecordatorios(false);
  }

  // ---------- Entrenar ----------
  function deporte(id) {
    return DEPORTES.filter(function (x) { return x.id === id; })[0] || DEPORTES[DEPORTES.length - 1];
  }

  function pintarEntrenar() {
    var fecha = hoy();
    var entrenos = estado.entrenos;
    var lunes = L.clave(L.sumarDias(fecha, -((fecha.getDay() + 6) % 7)));
    var semana = entrenos.filter(function (e) { return e.fecha >= lunes; });
    var minutos = semana.reduce(function (s, e) { return s + e.minutos; }, 0);

    var resumen = $('entrenar-resumen');
    resumen.textContent = '';
    var m = crear('span', 'emoji-grande', '💪');
    var cont = crear('div', 'contenido');
    cont.appendChild(crear('h2', '', semana.length ? plural(semana.length, 'entrenamiento', 'entrenamientos') + ' esta semana' : 'Aún no entrenas esta semana'));
    cont.appendChild(crear('p', '', semana.length ? plural(minutos, 'minuto', 'minutos') + ' en total. ¡Sigue así!' : 'Registra tu primera sesión y gana 25 puntos.'));
    resumen.appendChild(m); resumen.appendChild(cont);

    var lista = $('entrenar-lista');
    lista.textContent = '';
    lista.appendChild(crear('h3', '', 'Historial'));
    if (!entrenos.length) {
      lista.appendChild(crear('p', 'nota', 'Aquí verás tus sesiones de gym y de otros deportes.'));
      return;
    }
    entrenos.slice().reverse().slice(0, 30).forEach(function (e) {
      var d = deporte(e.deporte);
      var fila = crear('div', 'fila-entreno');
      fila.appendChild(crear('span', 'habito-icono', d.emoji));
      var datos = crear('div', 'datos');
      datos.appendChild(crear('b', '', d.nombre + ' · ' + e.minutos + ' min'));
      datos.appendChild(crear('span', '', e.fecha === L.clave(fecha) ? 'Hoy'
        : L.aFecha(e.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })));
      var borrar = crear('button', 'borrar', '✕');
      borrar.type = 'button';
      borrar.setAttribute('aria-label', 'Borrar entrenamiento');
      borrar.addEventListener('click', function () {
        if (!borrar.classList.contains('confirmar')) { borrar.classList.add('confirmar'); borrar.textContent = '¿Borrar?'; return; }
        estado.entrenos = estado.entrenos.filter(function (x) { return x.id !== e.id; });
        guardar(); pintar();
      });
      fila.appendChild(datos); fila.appendChild(borrar);
      lista.appendChild(fila);
    });
  }

  function abrirEntreno() {
    borradorEntreno = { deporte: 'gym', minutos: 60 };
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
      var b = crear('button', 'opcion-deporte' + (d.id === borradorEntreno.deporte ? ' elegido' : ''));
      b.type = 'button';
      b.appendChild(crear('i', '', d.emoji));
      b.appendChild(crear('span', '', d.nombre));
      b.addEventListener('click', function () { borradorEntreno.deporte = d.id; pintarOpcionesEntreno(); });
      caja.appendChild(b);
    });
    var cajaMin = $('opciones-minutos');
    cajaMin.textContent = '';
    MINUTOS.forEach(function (n) {
      var b = crear('button', 'opcion-minutos' + (n === borradorEntreno.minutos ? ' elegido' : ''), String(n));
      b.type = 'button';
      b.setAttribute('aria-label', n + ' minutos');
      b.addEventListener('click', function () {
        borradorEntreno.minutos = n; $('campo-minutos').value = ''; $('error-minutos').hidden = true; pintarOpcionesEntreno();
      });
      cajaMin.appendChild(b);
    });
  }

  function cerrarEntreno() { cerrarCapa(); }
  function ocultarEntreno() {
    $('fondo-entreno').hidden = true;
    $('campo-minutos').blur();
    borradorEntreno = null;
  }

  function guardarEntreno(evento) {
    evento.preventDefault();
    var minutos = Math.round(Number(borradorEntreno.minutos));
    if (!(minutos >= 1 && minutos <= 600)) { $('error-minutos').hidden = false; return; }
    estado.entrenos.push({
      id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      deporte: borradorEntreno.deporte, minutos: minutos, fecha: L.clave(hoy())
    });
    vibrar(25);
    revisarLogros();
    guardar();
    cerrarEntreno();
    pintar();
    siguienteCelebracion();
  }

  // ---------- Perfil y logros ----------
  function pintarPerfil() {
    var fecha = hoy();
    var xp = L.experiencia(estado.habitos, estado.entrenos, numAmigos());
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
      cajaNombre.appendChild(crear('span', '', 'Nivel ' + niv.nivel + ' · ' + xp + ' puntos'));
      arriba.appendChild(cajaNombre);
      var engrane = crear('button', 'btn-engrane');
      engrane.type = 'button';
      engrane.setAttribute('aria-label', 'Configuración');
      engrane.innerHTML = ENGRANE;
      engrane.addEventListener('click', abrirAjustes);
      arriba.appendChild(engrane);
      cabeza.appendChild(arriba);

      // Estado de la cuenta
      var s = window.Api && window.Api.sesion();
      var lineaCuenta = crear('div', 'linea-cuenta');
      if (s && s.token) {
        lineaCuenta.appendChild(crear('span', 'cuenta-ok', '✓ ' + s.usuario.correo));
      } else if (window.RACHA_API) {
        lineaCuenta.appendChild(crear('span', '', 'Sin cuenta: tu progreso solo vive en este teléfono.'));
        var btnCuenta = crear('button', 'boton-chico boton-chico-principal', 'Crear cuenta');
        btnCuenta.type = 'button';
        btnCuenta.addEventListener('click', function () { if (window.Cuenta) window.Cuenta.abrir('crear'); });
        lineaCuenta.appendChild(btnCuenta);
      }
      if (lineaCuenta.childNodes.length) cabeza.appendChild(lineaCuenta);

      var avatares = crear('div', 'avatares');
      AVATARES.forEach(function (a) {
        var b = crear('button', 'opcion-emoji' + (a === estado.perfil.avatar ? ' elegido' : ''), a);
        b.type = 'button';
        b.addEventListener('click', function () { estado.perfil.avatar = a; guardar(); pintarPerfil(); });
        avatares.appendChild(b);
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
    }

    var lista = L.logros(estado.habitos, estado.entrenos, fecha, numAmigos());
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
    var ganados = L.logros(estado.habitos, estado.entrenos, hoy(), numAmigos()).filter(function (l) { return l.logrado; });
    var vistos = estado.logrosVistos || [];
    ganados.forEach(function (l) {
      if (vistos.indexOf(l.id) !== -1) return;
      vistos.push(l.id);
      colaCelebra.push({ titulo: '¡Logro desbloqueado!', texto: l.titulo + ': ' + l.desc.toLowerCase() + '.', emoji: l.emoji });
    });
    estado.logrosVistos = vistos;
  }

  // Revisa logros (por ejemplo al agregar un amigo) y celebra solo si hay algo nuevo
  function revisarLogrosYCelebrar() {
    var antes = colaCelebra.length;
    revisarLogros();
    guardar();
    pintar();
    if (colaCelebra.length > antes && $('celebra').hidden) siguienteCelebracion();
  }

  // ---------- Celebración ----------
  // Muestra la siguiente celebración pendiente (día completo o logro nuevo).
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
  }

  // ---------- Navegación ----------
  // Pantallas que vienen de otros archivos (amigos en cuenta.js, configuración en ajustes.js)
  var vistasExtra = {};
  function registrarVista(nombre, pintarla, alEntrar) {
    vistasExtra[nombre] = { pintar: pintarla, alEntrar: alEntrar };
  }

  function pintar() {
    pintarHoy();
    if (vista === 'progreso') pintarProgreso();
    if (vista === 'entrenar') pintarEntrenar();
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

  // ---------- Hoja genérica (la usan cuenta.js y ajustes.js) ----------
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
    var xp = L.experiencia(estado.habitos, estado.entrenos, numAmigos());
    var lunes = L.clave(L.sumarDias(fecha, -((fecha.getDay() + 6) % 7)));
    return {
      xp: xp,
      nivel: L.nivel(xp).nivel,
      racha: L.rachaGeneral(estado.habitos, fecha),
      logros: L.logros(estado.habitos, estado.entrenos, fecha, numAmigos()).filter(function (l) { return l.logrado; }).length,
      minutosSemana: estado.entrenos.filter(function (e) { return e.fecha >= lunes; })
        .reduce(function (s, e) { return s + e.minutos; }, 0)
    };
  }

  // Marca como vistos los logros que ya se tenían, para no celebrarlos todos de golpe
  function marcarLogrosVistos(datos) {
    if (Array.isArray(datos.logrosVistos)) return;
    datos.logrosVistos = L.logros(datos.habitos, datos.entrenos, hoy(), numAmigos())
      .filter(function (l) { return l.logrado; }).map(function (l) { return l.id; });
  }

  // Cambia todos los datos del teléfono (por ejemplo, al traer el respaldo de tu cuenta)
  function reemplazarEstado(datos) {
    var nuevo = normalizar(JSON.parse(JSON.stringify(datos))) || estadoVacio();
    marcarLogrosVistos(nuevo);
    estado = nuevo;
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

  // Lo que otros archivos (cuenta.js, ajustes.js) pueden usar
  window.Racha = {
    $: $, crear: crear, plural: plural, avisar: avisar, vibrar: vibrar, FLAMA: FLAMA,
    estado: function () { return estado; },
    vista: function () { return vista; },
    tieneDatos: function () { return estado.habitos.length > 0 || estado.entrenos.length > 0; },
    guardar: guardar, pintar: pintar, cambiarVista: cambiarVista, registrarVista: registrarVista,
    abrirCapa: abrirCapa, cerrarCapa: cerrarCapa, abrirHojaGenerica: abrirHojaGenerica,
    ajustes: ajustes, guardarAjustes: guardarAjustes, programarRecordatorios: programarRecordatorios,
    resumen: resumen, reemplazarEstado: reemplazarEstado, borrarDatosLocales: borrarDatosLocales,
    revisarLogrosYCelebrar: revisarLogrosYCelebrar
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
  $('campo-hora').addEventListener('input', function () { $('btn-quitar-hora').disabled = !this.value; });
  $('btn-quitar-hora').addEventListener('click', function () { $('campo-hora').value = ''; this.disabled = true; });
  $('fondo-hoja').addEventListener('click', function (e) { if (e.target === this) cerrarHoja(); });
  $('btn-celebra').addEventListener('click', siguienteCelebracion);
  $('btn-entreno').addEventListener('click', abrirEntreno);
  $('hoja-entreno').addEventListener('submit', guardarEntreno);
  $('btn-cancelar-entreno').addEventListener('click', function () { cerrarEntreno(); });
  $('fondo-entreno').addEventListener('click', function (e) { if (e.target === this) cerrarEntreno(); });
  $('campo-minutos').addEventListener('input', function () {
    borradorEntreno.minutos = this.value === '' ? 0 : Number(this.value);
    $('error-minutos').hidden = true;
    pintarOpcionesEntreno();
  });
  // Si dejas la app abierta y cambia el día, se actualiza al volver
  document.addEventListener('visibilitychange', function () { if (!document.hidden) pintar(); });

  // Primera vez con esta versión: los logros que ya tenías se marcan sin celebrarlos todos de golpe
  if (!Array.isArray(estado.logrosVistos)) {
    marcarLogrosVistos(estado);
    guardar();
  }

  pintar();
})();
