/*
  ajustes.js — La pantalla de Configuración y el modo oscuro.
  Los valores se guardan en el teléfono en 'racha.ajustes' (los carga app.js).
*/
(function () {
  var R = window.Racha;
  var Api = window.Api;
  var $ = R.$;
  var crear = R.crear;
  var VERSION = '3.0';
  var medio = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // ---------- Tema claro / oscuro ----------
  function aplicarTema() {
    var tema = R.ajustes.tema;
    var oscuro = tema === 'oscuro' || (tema === 'auto' && !!(medio && medio.matches));
    document.documentElement.setAttribute('data-tema', oscuro ? 'oscuro' : 'claro');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', oscuro ? '#15121F' : '#F6F4FF');
    // En la app instalada, cambia el color de la hora y la batería de arriba
    var cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.SystemBars) {
      cap.Plugins.SystemBars.setStyle({ style: oscuro ? 'DARK' : 'LIGHT' }).catch(function () {});
    }
  }
  if (medio && medio.addEventListener) {
    medio.addEventListener('change', function () { if (R.ajustes.tema === 'auto') aplicarTema(); });
  }

  // ---------- Piezas de la pantalla ----------
  function seccion(titulo) {
    var s = crear('section', 'tarjeta seccion-ajustes');
    s.appendChild(crear('h3', '', titulo));
    return s;
  }

  function fila(titulo, descripcion, control) {
    var f = crear('div', 'fila-ajuste');
    var t = crear('div', 'fila-ajuste-texto');
    t.appendChild(crear('b', '', titulo));
    if (descripcion) t.appendChild(crear('span', '', descripcion));
    f.appendChild(t);
    if (control) f.appendChild(control);
    return f;
  }

  function interruptor(nombre, activo, alCambiar) {
    var b = crear('button', 'interruptor');
    b.type = 'button';
    b.setAttribute('role', 'switch');
    b.setAttribute('aria-label', nombre);
    b.setAttribute('aria-checked', String(activo));
    b.addEventListener('click', function () {
      var nuevo = b.getAttribute('aria-checked') !== 'true';
      b.setAttribute('aria-checked', String(nuevo));
      alCambiar(nuevo);
    });
    return b;
  }

  function boton(texto, clase, alTocar) {
    var b = crear('button', 'boton ' + clase, texto);
    b.type = 'button';
    b.addEventListener('click', alTocar);
    return b;
  }

  // Hoja con un formulario. alEnviar(valores) regresa una promesa; si falla, se muestra el error.
  function hojaFormulario(op) {
    R.abrirHojaGenerica(function (hoja) {
      var form = crear('form');
      form.noValidate = true;
      form.appendChild(crear('h2', '', op.titulo));
      if (op.texto) form.appendChild(crear('p', 'nota', op.texto));
      op.campos.forEach(function (c) {
        var etiqueta = crear('label', 'campo');
        etiqueta.appendChild(crear('span', '', c.etiqueta));
        var campo = crear('input');
        campo.name = c.nombre;
        campo.type = c.tipo || 'text';
        if (c.autocomplete) campo.autocomplete = c.autocomplete;
        etiqueta.appendChild(campo);
        form.appendChild(etiqueta);
      });
      var error = crear('p', 'error-form');
      error.hidden = true;
      form.appendChild(error);
      var enviar = crear('button', 'boton ' + (op.peligro ? 'boton-peligro confirmar' : 'boton-principal'), op.boton);
      enviar.type = 'submit';
      form.appendChild(enviar);
      form.appendChild(boton('Cancelar', 'boton-plano', R.cerrarCapa));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var valores = {};
        op.campos.forEach(function (c) { valores[c.nombre] = form.elements[c.nombre].value; });
        var texto = enviar.textContent;
        error.hidden = true;
        enviar.disabled = true;
        enviar.textContent = 'Un momento…';
        Promise.resolve().then(function () { return op.alEnviar(valores); })
          .then(function () { R.cerrarCapa(); }, function (err) { error.textContent = err.message; error.hidden = false; })
          .then(function () { enviar.disabled = false; enviar.textContent = texto; });
      });
      hoja.appendChild(form);
    });
  }

  // ---------- Acciones de la cuenta ----------
  function cambiarClave() {
    hojaFormulario({
      titulo: 'Cambiar contraseña',
      campos: [
        { nombre: 'actual', etiqueta: 'Contraseña actual', tipo: 'password', autocomplete: 'current-password' },
        { nombre: 'nueva', etiqueta: 'Nueva contraseña (mínimo 8)', tipo: 'password', autocomplete: 'new-password' }
      ],
      boton: 'Cambiar contraseña',
      alEnviar: function (v) {
        if (v.nueva.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
        return Api.llamar('cambiarClave', { actual: v.actual, nueva: v.nueva }).then(function () {
          R.avisar('Contraseña cambiada. Se cerró la sesión en tus otros teléfonos.');
        });
      }
    });
  }

  function eliminarCuenta() {
    hojaFormulario({
      titulo: 'Eliminar mi cuenta',
      texto: 'Se borran tu cuenta, tus amistades y tu respaldo del servidor. Los datos de este teléfono se quedan. Esto no se puede deshacer.',
      campos: [{ nombre: 'clave', etiqueta: 'Escribe tu contraseña para confirmar', tipo: 'password', autocomplete: 'current-password' }],
      boton: 'Eliminar para siempre',
      peligro: true,
      alEnviar: function (v) {
        return Api.llamar('eliminarCuenta', { clave: v.clave }).then(function () {
          window.Cuenta.detenerLatido();
          Api.guardarSesion(null);
          R.pintar();
          R.avisar('Tu cuenta se eliminó.');
        });
      }
    });
  }

  function borrarDatos() {
    var conCuenta = window.Cuenta.conectado();
    hojaFormulario({
      titulo: '¿Borrar los datos de este teléfono?',
      texto: 'Se borran tus hábitos, entrenamientos y logros de este teléfono.' +
        (conCuenta ? ' Tu respaldo en la cuenta se conserva y se cerrará la sesión; puedes recuperarlo al volver a entrar.' : ' No tienes cuenta, así que no se podrán recuperar.'),
      campos: [],
      boton: 'Borrar todo',
      peligro: true,
      alEnviar: function () {
        return (conCuenta ? window.Cuenta.cerrarSesion() : Promise.resolve()).then(function () {
          R.borrarDatosLocales();
          R.avisar('Listo, este teléfono quedó sin datos.');
        });
      }
    });
  }

  // ---------- Pantalla ----------
  function pintarAjustes() {
    var v = $('vista-ajustes');
    v.textContent = '';
    var Cuenta = window.Cuenta;
    var conectado = Cuenta.conectado();

    var cabeza = crear('div', 'ajustes-cabeza');
    var volver = crear('button', 'mes-flecha', '‹');
    volver.type = 'button';
    volver.setAttribute('aria-label', 'Volver');
    volver.addEventListener('click', R.cerrarCapa);
    cabeza.appendChild(volver);
    cabeza.appendChild(crear('h2', '', 'Configuración'));
    v.appendChild(cabeza);

    // Apariencia
    var apariencia = seccion('Apariencia');
    var segmentos = crear('div', 'segmentado');
    [['claro', '☀️', 'Claro'], ['oscuro', '🌙', 'Oscuro'], ['auto', '📱', 'Automático']].forEach(function (op) {
      var b = crear('button', R.ajustes.tema === op[0] ? 'elegido' : '');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(R.ajustes.tema === op[0]));
      b.appendChild(crear('i', '', op[1]));
      b.appendChild(crear('span', '', op[2]));
      b.addEventListener('click', function () {
        R.ajustes.tema = op[0];
        R.guardarAjustes();
        aplicarTema();
        pintarAjustes();
      });
      segmentos.appendChild(b);
    });
    apariencia.appendChild(segmentos);
    apariencia.appendChild(crear('p', 'nota', 'Automático usa el mismo modo que tu teléfono.'));
    v.appendChild(apariencia);

    // General
    var general = seccion('General');
    general.appendChild(fila('Recordatorios', 'Avisos a la hora que elegiste en cada hábito',
      interruptor('Recordatorios', R.ajustes.recordatorios, function (on) {
        R.ajustes.recordatorios = on;
        R.guardarAjustes();
        R.programarRecordatorios(on);
        R.avisar(on ? 'Recordatorios activados.' : 'Recordatorios apagados.');
      })));
    general.appendChild(fila('Vibración', 'Al marcar hábitos y desbloquear logros',
      interruptor('Vibración', R.ajustes.vibracion, function (on) {
        R.ajustes.vibracion = on;
        R.guardarAjustes();
        R.vibrar(30);
      })));
    v.appendChild(general);

    // Cuenta
    var cuenta = seccion('Cuenta');
    if (conectado) {
      var s = Api.sesion();
      cuenta.appendChild(fila('Correo', s.usuario.correo));
      cuenta.appendChild(fila('Tu código de amigo', s.usuario.codigo));
      cuenta.appendChild(boton('Cambiar contraseña', 'boton-secundario', cambiarClave));
      cuenta.appendChild(boton('Cerrar sesión', 'boton-secundario', function () { Cuenta.cerrarSesion(); }));
      cuenta.appendChild(boton('Eliminar mi cuenta', 'boton-peligro', eliminarCuenta));
    } else if (Cuenta.servidorListo()) {
      cuenta.appendChild(crear('p', 'nota', 'No has iniciado sesión. Tu progreso solo está guardado en este teléfono.'));
      cuenta.appendChild(boton('Crear cuenta', 'boton-principal', function () { Cuenta.abrir('crear'); }));
      cuenta.appendChild(boton('Iniciar sesión', 'boton-secundario', function () { Cuenta.abrir('entrar'); }));
    } else {
      cuenta.appendChild(crear('p', 'nota', 'Las cuentas estarán disponibles cuando el servidor esté conectado.'));
    }
    v.appendChild(cuenta);

    // Privacidad
    var privacidad = seccion('Privacidad');
    privacidad.appendChild(fila('Mostrar cuándo estoy en línea', 'Si lo apagas, tampoco verás cuándo están en línea tus amigos',
      interruptor('Mostrar cuándo estoy en línea', R.ajustes.mostrarEnLinea, function (on) {
        R.ajustes.mostrarEnLinea = on;
        R.guardarAjustes();
        if (Cuenta.conectado()) Cuenta.respaldarAhora(false);
      })));
    v.appendChild(privacidad);

    // Datos
    var datos = seccion('Tus datos');
    datos.appendChild(crear('p', 'nota', conectado
      ? 'Tus hábitos, entrenamientos y logros se respaldan solos en tu cuenta cada vez que cambian.'
      : 'Crea una cuenta para respaldar tus datos y no perderlos si cambias de teléfono.'));
    if (conectado) datos.appendChild(boton('Respaldar ahora', 'boton-secundario', function () { Cuenta.respaldarAhora(true); }));
    datos.appendChild(boton('Borrar datos de este teléfono', 'boton-peligro', borrarDatos));
    v.appendChild(datos);

    // Acerca de
    var acerca = seccion('Acerca de');
    acerca.appendChild(fila('Racha', 'Versión ' + VERSION));
    v.appendChild(acerca);
  }

  R.registrarVista('ajustes', pintarAjustes);
  aplicarTema();
})();
