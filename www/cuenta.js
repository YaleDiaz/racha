/*
  cuenta.js — Todo lo que usa el servidor:
   - Crear cuenta, iniciar sesión y recuperar la contraseña con un código por correo.
   - Respaldo automático de tus datos en tu cuenta.
   - Avisar "en línea" mientras usas la app y "me fui" al salir.
   - La sección Amigos (dentro de la pestaña Amigos): tu código, agregar amigos y la clasificación.
     Novedades y Liga viven en social.js.
*/
(function () {
  var R = window.Racha;
  var Api = window.Api;
  var $ = R.$;
  var crear = R.crear;
  function nada() { /* se ignora a propósito */ }

  var listaAmigos = null;        // última lista recibida del servidor
  var errorAmigos = '';
  var cargandoAmigos = false;
  var relojLatido = null;
  var relojRespaldo = null;
  var esperandoEleccion = false; // al entrar: ¿datos de la cuenta o del teléfono?
  var respaldoPendiente = null;
  var correoRecuperacion = '';

  function servidorListo() { return !!window.RACHA_API; }
  function conectado() { var s = Api.sesion(); return !!(s && s.token); }

  // ======================================================================
  //  PANTALLA DE CUENTA (bienvenida, crear, entrar, recuperar)
  // ======================================================================
  var pantalla = $('pantalla-cuenta');

  function abrir(panel) {
    if (!servidorListo()) { R.avisar('El servidor de cuentas todavía no está conectado.'); return; }
    if (pantalla.hidden) {
      pantalla.hidden = false;
      R.abrirCapa(alCerrarPantalla);
    }
    mostrarPanel(panel || 'bienvenida');
  }

  function mostrarPanel(nombre) {
    pantalla.querySelectorAll('.panel').forEach(function (p) {
      p.hidden = p.dataset.panel !== nombre;
      var error = p.querySelector('.error-form');
      if (error) error.hidden = true;
    });
    $('cuenta-cerrar').hidden = nombre === 'elegir';
    pantalla.scrollTop = 0;
  }

  function cerrarPantalla() { R.cerrarCapa(); }

  function alCerrarPantalla() {
    pantalla.hidden = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    try { localStorage.setItem('racha.bienvenida', '1'); } catch (e) { /* nada */ }
    // Si cerró sin elegir qué datos usar, no se inicia la sesión (así no se pisa nada)
    if (esperandoEleccion) {
      esperandoEleccion = false;
      respaldoPendiente = null;
      Api.guardarSesion(null);
      R.avisar('No se inició sesión. Tus datos quedaron como estaban.');
      R.pintar();
    }
  }

  function mostrarError(form, texto) {
    var error = form.querySelector('.error-form');
    error.textContent = texto;
    error.hidden = false;
  }

  // Manda un formulario al servidor mostrando "Un momento…" en el botón
  function enviar(form, accion, datos, alTerminar) {
    var boton = form.querySelector('button[type=submit]');
    var texto = boton.textContent;
    form.querySelector('.error-form').hidden = true;
    boton.disabled = true;
    boton.textContent = 'Un momento…';
    return Api.llamar(accion, datos)
      .then(alTerminar)
      .catch(function (e) { mostrarError(form, e.message); })
      .then(function () { boton.disabled = false; boton.textContent = texto; });
  }

  function valor(form, nombre) { return form.elements[nombre].value.trim(); }

  // ---------- Después de crear cuenta o iniciar sesión ----------
  function sesionIniciada(r, cuentaNueva) {
    Api.guardarSesion({ token: r.token, usuario: r.usuario, amigos: r.amigos || 0 });
    var perfil = R.estado().perfil;

    if (cuentaNueva) {
      perfil.nombre = r.usuario.nombre;
      return terminar();
    }

    R.ajustes.mostrarEnLinea = r.usuario.mostrarEnLinea;
    R.guardarAjustes();
    return Api.llamar('respaldo').then(function (resp) {
      var deCuenta = resp.datos && Array.isArray(resp.datos.habitos) ? resp.datos : null;
      if (deCuenta && R.tieneDatos()) {
        // Hay datos en los dos lados: que el usuario decida
        esperandoEleccion = true;
        respaldoPendiente = deCuenta;
        mostrarPanel('elegir');
        return;
      }
      if (deCuenta) R.reemplazarEstado(deCuenta);
      completarPerfil(r.usuario);
      terminar();
    }).catch(function (e) {
      Api.guardarSesion(null);
      throw e;
    });
  }

  function completarPerfil(usuario) {
    var perfil = R.estado().perfil;
    if (!perfil.nombre) perfil.nombre = usuario.nombre;
    if (!perfil.avatar) perfil.avatar = usuario.avatar;
  }

  function terminar() {
    esperandoEleccion = false;
    respaldoPendiente = null;
    R.guardar();
    cerrarPantalla();
    listaAmigos = null;
    iniciarLatido();
    respaldarAhora(false);
    cargarAmigos();
    R.revisarLogrosYCelebrar();
    var nombre = R.estado().perfil.nombre;
    R.avisar('¡Listo' + (nombre ? ', ' + nombre : '') + '! Tu progreso ya se respalda en tu cuenta.');
  }

  // ---------- Formularios ----------
  $('form-crear').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var nombre = valor(f, 'nombre');
    var correo = valor(f, 'correo');
    var clave = f.elements.clave.value;
    if (nombre.length < 2) return mostrarError(f, 'Tu nombre debe tener al menos 2 letras.');
    if (!/^\S+@\S+\.\S+$/.test(correo)) return mostrarError(f, 'Escribe un correo válido.');
    if (clave.length < 8) return mostrarError(f, 'La contraseña debe tener al menos 8 caracteres.');
    enviar(f, 'registrar', { nombre: nombre, correo: correo, clave: clave, avatar: R.estado().perfil.avatar },
      function (r) { f.reset(); return sesionIniciada(r, true); });
  });

  $('form-entrar').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var correo = valor(f, 'correo');
    var clave = f.elements.clave.value;
    if (!correo || !clave) return mostrarError(f, 'Escribe tu correo y tu contraseña.');
    enviar(f, 'entrar', { correo: correo, clave: clave },
      function (r) { return sesionIniciada(r, false).then(function () { f.reset(); }); });
  });

  $('form-recuperar').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var correo = valor(f, 'correo');
    if (!/^\S+@\S+\.\S+$/.test(correo)) return mostrarError(f, 'Escribe un correo válido.');
    enviar(f, 'pedirCodigo', { correo: correo }, function (r) {
      correoRecuperacion = correo;
      $('codigo-texto').textContent = r.mensaje;
      mostrarPanel('codigo');
    });
  });

  $('form-codigo').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var codigo = valor(f, 'codigo').replace(/\D/g, '');
    var clave = f.elements.clave.value;
    if (codigo.length !== 6) return mostrarError(f, 'El código tiene 6 números.');
    if (clave.length < 8) return mostrarError(f, 'La nueva contraseña debe tener al menos 8 caracteres.');
    enviar(f, 'restablecer', { correo: correoRecuperacion, codigo: codigo, clave: clave },
      function (r) { return sesionIniciada(r, false).then(function () { f.reset(); }); });
  });

  pantalla.querySelectorAll('[data-ir]').forEach(function (b) {
    b.addEventListener('click', function () { mostrarPanel(b.dataset.ir); });
  });
  pantalla.querySelectorAll('.ojo').forEach(function (b) {
    b.addEventListener('click', function () {
      var campo = b.previousElementSibling;
      var ver = campo.type === 'password';
      campo.type = ver ? 'text' : 'password';
      b.textContent = ver ? 'Ocultar' : 'Ver';
    });
  });
  $('btn-sin-cuenta').addEventListener('click', cerrarPantalla);
  $('cuenta-cerrar').addEventListener('click', cerrarPantalla);
  $('elegir-cuenta').addEventListener('click', function () {
    R.reemplazarEstado(respaldoPendiente);
    completarPerfil(Api.sesion().usuario);
    terminar();
  });
  $('elegir-telefono').addEventListener('click', function () {
    completarPerfil(Api.sesion().usuario);
    terminar();
  });

  // ======================================================================
  //  RESPALDO Y "EN LÍNEA"
  // ======================================================================
  function respaldarPronto() {
    if (!conectado() || esperandoEleccion) return;
    clearTimeout(relojRespaldo);
    relojRespaldo = setTimeout(respaldarAhora, 3000); // espera a que termines de tocar cosas
  }

  // Si avisarResultado es true (botón "Respaldar ahora"), muestra si funcionó
  function respaldarAhora(avisarResultado) {
    clearTimeout(relojRespaldo);
    relojRespaldo = null;
    if (!conectado() || esperandoEleccion) return Promise.resolve();
    var estado = R.estado();
    return Api.llamar('sincronizar', {
      datos: estado,
      stats: R.resumen(),
      semanas: R.semanasLiga(),
      nombre: estado.perfil.nombre,
      avatar: estado.perfil.avatar,
      mostrarEnLinea: R.ajustes.mostrarEnLinea
    }).then(function () {
      document.dispatchEvent(new Event('racha:respaldado'));
      if (avisarResultado) R.avisar('Respaldo guardado ✓');
    }, function (e) {
      if (avisarResultado) R.avisar(e.message); // sin internet: se reintenta con el próximo cambio
    });
  }

  function latido() {
    if (conectado() && !document.hidden) Api.llamar('presencia', { enLinea: true }).catch(nada);
  }
  function iniciarLatido() {
    clearInterval(relojLatido);
    latido();
    relojLatido = setInterval(latido, 60000); // cada minuto mientras la app está abierta
  }
  function detenerLatido() {
    clearInterval(relojLatido);
    relojLatido = null;
  }

  function alSalir() {
    if (!conectado()) return;
    if (relojRespaldo) respaldarAhora(false);
    detenerLatido();
    Api.avisarSalida();
  }
  function alVolver() {
    if (!conectado()) return;
    iniciarLatido();
    if (enPanelAmigos()) cargarAmigos();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) alSalir(); else alVolver(); });
  document.addEventListener('pause', alSalir);   // eventos de la app instalada
  document.addEventListener('resume', alVolver);
  window.addEventListener('pagehide', alSalir);
  document.addEventListener('racha:guardado', respaldarPronto);
  document.addEventListener('racha:sesion-vencida', function () {
    detenerLatido();
    listaAmigos = null;
    R.avisar('Tu sesión se cerró. Vuelve a iniciar sesión.');
    R.pintar();
  });

  function cerrarSesion() {
    return respaldarAhora(false)
      .then(function () { return Api.llamar('salir').catch(nada); })
      .then(function () {
        Api.guardarSesion(null);
        detenerLatido();
        listaAmigos = null;
        R.pintar();
        R.avisar('Cerraste sesión. Tus datos siguen en este teléfono.');
      });
  }

  // ======================================================================
  //  AMIGOS
  // ======================================================================
  function cargarAmigos() {
    if (!conectado() || cargandoAmigos) return;
    cargandoAmigos = true;
    Api.llamar('amigos').then(function (r) {
      listaAmigos = r.amigos;
      errorAmigos = '';
      // social.js revisa si alguien te superó en puntos
      document.dispatchEvent(new CustomEvent('racha:amigos', { detail: r.amigos }));
      var s = Api.sesion();
      if (s && s.amigos !== r.amigos.length) {
        s.amigos = r.amigos.length;   // alguien te agregó o te quitó: cambian tus puntos
        Api.guardarSesion(s);
        R.revisarLogrosYCelebrar();
        respaldarPronto();
      }
    }).catch(function (e) {
      errorAmigos = e.message;
    }).then(function () {
      cargandoAmigos = false;
      if (R.vista() === 'amigos') pintarAmigos();
    });
  }
  function enPanelAmigos() { return R.vista() === 'amigos' && !$('panel-amigos').hidden; }

  // "hace 5 min", "hace 2 h", "ayer"…
  function haceCuanto(segundos) {
    if (segundos < 60) return 'hace un momento';
    if (segundos < 3600) return 'hace ' + Math.floor(segundos / 60) + ' min';
    if (segundos < 86400) return 'hace ' + Math.floor(segundos / 3600) + ' h';
    if (segundos < 172800) return 'ayer';
    return 'hace ' + Math.floor(segundos / 86400) + ' días';
  }

  function textoEstado(a) {
    if (a.enLinea === null || a.enLinea === undefined) return 'Nivel ' + a.nivel;
    return a.enLinea ? 'En línea' : 'Visto ' + haceCuanto(a.vistoHace);
  }

  function pintarAmigos() {
    var sinCuenta = $('amigos-sin-cuenta');
    var conCuenta = $('amigos-con-cuenta');

    if (!servidorListo() || !conectado()) {
      conCuenta.hidden = true;
      sinCuenta.hidden = false;
      sinCuenta.textContent = '';
      var m = crear('span', 'mascota mascota-grande');
      m.innerHTML = R.FLAMA;
      sinCuenta.appendChild(m);
      sinCuenta.appendChild(crear('h2', '', 'Compite con tus amigos'));
      if (!servidorListo()) {
        sinCuenta.appendChild(crear('p', '', 'Muy pronto: cuando el servidor de cuentas esté conectado podrás agregar amigos y ver quién lleva la mejor racha.'));
        return;
      }
      sinCuenta.appendChild(crear('p', '', 'Crea tu cuenta, comparte tu código y gana 25 puntos por cada amigo. Verás sus rachas, sus niveles y cuándo están en línea.'));
      var crearBtn = crear('button', 'boton boton-principal', 'Crear cuenta');
      crearBtn.type = 'button';
      crearBtn.addEventListener('click', function () { abrir('crear'); });
      var entrarBtn = crear('button', 'boton boton-secundario', 'Ya tengo cuenta');
      entrarBtn.type = 'button';
      entrarBtn.addEventListener('click', function () { abrir('entrar'); });
      sinCuenta.appendChild(crearBtn);
      sinCuenta.appendChild(entrarBtn);
      return;
    }

    sinCuenta.hidden = true;
    conCuenta.hidden = false;
    var s = Api.sesion();
    $('mi-codigo').textContent = s.usuario.codigo;

    var caja = $('clasificacion');
    caja.textContent = '';
    var cabeza = crear('div', 'logros-cabeza');
    cabeza.appendChild(crear('h3', '', 'Clasificación'));
    cabeza.appendChild(crear('span', '', listaAmigos ? R.plural(listaAmigos.length, 'amigo', 'amigos') : ''));
    caja.appendChild(cabeza);

    if (!listaAmigos) {
      caja.appendChild(crear('p', 'nota', errorAmigos || 'Cargando…'));
      if (errorAmigos) {
        var otra = crear('button', 'boton-chico', 'Reintentar');
        otra.type = 'button';
        otra.addEventListener('click', function () { errorAmigos = ''; pintarAmigos(); cargarAmigos(); });
        caja.appendChild(otra);
      }
      return;
    }

    var yo = R.resumen();
    var perfil = R.estado().perfil;
    var filas = listaAmigos.slice();
    filas.push({ yo: true, nombre: perfil.nombre || 'Tú', avatar: perfil.avatar, nivel: yo.nivel, xp: yo.xp, racha: yo.racha, logros: yo.logros });
    filas.sort(function (a, b) { return b.xp - a.xp; });

    var lista = crear('div', 'lista-amigos');
    filas.forEach(function (a, i) {
      var fila = crear(a.yo ? 'div' : 'button', 'fila-amigo' + (a.yo ? ' yo' : ''));
      if (!a.yo) {
        fila.type = 'button';
        fila.addEventListener('click', function () { verAmigo(a); });
      }
      fila.appendChild(crear('span', 'posicion', ['🥇', '🥈', '🥉'][i] || String(i + 1)));
      var avatar = crear('span', 'avatar-amigo', a.avatar || '🔥');
      if (a.enLinea) avatar.appendChild(crear('i', 'punto-en-linea'));
      fila.appendChild(avatar);
      var datos = crear('span', 'datos');
      datos.appendChild(crear('b', '', a.yo ? (a.nombre + ' (tú)') : a.nombre));
      datos.appendChild(crear('span', a.enLinea ? 'en-linea' : '', a.yo ? 'Nivel ' + a.nivel + ' · ' + R.plural(a.logros, 'logro', 'logros') : textoEstado(a)));
      fila.appendChild(datos);
      var puntos = crear('span', 'puntos', a.xp + ' pts');
      puntos.appendChild(crear('small', '', '🔥 ' + a.racha));
      fila.appendChild(puntos);
      lista.appendChild(fila);
    });
    caja.appendChild(lista);

    if (!listaAmigos.length) {
      caja.appendChild(crear('p', 'nota', 'Aún no tienes amigos aquí. Comparte tu código para competir.'));
    }
  }

  function verAmigo(a) {
    R.abrirHojaGenerica(function (hoja) {
      var cabeza = crear('div', 'amigo-cabeza');
      var avatar = crear('span', 'perfil-avatar', a.avatar || '🔥');
      if (a.enLinea) avatar.appendChild(crear('i', 'punto-en-linea'));
      cabeza.appendChild(avatar);
      var nombre = crear('div');
      nombre.appendChild(crear('h2', '', a.nombre));
      nombre.appendChild(crear('span', a.enLinea ? 'en-linea' : 'nota', a.enLinea === null ? 'Estado oculto' : textoEstado(a)));
      cabeza.appendChild(nombre);
      hoja.appendChild(cabeza);

      var cifras = crear('div', 'cifras');
      [['Nivel', a.nivel], ['Puntos', R.miles(a.xp)], ['Racha', '🔥 ' + a.racha], ['Logros', a.logros],
        ['Medallas', '🥇 ' + (a.medallas || 0)], ['Min. esta semana', a.minutosSemana]
      ].forEach(function (c) {
        var cifra = crear('div', 'cifra');
        cifra.appendChild(crear('strong', '', String(c[1])));
        cifra.appendChild(crear('span', '', c[0]));
        cifras.appendChild(cifra);
      });
      hoja.appendChild(cifras);

      var diferencia = R.resumen().xp - a.xp;
      hoja.appendChild(crear('p', 'comparacion', diferencia > 0 ? 'Le llevas ' + diferencia + ' puntos. ¡No aflojes!'
        : diferencia < 0 ? 'Te lleva ' + (-diferencia) + ' puntos. ¡Tú puedes alcanzarlo!' : 'Van empatados. ¡Desempata hoy!'));

      var quitar = crear('button', 'boton boton-peligro', 'Eliminar amigo');
      quitar.type = 'button';
      quitar.addEventListener('click', function () {
        if (!quitar.classList.contains('confirmar')) {
          quitar.classList.add('confirmar');
          quitar.textContent = '¿Seguro? Toca otra vez';
          return;
        }
        quitar.disabled = true;
        Api.llamar('quitarAmigo', { id: a.id }).then(function (r) {
          var s = Api.sesion();
          s.amigos = r.amigos;
          Api.guardarSesion(s);
          listaAmigos = listaAmigos.filter(function (x) { return x.id !== a.id; });
          R.cerrarCapa();
          R.pintar();
          respaldarPronto();
          R.avisar(a.nombre + ' ya no está en tus amigos.');
        }).catch(function (e) { quitar.disabled = false; R.avisar(e.message); });
      });
      hoja.appendChild(quitar);
      var cerrar = crear('button', 'boton boton-plano', 'Cerrar');
      cerrar.type = 'button';
      cerrar.addEventListener('click', R.cerrarCapa);
      hoja.appendChild(cerrar);
    });
  }

  $('form-amigo').addEventListener('submit', function (e) {
    e.preventDefault();
    var campo = $('campo-codigo-amigo');
    var error = $('error-amigo');
    var boton = this.querySelector('button[type=submit]');
    var codigo = campo.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    error.hidden = true;
    if (codigo.length !== 6) { error.textContent = 'El código tiene 6 letras y números.'; error.hidden = false; return; }
    boton.disabled = true;
    Api.llamar('agregarAmigo', { codigo: codigo }).then(function (r) {
      campo.value = '';
      campo.blur();
      var s = Api.sesion();
      s.amigos = r.amigos;
      Api.guardarSesion(s);
      R.vibrar(25);
      R.avisar('¡' + r.amigo.nombre + ' ahora es tu amigo! +25 puntos');
      listaAmigos = null;
      cargarAmigos();
      R.revisarLogrosYCelebrar();
      respaldarPronto();
    }).catch(function (err) {
      error.textContent = err.message;
      error.hidden = false;
    }).then(function () { boton.disabled = false; });
  });
  $('campo-codigo-amigo').addEventListener('input', function () {
    var limpio = this.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    if (limpio !== this.value) this.value = limpio;
    $('error-amigo').hidden = true;
  });

  function copiar(texto) {
    function plan_b() {
      var t = crear('textarea');
      t.value = texto;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      try { document.execCommand('copy'); } catch (e) { /* nada */ }
      t.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).catch(plan_b);
    plan_b();
    return Promise.resolve();
  }

  $('btn-copiar').addEventListener('click', function () {
    copiar(Api.sesion().usuario.codigo).then(function () { R.avisar('Código copiado.'); });
  });
  $('btn-compartir').addEventListener('click', function () {
    var codigo = Api.sesion().usuario.codigo;
    var mensaje = '¡Compite conmigo en Racha! 🔥 Agrégame con mi código: ' + codigo;
    var cap = window.Capacitor;
    var Share = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Share;
    if (Share) { Share.share({ title: 'Racha', text: mensaje, dialogTitle: 'Compartir mi código' }).catch(nada); return; }
    if (navigator.share) { navigator.share({ text: mensaje }).catch(nada); return; }
    copiar(mensaje).then(function () { R.avisar('Mensaje copiado. Pégalo en WhatsApp o donde quieras.'); });
  });

  // Mientras ves la lista de amigos, se actualiza cada 30 segundos
  setInterval(function () {
    if (enPanelAmigos() && !document.hidden) cargarAmigos();
  }, 30000);

  // ======================================================================
  //  ARRANQUE  (la pestaña Amigos la registra social.js)
  // ======================================================================
  window.Cuenta = {
    pintarAmigos: pintarAmigos,
    cargarAmigos: cargarAmigos,
    abrir: abrir,
    conectado: conectado,
    servidorListo: servidorListo,
    cerrarSesion: cerrarSesion,
    respaldarAhora: respaldarAhora,
    detenerLatido: detenerLatido
  };

  if (conectado()) {
    // Actualiza los datos de la cuenta (por si cambiaron en otro teléfono)
    Api.llamar('yo').then(function (r) {
      var s = Api.sesion();
      s.usuario = r.usuario;
      s.amigos = r.amigos;
      Api.guardarSesion(s);
      R.pintar();
    }).catch(nada);
    iniciarLatido();
    respaldarPronto();
  } else if (servidorListo()) {
    var vista = null;
    try { vista = localStorage.getItem('racha.bienvenida'); } catch (e) { /* nada */ }
    if (!vista) abrir('bienvenida');
  }
})();
