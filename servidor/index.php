<?php
/*
  index.php — El servidor de Racha (cuentas, amigos, "en línea" y respaldo).

  La app le habla así:   POST  https://tu-dominio/racha-api/?accion=entrar
  con un cuerpo JSON, y el servidor responde JSON:
     bien:  { "ok": true, ...datos }
     mal:   { "ok": false, "error": "mensaje para mostrar" }

  Si la petición necesita sesión, la app manda la cabecera  X-Racha-Token: <token>.

  Seguridad:
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

// GET sirve para revisar que el servidor y la base de datos funcionan
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    $tablas = 0;
    foreach (['usuarios', 'sesiones', 'amistades', 'respaldos', 'recuperaciones', 'intentos'] as $t) {
        try { consulta("SELECT 1 FROM $t LIMIT 1"); $tablas++; } catch (Throwable $e) { /* falta la tabla */ }
    }
    responder(['app' => 'Racha API', 'version' => 1, 'base' => 'conectada', 'tablas' => $tablas, 'tablasEsperadas' => 6]);
}

// ---------- Lectura de la petición ----------
$cuerpo = file_get_contents('php://input') ?: '';
if (strlen($cuerpo) > 1500000) {
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
        $s = is_array($entrada['stats'] ?? null) ? $entrada['stats'] : [];
        $nombre = texto('nombre', 24);
        $avatar = texto('avatar', 16);
        $mostrar = array_key_exists('mostrarEnLinea', $entrada) ? ($entrada['mostrarEnLinea'] ? 1 : 0) : (int)$u['mostrar_en_linea'];
        consulta('UPDATE usuarios SET xp = ?, nivel = ?, racha = ?, logros = ?, minutos_semana = ?, nombre = ?, avatar = ?, mostrar_en_linea = ?, ultimo_visto = ? WHERE id = ?', [
            entero($s['xp'] ?? 0), max(1, entero($s['nivel'] ?? 1, 100000)), entero($s['racha'] ?? 0, 100000),
            entero($s['logros'] ?? 0, 1000), entero($s['minutosSemana'] ?? 0, 100000),
            mb_strlen($nombre) >= 2 ? $nombre : $u['nombre'], $avatar !== '' ? $avatar : $u['avatar'],
            $mostrar, $ahora, $u['id'],
        ]);
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
        $filas = consulta('SELECT u.id, u.nombre, u.avatar, u.nivel, u.xp, u.racha, u.logros, u.minutos_semana, u.mostrar_en_linea, u.en_linea, u.ultimo_visto, a.creada
            FROM amistades a JOIN usuarios u ON u.id = a.amigo_id WHERE a.usuario_id = ? ORDER BY u.xp DESC', [$u['id']])->fetchAll();
        $amigos = array_map(function ($f) use ($yoMuestro, $ahora) {
            // Como en WhatsApp: si ocultas tu estado, tampoco ves el de los demás
            $visible = $yoMuestro && (int)$f['mostrar_en_linea'] === 1;
            $hace = max(0, $ahora - (int)$f['ultimo_visto']);
            return [
                'id' => (int)$f['id'], 'nombre' => $f['nombre'], 'avatar' => $f['avatar'],
                'nivel' => (int)$f['nivel'], 'xp' => (int)$f['xp'], 'racha' => (int)$f['racha'],
                'logros' => (int)$f['logros'], 'minutosSemana' => (int)$f['minutos_semana'],
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
        $db->beginTransaction();
        consulta('DELETE FROM amistades WHERE usuario_id = ? OR amigo_id = ?', [$u['id'], $u['id']]);
        consulta('DELETE FROM sesiones WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM respaldos WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM recuperaciones WHERE usuario_id = ?', [$u['id']]);
        consulta('DELETE FROM usuarios WHERE id = ?', [$u['id']]);
        $db->commit();
        responder([]);

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
