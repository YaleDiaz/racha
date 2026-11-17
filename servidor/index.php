<?php
/*
  index.php — El servidor de Racha (cuentas, amigos, "en línea", respaldo,
  novedades con fotos y liga semanal).

  La app le habla así:   POST  https://tu-dominio/racha-api/?accion=entrar
  con un cuerpo JSON, y el servidor responde JSON:
     bien:  { "ok": true, ...datos }
     mal:   { "ok": false, "error": "mensaje para mostrar" }

  Si la petición necesita sesión, la app manda la cabecera  X-Racha-Token: <token>.

  Seguridad:
   - Las fotos se guardan en la carpeta fotos/ (cerrada al público) y solo las ven
     su dueño y sus amigos. Se borran solas a los 7 días.
   - Las contraseñas se guardan cifradas con password_hash (nunca en texto).
   - Los tokens de sesión se guardan solo como huella SHA-256.
   - Todas las consultas usan sentencias preparadas (evita inyección SQL).
   - Se limitan los intentos de inicio de sesión y de códigos.
*/
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Racha-Token');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

const DURACION_SESION = 180 * 86400;   // 180 días
const MAX_AMIGOS = 100;
const EN_LINEA_SEGUNDOS = 150;         // si no avisa en 2.5 min, ya no está en línea
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I para no confundir
const VERSION_ESQUEMA = 2;             // súbelo cuando cambien las tablas
const DIAS_FOTOS = 7;                  // las fotos se borran a los 7 días
const TIPOS_PUBLICACION = ['habito', 'reto', 'record', 'entreno', 'nivel', 'medalla', 'racha'];

