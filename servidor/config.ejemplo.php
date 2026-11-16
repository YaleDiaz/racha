<?php
/*
  config.ejemplo.php — Plantilla de configuración del servidor.

  1. Copia este archivo en el servidor con el nombre  config.php
  2. Llena los datos de tu base de datos (hPanel de Hostinger → Bases de datos → MySQL).
  3. NUNCA subas config.php a GitHub: tu repositorio es público y tendría tu contraseña.
*/
return [
    // En Hostinger el servidor MySQL está en la misma máquina: usa 127.0.0.1
    'db_dsn' => 'mysql:host=127.0.0.1;port=3306;dbname=NOMBRE_DE_TU_BASE;charset=utf8mb4',
    'db_usuario' => 'USUARIO_DE_TU_BASE',
    'db_clave' => 'CONTRASEÑA_DE_TU_BASE',

    // Correo desde el que se mandan los códigos para recuperar contraseña.
    // Debe ser de un dominio que esté en tu Hostinger.
    'correo_remitente' => 'no-reply@tudominio.com',
];
