-- Tablas de Racha para MySQL / MariaDB.
-- Se crean solas abriendo instalar.php una vez, o importando este archivo en phpMyAdmin.
-- Las fechas se guardan como segundos desde 1970 (timestamp Unix) para evitar líos de zona horaria.
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  correo VARCHAR(190) NOT NULL,
  clave_hash VARCHAR(255) NOT NULL,
  nombre VARCHAR(60) NOT NULL DEFAULT '',
  avatar VARCHAR(32) NOT NULL DEFAULT '',
  codigo CHAR(6) NOT NULL,
  mostrar_en_linea TINYINT(1) NOT NULL DEFAULT 1,
  en_linea TINYINT(1) NOT NULL DEFAULT 0,
  ultimo_visto INT UNSIGNED NOT NULL DEFAULT 0,
  xp INT UNSIGNED NOT NULL DEFAULT 0,
  nivel INT UNSIGNED NOT NULL DEFAULT 1,
  racha INT UNSIGNED NOT NULL DEFAULT 0,
  logros INT UNSIGNED NOT NULL DEFAULT 0,
  minutos_semana INT UNSIGNED NOT NULL DEFAULT 0,
  creado INT UNSIGNED NOT NULL,
  UNIQUE KEY uk_correo (correo),
  UNIQUE KEY uk_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesiones (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  creada INT UNSIGNED NOT NULL,
  expira INT UNSIGNED NOT NULL,
  KEY k_usuario (usuario_id),
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS amistades (
  usuario_id INT UNSIGNED NOT NULL,
  amigo_id INT UNSIGNED NOT NULL,
  creada INT UNSIGNED NOT NULL,
  PRIMARY KEY (usuario_id, amigo_id),
  KEY k_amigo (amigo_id),
  CONSTRAINT fk_amistad_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_amistad_amigo FOREIGN KEY (amigo_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS respaldos (
  usuario_id INT UNSIGNED NOT NULL PRIMARY KEY,
  datos MEDIUMTEXT NOT NULL,
  actualizado INT UNSIGNED NOT NULL,
  CONSTRAINT fk_respaldo_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recuperaciones (
  usuario_id INT UNSIGNED NOT NULL PRIMARY KEY,
  codigo_hash CHAR(64) NOT NULL,
  expira INT UNSIGNED NOT NULL,
  intentos INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_recuperacion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS intentos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  clave VARCHAR(200) NOT NULL,
  momento INT UNSIGNED NOT NULL,
  KEY k_clave_momento (clave, momento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