// ---------- Respuestas ----------
function responder(array $datos): void
{
    echo json_encode(['ok' => true] + $datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function falla(string $mensaje, int $estado = 400): void
{
    http_response_code($estado);
    echo json_encode(['ok' => false, 'error' => $mensaje], JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(function (Throwable $e) {
    error_log('Racha API: ' . $e->getMessage() . ' en ' . $e->getFile() . ':' . $e->getLine());
    falla('Error del servidor. Intenta de nuevo en un momento.', 500);
});

// ---------- Conexión a la base de datos ----------
$rutaConfig = __DIR__ . '/config.php';
if (!is_file($rutaConfig)) {
    falla('Falta el archivo config.php en el servidor.', 500);
}
$config = require $rutaConfig;

$db = new PDO($config['db_dsn'], $config['db_usuario'] ?? null, $config['db_clave'] ?? null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

// Ejecuta una consulta preparada y regresa el resultado
function consulta(string $sql, array $parametros = []): PDOStatement
{
    global $db;
    $sentencia = $db->prepare($sql);
    $sentencia->execute($parametros);
    return $sentencia;
}

function fila(string $sql, array $parametros = []): ?array
{
    $f = consulta($sql, $parametros)->fetch();
    return $f === false ? null : $f;
}

// ---------- Actualización automática de las tablas ----------
// Cuando subes una versión nueva de este archivo, la primera petición agrega lo que falte
// (tablas nuevas, columnas nuevas y la carpeta de fotos). No borra nada.
function carpetaFotos(): string
{
    return __DIR__ . '/fotos';
}

function migrar(): void
{
    global $db;
    $marca = carpetaFotos() . '/version.txt';
    if (is_file($marca) && (int)trim((string)file_get_contents($marca)) >= VERSION_ESQUEMA) {
        return;
    }
    $sqlite = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $fin = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $llave = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY';
    $indices = $sqlite ? '' : ', KEY k_usuario_creado (usuario_id, creado), UNIQUE KEY uk_usuario_clave (usuario_id, clave), KEY k_creado (creado)';

    $db->exec("CREATE TABLE IF NOT EXISTS actividad (
        id $llave,
        usuario_id INT UNSIGNED NOT NULL,
        clave VARCHAR(80) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        titulo VARCHAR(120) NOT NULL DEFAULT '',
        emoji VARCHAR(32) NOT NULL DEFAULT '',
        detalle VARCHAR(160) NOT NULL DEFAULT '',
        puntos INT UNSIGNED NOT NULL DEFAULT 0,
        foto VARCHAR(40) NULL,
        creado INT UNSIGNED NOT NULL$indices
    )$fin");
    if ($sqlite) {
        $db->exec('CREATE INDEX IF NOT EXISTS k_actividad_usuario ON actividad (usuario_id, creado)');
        $db->exec('CREATE UNIQUE INDEX IF NOT EXISTS uk_actividad_clave ON actividad (usuario_id, clave)');
    }
    $db->exec("CREATE TABLE IF NOT EXISTS puntos_semana (
        usuario_id INT UNSIGNED NOT NULL,
        semana CHAR(10) NOT NULL,
        puntos INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (usuario_id, semana)
    )$fin");
    try {
        $db->query('SELECT medallas FROM usuarios LIMIT 1');
    } catch (Throwable $e) {
        $db->exec('ALTER TABLE usuarios ADD COLUMN medallas INT UNSIGNED NOT NULL DEFAULT 0');
    }

    // Carpeta de fotos cerrada al público (solo se entregan con ?accion=foto)
    $carpeta = carpetaFotos();
    if (!is_dir($carpeta) && !@mkdir($carpeta, 0755, true) && !is_dir($carpeta)) {
        throw new RuntimeException('No se pudo crear la carpeta de fotos');
    }
    @file_put_contents($carpeta . '/.htaccess', "Require all denied\n");
    @file_put_contents($carpeta . '/index.html', '');
    if (@file_put_contents($marca, (string)VERSION_ESQUEMA) === false) {
        throw new RuntimeException('No se pudo escribir fotos/version.txt');
    }
}
migrar();

// GET sirve para revisar que el servidor y la base de datos funcionan
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    $tablas = 0;
    foreach (['usuarios', 'sesiones', 'amistades', 'respaldos', 'recuperaciones', 'intentos', 'actividad', 'puntos_semana'] as $t) {
        try { consulta("SELECT 1 FROM $t LIMIT 1"); $tablas++; } catch (Throwable $e) { /* falta la tabla */ }
    }
    responder(['app' => 'Racha API', 'version' => VERSION_ESQUEMA, 'base' => 'conectada', 'tablas' => $tablas, 'tablasEsperadas' => 8]);
}

// ---------- Lectura de la petición ----------
$cuerpo = file_get_contents('php://input') ?: '';
if (strlen($cuerpo) > 2500000) {
    falla('La petición es demasiado grande.', 413);
}
$entrada = json_decode($cuerpo, true);
if (!is_array($entrada)) {
    $entrada = [];
}
$accion = (string)($_GET['accion'] ?? '');
$ahora = time();
$ip = substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);

function texto(string $campo, int $max = 200): string
{
    global $entrada;
    $valor = $entrada[$campo] ?? '';
    return is_string($valor) ? trim(mb_substr($valor, 0, $max)) : '';
}

function entero($valor, int $max = 1000000000): int
{
    $n = is_numeric($valor) ? (int)$valor : 0;
    return max(0, min($max, $n));
}

// ---------- Límite de intentos (contra quien intenta adivinar contraseñas) ----------
function demasiadosIntentos(string $clave, int $maximo, int $ventanaSegundos): bool
{
    global $ahora;
    $f = fila('SELECT COUNT(*) AS n FROM intentos WHERE clave = ? AND momento > ?', [$clave, $ahora - $ventanaSegundos]);
    return (int)$f['n'] >= $maximo;
}

function anotarIntento(string $clave): void
{
    global $ahora;
    consulta('INSERT INTO intentos (clave, momento) VALUES (?, ?)', [$clave, $ahora]);
    if (random_int(1, 50) === 1) {
        consulta('DELETE FROM intentos WHERE momento < ?', [$ahora - 86400]);
    }
}

// ---------- Usuarios y sesiones ----------
function usuarioPublico(array $u): array
{
    return [
        'id' => (int)$u['id'],
        'correo' => $u['correo'],
        'nombre' => $u['nombre'],
        'avatar' => $u['avatar'],
        'codigo' => $u['codigo'],
        'mostrarEnLinea' => (int)$u['mostrar_en_linea'] === 1,
    ];
}

function nuevoCodigo(): string
{
    for ($intento = 0; $intento < 20; $intento++) {
        $codigo = '';
        for ($i = 0; $i < 6; $i++) {
            $codigo .= LETRAS_CODIGO[random_int(0, strlen(LETRAS_CODIGO) - 1)];
        }
        if (!fila('SELECT id FROM usuarios WHERE codigo = ?', [$codigo])) {
            return $codigo;
        }
    }
    throw new RuntimeException('No se pudo generar un código único');
}

function crearSesion(int $usuarioId): string
{
    global $ahora;
    $token = bin2hex(random_bytes(32));
    consulta('INSERT INTO sesiones (token_hash, usuario_id, creada, expira) VALUES (?, ?, ?, ?)',
        [hash('sha256', $token), $usuarioId, $ahora, $ahora + DURACION_SESION]);
    return $token;
}

function tokenRecibido(): string
{
    return (string)($_SERVER['HTTP_X_RACHA_TOKEN'] ?? '');
}

// Regresa el usuario dueño del token, o corta con error 401
function usuarioActual(): array
{
    global $ahora;
    $token = tokenRecibido();
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        falla('Tu sesión se cerró. Vuelve a iniciar sesión.', 401);
    }
    $hash = hash('sha256', $token);
    $u = fila('SELECT u.*, s.expira AS sesion_expira FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?', [$hash]);
    if (!$u || (int)$u['sesion_expira'] < $ahora) {
        consulta('DELETE FROM sesiones WHERE token_hash = ?', [$hash]);
        falla('Tu sesión se cerró. Vuelve a iniciar sesión.', 401);
    }
    // Si quedan menos de 90 días, se renueva sola
    if ((int)$u['sesion_expira'] - $ahora < 90 * 86400) {
        consulta('UPDATE sesiones SET expira = ? WHERE token_hash = ?', [$ahora + DURACION_SESION, $hash]);
    }
    return $u;
}

function validarClave(string $clave): void
{
    if (mb_strlen($clave) < 8) {
        falla('La contraseña debe tener al menos 8 caracteres.');
    }
    if (strlen($clave) > 200) {
        falla('La contraseña es demasiado larga.');
    }
}

function contarAmigos(int $usuarioId): int
{
    return (int)fila('SELECT COUNT(*) AS n FROM amistades WHERE usuario_id = ?', [$usuarioId])['n'];
}

function claveEntrada(): string
{
    global $entrada;
    $c = $entrada['clave'] ?? '';
    return is_string($c) ? $c : '';
}

// Un día en texto "AAAA-MM-DD" válido, o '' si no lo es
function fechaValida($valor): string
{
    if (!is_string($valor) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $valor, $m)) return '';
    return checkdate((int)$m[2], (int)$m[3], (int)$m[1]) ? $valor : '';
}

// ---------- Fotos ----------
// Recibe la foto en base64 (JPG), la revisa, la vuelve a guardar sin datos ocultos
// (como la ubicación) y regresa su nombre de archivo.
function guardarFoto(string $base64): string
{
    $limpio = preg_replace('#^data:image/[a-z]+;base64,#i', '', $base64);
    $datos = base64_decode((string)$limpio, true);
    if ($datos === false || strlen($datos) < 500) falla('No se pudo leer la foto.');
    if (strlen($datos) > 1600000) falla('La foto es demasiado grande.');
    if (substr($datos, 0, 3) !== "\xFF\xD8\xFF") falla('La foto debe ser JPG.');
    if (function_exists('imagecreatefromstring')) {
        $img = @imagecreatefromstring($datos);
        if (!$img) falla('No se pudo leer la foto.');
        $ancho = imagesx($img);
        $alto = imagesy($img);
        $max = 1280;
        if ($ancho > $max || $alto > $max) {
            $escala = $max / max($ancho, $alto);
            $nueva = imagecreatetruecolor((int)round($ancho * $escala), (int)round($alto * $escala));
            imagecopyresampled($nueva, $img, 0, 0, 0, 0, imagesx($nueva), imagesy($nueva), $ancho, $alto);
            imagedestroy($img);
            $img = $nueva;
        }
        ob_start();
        imagejpeg($img, null, 82);
        $datos = (string)ob_get_clean();
        imagedestroy($img);
    }
    $nombre = bin2hex(random_bytes(16));
    if (@file_put_contents(carpetaFotos() . '/' . $nombre . '.jpg', $datos, LOCK_EX) === false) {
        throw new RuntimeException('No se pudo guardar la foto');
    }
    return $nombre;
}

function borrarArchivoFoto(?string $nombre): void
{
    if ($nombre && preg_match('/^[a-f0-9]{32}$/', $nombre)) {
        @unlink(carpetaFotos() . '/' . $nombre . '.jpg');
    }
}

// Borra fotos de más de 7 días y publicaciones de más de 8
function limpiarViejas(): void
{
    global $ahora;
    $viejas = consulta('SELECT id, foto FROM actividad WHERE foto IS NOT NULL AND creado < ? LIMIT 300', [$ahora - DIAS_FOTOS * 86400])->fetchAll();
    foreach ($viejas as $v) {
        borrarArchivoFoto($v['foto']);
        consulta('UPDATE actividad SET foto = NULL WHERE id = ?', [$v['id']]);
    }
    consulta('DELETE FROM actividad WHERE foto IS NULL AND creado < ?', [$ahora - (DIAS_FOTOS + 1) * 86400]);
}

function sonAmigos(int $a, int $b): bool
{
    return (bool)fila('SELECT usuario_id FROM amistades WHERE usuario_id = ? AND amigo_id = ?', [$a, $b]);
}

// Tabla de la liga de una semana: yo y mis amigos con sus puntos
function tablaLiga(int $usuarioId, string $semana): array
{
    $filas = consulta('SELECT u.id, u.nombre, u.avatar, u.medallas, COALESCE(p.puntos, 0) AS puntos
        FROM usuarios u LEFT JOIN puntos_semana p ON p.usuario_id = u.id AND p.semana = ?
        WHERE u.id = ? OR u.id IN (SELECT amigo_id FROM amistades WHERE usuario_id = ?)
        ORDER BY puntos DESC, u.nombre ASC', [$semana, $usuarioId, $usuarioId])->fetchAll();
    return array_map(function ($f) use ($usuarioId) {
        return [
            'id' => (int)$f['id'], 'nombre' => $f['nombre'], 'avatar' => $f['avatar'],
            'puntos' => (int)$f['puntos'], 'medallas' => (int)$f['medallas'], 'yo' => (int)$f['id'] === $usuarioId,
        ];
    }, $filas);
}

function enviarCorreo(string $para, string $asunto, string $mensaje): bool
{
    global $config;
    $remitente = $config['correo_remitente'] ?? '';
    if ($remitente === '') {
        return false;
    }
    $cabeceras = 'From: Racha <' . $remitente . ">\r\n"
        . "MIME-Version: 1.0\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n";
    $asuntoCodificado = '=?UTF-8?B?' . base64_encode($asunto) . '?=';
    return @mail($para, $asuntoCodificado, $mensaje, $cabeceras, '-f' . $remitente);
}

// ======================================================================
//  ACCIONES
// ======================================================================
switch ($accion) {

    // ---------- Crear cuenta ----------
    case 'registrar':
        $correo = mb_strtolower(texto('correo', 190));
        $nombre = texto('nombre', 24);
        $avatar = texto('avatar', 16) ?: '🔥';
        $clave = claveEntrada();
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) falla('Escribe un correo válido.');
        if (mb_strlen($nombre) < 2) falla('Tu nombre debe tener al menos 2 letras.');
        validarClave($clave);
        if (demasiadosIntentos('registro-ip:' . $ip, 10, 3600)) falla('Demasiadas cuentas creadas desde aquí. Espera un rato.', 429);
        if (fila('SELECT id FROM usuarios WHERE correo = ?', [$correo])) falla('Ese correo ya tiene una cuenta. Inicia sesión.');
        anotarIntento('registro-ip:' . $ip);

        consulta('INSERT INTO usuarios (correo, clave_hash, nombre, avatar, codigo, ultimo_visto, creado) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$correo, password_hash($clave, PASSWORD_DEFAULT), $nombre, $avatar, nuevoCodigo(), $ahora, $ahora]);
        $u = fila('SELECT * FROM usuarios WHERE correo = ?', [$correo]);
        responder(['token' => crearSesion((int)$u['id']), 'usuario' => usuarioPublico($u), 'amigos' => 0]);

    // ---------- Iniciar sesión ----------
    case 'entrar':
        $correo = mb_strtolower(texto('correo', 190));
        $clave = claveEntrada();
        if ($correo === '' || $clave === '') falla('Escribe tu correo y tu contraseña.');
        if (demasiadosIntentos('entrar:' . $correo, 8, 900) || demasiadosIntentos('entrar-ip:' . $ip, 30, 900)) {
            falla('Demasiados intentos. Espera 15 minutos o recupera tu contraseña.', 429);
        }
        $u = fila('SELECT * FROM usuarios WHERE correo = ?', [$correo]);
        if (!$u || !password_verify($clave, $u['clave_hash'])) {
            anotarIntento('entrar:' . $correo);
            anotarIntento('entrar-ip:' . $ip);
            falla('Correo o contraseña incorrectos.');
        }
        if (password_needs_rehash($u['clave_hash'], PASSWORD_DEFAULT)) {
            consulta('UPDATE usuarios SET clave_hash = ? WHERE id = ?', [password_hash($clave, PASSWORD_DEFAULT), $u['id']]);
        }
        responder(['token' => crearSesion((int)$u['id']), 'usuario' => usuarioPublico($u), 'amigos' => contarAmigos((int)$u['id'])]);

    // ---------- Cerrar sesión ----------
    case 'salir':
        $token = tokenRecibido();
        if ($token !== '') {
            $u = usuarioActual();
            consulta('UPDATE usuarios SET en_linea = 0, ultimo_visto = ? WHERE id = ?', [$ahora, $u['id']]);
            consulta('DELETE FROM sesiones WHERE token_hash = ?', [hash('sha256', $token)]);
        }
        responder([]);

    // ---------- Datos de mi cuenta ----------
    case 'yo':
        $u = usuarioActual();
        responder(['usuario' => usuarioPublico($u), 'amigos' => contarAmigos((int)$u['id'])]);

    // ---------- Guardar respaldo + estadísticas que ven los amigos ----------
    case 'sincronizar':
        $u = usuarioActual();
        $datos = $entrada['datos'] ?? null;
        if (is_array($datos)) {
            $json = json_encode($datos, JSON_UNESCAPED_UNICODE);
            if (strlen($json) > 1000000) falla('Tus datos son demasiado grandes para respaldar.');
            consulta('DELETE FROM respaldos WHERE usuario_id = ?', [$u['id']]);
            consulta('INSERT INTO respaldos (usuario_id, datos, actualizado) VALUES (?, ?, ?)', [$u['id'], $json, $ahora]);
        }
        $nombre = texto('nombre', 24);
        $avatar = texto('avatar', 16);
        $mostrar = array_key_exists('mostrarEnLinea', $entrada) ? ($entrada['mostrarEnLinea'] ? 1 : 0) : (int)$u['mostrar_en_linea'];
        consulta('UPDATE usuarios SET nombre = ?, avatar = ?, mostrar_en_linea = ?, ultimo_visto = ? WHERE id = ?', [
            mb_strlen($nombre) >= 2 ? $nombre : $u['nombre'], $avatar !== '' ? $avatar : $u['avatar'], $mostrar, $ahora, $u['id'],
        ]);
        // Estadísticas que ven tus amigos (solo si la app las manda)
        if (is_array($entrada['stats'] ?? null)) {
            $s = $entrada['stats'];
            $nivelNuevo = max(1, entero($s['nivel'] ?? 1, 100000));
            consulta('UPDATE usuarios SET xp = ?, nivel = ?, racha = ?, logros = ?, minutos_semana = ?, medallas = ? WHERE id = ?', [
                entero($s['xp'] ?? 0), $nivelNuevo, entero($s['racha'] ?? 0, 100000),
                entero($s['logros'] ?? 0, 1000), entero($s['minutosSemana'] ?? 0, 100000),
                entero($s['medallas'] ?? $u['medallas'], 10000), $u['id'],
            ]);
            // Subiste de nivel: tus amigos lo ven en Novedades
            $nivelViejo = (int)$u['nivel'];
            if ((int)$u['xp'] > 0 && $nivelNuevo > $nivelViejo && $nivelNuevo - $nivelViejo <= 3
                && !fila('SELECT id FROM actividad WHERE usuario_id = ? AND clave = ?', [$u['id'], 'nivel:' . $nivelNuevo])) {
                consulta('INSERT INTO actividad (usuario_id, clave, tipo, titulo, emoji, detalle, puntos, foto, creado) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)',
                    [$u['id'], 'nivel:' . $nivelNuevo, 'nivel', 'subió al nivel ' . $nivelNuevo, '⭐', '', $ahora]);
            }
        }
        // Puntos de la liga semanal: { "2026-11-16": 120, "2026-11-09": 340 }
        if (is_array($entrada['semanas'] ?? null)) {
            $n = 0;
            foreach ($entrada['semanas'] as $semana => $puntos) {
                if (++$n > 3) break;
                if (fechaValida((string)$semana) === '') continue;
                consulta('DELETE FROM puntos_semana WHERE usuario_id = ? AND semana = ?', [$u['id'], $semana]);
                consulta('INSERT INTO puntos_semana (usuario_id, semana, puntos) VALUES (?, ?, ?)', [$u['id'], $semana, entero($puntos, 1000000)]);
            }
        }
        responder(['actualizado' => $ahora]);

    // ---------- Traer mi respaldo ----------
    case 'respaldo':
        $u = usuarioActual();
        $r = fila('SELECT datos, actualizado FROM respaldos WHERE usuario_id = ?', [$u['id']]);
        responder(['datos' => $r ? json_decode($r['datos'], true) : null, 'actualizado' => $r ? (int)$r['actualizado'] : null]);

    // ---------- Estoy en línea / me fui ----------
    case 'presencia':
        $u = usuarioActual();
        $enLinea = !empty($entrada['enLinea']) ? 1 : 0;
        consulta('UPDATE usuarios SET en_linea = ?, ultimo_visto = ? WHERE id = ?', [$enLinea, $ahora, $u['id']]);
        responder([]);

    // ---------- Lista de amigos (y yo) para la clasificación ----------
    case 'amigos':
        $u = usuarioActual();
        $yoMuestro = (int)$u['mostrar_en_linea'] === 1;
        $filas = consulta('SELECT u.id, u.nombre, u.avatar, u.nivel, u.xp, u.racha, u.logros, u.minutos_semana, u.medallas, u.mostrar_en_linea, u.en_linea, u.ultimo_visto, a.creada
            FROM amistades a JOIN usuarios u ON u.id = a.amigo_id WHERE a.usuario_id = ? ORDER BY u.xp DESC', [$u['id']])->fetchAll();
        $amigos = array_map(function ($f) use ($yoMuestro, $ahora) {
            // Como en WhatsApp: si ocultas tu estado, tampoco ves el de los demás
            $visible = $yoMuestro && (int)$f['mostrar_en_linea'] === 1;
            $hace = max(0, $ahora - (int)$f['ultimo_visto']);
            return [
                'id' => (int)$f['id'], 'nombre' => $f['nombre'], 'avatar' => $f['avatar'],
                'nivel' => (int)$f['nivel'], 'xp' => (int)$f['xp'], 'racha' => (int)$f['racha'],
                'logros' => (int)$f['logros'], 'minutosSemana' => (int)$f['minutos_semana'], 'medallas' => (int)$f['medallas'],
                'enLinea' => $visible ? ((int)$f['en_linea'] === 1 && $hace < EN_LINEA_SEGUNDOS) : null,
                'vistoHace' => $visible ? $hace : null,
                'amigosDesde' => (int)$f['creada'],
            ];
        }, $filas);
        responder(['amigos' => $amigos]);

    // ---------- Agregar amigo con su código ----------
    case 'agregarAmigo':
        $u = usuarioActual();
        $codigo = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', texto('codigo', 20)));
        if (strlen($codigo) !== 6) falla('El código tiene 6 letras y números.');
        if (demasiadosIntentos('amigo:' . $u['id'], 20, 3600)) falla('Demasiados intentos. Espera un rato.', 429);
        if ($codigo === $u['codigo']) falla('Ese es tu propio código 😄');
        $amigo = fila('SELECT * FROM usuarios WHERE codigo = ?', [$codigo]);
        if (!$amigo) {
            anotarIntento('amigo:' . $u['id']);
            falla('No existe nadie con ese código. Revísalo.');
        }
        if (fila('SELECT usuario_id FROM amistades WHERE usuario_id = ? AND amigo_id = ?', [$u['id'], $amigo['id']])) {
            falla('Ya son amigos.');
        }
        if (contarAmigos((int)$u['id']) >= MAX_AMIGOS || contarAmigos((int)$amigo['id']) >= MAX_AMIGOS) {
            falla('Se alcanzó el máximo de ' . MAX_AMIGOS . ' amigos.');
        }
        $db->beginTransaction();
        consulta('INSERT INTO amistades (usuario_id, amigo_id, creada) VALUES (?, ?, ?)', [$u['id'], $amigo['id'], $ahora]);
        consulta('INSERT INTO amistades (usuario_id, amigo_id, creada) VALUES (?, ?, ?)', [$amigo['id'], $u['id'], $ahora]);
        $db->commit();
        responder(['amigo' => ['id' => (int)$amigo['id'], 'nombre' => $amigo['nombre'], 'avatar' => $amigo['avatar']], 'amigos' => contarAmigos((int)$u['id'])]);

    // ---------- Quitar amigo ----------
    case 'quitarAmigo':
        $u = usuarioActual();
        $id = entero($entrada['id'] ?? 0);
        consulta('DELETE FROM amistades WHERE (usuario_id = ? AND amigo_id = ?) OR (usuario_id = ? AND amigo_id = ?)', [$u['id'], $id, $id, $u['id']]);
        responder(['amigos' => contarAmigos((int)$u['id'])]);

    // ---------- Cambiar contraseña (estando dentro) ----------
    case 'cambiarClave':
        $u = usuarioActual();
        $actual = is_string($entrada['actual'] ?? null) ? $entrada['actual'] : '';
        $nueva = is_string($entrada['nueva'] ?? null) ? $entrada['nueva'] : '';
        if (!password_verify($actual, $u['clave_hash'])) falla('Tu contraseña actual no es correcta.');
        validarClave($nueva);
        consulta('UPDATE usuarios SET clave_hash = ? WHERE id = ?', [password_hash($nueva, PASSWORD_DEFAULT), $u['id']]);
        // Cierra la sesión en los demás teléfonos
        consulta('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash <> ?', [$u['id'], hash('sha256', tokenRecibido())]);
        responder([]);

    // ---------- Eliminar mi cuenta ----------
    case 'eliminarCuenta':
        $u = usuarioActual();
        if (!password_verify(claveEntrada(), $u['clave_hash'])) falla('La contraseña no es correcta.');
        foreach (consulta('SELECT foto FROM actividad WHERE usuario_id = ? AND foto IS NOT NULL', [$u['id']])->fetchAll() as $f) {
            borrarArchivoFoto($f['foto']);
        }
        $db->beginTransaction();
        consulta('DELETE FROM actividad WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM puntos_semana WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM amistades WHERE usuario_id = ? OR amigo_id = ?', [$u['id'], $u['id']]);
        consulta('DELETE FROM sesiones WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM respaldos WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM recuperaciones WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM usuarios WHERE id = ?', [$u['id']]);
        $db->commit();
        responder([]);

    // ---------- Publicar en Novedades (hábito cumplido, reto, récord…) ----------
    // "clave" identifica la publicación: si ya existe, se actualiza (por ejemplo, al agregarle la foto).
    case 'publicar':
        $u = usuarioActual();
        $clave = texto('clave', 80);
        $tipo = texto('tipo', 20);
        if (!preg_match('/^[A-Za-z0-9:_.\-]{1,80}$/', $clave)) falla('Publicación no válida.');
        if (!in_array($tipo, TIPOS_PUBLICACION, true)) falla('Tipo de publicación no válido.');
        if (demasiadosIntentos('publicar:' . $u['id'], 150, 3600)) falla('Vas muy rápido. Espera un rato.', 429);
        anotarIntento('publicar:' . $u['id']);
        $momento = entero($entrada['momento'] ?? $ahora, 4000000000);
        if ($momento > $ahora + 300 || $momento < $ahora - 2 * 86400) $momento = $ahora;
        $foto = null;
        if (is_string($entrada['foto'] ?? null) && $entrada['foto'] !== '') {
            if (demasiadosIntentos('foto:' . $u['id'], 40, 86400)) falla('Ya subiste muchas fotos hoy. Intenta mañana.', 429);
            anotarIntento('foto:' . $u['id']);
            $foto = guardarFoto($entrada['foto']);
        }
        $datosPub = [$tipo, texto('titulo', 120), texto('emoji', 32), texto('detalle', 160), entero($entrada['puntos'] ?? 0, 10000)];
        $existe = fila('SELECT id, foto FROM actividad WHERE usuario_id = ? AND clave = ?', [$u['id'], $clave]);
        if ($existe) {
            if ($foto !== null) borrarArchivoFoto($existe['foto']);
            $fotoFinal = $foto ?? $existe['foto'];
            consulta('UPDATE actividad SET tipo = ?, titulo = ?, emoji = ?, detalle = ?, puntos = ?, foto = ? WHERE id = ?',
                array_merge($datosPub, [$fotoFinal, $existe['id']]));
            $id = (int)$existe['id'];
        } else {
            $fotoFinal = $foto;
            consulta('INSERT INTO actividad (tipo, titulo, emoji, detalle, puntos, foto, usuario_id, clave, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                array_merge($datosPub, [$fotoFinal, $u['id'], $clave, $momento]));
            $id = (int)$db->lastInsertId();
        }
        responder(['id' => $id, 'foto' => $fotoFinal !== null]);

    // ---------- Borrar una publicación (por ejemplo, al desmarcar un hábito) ----------
    case 'borrarPublicacion':
        $u = usuarioActual();
        $clave = texto('clave', 80);
        $p = fila('SELECT id, foto FROM actividad WHERE usuario_id = ? AND clave = ?', [$u['id'], $clave]);
        if ($p) {
            borrarArchivoFoto($p['foto']);
            consulta('DELETE FROM actividad WHERE id = ?', [$p['id']]);
        }
        responder(['borrada' => (bool)$p]);

    // ---------- Novedades: lo que hicieron tú y tus amigos en los últimos 7 días ----------
    case 'novedades':
        $u = usuarioActual();
        if (random_int(1, 5) === 1) limpiarViejas();
        $filas = consulta('SELECT a.id, a.usuario_id, a.clave, a.tipo, a.titulo, a.emoji, a.detalle, a.puntos, a.foto, a.creado, u.nombre, u.avatar
            FROM actividad a JOIN usuarios u ON u.id = a.usuario_id
            WHERE a.creado > ? AND (a.usuario_id = ? OR a.usuario_id IN (SELECT amigo_id FROM amistades WHERE usuario_id = ?))
            ORDER BY a.creado DESC, a.id DESC LIMIT 80', [$ahora - DIAS_FOTOS * 86400, $u['id'], $u['id']])->fetchAll();
        $lista = array_map(function ($f) use ($u, $ahora) {
            return [
                'id' => (int)$f['id'],
                'usuario' => ['id' => (int)$f['usuario_id'], 'nombre' => $f['nombre'], 'avatar' => $f['avatar']],
                'yo' => (int)$f['usuario_id'] === (int)$u['id'],
                'clave' => (int)$f['usuario_id'] === (int)$u['id'] ? $f['clave'] : null,
                'tipo' => $f['tipo'], 'titulo' => $f['titulo'], 'emoji' => $f['emoji'], 'detalle' => $f['detalle'],
                'puntos' => (int)$f['puntos'], 'foto' => $f['foto'] !== null,
                'creado' => (int)$f['creado'], 'hace' => max(0, $ahora - (int)$f['creado']),
            ];
        }, $filas);
        responder(['novedades' => $lista, 'ahora' => $ahora]);

    // ---------- Ver una foto (solo su dueño y sus amigos) ----------
    case 'foto':
        $u = usuarioActual();
        $id = entero($entrada['id'] ?? ($_GET['id'] ?? 0));
        $p = fila('SELECT usuario_id, foto FROM actividad WHERE id = ?', [$id]);
        if (!$p || !$p['foto']) falla('Esa foto ya no existe.', 404);
        if ((int)$p['usuario_id'] !== (int)$u['id'] && !sonAmigos((int)$u['id'], (int)$p['usuario_id'])) {
            falla('No puedes ver esta foto.', 403);
        }
        $ruta = carpetaFotos() . '/' . $p['foto'] . '.jpg';
        if (!is_file($ruta)) falla('Esa foto ya no existe.', 404);
        header('Content-Type: image/jpeg');
        header('Cache-Control: private, max-age=604800');
        header('Content-Length: ' . filesize($ruta));
        readfile($ruta);
        exit;

    // ---------- Liga semanal (de lunes a domingo, entre tú y tus amigos) ----------
    // La app manda qué lunes es la semana actual y la anterior (según la hora del teléfono).
    case 'liga':
        $u = usuarioActual();
        $semana = fechaValida(texto('semana', 10));
        $anterior = fechaValida(texto('anterior', 10));
        if ($semana === '') falla('Semana no válida.');
        responder([
            'semana' => $semana,
            'tabla' => tablaLiga((int)$u['id'], $semana),
            'anterior' => $anterior === '' ? null : ['semana' => $anterior, 'tabla' => tablaLiga((int)$u['id'], $anterior)],
        ]);

    // ---------- Olvidé mi contraseña: enviar código por correo ----------
    case 'pedirCodigo':
        $correo = mb_strtolower(texto('correo', 190));
        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) falla('Escribe un correo válido.');
        if (demasiadosIntentos('codigo:' . $correo, 3, 3600) || demasiadosIntentos('codigo-ip:' . $ip, 10, 3600)) {
            falla('Ya pediste varios códigos. Espera una hora.', 429);
        }
        anotarIntento('codigo:' . $correo);
        anotarIntento('codigo-ip:' . $ip);
        $u = fila('SELECT * FROM usuarios WHERE correo = ?', [$correo]);
        if ($u) {
            $codigo = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            consulta('DELETE FROM recuperaciones WHERE usuario_id = ?', [$u['id']]);
            consulta('INSERT INTO recuperaciones (usuario_id, codigo_hash, expira, intentos) VALUES (?, ?, ?, 0)',
                [$u['id'], hash('sha256', $u['id'] . ':' . $codigo), $ahora + 900]);
            enviarCorreo($correo, 'Tu código de Racha: ' . $codigo,
                "Hola " . $u['nombre'] . ",\n\nTu código para cambiar tu contraseña de Racha es:\n\n    " . $codigo
                . "\n\nVence en 15 minutos. Si tú no lo pediste, ignora este correo.\n");
        }
        // La respuesta es igual exista o no la cuenta, para no revelar qué correos están registrados
        responder(['mensaje' => 'Si ese correo tiene cuenta, te enviamos un código. Revisa también tu carpeta de spam.']);

    // ---------- Olvidé mi contraseña: usar el código ----------
    case 'restablecer':
        $correo = mb_strtolower(texto('correo', 190));
        $codigo = preg_replace('/\D/', '', texto('codigo', 12));
        $nueva = claveEntrada();
        $u = fila('SELECT * FROM usuarios WHERE correo = ?', [$correo]);
        $r = $u ? fila('SELECT * FROM recuperaciones WHERE usuario_id = ?', [$u['id']]) : null;
        if (!$r || (int)$r['expira'] < $ahora || (int)$r['intentos'] >= 5) {
            falla('El código venció. Pide uno nuevo.');
        }
        if (!hash_equals($r['codigo_hash'], hash('sha256', $u['id'] . ':' . $codigo))) {
            consulta('UPDATE recuperaciones SET intentos = intentos + 1 WHERE usuario_id = ?', [$u['id']]);
            falla('El código no es correcto.');
        }
        validarClave($nueva);
        consulta('UPDATE usuarios SET clave_hash = ? WHERE id = ?', [password_hash($nueva, PASSWORD_DEFAULT), $u['id']]);
        consulta('DELETE FROM recuperaciones WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM sesiones WHERE usuario_id = ?', [$u['id']]);
        responder(['token' => crearSesion((int)$u['id']), 'usuario' => usuarioPublico($u), 'amigos' => contarAmigos((int)$u['id'])]);

    default:
        falla('Acción desconocida.', 404);
}
