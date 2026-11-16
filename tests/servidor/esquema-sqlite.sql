-- Mismo esquema que servidor/esquema.sql pero para SQLite (solo para pruebas en la computadora)
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  correo TEXT NOT NULL UNIQUE,
  clave_hash TEXT NOT NULL,
  nombre TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  codigo TEXT NOT NULL UNIQUE,
  mostrar_en_linea INTEGER NOT NULL DEFAULT 1,
  en_linea INTEGER NOT NULL DEFAULT 0,
  ultimo_visto INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  nivel INTEGER NOT NULL DEFAULT 1,
  racha INTEGER NOT NULL DEFAULT 0,
  logros INTEGER NOT NULL DEFAULT 0,
  minutos_semana INTEGER NOT NULL DEFAULT 0,
  creado INTEGER NOT NULL
);
CREATE TABLE sesiones (token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL, creada INTEGER NOT NULL, expira INTEGER NOT NULL);
CREATE TABLE amistades (usuario_id INTEGER NOT NULL, amigo_id INTEGER NOT NULL, creada INTEGER NOT NULL, PRIMARY KEY (usuario_id, amigo_id));
CREATE TABLE respaldos (usuario_id INTEGER PRIMARY KEY, datos TEXT NOT NULL, actualizado INTEGER NOT NULL);
CREATE TABLE recuperaciones (usuario_id INTEGER PRIMARY KEY, codigo_hash TEXT NOT NULL, expira INTEGER NOT NULL, intentos INTEGER NOT NULL DEFAULT 0);
CREATE TABLE intentos (id INTEGER PRIMARY KEY AUTOINCREMENT, clave TEXT NOT NULL, momento INTEGER NOT NULL);
