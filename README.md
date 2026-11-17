# Racha 🔥

App de rachas de hábitos para Android, con estilo tipo Duolingo.

- **Hábitos y rachas:** agregas hábitos, los marcas cada día y la app cuenta tu racha. Te recuerda a la hora que elijas.
- **Fotos de evidencia (opcional):** al cumplir un hábito puedes tomar una foto con la cámara y ganas +10 puntos.
- **Escudos:** si un día no haces nada, un escudo cuida tu racha. Ganas uno cada 7 días de racha (máximo 2).
- **Meta diaria de puntos** con barra en la pantalla Hoy.
- **Retos sorpresa:** unos 4 días por semana llega una notificación con un reto pequeño (100–200 puntos) que se completa con una foto.
- **Entrenar:** rutinas con series, repeticiones y peso; descanso cronometrado; historial por ejercicio; récords personales; peso corporal con gráfica; otros deportes.
- **Reloj:** pasos, calorías y entrenamientos del Redmi Watch a través de Health Connect; hábitos que se marcan solos con meta de pasos.
- **Novedades:** ves a qué hora cumplieron sus hábitos tus amigos, sus fotos (se borran a los 7 días), retos, récords y niveles.
- **Liga semanal:** compites por puntos de lunes a domingo; el primer lugar gana una medalla 🥇.
- **Avisos de amigos:** "Gael te superó en la liga", "Ana subió al nivel 7".
- **Sonidos** suaves al cumplir hábitos, logros, récords y retos, y sonido propio en las notificaciones.
- **Perfil, niveles y logros:** 10 puntos por hábito (+10 con foto), 25 por entrenamiento, 20 por récord, 25 por amigo y los retos; 26 logros.
- **Cuentas:** correo y contraseña, recuperar contraseña con un código por correo y respaldo automático de tus datos.
- **Amigos:** cada quien tiene un código de 6 letras; con él se agregan, compiten en una clasificación y ven quién está en línea.
- **Configuración:** modo claro, oscuro o automático, recordatorios, vibración, privacidad y cuenta.

## Cómo obtener el APK

1. Sube **todo el contenido** de esta carpeta a tu repositorio de GitHub (incluida la carpeta oculta `.github`).
2. En la pestaña **Actions** espera a que "Compilar APK" termine en verde (unos 5 minutos).
3. Descarga el APK desde **Releases** o desde **Artifacts** dentro de la compilación, e instálalo encima del anterior.

## El servidor de cuentas (PHP + MySQL en Hostinger)

La carpeta `servidor/` es el "backend": guarda cuentas, amigos, el estado en línea y los respaldos.

1. En hPanel → **Bases de datos** crea una base MySQL con su usuario y contraseña.
2. Publica la carpeta `servidor/` en tu hosting (por ejemplo dentro de tu sitio, en una carpeta `racha`).
3. Abre `.../servidor/instalar.php` en el navegador, escribe los datos de la base y presiona **Instalar**.
   Eso crea `config.php` y las tablas. Si abres `.../servidor/` debe responder `"tablas": 8`.
4. Pon esa dirección en `www/config.js` (`window.RACHA_API = 'https://...'`) y vuelve a compilar el APK.

**Actualizar el servidor a la versión 4:** solo reemplaza `index.php` en la carpeta del servidor (en tu Hostinger: `racha-api`)
y abre su dirección en el navegador. Él solo agrega las tablas nuevas, la columna de medallas y la carpeta `fotos/`
(cerrada al público). Debe responder `"version": 2, "tablas": 8`.

Seguridad: las contraseñas se guardan cifradas (`password_hash`), las sesiones como huella SHA-256,
todas las consultas son preparadas y se limitan los intentos. **`servidor/config.php` nunca va a GitHub**
(está en `.gitignore`), porque tu repositorio es público.

## Qué hay en cada archivo

| Archivo | Para qué sirve |
|---|---|
| `www/index.html` | La estructura de todas las pantallas |
| `www/style.css` | Colores, tamaños y animaciones (colores claros en `:root`, oscuros en `[data-tema="oscuro"]`) |
| `www/tema.js` | Pone el modo oscuro antes de dibujar, para que no parpadee |
| `www/logic.js` | Cálculo de rachas, puntos, niveles y lista de logros |
| `www/app.js` | Hoy, Progreso, Entrenar, Perfil, recordatorios y el botón "atrás" |
| `www/config.js` | Dirección del servidor |
| `www/api.js` | Cómo la app habla con el servidor |
| `www/cuenta.js` | Crear cuenta, entrar, recuperar contraseña, respaldo, en línea y lista de amigos |
| `www/social.js` | Novedades, Liga semanal, medallas y avisos de amigos |
| `www/gym.js` | Pestaña Entrenar: rutinas, entrenamiento en curso, récords, peso corporal e historial |
| `www/reloj.js` | Conexión con el reloj por Health Connect |
| `www/camara.js` | Tomar fotos con la cámara (sin datos ocultos) |
| `www/sonidos.js` | Sonidos de la interfaz |
| `www/privacypolicy.html` | Política de privacidad (Health Connect la pide) |
| `www/ajustes.js` | Pantalla de Configuración y modo oscuro |
| `servidor/index.php` | El servidor: todas las acciones (registrar, entrar, amigos…) |
| `servidor/esquema.sql` | Las 8 tablas de MySQL |
| `servidor/instalar.php` | Instalador de una sola vez |
| `servidor/config.ejemplo.php` | Plantilla de configuración (la real la crea el instalador) |
| `tests/` | Pruebas: `npm test` (rachas) y `npm run test:servidor` (servidor, necesita PHP) |
| `.github/workflows/compilar-apk.yml` | Instrucciones para que GitHub compile el APK |
| `recursos/` | Icono, pantalla de inicio, sonidos de notificación, la firma del APK y `preparar-android.js` |

## Notas

- Sin cuenta, la app funciona igual; los datos viven solo en el teléfono.
- Con cuenta, tus datos se respaldan solos. Si usas dos teléfonos a la vez, gana el último que guardó.
- "En línea" se actualiza cada minuto mientras la app está abierta; si alguien cierra la app sin internet, aparece desconectado a los 2–3 minutos.
- Los recordatorios pueden llegar unos minutos tarde: Android agrupa las alarmas para ahorrar batería.
- Los correos de recuperación pueden caer en spam.
- Los avisos de amigos aparecen cuando abres la app (para que lleguen con la app cerrada haría falta Firebase).
- El reloj: en la app Mi Fitness activa Health Connect; luego en Racha → Configuración → Reloj → Conectar. Necesita Android 8 o más nuevo.
- `recursos/debug.keystore` es una firma de pruebas, suficiente para uso personal. Para Google Play se necesita una firma privada propia.
