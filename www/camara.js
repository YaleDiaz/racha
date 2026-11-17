/*
  camara.js — Tomar una foto con la cámara para las evidencias.
  En la app instalada abre la cámara del teléfono (no la galería, para que la foto sea del momento).
  En el navegador de la computadora usa un selector de archivo.

  Camara.tomar()  →  promesa con la foto en texto (JPG en base64, máximo 1080 px),
                     o error con .cancelada = true si el usuario se arrepintió.
  La foto se vuelve a dibujar en un "lienzo": eso le quita los datos ocultos (como la ubicación).
*/
(function (raiz) {
  var LADO_MAXIMO = 1080;
  var CALIDAD = 0.74;

  function cancelada() {
    var e = new Error('Cancelaste la foto.');
    e.cancelada = true;
    return e;
  }

  function nativa() {
    var cap = raiz.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
    return (cap.Plugins && cap.Plugins.Camera) || null;
  }

  // Carga una imagen desde una dirección y la reduce a JPG
  function comprimir(direccion) {
    return new Promise(function (resolver, rechazar) {
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
        var lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.naturalWidth * escala);
        lienzo.height = Math.round(img.naturalHeight * escala);
        var c = lienzo.getContext('2d');
        c.drawImage(img, 0, 0, lienzo.width, lienzo.height);
        try {
          resolver(lienzo.toDataURL('image/jpeg', CALIDAD));
        } catch (e) {
          rechazar(new Error('No se pudo preparar la foto.'));
        }
      };
      img.onerror = function () { rechazar(new Error('No se pudo abrir la foto.')); };
      img.src = direccion;
    });
  }

  function conArchivo() {
    return new Promise(function (resolver, rechazar) {
      var entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = 'image/*';
      entrada.setAttribute('capture', 'environment');
      entrada.style.display = 'none';
      document.body.appendChild(entrada);
      entrada.addEventListener('change', function () {
        var archivo = entrada.files && entrada.files[0];
        entrada.remove();
        if (!archivo) { rechazar(cancelada()); return; }
        var url = URL.createObjectURL(archivo);
        comprimir(url).then(function (foto) { URL.revokeObjectURL(url); resolver(foto); }, rechazar);
      });
      entrada.click();
    });
  }

  function tomar() {
    var Camera = nativa();
    if (!Camera) return conArchivo();
    var pedir = Camera.takePhoto
      ? Camera.takePhoto({ quality: 85, correctOrientation: true, saveToGallery: false, editable: 'no' })
      : Camera.getPhoto({ quality: 85, correctOrientation: true, saveToGallery: false, resultType: 'uri', source: 'CAMERA' });
    return pedir.then(function (r) {
      var ruta = r && (r.webPath || r.path);
      if (!ruta) throw new Error('No se recibió la foto.');
      return comprimir(ruta);
    }, function (e) {
      var texto = String((e && e.message) || '').toLowerCase();
      if (/cancel|cancelled|canceled|no image|no photo/.test(texto)) throw cancelada();
      if (/permission|denied|permiso/.test(texto)) throw new Error('Racha necesita permiso de cámara. Actívalo en los ajustes del teléfono.');
      throw new Error('No se pudo abrir la cámara.');
    });
  }

  raiz.Camara = { tomar: tomar };
})(this);
