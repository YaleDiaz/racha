/*
  social.js — La parte social de la pestaña Amigos:
   - Novedades: qué hicieron tú y tus amigos (hábitos con hora y foto, retos, récords, niveles…).
   - Liga semanal: puntos de lunes a domingo; el primer lugar gana una medalla 🥇.
   - Avisos: "Gael te superó en la liga", "Ana subió al nivel 7".
   - Cola de publicaciones: si no hay internet, lo que publicas espera y se manda después.
  La lista de amigos y tu código siguen en cuenta.js.
*/
(function () {
  var R = window.Racha;
  var Api = window.Api;
  var L = window.Logica;
  var $ = R.$;
  var crear = R.crear;

  var CLAVE_COLA = 'racha.cola';
  var AVISABLES = { nivel: true, medalla: true, record: true, reto: true, racha: true };
  var panel = 'novedades';
  var novedades = null;
  var errorNovedades = '';
  var cargandoNovedades = false;
  var liga = null;
  var errorLiga = '';
  var cargandoLiga = false;
  var fotos = {};          // id de publicación → dirección de la imagen ya descargada
  var observador = null;

  function conectado() { return !!(window.Cuenta && window.Cuenta.conectado()); }
  function leer(clave) { try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; } }
  function escribir(clave, valor) { try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch (e) { return false; } }

  // ======================================================================
  //  COLA DE PUBLICACIONES
  // ======================================================================
  var procesando = false;
  var relojReintento = null;
  var huboCambios = false;

  function leerCola() { return leer(CLAVE_COLA) || []; }

  // Guarda la cola; si no cabe (las fotos pesan), les quita la foto a las más viejas
  function guardarCola(cola) {
    var conFoto = cola.filter(function (i) { return i.datos.foto; });
    while (conFoto.length > 6) { delete conFoto.shift().datos.foto; }
    while (!escribir(CLAVE_COLA, cola)) {
      var vieja = cola.filter(function (i) { return i.datos.foto; })[0];
      if (!vieja) { escribir(CLAVE_COLA, []); return; }
      delete vieja.datos.foto;
    }
  }

  function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function publicar(datos) {
    if (!conectado()) return;
    var cola = leerCola();
    var previo = cola.filter(function (i) { return i.accion === 'publicar' && i.datos.clave === datos.clave; })[0];
    var juntos = Object.assign({}, previo ? previo.datos : {}, datos);
    if (!datos.foto && previo && previo.datos.foto) juntos.foto = previo.datos.foto;
    if (!juntos.foto) delete juntos.foto;
    cola = cola.filter(function (i) { return i.datos.clave !== datos.clave; });
    cola.push({ id: nuevoId(), accion: 'publicar', datos: juntos });
    guardarCola(cola);
    procesar();
  }

  function borrar(clave) {
    if (!conectado()) return;
    var cola = leerCola().filter(function (i) { return i.datos.clave !== clave; });
    cola.push({ id: nuevoId(), accion: 'borrarPublicacion', datos: { clave: clave } });
    guardarCola(cola);
    procesar();
    if (novedades) {
      novedades = novedades.filter(function (n) { return n.clave !== clave; });
      if (R.vista() === 'amigos' && panel === 'novedades') pintarNovedades();
    }
  }

  function procesar() {
    if (procesando || !conectado()) return;
    var cola = leerCola();
    if (!cola.length) {
      if (huboCambios) {
        huboCambios = false;
        if (R.vista() === 'amigos' && panel === 'novedades') cargarNovedades();
      }
      return;
    }
    var item = cola[0];
    procesando = true;
    Api.llamar(item.accion, item.datos).then(function () {
      procesando = false;
      huboCambios = true;
      guardarCola(leerCola().filter(function (i) { return i.id !== item.id; }));
      procesar();
    }, function (e) {
      procesando = false;
      // Error de datos (no de internet): se descarta para no atorar la cola
      if (e.estado && e.estado >= 400 && e.estado < 500 && e.estado !== 401 && e.estado !== 408 && e.estado !== 429) {
        guardarCola(leerCola().filter(function (i) { return i.id !== item.id; }));
        if (item.datos.foto) R.avisar('No se pudo subir tu foto: ' + e.message);
        procesar();
        return;
      }
      clearTimeout(relojReintento);
      relojReintento = setTimeout(procesar, 60000); // sin internet: reintenta en un minuto
    });
  }

  // ======================================================================
  //  AVISOS DE AMIGOS (banner arriba)
  // ======================================================================
  var colaBanner = [];
  var relojBanner = null;

  function banner(avatar, texto) {
    if (!R.ajustes.avisosAmigos || document.hidden) return;
    colaBanner.push({ avatar: avatar, texto: texto });
    if (colaBanner.length === 1) mostrarBanner();
  }

  function mostrarBanner() {
    var b = colaBanner[0];
    var caja = $('banner');
    if (!b) { caja.hidden = true; return; }
    caja.textContent = '';
    caja.appendChild(crear('span', 'banner-avatar', b.avatar || '🔥'));
    caja.appendChild(crear('span', 'banner-texto', b.texto));
    caja.hidden = false;
    caja.classList.remove('entra');
    void caja.offsetWidth; // reinicia la animación
    caja.classList.add('entra');
    R.sonar('aviso');
    clearTimeout(relojBanner);
    relojBanner = setTimeout(function () { colaBanner.shift(); mostrarBanner(); }, 4500);
  }

  $('banner').addEventListener('click', function () {
    clearTimeout(relojBanner);
    colaBanner = [];
    $('banner').hidden = true;
    if (R.vista() !== 'amigos') R.cambiarVista('amigos');
    cambiarPanel('novedades');
  });

  // Puntos totales: ¿alguien te pasó? (llega desde cuenta.js con la lista de amigos)
  document.addEventListener('racha:amigos', function (ev) {
    var lista = ev.detail || [];
    var yo = R.xpTotal();
    var previo = leer('racha.xpPrevio');
    if (previo) {
      lista.forEach(function (a) {
        var antes = previo.otros[a.id];
        if (antes === undefined) return;
        if (antes <= previo.yo && a.xp > yo) banner(a.avatar, a.nombre + ' te superó en puntos 😱');
      });
    }
    var otros = {};
    lista.forEach(function (a) { otros[a.id] = a.xp; });
    escribir('racha.xpPrevio', { yo: yo, otros: otros });
  });

  // ======================================================================
  //  NOVEDADES
  // ======================================================================
  function cargarNovedades() {
    if (!conectado() || cargandoNovedades) return;
    cargandoNovedades = true;
    Api.llamar('novedades').then(function (r) {
      errorNovedades = '';
      revisarNuevas(r.novedades);
      novedades = r.novedades;
    }).catch(function (e) {
      errorNovedades = e.message;
    }).then(function () {
      cargandoNovedades = false;
      marcarPunto();
      if (R.vista() === 'amigos' && panel === 'novedades') pintarNovedades();
    });
  }

  // Avisos de lo nuevo que hicieron tus amigos (niveles, medallas, récords, retos)
  function revisarNuevas(lista) {
    var ultima = Number(leer('racha.ultimaNovedad') || 0);
    var max = lista.reduce(function (m, n) { return Math.max(m, n.id); }, ultima);
    if (ultima) {
      lista.filter(function (n) { return n.id > ultima && !n.yo && AVISABLES[n.tipo]; }).slice(0, 3).reverse()
        .forEach(function (n) { banner(n.usuario.avatar, n.usuario.nombre + ' ' + n.titulo + ' ' + (n.emoji || '')); });
    }
    escribir('racha.ultimaNovedad', max);
  }

  // Puntito rojo en el menú cuando hay novedades de amigos que no has visto
  function marcarPunto() {
    var vista = Number(leer('racha.novedadVista') || 0);
    var hay = !!(novedades && novedades.some(function (n) { return !n.yo && n.id > vista; }));
    if (R.vista() === 'amigos' && panel === 'novedades' && novedades) {
      escribir('racha.novedadVista', novedades.reduce(function (m, n) { return Math.max(m, n.id); }, vista));
      hay = false;
    }
    $('punto-menu-amigos').hidden = !hay;
    $('punto-novedades').hidden = !hay;
  }

  function haceCuanto(seg) {
    if (seg < 60) return 'hace un momento';
    if (seg < 3600) return 'hace ' + Math.floor(seg / 60) + ' min';
    return '';
  }

  function nombreDia(fecha) {
    var k = L.clave(fecha);
    if (k === R.claveHoy()) return 'Hoy';
    if (k === L.clave(L.sumarDias(R.hoy(), -1))) return 'Ayer';
    var t = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function sinCuenta(contenedor, titulo, texto) {
    var caja = crear('section', 'tarjeta centrada');
    var m = crear('span', 'mascota mascota-grande');
    m.innerHTML = R.FLAMA;
    caja.appendChild(m);
    caja.appendChild(crear('h2', '', titulo));
    caja.appendChild(crear('p', 'nota', texto));
    if (window.Cuenta && window.Cuenta.servidorListo()) {
      caja.appendChild(R.boton('Crear cuenta', 'boton boton-principal', function () { window.Cuenta.abrir('crear'); }));
      caja.appendChild(R.boton('Ya tengo cuenta', 'boton boton-secundario', function () { window.Cuenta.abrir('entrar'); }));
    }
    contenedor.appendChild(caja);
  }

  function pintarNovedades() {
    var cont = $('panel-novedades');
    cont.textContent = '';
    if (!conectado()) {
      sinCuenta(cont, 'Mira lo que hacen tus amigos', 'Con una cuenta verás a qué hora cumplen sus hábitos, sus fotos, sus retos y sus récords. Ellos también verán los tuyos.');
      return;
    }
    if (!novedades) {
      var carga = crear('section', 'tarjeta');
      carga.appendChild(crear('p', 'nota', errorNovedades || 'Cargando novedades…'));
      if (errorNovedades) carga.appendChild(R.boton('Reintentar', 'boton-chico', function () { errorNovedades = ''; pintarNovedades(); cargarNovedades(); }));
      cont.appendChild(carga);
      return;
    }
    var pendientes = leerCola().filter(function (i) { return i.accion === 'publicar'; }).length;
    if (pendientes) cont.appendChild(crear('p', 'nota nota-cola', '⏳ ' + R.plural(pendientes, 'publicación', 'publicaciones') + ' esperando internet para subirse.'));
    if (!novedades.length) {
      var vacio = crear('section', 'tarjeta centrada');
      vacio.appendChild(crear('span', 'emoji-grande', '📰'));
      vacio.appendChild(crear('h2', '', 'Todavía no hay novedades'));
      vacio.appendChild(crear('p', 'nota', 'Cuando tú o tus amigos cumplan un hábito, suban una foto o completen un reto, aparecerá aquí. Las fotos duran 7 días.'));
      cont.appendChild(vacio);
      return;
    }
    var diaActual = '';
    novedades.forEach(function (n) {
      var fecha = new Date(n.creado * 1000);
      var dia = nombreDia(fecha);
      if (dia !== diaActual) {
        diaActual = dia;
        cont.appendChild(crear('h3', 'titulo-seccion', dia));
      }
      cont.appendChild(publicacion(n, fecha));
    });
    observarFotos();
  }

  function publicacion(n, fecha) {
    var caja = crear('article', 'publicacion tipo-' + n.tipo);
    var arriba = crear('div', 'pub-arriba');
    arriba.appendChild(crear('span', 'avatar-amigo', n.usuario.avatar || '🔥'));
    var texto = crear('div', 'pub-texto');
    var linea = crear('p');
    linea.appendChild(crear('b', '', n.usuario.nombre));
    linea.appendChild(document.createTextNode(' ' + n.titulo + ' ' + (n.emoji || '')));
    texto.appendChild(linea);
    var hora = fecha.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    var hace = haceCuanto(n.hace);
    texto.appendChild(crear('span', 'pub-hora', (n.yo ? 'Tú · ' : '') + (hace ? hace + ' · ' : '') + hora + (n.detalle ? ' · ' + n.detalle : '')));
    arriba.appendChild(texto);
    if (n.puntos) arriba.appendChild(crear('span', 'pub-puntos', '+' + n.puntos));
    caja.appendChild(arriba);

    if (n.foto) {
      var marco = crear('button', 'pub-foto');
      marco.type = 'button';
      marco.dataset.id = n.id;
      marco.setAttribute('aria-label', 'Ver foto de ' + (n.yo ? 'ti' : n.usuario.nombre));
      if (fotoLista(n.id)) {
        var img = crear('img');
        img.src = fotos[n.id];
        img.alt = '';
        marco.appendChild(img);
        marco.classList.add('lista');
      } else {
        marco.appendChild(crear('span', 'pub-foto-cargando', fotos[n.id] === 'error' ? 'La foto ya no está disponible' : '📷'));
      }
      marco.addEventListener('click', function () { if (fotoLista(n.id)) verFoto(fotos[n.id]); });
      caja.appendChild(marco);
    }

    if (n.yo && n.clave) {
      var borrarBtn = R.boton('Borrar', 'pub-borrar', function () {
        if (!borrarBtn.classList.contains('confirmar')) { borrarBtn.classList.add('confirmar'); borrarBtn.textContent = '¿Borrar?'; return; }
        borrar(n.clave);
      });
      caja.appendChild(borrarBtn);
    }
    return caja;
  }

  function fotoLista(id) { return !!fotos[id] && fotos[id] !== 'error' && fotos[id] !== 'cargando'; }

  // Las fotos se descargan cuando aparecen en pantalla (ahorra datos)
  function descargarFoto(id) {
    if (fotos[id]) return;
    fotos[id] = 'cargando';
    fetch(window.RACHA_API.replace(/\/+$/, '') + '/?accion=foto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Racha-Token': Api.sesion().token },
      body: JSON.stringify({ id: id })
    }).then(function (r) {
      if (!r.ok) throw new Error('sin foto');
      return r.blob();
    }).then(function (blob) {
      fotos[id] = URL.createObjectURL(blob);
    }).catch(function () {
      fotos[id] = 'error';
    }).then(function () {
      var marco = document.querySelector('.pub-foto[data-id="' + id + '"]');
      if (!marco) return;
      marco.textContent = '';
      if (fotos[id] === 'error') {
        marco.appendChild(crear('span', 'pub-foto-cargando', 'La foto ya no está disponible'));
        return;
      }
      var img = crear('img');
      img.alt = '';
      img.src = fotos[id];
      marco.appendChild(img);
      marco.classList.add('lista');
    });
  }

  function observarFotos() {
    var marcos = document.querySelectorAll('#panel-novedades .pub-foto:not(.lista)');
    if (!('IntersectionObserver' in window)) {
      marcos.forEach(function (m) { descargarFoto(Number(m.dataset.id)); });
      return;
    }
    if (!observador) {
      observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (!e.isIntersecting) return;
          observador.unobserve(e.target);
          descargarFoto(Number(e.target.dataset.id));
        });
      }, { rootMargin: '300px' });
    }
    marcos.forEach(function (m) { observador.observe(m); });
  }

  // Foto en pantalla completa; "atrás" la cierra
  function verFoto(src) {
    var visor = crear('div', 'visor');
    var img = crear('img');
    img.src = src;
    img.alt = '';
    visor.appendChild(img);
    visor.addEventListener('click', function () { R.cerrarCapa(); });
    document.body.appendChild(visor);
    R.abrirCapa(function () { visor.remove(); });
  }

  // ======================================================================
  //  LIGA SEMANAL
  // ======================================================================
  function semanaActual() { return L.clave(R.lunesDe(0)); }

  function cargarLiga() {
    if (!conectado() || cargandoLiga) return;
    cargandoLiga = true;
    Api.llamar('liga', { semana: semanaActual(), anterior: L.clave(R.lunesDe(1)) }).then(function (r) {
      errorLiga = '';
      liga = r;
      corregirMisPuntos(liga.tabla, R.puntosSemana(0));
      revisarMedalla(r);
      revisarSuperados(r);
    }).catch(function (e) {
      errorLiga = e.message;
    }).then(function () {
      cargandoLiga = false;
      if (R.vista() === 'amigos' && panel === 'liga') pintarLiga();
    });
  }

  // Tus puntos del teléfono son los más nuevos: se usan en tu fila
  function corregirMisPuntos(tabla, misPuntos) {
    tabla.forEach(function (f) { if (f.yo) f.puntos = misPuntos; });
    tabla.sort(function (a, b) { return b.puntos - a.puntos || (a.yo ? -1 : b.yo ? 1 : 0); });
  }

  // Al empezar una semana nueva: ¿ganaste la pasada?
  function revisarMedalla(r) {
    var est = R.estado();
    var anterior = r.anterior;
    if (!anterior || est.ligaRevisada === anterior.semana) return;
    var primeraVez = !est.ligaRevisada; // recién actualizada la app: la semana pasada no cuenta
    est.ligaRevisada = anterior.semana;
    if (primeraVez) { R.guardar(); return; }
    var tabla = anterior.tabla.slice();
    corregirMisPuntos(tabla, R.puntosSemana(1));
    var yo = tabla.filter(function (f) { return f.yo; })[0];
    if (tabla.length >= 2 && yo && yo.puntos > 0) {
      var maximo = tabla[0].puntos;
      if (yo.puntos >= maximo && !est.medallas.some(function (m) { return m.semana === anterior.semana; })) {
        est.medallas.push({ semana: anterior.semana, puntos: yo.puntos });
        R.publicar({ clave: 'm:' + anterior.semana, tipo: 'medalla', titulo: 'ganó la liga semanal', emoji: '🥇', detalle: yo.puntos + ' puntos', puntos: 0 });
        R.celebrar({ titulo: '¡Ganaste la liga!', emoji: '🥇', sonido: 'medalla', texto: 'Quedaste en primer lugar la semana pasada con ' + yo.puntos + ' puntos. ¡Medalla para tu vitrina!' });
        R.revisarLogrosYCelebrar();
      } else {
        var lugar = tabla.indexOf(yo) + 1;
        R.avisar('La semana pasada quedaste en ' + lugar + 'º lugar de la liga. ¡Esta semana vas por el 🥇!');
      }
    }
    R.guardar();
  }

  // ¿Alguien te pasó en la liga desde la última vez? (o tú a alguien)
  function revisarSuperados(r) {
    var yo = R.puntosSemana(0);
    var previo = leer('racha.ligaPrevia');
    if (previo && previo.semana === r.semana) {
      r.tabla.forEach(function (f) {
        if (f.yo) return;
        var antes = previo.otros[f.id];
        if (antes === undefined) return;
        if (antes <= previo.yo && f.puntos > yo) banner(f.avatar, f.nombre + ' te superó en la liga semanal 😱');
        else if (antes > previo.yo && f.puntos < yo) banner(f.avatar, '¡Superaste a ' + f.nombre + ' en la liga! 💪');
      });
    }
    var otros = {};
    r.tabla.forEach(function (f) { if (!f.yo) otros[f.id] = f.puntos; });
    escribir('racha.ligaPrevia', { semana: r.semana, yo: yo, otros: otros });
  }

  function faltaParaDomingo() {
    var fin = L.sumarDias(R.lunesDe(0), 7);
    var seg = Math.max(0, Math.floor((fin - new Date()) / 1000));
    var d = Math.floor(seg / 86400);
    var h = Math.floor((seg % 86400) / 3600);
    var m = Math.floor((seg % 3600) / 60);
    return d > 0 ? d + ' d ' + h + ' h' : h > 0 ? h + ' h ' + m + ' min' : m + ' min';
  }

  function pintarLiga() {
    var cont = $('panel-liga');
    cont.textContent = '';
    if (!conectado()) {
      sinCuenta(cont, 'Liga semanal entre amigos', 'Compite por puntos de lunes a domingo. El primer lugar se lleva una medalla 🥇.');
      return;
    }
    var cabeza = crear('section', 'tarjeta-progreso liga-cabeza');
    cabeza.appendChild(crear('span', 'emoji-grande', '🏆'));
    var c = crear('div', 'contenido');
    c.appendChild(crear('h2', '', 'Liga semanal'));
    c.appendChild(crear('p', '', 'Termina en ' + faltaParaDomingo() + '. El primer lugar gana una medalla 🥇.'));
    cabeza.appendChild(c);
    cont.appendChild(cabeza);

    var tarjeta = crear('section', 'tarjeta');
    if (!liga) {
      tarjeta.appendChild(crear('p', 'nota', errorLiga || 'Cargando la liga…'));
      if (errorLiga) tarjeta.appendChild(R.boton('Reintentar', 'boton-chico', function () { errorLiga = ''; pintarLiga(); cargarLiga(); }));
      cont.appendChild(tarjeta);
      return;
    }
    corregirMisPuntos(liga.tabla, R.puntosSemana(0));
    var lista = crear('div', 'lista-amigos');
    liga.tabla.forEach(function (f, i) {
      var fila = crear('div', 'fila-amigo' + (f.yo ? ' yo' : ''));
      fila.appendChild(crear('span', 'posicion', f.puntos > 0 ? (['🥇', '🥈', '🥉'][i] || String(i + 1)) : String(i + 1)));
      fila.appendChild(crear('span', 'avatar-amigo', f.avatar || '🔥'));
      var datos = crear('span', 'datos');
      datos.appendChild(crear('b', '', f.yo ? (R.estado().perfil.nombre || 'Tú') + ' (tú)' : f.nombre));
      datos.appendChild(crear('span', '', f.medallas ? '🥇 × ' + f.medallas : 'Sin medallas aún'));
      fila.appendChild(datos);
      fila.appendChild(crear('span', 'puntos', R.miles(f.puntos) + ' pts'));
      lista.appendChild(fila);
    });
    tarjeta.appendChild(lista);
    if (liga.tabla.length < 2) tarjeta.appendChild(crear('p', 'nota', 'Agrega amigos con tu código para competir contra ellos.'));
    var yoFila = liga.tabla.filter(function (f) { return f.yo; })[0];
    var lider = liga.tabla[0];
    if (yoFila && lider && liga.tabla.length >= 2) {
      var dif = lider.yo ? lider.puntos - (liga.tabla[1] ? liga.tabla[1].puntos : 0) : lider.puntos - yoFila.puntos;
      tarjeta.appendChild(crear('p', 'comparacion', lider.yo
        ? (dif > 0 ? 'Vas en primer lugar con ' + dif + ' puntos de ventaja. ¡No aflojes!' : 'Vas empatado en primer lugar. ¡Desempata hoy!')
        : 'Te faltan ' + (dif + 1) + ' puntos para alcanzar el primer lugar.'));
    }
    cont.appendChild(tarjeta);

    // Semana pasada
    if (liga.anterior && liga.anterior.tabla.length >= 2) {
      var pasada = crear('section', 'tarjeta');
      pasada.appendChild(crear('h3', '', 'Semana pasada'));
      var tabla = liga.anterior.tabla.slice();
      corregirMisPuntos(tabla, R.puntosSemana(1));
      var gano = tabla[0];
      var linea = crear('div', 'fila-amigo');
      linea.appendChild(crear('span', 'posicion', '🥇'));
      linea.appendChild(crear('span', 'avatar-amigo', gano.avatar || '🔥'));
      var d = crear('span', 'datos');
      d.appendChild(crear('b', '', gano.yo ? 'Tú ganaste' : gano.nombre + ' ganó'));
      var miLugar = tabla.indexOf(tabla.filter(function (f) { return f.yo; })[0]) + 1;
      d.appendChild(crear('span', '', gano.yo ? '¡Felicidades, campeón!' : 'Tú quedaste en ' + miLugar + 'º lugar'));
      linea.appendChild(d);
      linea.appendChild(crear('span', 'puntos', R.miles(gano.puntos) + ' pts'));
      pasada.appendChild(linea);
      cont.appendChild(pasada);
    }

    var ayuda = crear('section', 'tarjeta');
    ayuda.appendChild(crear('h3', '', '¿Cómo gano puntos?'));
    ayuda.appendChild(crear('p', 'nota', 'Hábito cumplido 10 · con foto +10 · entrenamiento 25 · récord personal 20 · reto sorpresa de 100 a 200. La liga se reinicia cada lunes.'));
    cont.appendChild(ayuda);
  }

  // ======================================================================
  //  PESTAÑAS (Novedades · Liga · Amigos)
  // ======================================================================
  function cambiarPanel(nuevo, sinCargar) {
    panel = nuevo;
    ['novedades', 'liga', 'amigos'].forEach(function (p) { $('panel-' + p).hidden = p !== nuevo; });
    document.querySelectorAll('#social-pestanas button').forEach(function (b) {
      var activo = b.dataset.panel === nuevo;
      b.classList.toggle('elegido', activo);
      b.setAttribute('aria-selected', String(activo));
    });
    if (sinCargar) return;
    pintarSocial();
    alEntrar();
  }

  function pintarSocial() {
    if (panel === 'novedades') pintarNovedades();
    else if (panel === 'liga') pintarLiga();
    else window.Cuenta.pintarAmigos();
    marcarPunto();
  }

  function alEntrar() {
    if (panel === 'novedades') { procesar(); cargarNovedades(); }
    else if (panel === 'liga') cargarLiga();
    else window.Cuenta.cargarAmigos();
  }

  document.querySelectorAll('#social-pestanas button').forEach(function (b) {
    b.addEventListener('click', function () { cambiarPanel(b.dataset.panel); });
  });

  // Revisión periódica mientras la app está abierta (novedades y liga para los avisos)
  function revisarTodo() {
    if (!conectado() || document.hidden) return;
    procesar();
    cargarNovedades();
    cargarLiga();
    if (window.Cuenta) window.Cuenta.cargarAmigos();
  }
  setInterval(revisarTodo, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(revisarTodo, 1500); });
  window.addEventListener('online', procesar);
  // Al abrir: primero sube tus puntos, luego revisa la liga (para la medalla) y las novedades
  setTimeout(function () {
    if (!conectado()) return;
    window.Cuenta.respaldarAhora(false).then(revisarTodo, revisarTodo);
  }, 3500);

  R.registrarVista('amigos', pintarSocial, alEntrar);
  cambiarPanel('novedades', true);

  window.Social = { publicar: publicar, borrar: borrar, procesar: procesar, cargarNovedades: cargarNovedades, cargarLiga: cargarLiga };
})();
