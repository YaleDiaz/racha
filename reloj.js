/*
  reloj.js — Conexión con tu reloj (Redmi Watch u otro) a través de Health Connect de Android.

  Cómo llegan los datos:  reloj  →  app Mi Fitness  →  Health Connect  →  Racha
  (En Mi Fitness hay que activar la opción de Health Connect una sola vez.)

  Qué hace:
   - Lee tus pasos y calorías de hoy.
   - Marca solos los hábitos con meta de pasos ("Caminar 8,000 pasos").
   - Importa los entrenamientos que registró tu reloj (correr, caminar, gym…).
  Solo funciona en la app instalada en Android; en la computadora no hace nada.
*/
(function () {
  var R = window.Racha;
  var L = window.Logica;
  var crear = R.crear;
  var boton = R.boton;

  var CLAVE = 'racha.reloj';
  var MINIMO_MINUTOS = 10; // entrenamientos más cortos no se importan
  // Tipos de entrenamiento de Health Connect → deportes de Racha
  var TIPOS = {
    running: 'correr', runningTreadmill: 'correr', trackAndField: 'correr',
    walking: 'caminar', hiking: 'caminar',
    cycling: 'bici', bikingStationary: 'bici', handCycling: 'bici',
    swimming: 'natacion', swimmingPool: 'natacion', swimmingOpenWater: 'natacion',
    soccer: 'futbol', americanFootball: 'futbol', basketball: 'basquet',
    boxing: 'box', kickboxing: 'box', martialArts: 'box', wrestling: 'box',
    yoga: 'yoga', pilates: 'yoga', flexibility: 'yoga', stretching: 'yoga',
    strengthTraining: 'gym', traditionalStrengthTraining: 'gym', functionalStrengthTraining: 'gym',
    weightlifting: 'gym', calisthenics: 'gym', crossTraining: 'gym', highIntensityIntervalTraining: 'gym', coreTraining: 'gym'
  };

  var datos = leer();               // { fecha, pasos, kcal, actualizado }
  var ultimaLectura = 0;
  var leyendo = false;

  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch (e) { return null; } }
  function guardarDatos() { try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch (e) { /* nada */ } }

  function plugin() {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.Health) || null;
  }
  function esApp() { return !!plugin(); }

  // ¿Se puede usar Health Connect en este teléfono?
  function disponible() {
    var H = plugin();
    if (!H) return Promise.resolve({ ok: false, razon: 'Solo funciona en la app instalada en tu Android.' });
    return H.isAvailable().then(function (r) {
      if (r && r.available) return { ok: true };
      var texto = String((r && r.reason) || '');
      return {
        ok: false,
        actualizar: /update/i.test(texto),
        razon: /update/i.test(texto)
          ? 'Health Connect necesita actualizarse. Actualízalo desde la Play Store y vuelve a intentar.'
          : 'Tu teléfono no tiene Health Connect. Instálalo gratis desde la Play Store ("Health Connect by Android").'
      };
    }, function () { return { ok: false, razon: 'No se pudo revisar Health Connect.' }; });
  }

  function conectar() {
    var H = plugin();
    return disponible().then(function (d) {
      if (!d.ok) throw new Error(d.razon);
      return H.requestAuthorization({ read: ['steps', 'calories', 'workouts'], write: [] });
    }).then(function (estado) {
      var permitidos = (estado && estado.readAuthorized) || [];
      if (permitidos.indexOf('steps') === -1 && permitidos.indexOf('workouts') === -1) {
        throw new Error('No diste permiso para leer tus pasos. Puedes darlo en Configuración → Reloj → Abrir Health Connect.');
      }
      R.ajustes.reloj = true;
      R.estado().relojDesde = R.estado().relojDesde || L.clave(L.sumarDias(R.hoy(), -2));
      R.guardarAjustes();
      R.guardar();
      return actualizar(true);
    }).then(function () {
      R.avisar('⌚ ¡Reloj conectado! Hoy llevas ' + R.miles(pasosHoy() || 0) + ' pasos.');
      R.pintar();
    });
  }

  function desconectar() {
    R.ajustes.reloj = false;
    R.guardarAjustes();
    datos = null;
    try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ }
    R.pintar();
  }

  function inicioDelDia() {
    var h = R.hoy();
    return new Date(h.getFullYear(), h.getMonth(), h.getDate());
  }

  // Suma de un dato (pasos o calorías) desde la medianoche hasta ahora
  function sumaDeHoy(tipo) {
    return plugin().queryAggregated({
      dataType: tipo, startDate: inicioDelDia().toISOString(), endDate: new Date().toISOString(), bucket: 'day', aggregation: 'sum'
    }).then(function (r) {
      return ((r && r.samples) || []).reduce(function (s, x) { return s + (Number(x.value) || 0); }, 0);
    }, function () { return null; });
  }

  // Lee todo (como mucho una vez por minuto, salvo que se pida "forzar")
  function actualizar(forzar) {
    if (!R.ajustes.reloj || !plugin() || leyendo) return Promise.resolve();
    if (!forzar && Date.now() - ultimaLectura < 60000) return Promise.resolve();
    leyendo = true;
    ultimaLectura = Date.now();
    return Promise.all([sumaDeHoy('steps'), sumaDeHoy('calories')]).then(function (r) {
      datos = {
        fecha: R.claveHoy(),
        pasos: r[0] === null ? (datos && datos.fecha === R.claveHoy() ? datos.pasos : 0) : Math.round(r[0]),
        kcal: r[1] === null ? null : Math.round(r[1]),
        actualizado: Date.now()
      };
      guardarDatos();
      return importarEntrenos();
    }).then(function () {
      revisarHabitos();
    }).catch(function () { /* sin permiso o sin datos: no pasa nada */ }).then(function () {
      leyendo = false;
      if (R.vista() === 'entrenar' || R.vista() === 'hoy') R.pintar();
    });
  }

  function pasosHoy() {
    if (!R.ajustes.reloj || !datos || datos.fecha !== R.claveHoy()) return null;
    return datos.pasos;
  }

  // Hábitos con meta de pasos: se marcan solos al llegar
  function revisarHabitos() {
    var pasos = pasosHoy();
    if (pasos === null) return;
    var hoyF = R.hoy();
    R.estado().habitos.forEach(function (h) {
      if (!h.pasos || pasos < h.pasos || !L.toca(h, hoyF)) return;
      if (R.marcarPorReloj(h.id)) R.avisar('⌚ ¡Llegaste a ' + R.miles(h.pasos) + ' pasos! Se marcó "' + h.nombre + '".');
    });
  }

  // Entrenamientos del reloj de los últimos 3 días que todavía no estén en Racha
  function importarEntrenos() {
    var H = plugin();
    var est = R.estado();
    var desde = L.sumarDias(inicioDelDia(), -3);
    if (est.relojDesde && L.aFecha(est.relojDesde) > desde) desde = L.aFecha(est.relojDesde);
    return H.queryWorkouts({ startDate: desde.toISOString(), endDate: new Date().toISOString(), limit: 50 }).then(function (r) {
      var nuevos = 0;
      var nivelAntes = R.nivelActual();
      var ignorados = est.relojIgnorados || [];
      ((r && r.workouts) || []).forEach(function (w) {
        var minutos = Math.round((Number(w.duration) || 0) / 60);
        if (minutos < MINIMO_MINUTOS) return;
        var id = 'w' + String(w.platformId || w.startDate).replace(/[^A-Za-z0-9]/g, '').slice(-40);
        if (ignorados.indexOf(id) !== -1 || est.entrenos.some(function (e) { return e.id === id; })) return;
        var deporte = TIPOS[w.workoutType] || 'otro';
        var fecha = L.clave(new Date(w.startDate));
        // Si ese día ya registraste ese deporte a mano (por ejemplo tu rutina de gym), no se duplica
        if (est.entrenos.some(function (e) { return e.fecha === fecha && e.deporte === deporte && e.origen !== 'reloj'; })) {
          est.relojIgnorados = ignorados.concat([id]).slice(-200);
          ignorados = est.relojIgnorados;
          return;
        }
        R.agregarEntreno({ id: id, deporte: deporte, minutos: Math.min(600, minutos), fecha: fecha, origen: 'reloj' }, fecha === R.claveHoy());
        nuevos++;
      });
      if (nuevos) {
        R.revisarAvances(nivelAntes);
        R.guardar();
        R.avisar('⌚ ' + (nuevos === 1 ? 'Se agregó 1 entrenamiento' : 'Se agregaron ' + nuevos + ' entrenamientos') + ' de tu reloj. +' + nuevos * L.PUNTOS.entreno + ' puntos.');
        R.siguienteCelebracion();
      }
    }, function () { /* sin permiso de entrenamientos */ });
  }

  // Tarjeta para la pestaña Entrenar
  function tarjeta() {
    if (!esApp()) return null;
    var t = crear('section', 'tarjeta tarjeta-reloj');
    if (!R.ajustes.reloj) {
      t.appendChild(crear('span', 'emoji-grande', '⌚'));
      var d = crear('div', 'datos');
      d.appendChild(crear('b', '', 'Conecta tu reloj'));
      d.appendChild(crear('span', '', 'Tus pasos y entrenamientos del Redmi Watch llegan solos.'));
      t.appendChild(d);
      t.appendChild(boton('Conectar', 'boton-chico boton-chico-principal', function () {
        conectar().catch(function (e) { R.avisar(e.message); });
      }));
      return t;
    }
    t.appendChild(crear('span', 'emoji-grande', '⌚'));
    var info = crear('div', 'datos');
    var pasos = pasosHoy();
    info.appendChild(crear('b', '', pasos === null ? 'Leyendo tu reloj…' : R.miles(pasos) + ' pasos hoy' + (datos && datos.kcal ? ' · ' + R.miles(datos.kcal) + ' kcal' : '')));
    var hace = datos ? Math.round((Date.now() - datos.actualizado) / 60000) : null;
    info.appendChild(crear('span', '', hace === null ? 'Health Connect' : hace < 1 ? 'Actualizado hace un momento' : 'Actualizado hace ' + hace + ' min'));
    t.appendChild(info);
    var refrescar = boton('↻', 'boton-chico', function () { refrescar.disabled = true; actualizar(true); });
    refrescar.setAttribute('aria-label', 'Actualizar datos del reloj');
    t.appendChild(refrescar);
    return t;
  }

  function abrirHealthConnect() {
    var H = plugin();
    if (!H) return;
    H.openHealthConnectSettings().catch(function () {
      R.avisar('No se pudo abrir Health Connect. Búscalo en los ajustes del teléfono.');
    });
  }

  // Revisa al abrir, al volver a la app y cada 5 minutos mientras está abierta
  setTimeout(function () { actualizar(true); }, 2000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) actualizar(false); });
  setInterval(function () { if (!document.hidden) actualizar(false); }, 300000);

  window.Reloj = {
    esApp: esApp, disponible: disponible, conectar: conectar, desconectar: desconectar,
    actualizar: actualizar, pasosHoy: pasosHoy, revisarHabitos: revisarHabitos,
    tarjeta: tarjeta, abrirHealthConnect: abrirHealthConnect,
    datos: function () { return datos; }
  };
})();
