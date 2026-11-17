/*
  preparar-android.js — Ajustes al proyecto Android después de "npx cap add android".
  Lo corre GitHub Actions antes de compilar (ver .github/workflows/compilar-apk.yml).

  - Health Connect (para el reloj) necesita Android 8.0 o más nuevo (minSdk 26).
*/
const fs = require('node:fs');
const path = require('node:path');

const variables = path.join(__dirname, '..', 'android', 'variables.gradle');
const texto = fs.readFileSync(variables, 'utf8');
if (!/minSdkVersion\s*=\s*\d+/.test(texto)) {
  console.error('No encontré minSdkVersion en android/variables.gradle');
  process.exit(1);
}
fs.writeFileSync(variables, texto.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 26'));
console.log('✔ minSdkVersion = 26 (Android 8.0 o más nuevo)');

// Revisa que estén los sonidos de las notificaciones
for (const sonido of ['racha_aviso.wav', 'racha_reto.wav']) {
  const ruta = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'raw', sonido);
  if (!fs.existsSync(ruta)) {
    console.error('Falta el sonido ' + sonido + ' en res/raw');
    process.exit(1);
  }
}
console.log('✔ Sonidos de notificaciones listos');
