<?php
/*
  instalar.php — Instalador del servidor de Racha (se usa una sola vez).

  Ábrelo en el navegador:  https://tu-dominio/.../servidor/instalar.php
   1. Escribe los datos de la base de datos MySQL que creaste en Hostinger.
   2. El instalador prueba la conexión, guarda config.php y crea las tablas.
  Cuando config.php ya existe, este archivo solo revisa que las tablas estén completas
  (no borra nada y ya no acepta cambios de configuración).
*/
declare(strict_types=1);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$rutaConfig = __DIR__ . '/config.php';
$mensaje = '';
$error = '';

function conectar(array $c): PDO
{
    return new PDO($c['db_dsn'], $c['db_usuario'], $c['db_clave'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
}

function crearTablas(PDO $db): int
{
    $sql = preg_replace('/^--.*$/m', '', file_get_contents(__DIR__ . '/esquema.sql'));
    $n = 0;
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $sentencia) {
        $db->exec($sentencia);
        if (stripos($sentencia, 'CREATE TABLE') === 0) $n++;
    }
    return $n;
}

function h(string $t): string { return htmlspecialchars($t, ENT_QUOTES, 'UTF-8'); }

if (is_file($rutaConfig)) {
    // Ya instalado: solo revisa las tablas
    try {
        $n = crearTablas(conectar(require $rutaConfig));
        $mensaje = "Todo listo ✅ El servidor ya está configurado y las $n tablas existen.";
    } catch (Throwable $e) {
        $error = 'Existe config.php pero no se pudo conectar a la base de datos. Revisa sus datos en el Administrador de archivos.';
    }
} elseif (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $base = trim((string)($_POST['base'] ?? ''));
    $usuario = trim((string)($_POST['usuario'] ?? ''));
    $clave = (string)($_POST['clave'] ?? '');
    $remitente = trim((string)($_POST['remitente'] ?? ''));
    if ($base === '' || $usuario === '' || $clave === '') {
        $error = 'Llena el nombre de la base, el usuario y la contraseña.';
    } elseif ($remitente !== '' && !filter_var($remitente, FILTER_VALIDATE_EMAIL)) {
        $error = 'El correo remitente no es válido.';
    } else {
        $config = null;
        foreach (['127.0.0.1', 'localhost'] as $host) {
            $prueba = [
                'db_dsn' => 'mysql:host=' . $host . ';port=3306;dbname=' . $base . ';charset=utf8mb4',
                'db_usuario' => $usuario,
                'db_clave' => $clave,
                'correo_remitente' => $remitente,
            ];
            try {
                $n = crearTablas(conectar($prueba));
                $config = $prueba;
                break;
            } catch (Throwable $e) {
                $error = 'No se pudo conectar: revisa el nombre de la base, el usuario y la contraseña.';
            }
        }
        if ($config) {
            $contenido = "<?php\n// Creado por instalar.php. NO subas este archivo a GitHub.\nreturn " . var_export($config, true) . ";\n";
            if (@file_put_contents($rutaConfig, $contenido, LOCK_EX) === false) {
                $error = 'Se conectó, pero no se pudo guardar config.php en esta carpeta.';
            } else {
                @chmod($rutaConfig, 0600);
                $error = '';
                $mensaje = "¡Instalado! ✅ Se guardó la configuración y se crearon $n tablas. Ya puedes usar las cuentas en la app.";
            }
        }
    }
}
$instalado = is_file($rutaConfig);
$sugerido = 'no-reply@' . preg_replace('/^www\./', '', (string)($_SERVER['HTTP_HOST'] ?? 'tudominio.com'));
?><!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Instalar Racha</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #F6F4FF; color: #241C3F; margin: 0; padding: 24px; }
    main { max-width: 440px; margin: 0 auto; background: #fff; border: 2px solid #E4DFF5; border-bottom-width: 5px; border-radius: 20px; padding: 24px; }
    h1 { margin: 0 0 6px; font-size: 26px; }
    p { color: #5d5677; line-height: 1.45; }
    label { display: block; font-weight: 700; margin-top: 14px; font-size: 14px; }
    input { width: 100%; box-sizing: border-box; margin-top: 6px; padding: 12px; border: 2px solid #E4DFF5; border-radius: 12px; font-size: 16px; }
    small { color: #7A7393; }
    button { margin-top: 20px; width: 100%; padding: 14px; border: 0; border-radius: 14px; background: #6C4DF5; color: #fff; font-size: 16px; font-weight: 800; box-shadow: 0 5px 0 #4B32C2; cursor: pointer; }
    .ok { background: #E6FBF3; color: #0b7a55; padding: 12px; border-radius: 12px; font-weight: 700; }
    .mal { background: #FDECEC; color: #b3262b; padding: 12px; border-radius: 12px; font-weight: 700; }
  </style>
</head>
<body>
<main>
  <h1>🔥 Instalar Racha</h1>
  <?php if ($mensaje): ?><p class="ok"><?= h($mensaje) ?></p><?php endif; ?>
  <?php if ($error): ?><p class="mal"><?= h($error) ?></p><?php endif; ?>
  <?php if (!$instalado): ?>
    <p>Escribe los datos de la base de datos MySQL que creaste en hPanel (Bases de datos → Administración). Solo se piden una vez.</p>
    <form method="post" autocomplete="off">
      <label>Nombre de la base de datos
        <input name="base" required placeholder="u123456789_racha" value="<?= h((string)($_POST['base'] ?? '')) ?>">
      </label>
      <label>Usuario de la base de datos
        <input name="usuario" required placeholder="u123456789_racha" value="<?= h((string)($_POST['usuario'] ?? '')) ?>">
      </label>
      <label>Contraseña de la base de datos
        <input name="clave" type="password" required>
      </label>
      <label>Correo para enviar códigos de recuperación
        <input name="remitente" type="email" value="<?= h((string)($_POST['remitente'] ?? $sugerido)) ?>">
        <small>Debe ser de un dominio que esté en tu Hostinger.</small>
      </label>
      <button type="submit">Instalar</button>
    </form>
  <?php else: ?>
    <p>La dirección de tu servidor para la app es esta carpeta (sin <code>instalar.php</code>).</p>
  <?php endif; ?>
</main>
</body>
</html>
