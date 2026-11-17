/*
  gym.js — La pestaña Entrenar:
   - Rutinas con ejercicios (series × repeticiones) y una pantalla para entrenar
     anotando el peso y las repeticiones de cada serie, con descanso cronometrado.
   - Récords personales: te avisa cuando superas tu mejor marca.
   - Historial por ejercicio con gráfica.
   - Peso corporal con gráfica.
   - Otros deportes (correr, fútbol…) y entrenamientos que llegan del reloj.

  Datos (dentro del estado de app.js, se respaldan con tu cuenta):
   rutinas:  [ { id, nombre, ejercicios: [ { nombre, series: 3, reps: 10 } ] } ]
   sesiones: [ { id, fecha, inicio, minutos, nombre, rutinaId, ejercicios: [ { nombre, series: [ { peso, reps } ] } ] } ]
   pesos:    [ { fecha: "2026-11-17", kg: 72.4 } ]
   entrenoActivo: el entrenamiento que estás haciendo ahora (sobrevive si se cierra la app)
*/
(function () {
  var R = window.Racha;
  var L = window.Logica;
  var $ = R.$;
  var crear = R.crear;
  var boton = R.boton;

  var DESCANSO = 90; // segundos de descanso entre series
  var SUGERIDOS = ['Press banca', 'Press inclinado', 'Aperturas', 'Fondos', 'Press militar', 'Elevaciones laterales',
    'Dominadas', 'Jalón al pecho', 'Remo con barra', 'Remo con mancuerna', 'Peso muerto', 'Sentadilla', 'Prensa',
    'Zancadas', 'Hip thrust', 'Extensión de pierna', 'Curl femoral', 'Pantorrilla', 'Curl de bíceps', 'Curl martillo',
    'Extensión de tríceps', 'Press francés', 'Abdominales', 'Plancha', 'Lagartijas'];
  var PLANTILLAS = [
    { nombre: 'Pecho y tríceps', ejercicios: ['Press banca', 'Press inclinado', 'Aperturas', 'Fondos', 'Extensión de tríceps'] },
    { nombre: 'Espalda y bíceps', ejercicios: ['Dominadas', 'Jalón al pecho', 'Remo con barra', 'Curl de bíceps', 'Curl martillo'] },
    { nombre: 'Pierna', ejercicios: ['Sentadilla', 'Prensa', 'Zancadas', 'Curl femoral', 'Pantorrilla'] },
    { nombre: 'Cuerpo completo', ejercicios: ['Sentadilla', 'Press banca', 'Remo con barra', 'Press militar', 'Peso muerto'] }
  ];

  function est() { return R.estado(); }
  function nuevoId(letra) { return letra + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  // "62,5" o "62.5" → 62.5 ; vacío o raro → NaN
  function numero(v) {
    var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
  }
  function kg(n) { return String(n).replace('.', ','); }
  function marca(s) { return s.peso > 0 ? kg(s.peso) + ' kg × ' + s.reps : s.reps + ' reps'; }
  function fechaCorta(k) { return L.aFecha(k).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  function haceDias(k) {
    var dias = Math.round((L.aFecha(R.claveHoy()) - L.aFecha(k)) / 86400000);
    return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : 'hace ' + dias + ' días';
  }
  function encabezado(titulo, textoBoton, alTocar) {
    var c = crear('div', 'logros-cabeza');
    c.appendChild(crear('h3', '', titulo));
    if (textoBoton) c.appendChild(boton(textoBoton, 'boton-chico boton-chico-principal', alTocar));
    return c;
  }

  // ======================================================================
  //  PANTALLA ENTRENAR
  // ======================================================================
  function pintarEntrenar() {
    var v = $('vista-entrenar');
    var e = est();
    v.textContent = '';
    var fecha = R.hoy();
    var lunes = L.clave(L.lunes(fecha));
    var semana = e.entrenos.filter(function (x) { return x.fecha >= lunes; });
    var minutos = semana.reduce(function (s, x) { return s + x.minutos; }, 0);

    // Resumen de la semana
    var resumen = crear('section', 'tarjeta-progreso fuego');
    resumen.appendChild(crear('span', 'emoji-grande', '💪'));
    var cont = crear('div', 'contenido');
    cont.appendChild(crear('h2', '', semana.length ? R.plural(semana.length, 'entrenamiento', 'entrenamientos') + ' esta semana' : 'Aún no entrenas esta semana'));
    cont.appendChild(crear('p', '', semana.length ? R.plural(minutos, 'minuto', 'minutos') + ' en total. ¡Sigue así!' : 'Empieza una rutina y gana 25 puntos (+20 por cada récord).'));
    resumen.appendChild(cont);
    v.appendChild(resumen);

    // Datos del reloj (pasos, calorías)
    if (window.Reloj) {
      var reloj = window.Reloj.tarjeta();
      if (reloj) v.appendChild(reloj);
    }

    // Entrenamiento en curso
    if (e.entrenoActivo) {
      var activo = crear('section', 'tarjeta tarjeta-activo');
      activo.appendChild(crear('span', 'emoji-grande', '⏱️'));
      var t = crear('div', 'datos');
      t.appendChild(crear('b', '', 'Entrenamiento en curso'));
      t.appendChild(crear('span', '', e.entrenoActivo.nombre + ' · ' + Math.max(1, Math.round((Date.now() - e.entrenoActivo.inicio) / 60000)) + ' min'));
      activo.appendChild(t);
      activo.appendChild(boton('Continuar', 'boton-chico boton-chico-principal', abrirPantalla));
      v.appendChild(activo);
    }

    v.appendChild(tarjetaRutinas());
    v.appendChild(boton('Registrar otro deporte', 'boton boton-secundario', R.abrirEntreno));
    v.appendChild(tarjetaPeso());
    v.appendChild(tarjetaRecords());
    v.appendChild(tarjetaHistorial());
  }

  // ---------- Rutinas ----------
  function tarjetaRutinas() {
    var e = est();
    var t = crear('section', 'tarjeta');
    t.appendChild(encabezado('Mis rutinas', '+ Nueva', function () { editarRutina(null); }));
    if (!e.rutinas.length) {
      t.appendChild(crear('p', 'nota', 'Crea tu rutina con tus ejercicios, o empieza con una plantilla:'));
      var chips = crear('div', 'sugerencias sugerencias-izq');
      PLANTILLAS.forEach(function (p) {
        chips.appendChild(boton('🏋️ ' + p.nombre, 'sugerencia', function () {
          e.rutinas.push({ id: nuevoId('r'), nombre: p.nombre, ejercicios: p.ejercicios.map(function (n) { return { nombre: n, series: 3, reps: 10 }; }) });
          R.guardar(); R.pintar();
          R.avisar('Rutina "' + p.nombre + '" creada. Tócala para cambiar sus ejercicios.');
        }));
      });
      t.appendChild(chips);
    }
    e.rutinas.forEach(function (r) {
      var fila = crear('div', 'fila-entreno fila-rutina');
      var info = boton(undefined, 'fila-rutina-info', function () { editarRutina(r); });
      info.appendChild(crear('span', 'habito-icono', '🏋️'));
      var datos = crear('span', 'datos');
      datos.appendChild(crear('b', '', r.nombre));
      var ultima = e.sesiones.filter(function (s) { return s.rutinaId === r.id; }).map(function (s) { return s.fecha; }).sort().pop();
      datos.appendChild(crear('span', '', R.plural(r.ejercicios.length, 'ejercicio', 'ejercicios') + (ultima ? ' · ' + haceDias(ultima) : ' · sin estrenar')));
      info.appendChild(datos);
      fila.appendChild(info);
      fila.appendChild(boton('Empezar', 'boton-chico boton-chico-fuego', function () { empezar(r); }));
      t.appendChild(fila);
    });
    if (e.rutinas.length) t.appendChild(boton('Entrenar sin rutina', 'boton boton-plano', function () { empezar(null); }));
    return t;
  }

  // Selector de ejercicios: escribe o elige uno sugerido
  function selectorEjercicio(alElegir) {
    var caja = crear('div', 'selector-ejercicio');
    var fila = crear('div', 'fila-hora');
    var campo = crear('input', 'campo-texto');
    campo.placeholder = 'Escribe un ejercicio';
    campo.maxLength = 40;
    campo.setAttribute('aria-label', 'Nombre del ejercicio');
    fila.appendChild(campo);
    fila.appendChild(boton('Agregar', 'boton-chico boton-chico-principal', function () {
      var n = campo.value.trim();
      if (n) { alElegir(n); campo.value = ''; pintarChips(); }
    }));
    caja.appendChild(fila);
    var chips = crear('div', 'sugerencias sugerencias-izq');
    function pintarChips() {
      chips.textContent = '';
      var filtro = L.claveEjercicio(campo.value);
      SUGERIDOS.filter(function (n) { return !filtro || L.claveEjercicio(n).indexOf(filtro) !== -1; }).slice(0, 14).forEach(function (n) {
        chips.appendChild(boton(n, 'sugerencia sugerencia-chica', function () { alElegir(n); }));
      });
    }
    campo.addEventListener('input', pintarChips);
    pintarChips();
    caja.appendChild(chips);
    return caja;
  }

  function editarRutina(rutina) {
    var ed = rutina
      ? { id: rutina.id, nombre: rutina.nombre, ejercicios: rutina.ejercicios.map(function (x) { return { nombre: x.nombre, series: x.series, reps: x.reps }; }) }
      : { id: null, nombre: '', ejercicios: [] };
    R.abrirHojaGenerica(function (hoja) {
      hoja.appendChild(crear('h2', '', rutina ? 'Editar rutina' : 'Nueva rutina'));
      var etq = crear('label', 'campo');
      etq.appendChild(crear('span', '', 'Nombre'));
      var nombre = crear('input');
      nombre.maxLength = 30;
      nombre.placeholder = 'Ej. Pecho y tríceps';
      nombre.value = ed.nombre;
      etq.appendChild(nombre);
      hoja.appendChild(etq);

      var campoEj = crear('div', 'campo');
      campoEj.appendChild(crear('span', '', 'Ejercicios (series × repeticiones)'));
      var lista = crear('div', 'lista-ejercicios');
      campoEj.appendChild(lista);
      hoja.appendChild(campoEj);

      function pintarLista() {
        lista.textContent = '';
        if (!ed.ejercicios.length) lista.appendChild(crear('p', 'nota', 'Agrega tus ejercicios abajo.'));
        ed.ejercicios.forEach(function (x, i) {
          var f = crear('div', 'fila-ejercicio-ed');
          f.appendChild(crear('b', '', x.nombre));
          [['series', 1, 10], ['reps', 1, 100]].forEach(function (c, j) {
            var inp = crear('input', 'num-chico');
            inp.type = 'number';
            inp.inputMode = 'numeric';
            inp.min = c[1]; inp.max = c[2];
            inp.value = x[c[0]];
            inp.setAttribute('aria-label', (c[0] === 'series' ? 'Series de ' : 'Repeticiones de ') + x.nombre);
            inp.addEventListener('input', function () {
              var n = Math.round(numero(inp.value));
              if (n >= c[1] && n <= c[2]) x[c[0]] = n;
            });
            f.appendChild(inp);
            if (j === 0) f.appendChild(crear('span', 'por', '×'));
          });
          var quitar = boton('✕', 'borrar', function () { ed.ejercicios.splice(i, 1); pintarLista(); });
          quitar.setAttribute('aria-label', 'Quitar ' + x.nombre);
          f.appendChild(quitar);
          lista.appendChild(f);
        });
      }
      pintarLista();
      hoja.appendChild(selectorEjercicio(function (n) {
        if (ed.ejercicios.length >= 20) return;
        ed.ejercicios.push({ nombre: n, series: 3, reps: 10 });
        pintarLista();
      }));

      var error = crear('p', 'error-form');
      error.hidden = true;
      hoja.appendChild(error);
      hoja.appendChild(boton('Guardar', 'boton boton-principal', function () {
        var n = nombre.value.trim();
        if (!n) { error.textContent = 'Ponle nombre a tu rutina.'; error.hidden = false; return; }
        if (!ed.ejercicios.length) { error.textContent = 'Agrega al menos un ejercicio.'; error.hidden = false; return; }
        var e = est();
        if (ed.id) {
          var r = e.rutinas.filter(function (x) { return x.id === ed.id; })[0];
          r.nombre = n; r.ejercicios = ed.ejercicios;
        } else {
          e.rutinas.push({ id: nuevoId('r'), nombre: n, ejercicios: ed.ejercicios });
        }
        R.guardar(); R.cerrarCapa(); R.pintar();
      }));
      if (rutina) {
        var borrar = boton('Eliminar rutina', 'boton boton-peligro', function () {
          if (!borrar.classList.contains('confirmar')) { borrar.classList.add('confirmar'); borrar.textContent = '¿Seguro? Toca otra vez'; return; }
          var e = est();
          e.rutinas = e.rutinas.filter(function (x) { return x.id !== rutina.id; });
          R.guardar(); R.cerrarCapa(); R.pintar();
        });
        hoja.appendChild(borrar);
      }
      hoja.appendChild(boton('Cancelar', 'boton boton-plano', R.cerrarCapa));
    });
  }

  // ======================================================================
  //  ENTRENANDO (pantalla completa)
  // ======================================================================
  var relojPantalla = null;
  var pantallaAbierta = false;
  var relojGuardar = null;

  function activo() { return est().entrenoActivo; }
  function guardarPronto() {
    clearTimeout(relojGuardar);
    relojGuardar = setTimeout(R.guardar, 800);
  }

  function nuevaSerie() { return { peso: '', reps: '', hecha: false }; }

  function empezar(rutina) {
    var e = est();
    if (!e.entrenoActivo) {
      e.entrenoActivo = {
        inicio: Date.now(),
        nombre: rutina ? rutina.nombre : 'Entrenamiento libre',
        rutinaId: rutina ? rutina.id : null,
        ejercicios: (rutina ? rutina.ejercicios : []).map(function (x) {
          var series = [];
          for (var i = 0; i < x.series; i++) series.push(nuevaSerie());
          return { nombre: x.nombre, meta: x.reps, series: series };
        }),
        anunciados: [],
        descansoHasta: null
      };
      R.guardar();
    } else {
      R.avisar('Ya tienes un entrenamiento en curso. Termínalo o descártalo primero.');
    }
    abrirPantalla();
  }

  function abrirPantalla() {
    if (!activo()) return;
    $('pantalla-gym').hidden = false;
    pantallaAbierta = true;
    pintarPantalla();
    R.abrirCapa(ocultarPantalla); // "atrás" la minimiza (el entrenamiento sigue)
    clearInterval(relojPantalla);
    relojPantalla = setInterval(tic, 1000);
  }

  function ocultarPantalla() {
    pantallaAbierta = false;
    clearInterval(relojPantalla);
    $('pantalla-gym').hidden = true;
    $('pantalla-gym').textContent = '';
    R.guardar();
    R.pintar();
  }

  function duracion(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(seg).padStart(2, '0');
  }

  // Cada segundo: reloj del entrenamiento y cuenta del descanso
  function tic() {
    var a = activo();
    if (!a || !pantallaAbierta) return;
    var r = $('gym-reloj');
    if (r) r.textContent = duracion(Date.now() - a.inicio);
    var barra = $('gym-descanso');
    if (!barra) return;
    if (!a.descansoHasta) { barra.hidden = true; return; }
    var falta = a.descansoHasta - Date.now();
    if (falta <= 0) {
      a.descansoHasta = null;
      barra.hidden = true;
      R.sonar('descanso');
      R.vibrar([200, 120, 200]);
      return;
    }
    barra.hidden = false;
    $('gym-descanso-tiempo').textContent = duracion(falta);
  }

  // Lo que hiciste la última vez en ese ejercicio (para sugerir el peso)
  function ultimaVez(nombre) {
    return L.historialEjercicio(est().sesiones, nombre)[0] || null;
  }

  function pintarPantalla() {
    var a = activo();
    var p = $('pantalla-gym');
    var scroll = p.scrollTop;
    p.textContent = '';
    if (!a) return;
    var caja = crear('div', 'gym-caja');

    var cabeza = crear('header', 'gym-cabeza');
    var min = boton('‹', 'mes-flecha', R.cerrarCapa);
    min.setAttribute('aria-label', 'Minimizar');
    cabeza.appendChild(min);
    var titulo = crear('div', 'gym-titulo');
    titulo.appendChild(crear('h2', '', a.nombre));
    var reloj = crear('span', 'gym-reloj', duracion(Date.now() - a.inicio));
    reloj.id = 'gym-reloj';
    titulo.appendChild(reloj);
    cabeza.appendChild(titulo);
    cabeza.appendChild(boton('Terminar', 'boton-chico boton-chico-principal', terminar));
    caja.appendChild(cabeza);

    var mejores = L.mejoresMarcas(est().sesiones);
    if (!a.ejercicios.length) caja.appendChild(crear('p', 'nota centrada-texto', 'Agrega tu primer ejercicio abajo.'));
    a.ejercicios.forEach(function (ej, i) { caja.appendChild(tarjetaEjercicio(ej, i, mejores)); });

    var agregar = crear('section', 'tarjeta');
    agregar.appendChild(crear('h3', '', 'Agregar ejercicio'));
    agregar.appendChild(selectorEjercicio(function (n) {
      a.ejercicios.push({ nombre: n, meta: 10, series: [nuevaSerie(), nuevaSerie(), nuevaSerie()] });
      R.guardar();
      pintarPantalla();
      var ultimo = p.querySelectorAll('.gym-ejercicio');
      if (ultimo.length) ultimo[ultimo.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    caja.appendChild(agregar);

    caja.appendChild(boton('Terminar entrenamiento', 'boton boton-fuego', terminar));
    var descartar = boton('Descartar entrenamiento', 'boton boton-plano', function () {
      if (!descartar.classList.contains('confirmar')) { descartar.classList.add('confirmar'); descartar.textContent = '¿Seguro? Se pierde lo anotado'; return; }
      est().entrenoActivo = null;
      R.guardar();
      R.cerrarCapa();
    });
    caja.appendChild(descartar);

    // Barra de descanso (abajo)
    var barra = crear('div', 'gym-descanso');
    barra.id = 'gym-descanso';
    barra.hidden = !a.descansoHasta;
    barra.appendChild(crear('span', '', '⏳ Descanso'));
    var tiempo = crear('b', '', a.descansoHasta ? duracion(a.descansoHasta - Date.now()) : '');
    tiempo.id = 'gym-descanso-tiempo';
    barra.appendChild(tiempo);
    barra.appendChild(boton('−15', 'boton-chico', function () { if (a.descansoHasta) a.descansoHasta -= 15000; tic(); }));
    barra.appendChild(boton('+15', 'boton-chico', function () { if (a.descansoHasta) a.descansoHasta += 15000; tic(); }));
    barra.appendChild(boton('Saltar', 'boton-chico', function () { a.descansoHasta = null; tic(); }));
    caja.appendChild(barra);

    var aviso = crear('div', 'gym-record');
    aviso.id = 'gym-record';
    aviso.hidden = true;
    caja.appendChild(aviso);

    p.appendChild(caja);
    p.scrollTop = scroll;
  }

  function tarjetaEjercicio(ej, i, mejores) {
    var a = activo();
    var t = crear('section', 'tarjeta gym-ejercicio');
    var cab = crear('div', 'logros-cabeza');
    cab.appendChild(crear('h3', '', ej.nombre));
    var quitar = boton('✕', 'borrar', function () {
      if (!quitar.classList.contains('confirmar')) { quitar.classList.add('confirmar'); quitar.textContent = '¿Quitar?'; return; }
      a.ejercicios.splice(i, 1);
      R.guardar(); pintarPantalla();
    });
    quitar.setAttribute('aria-label', 'Quitar ' + ej.nombre);
    cab.appendChild(quitar);
    t.appendChild(cab);

    var previa = ultimaVez(ej.nombre);
    var mejor = mejores[L.claveEjercicio(ej.nombre)];
    t.appendChild(crear('p', 'nota gym-previo', previa
      ? 'Última vez (' + fechaCorta(previa.fecha) + '): ' + previa.series.map(marca).join(' · ') + (mejor ? '  ·  🏆 Récord: ' + marca(mejor) : '')
      : 'Primera vez: hoy marcas tu base. La próxima vez que la superes será récord.'));

    var tabla = crear('div', 'gym-tabla');
    ['Serie', 'Kg', 'Reps', ''].forEach(function (x) { tabla.appendChild(crear('span', 'gym-th', x)); });
    ej.series.forEach(function (s, j) {
      // Sugerencia (número gris): lo de la última vez; si es la primera vez, la serie anterior de hoy
      var anterior = j > 0 && ej.series[j - 1].hecha ? { peso: numero(ej.series[j - 1].peso) || 0, reps: Math.round(numero(ej.series[j - 1].reps)) || 0 } : null;
      var sugerida = previa && previa.series[j] ? previa.series[j] : (previa ? previa.series[previa.series.length - 1] : anterior);
      tabla.appendChild(crear('span', 'gym-num', String(j + 1)));
      var kgIn = crear('input', 'gym-input');
      kgIn.inputMode = 'decimal';
      kgIn.placeholder = sugerida ? kg(sugerida.peso) : '0';
      kgIn.value = s.peso;
      kgIn.setAttribute('aria-label', 'Kilos de la serie ' + (j + 1));
      kgIn.addEventListener('input', function () { s.peso = kgIn.value; guardarPronto(); });
      var repsIn = crear('input', 'gym-input');
      repsIn.inputMode = 'numeric';
      repsIn.placeholder = String(sugerida ? sugerida.reps : (ej.meta || 10));
      repsIn.value = s.reps;
      repsIn.setAttribute('aria-label', 'Repeticiones de la serie ' + (j + 1));
      repsIn.addEventListener('input', function () { s.reps = repsIn.value; guardarPronto(); });
      if (s.hecha) { kgIn.disabled = true; repsIn.disabled = true; }
      tabla.appendChild(kgIn);
      tabla.appendChild(repsIn);
      var check = boton(undefined, 'gym-check' + (s.hecha ? ' hecha' : ''), function () { marcarSerie(ej, s, kgIn, repsIn); });
      check.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      check.setAttribute('aria-label', (s.hecha ? 'Desmarcar' : 'Marcar') + ' serie ' + (j + 1));
      tabla.appendChild(check);
    });
    t.appendChild(tabla);
    var fila = crear('div', 'fila-botones');
    fila.appendChild(boton('+ Serie', 'boton-chico', function () { ej.series.push(nuevaSerie()); R.guardar(); pintarPantalla(); }));
    if (ej.series.length > 1) {
      fila.appendChild(boton('− Serie', 'boton-chico', function () {
        var ultima = ej.series[ej.series.length - 1];
        if (ultima.hecha) return;
        ej.series.pop(); R.guardar(); pintarPantalla();
      }));
    }
    t.appendChild(fila);
    return t;
  }

  function marcarSerie(ej, s, kgIn, repsIn) {
    var a = activo();
    if (s.hecha) {
      s.hecha = false;
      R.guardar(); pintarPantalla();
      return;
    }
    // Si dejaste vacío, se usa lo sugerido (el número gris)
    var peso = numero(s.peso !== '' ? s.peso : kgIn.placeholder);
    var reps = Math.round(numero(s.reps !== '' ? s.reps : repsIn.placeholder));
    if (!(reps >= 1 && reps <= 500)) { R.avisar('Escribe cuántas repeticiones hiciste.'); repsIn.focus(); return; }
    if (!(peso >= 0 && peso <= 1000)) peso = 0;
    s.peso = String(peso);
    s.reps = String(reps);
    s.hecha = true;
    R.vibrar(20);
    a.descansoHasta = Date.now() + DESCANSO * 1000;

    // ¿Récord? Se compara con tus entrenamientos anteriores (la primera vez no cuenta)
    var k = L.claveEjercicio(ej.nombre);
    var antes = L.mejoresMarcas(est().sesiones)[k];
    if (antes && L.superaMarca({ peso: peso, reps: reps }, antes) && a.anunciados.indexOf(k) === -1) {
      a.anunciados.push(k);
      R.sonar('record');
      R.vibrar([30, 40, 30, 40, 60]);
      setTimeout(function () { mostrarRecord('🏆 ¡Nuevo récord en ' + ej.nombre + '! ' + marca({ peso: peso, reps: reps }) + ' (antes ' + marca(antes) + ')'); }, 50);
    } else {
      R.sonar('hecho');
    }
    R.guardar();
    pintarPantalla();
    tic();
  }

  var relojRecord = null;
  function mostrarRecord(texto) {
    var aviso = $('gym-record');
    if (!aviso) return;
    aviso.textContent = texto;
    aviso.hidden = false;
    clearTimeout(relojRecord);
    relojRecord = setTimeout(function () { var x = $('gym-record'); if (x) x.hidden = true; }, 4000);
  }

  function terminar() {
    var e = est();
    var a = e.entrenoActivo;
    if (!a) return;
    var hechos = a.ejercicios.map(function (ej) {
      return {
        nombre: ej.nombre,
        series: ej.series.filter(function (s) { return s.hecha; }).map(function (s) { return { peso: numero(s.peso) || 0, reps: Math.round(numero(s.reps)) || 0 }; })
      };
    }).filter(function (ej) { return ej.series.length; });
    if (!hechos.length) { R.avisar('Marca al menos una serie con ✓ para guardar tu entrenamiento.'); return; }

    var nivelAntes = R.nivelActual();
    var minutos = Math.min(600, Math.max(1, Math.round((Date.now() - a.inicio) / 60000)));
    var sesion = { id: nuevoId('s'), fecha: R.claveHoy(), inicio: a.inicio, minutos: minutos, nombre: a.nombre, rutinaId: a.rutinaId, ejercicios: hechos };
    e.sesiones.push(sesion);
    var nuevos = L.records(e.sesiones).filter(function (r) { return r.sesionId === sesion.id; });
    var series = hechos.reduce(function (n, ej) { return n + ej.series.length; }, 0);
    var volumen = hechos.reduce(function (n, ej) { return n + ej.series.reduce(function (m, s) { return m + s.peso * s.reps; }, 0); }, 0);

    R.agregarEntreno({
      deporte: 'gym', minutos: minutos, sesionId: sesion.id, nombre: a.nombre,
      detalle: R.plural(hechos.length, 'ejercicio', 'ejercicios') + (nuevos.length ? ' · 🏆 ' + R.plural(nuevos.length, 'récord', 'récords') : '')
    });
    nuevos.forEach(function (r, i) {
      R.publicar({
        clave: 'rec:' + sesion.id + ':' + i, tipo: 'record', titulo: 'rompió su récord en ' + r.nombre, emoji: '🏆',
        detalle: marca(r) + ' (antes ' + marca(r.antes) + ')', puntos: L.PUNTOS.record, momento: Math.floor(Date.now() / 1000)
      });
    });
    e.entrenoActivo = null;
    R.revisarAvances(nivelAntes);
    R.guardar();
    R.celebrar({
      titulo: '¡Entrenamiento terminado!', emoji: nuevos.length ? '🏆' : '💪', sonido: nuevos.length ? 'record' : 'dia',
      texto: minutos + ' min · ' + R.plural(series, 'serie', 'series') + (volumen ? ' · ' + R.miles(volumen) + ' kg levantados' : '') +
        (nuevos.length ? ' · ' + R.plural(nuevos.length, 'récord nuevo', 'récords nuevos') : '') +
        '. +' + (L.PUNTOS.entreno + nuevos.length * L.PUNTOS.record) + ' puntos.'
    });
    R.cerrarCapa();
  }

  // ======================================================================
  //  PESO CORPORAL
  // ======================================================================
  function tarjetaPeso() {
    var e = est();
    var t = crear('section', 'tarjeta');
    t.appendChild(encabezado('Peso corporal', '+ Registrar', registrarPeso));
    var pesos = e.pesos.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    if (!pesos.length) {
      t.appendChild(crear('p', 'nota', 'Registra tu peso de vez en cuando para ver tu avance en una gráfica. Solo lo ves tú.'));
      return t;
    }
    var ultimo = pesos[pesos.length - 1];
    var grande = crear('div', 'peso-grande');
    grande.appendChild(crear('b', '', kg(ultimo.kg) + ' kg'));
    var hace30 = L.clave(L.sumarDias(R.hoy(), -30));
    var base = pesos.filter(function (p) { return p.fecha >= hace30; })[0] || pesos[0];
    var dif = Math.round((ultimo.kg - base.kg) * 10) / 10;
    grande.appendChild(crear('span', '', base === ultimo ? 'Registrado ' + haceDias(ultimo.fecha)
      : (dif === 0 ? 'Igual que' : (dif > 0 ? '+' : '−') + kg(Math.abs(dif)) + ' kg desde') + ' el ' + fechaCorta(base.fecha)));
    t.appendChild(grande);
    t.appendChild(R.grafica(pesos.slice(-20).map(function (p) { return { etiqueta: fechaCorta(p.fecha), valor: p.kg }; }), { unidad: ' kg' }));
    t.appendChild(boton('Ver historial', 'boton boton-plano', verPesos));
    return t;
  }

  function registrarPeso() {
    var e = est();
    var ultimo = e.pesos.slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).pop();
    R.abrirHojaGenerica(function (hoja) {
      var form = crear('form');
      form.noValidate = true;
      form.appendChild(crear('h2', '', 'Registrar peso'));
      var etq = crear('label', 'campo');
      etq.appendChild(crear('span', '', 'Tu peso de hoy (kg)'));
      var campo = crear('input');
      campo.inputMode = 'decimal';
      campo.placeholder = ultimo ? kg(ultimo.kg) : 'Ej. 70,5';
      etq.appendChild(campo);
      form.appendChild(etq);
      var error = crear('p', 'error-form');
      error.hidden = true;
      form.appendChild(error);
      var guardar = crear('button', 'boton boton-principal', 'Guardar');
      guardar.type = 'submit';
      form.appendChild(guardar);
      form.appendChild(boton('Cancelar', 'boton boton-plano', R.cerrarCapa));
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var n = numero(campo.value !== '' ? campo.value : (ultimo ? ultimo.kg : ''));
        if (!(n >= 20 && n <= 400)) { error.textContent = 'Escribe un peso entre 20 y 400 kg.'; error.hidden = false; return; }
        var k = R.claveHoy();
        e.pesos = e.pesos.filter(function (p) { return p.fecha !== k; });
        e.pesos.push({ fecha: k, kg: Math.round(n * 10) / 10 });
        R.sonar('hecho');
        R.guardar(); R.cerrarCapa(); R.pintar();
      });
      hoja.appendChild(form);
      setTimeout(function () { campo.focus(); }, 250);
    });
  }

  function verPesos() {
    R.abrirHojaGenerica(function (hoja) {
      hoja.appendChild(crear('h2', '', 'Historial de peso'));
      var lista = crear('div');
      function pintarLista() {
        lista.textContent = '';
        var e = est();
        e.pesos.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; }).forEach(function (p) {
          var fila = crear('div', 'fila-entreno');
          var d = crear('div', 'datos');
          d.appendChild(crear('b', '', kg(p.kg) + ' kg'));
          d.appendChild(crear('span', '', L.aFecha(p.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })));
          fila.appendChild(d);
          var borrar = boton('✕', 'borrar', function () {
            if (!borrar.classList.contains('confirmar')) { borrar.classList.add('confirmar'); borrar.textContent = '¿Borrar?'; return; }
            e.pesos = e.pesos.filter(function (x) { return x !== p; });
            R.guardar(); pintarLista(); R.pintar();
          });
          borrar.setAttribute('aria-label', 'Borrar peso');
          fila.appendChild(borrar);
          lista.appendChild(fila);
        });
        if (!e.pesos.length) lista.appendChild(crear('p', 'nota', 'No hay registros.'));
      }
      pintarLista();
      hoja.appendChild(lista);
      hoja.appendChild(boton('Cerrar', 'boton boton-plano', R.cerrarCapa));
    });
  }

  // ======================================================================
  //  RÉCORDS E HISTORIAL
  // ======================================================================
  function tarjetaRecords() {
    var e = est();
    var t = crear('section', 'tarjeta');
    var rotos = L.records(e.sesiones).length;
    var cab = crear('div', 'logros-cabeza');
    cab.appendChild(crear('h3', '', 'Récords personales'));
    if (rotos) cab.appendChild(crear('span', '', R.plural(rotos, 'récord roto', 'récords rotos')));
    t.appendChild(cab);
    var mejores = L.mejoresMarcas(e.sesiones);
    var claves = Object.keys(mejores).sort(function (a, b) { return mejores[a].fecha < mejores[b].fecha ? 1 : -1; });
    if (!claves.length) {
      t.appendChild(crear('p', 'nota', 'Tus mejores marcas aparecen aquí cuando entrenas con una rutina. Toca un ejercicio para ver su historial.'));
      return t;
    }
    claves.slice(0, 10).forEach(function (k) {
      var m = mejores[k];
      var fila = boton(undefined, 'fila-entreno fila-record', function () { verEjercicio(m.nombre); });
      fila.appendChild(crear('span', 'habito-icono', '🏆'));
      var d = crear('span', 'datos');
      d.appendChild(crear('b', '', m.nombre));
      d.appendChild(crear('span', '', fechaCorta(m.fecha)));
      fila.appendChild(d);
      fila.appendChild(crear('span', 'marca', marca(m)));
      t.appendChild(fila);
    });
    return t;
  }

  function verEjercicio(nombre) {
    var hist = L.historialEjercicio(est().sesiones, nombre);
    R.abrirHojaGenerica(function (hoja) {
      hoja.appendChild(crear('h2', '', nombre));
      var mejor = L.mejoresMarcas(est().sesiones)[L.claveEjercicio(nombre)];
      if (mejor) hoja.appendChild(crear('p', 'nota', '🏆 Mejor marca: ' + marca(mejor) + ' (' + fechaCorta(mejor.fecha) + ')'));
      var conPeso = hist.some(function (h) { return h.mejor.peso > 0; });
      hoja.appendChild(R.grafica(hist.slice(0, 20).reverse().map(function (h) {
        return { etiqueta: fechaCorta(h.fecha), valor: conPeso ? h.mejor.peso : h.mejor.reps };
      }), { unidad: conPeso ? ' kg' : ' reps', vacia: 'Entrena este ejercicio otra vez para ver tu avance.' }));
      hist.forEach(function (h) {
        var fila = crear('div', 'fila-entreno');
        var d = crear('div', 'datos');
        d.appendChild(crear('b', '', fechaCorta(h.fecha) + ' · ' + h.sesion));
        d.appendChild(crear('span', '', h.series.map(marca).join(' · ')));
        fila.appendChild(d);
        hoja.appendChild(fila);
      });
      hoja.appendChild(boton('Cerrar', 'boton boton-plano', R.cerrarCapa));
    });
  }

  function verSesion(s) {
    R.abrirHojaGenerica(function (hoja) {
      hoja.appendChild(crear('h2', '', s.nombre));
      hoja.appendChild(crear('p', 'nota', L.aFecha(s.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + s.minutos + ' min'));
      s.ejercicios.forEach(function (ej) {
        var fila = boton(undefined, 'fila-entreno fila-record', function () { R.cerrarCapa(); setTimeout(function () { verEjercicio(ej.nombre); }, 50); });
        var d = crear('span', 'datos');
        d.appendChild(crear('b', '', ej.nombre));
        d.appendChild(crear('span', '', ej.series.map(marca).join(' · ')));
        fila.appendChild(d);
        hoja.appendChild(fila);
      });
      hoja.appendChild(boton('Cerrar', 'boton boton-plano', R.cerrarCapa));
    });
  }

  function tarjetaHistorial() {
    var e = est();
    var t = crear('section', 'tarjeta');
    t.appendChild(crear('h3', '', 'Historial'));
    if (!e.entrenos.length) {
      t.appendChild(crear('p', 'nota', 'Aquí verás tus sesiones de gym y de otros deportes.'));
      return t;
    }
    var hoyK = R.claveHoy();
    e.entrenos.slice().reverse().slice(0, 30).forEach(function (x) {
      var d = R.deporte(x.deporte);
      var sesion = x.sesionId ? e.sesiones.filter(function (s) { return s.id === x.sesionId; })[0] : null;
      var fila = crear('div', 'fila-entreno');
      var info = sesion ? boton(undefined, 'fila-rutina-info', function () { verSesion(sesion); }) : crear('div', 'fila-rutina-info');
      info.appendChild(crear('span', 'habito-icono', d.emoji));
      var datos = crear('span', 'datos');
      datos.appendChild(crear('b', '', (x.nombre || d.nombre) + ' · ' + x.minutos + ' min' + (x.origen === 'reloj' ? ' ⌚' : '')));
      datos.appendChild(crear('span', '', x.fecha === hoyK ? 'Hoy'
        : L.aFecha(x.fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })));
      info.appendChild(datos);
      fila.appendChild(info);
      var borrar = boton('✕', 'borrar', function () {
        if (!borrar.classList.contains('confirmar')) { borrar.classList.add('confirmar'); borrar.textContent = '¿Borrar?'; return; }
        R.borrarEntreno(x.id);
      });
      borrar.setAttribute('aria-label', 'Borrar entrenamiento');
      fila.appendChild(borrar);
      t.appendChild(fila);
    });
    return t;
  }

  R.registrarVista('entrenar', pintarEntrenar);
  window.Gym = { abrirPantalla: abrirPantalla, empezar: empezar };
})();
