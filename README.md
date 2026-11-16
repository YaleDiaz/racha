# Racha 🔥

App de rachas de hábitos para Android, con estilo tipo Duolingo.

- **Hábitos y rachas:** agregas hábitos, los marcas cada día y la app cuenta tu racha. Te recuerda a la hora que elijas.
- **Entrenar:** registras sesiones de gym y de otros deportes.
- **Perfil, niveles y logros:** 10 puntos por hábito, 25 por entrenamiento y 25 por cada amigo; 18 logros.
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
   Eso crea `config.php` y las tablas. Si abres `.../servidor/` debe responder `"tablas": 6`.
4. Pon esa dirección en `www/config.js` (`window.RACHA_API = 'https://...'`) y vuelve a compilar el APK.

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
| `www/cuenta.js` | Crear cuenta, entrar, recuperar contraseña, respaldo, en línea y Amigos |
| `www/ajustes.js` | Pantalla de Configuración y modo oscuro |
| `servidor/index.php` | El servidor: todas las acciones (registrar, entrar, amigos…) |
| `servidor/esquema.sql` | Las 6 tablas de MySQL |
| `servidor/instalar.php` | Instalador de una sola vez |
| `servidor/config.ejemplo.php` | Plantilla de configuración (la real la crea el instalador) |
| `tests/` | Pruebas: `npm test` (rachas) y `npm run test:servidor` (servidor, necesita PHP) |
| `.github/workflows/compilar-apk.yml` | Instrucciones para que GitHub compile el APK |
| `recursos/` | Icono, pantalla de inicio y la firma del APK |

## Notas

- Sin cuenta, la app funciona igual; los datos viven solo en el teléfono.
- Con cuenta, tus datos se respaldan solos. Si usas dos teléfonos a la vez, gana el último que guardó.
- "En línea" se actualiza cada minuto mientras la app está abierta; si alguien cierra la app sin internet, aparece desconectado a los 2–3 minutos.
- Los recordatorios pueden llegar unos minutos tarde: Android agrupa las alarmas para ahorrar batería.
- Los correos de recuperación pueden caer en spam.
- `recursos/debug.keystore` es una firma de pruebas, suficiente para uso personal. Para Google Play se necesita una firma privada propia.
