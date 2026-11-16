# Racha 🔥

App de rachas de hábitos para Android. Agregas tus hábitos, los marcas cada día, la app cuenta tu racha y te manda un recordatorio a la hora que elijas.

## Cómo obtener el APK (sin instalar nada)

1. Entra a github.com → **New repository** → nombre `racha` → **Create repository** (sin README).
2. En la página del repo nuevo, da clic en **uploading an existing file**.
3. Arrastra **todo el contenido** de esta carpeta (incluida la carpeta `.github`, que es la que compila) y da **Commit changes**.
   - Si no ves `.github`: en Windows activa *Ver → Elementos ocultos*; en Mac presiona `Cmd + Shift + .`
4. Abre la pestaña **Actions**: verás "Compilar APK" corriendo. Tarda unos 5 minutos.
5. Cuando termine en verde, ve a **Releases** (lado derecho del repo) y descarga `racha.apk`.
6. Ábrelo en tu Android. Te pedirá permitir "instalar apps desconocidas": acéptalo solo para esta instalación.

Cada vez que subas un cambio a `main`, GitHub compila un APK nuevo. Al instalarlo encima se conservan tus hábitos.

## Qué hay en cada archivo

| Archivo | Para qué sirve |
|---|---|
| `www/index.html` | La estructura de las pantallas |
| `www/style.css` | Colores, tamaños y animaciones (los colores están hasta arriba, en `:root`) |
| `www/app.js` | Lo que pasa al tocar: pintar pantallas, crear hábitos, guardar |
| `www/logic.js` | El cálculo de las rachas |
| `tests/logica.test.js` | Pruebas automáticas de las rachas (`npm test`) |
| `capacitor.config.json` | Nombre e identificador de la app |
| `.github/workflows/compilar-apk.yml` | Las instrucciones para que GitHub compile el APK |
| `recursos/` | Icono, pantalla de inicio y la firma del APK |

## Probarla en la computadora

Abre `www/index.html` en Chrome. Funciona igual que en el teléfono.

## Notas

- Los recordatorios pueden llegar unos minutos tarde: Android agrupa las alarmas para ahorrar batería.
- Los datos se guardan solo en tu teléfono. Si desinstalas la app, se borran.
- `recursos/debug.keystore` es una firma de pruebas, suficiente para uso personal.
  Para publicar en Google Play se necesita una firma privada propia (no la subas a GitHub).
