/*
  api.js — Cómo la app habla con el servidor (servidor/index.php).
  Api.llamar('entrar', { correo, clave })  →  promesa con la respuesta, o error con un mensaje en español.
  La sesión (token + datos de la cuenta) se guarda en el teléfono en 'racha.sesion'.
*/
(function (raiz) {
  var CLAVE_SESION = 'racha.sesion';

  function sesion() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch (e) { return null; }
  }

  function guardarSesion(s) {
    try {
      if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
      else localStorage.removeItem(CLAVE_SESION);
    } catch (e) { /* sin espacio */ }
  }

  function direccion(accion) {
    return raiz.RACHA_API.replace(/\/+$/, '') + '/?accion=' + encodeURIComponent(accion);
  }

  function cabeceras() {
    var c = { 'Content-Type': 'application/json' };
    var s = sesion();
    if (s && s.token) c['X-Racha-Token'] = s.token;
    return c;
  }

  function llamar(accion, datos) {
    if (!raiz.RACHA_API) return Promise.reject(new Error('El servidor de cuentas todavía no está conectado.'));
    var tenia = !!(sesion() && sesion().token);
    var control = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var reloj = setTimeout(function () { if (control) control.abort(); }, 15000);

    return fetch(direccion(accion), {
      method: 'POST',
      headers: cabeceras(),
      body: JSON.stringify(datos || {}),
      signal: control ? control.signal : undefined
    }).then(function (respuesta) {
      clearTimeout(reloj);
      return respuesta.json().catch(function () { return { ok: false, error: 'El servidor respondió algo raro. Intenta más tarde.' }; })
        .then(function (json) {
          if (respuesta.status === 401 && tenia) {
            guardarSesion(null);
            document.dispatchEvent(new Event('racha:sesion-vencida'));
          }
          if (!json.ok) {
            var error = new Error(json.error || 'Algo salió mal.');
            error.estado = respuesta.status;
            throw error;
          }
          return json;
        });
    }, function () {
      clearTimeout(reloj);
      throw new Error('No hay conexión con el servidor. Revisa tu internet.');
    });
  }

  // Aviso rápido de "me fui" cuando la app se cierra o se va a segundo plano.
  // keepalive deja que la petición termine aunque la app ya no esté en pantalla.
  function avisarSalida() {
    var s = sesion();
    if (!raiz.RACHA_API || !s || !s.token) return;
    try {
      fetch(direccion('presencia'), { method: 'POST', headers: cabeceras(), body: '{"enLinea":false}', keepalive: true }).catch(function () {});
    } catch (e) { /* no pasa nada */ }
  }

  raiz.Api = { llamar: llamar, sesion: sesion, guardarSesion: guardarSesion, avisarSalida: avisarSalida };
})(this);
