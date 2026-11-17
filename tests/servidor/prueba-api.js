/*
  Prueba del servidor PHP en tu computadora (usa SQLite en lugar de MySQL).
  Requiere PHP instalado. Se corre con:   node tests/servidor/prueba-api.js
*/
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PUERTO = 8099;
// Una foto JPG chiquita (48×48) para probar las publicaciones
const FOTO = 'data:image/jpeg;base64,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';
const API = `http://127.0.0.1:${PUERTO}/`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'racha-api-'));
const correos = path.join(tmp, 'correos.txt');

// Copia el servidor a una carpeta temporal con una base SQLite vacía
for (const f of ['index.php', 'instalar.php']) fs.copyFileSync(path.join(__dirname, '../../servidor', f), path.join(tmp, f));
const base = path.join(tmp, 'racha.sqlite');
execFileSync('php', ['-r', `$db = new PDO('sqlite:${base}'); $db->exec(file_get_contents('${path.join(__dirname, 'esquema-sqlite.sql')}'));`]);
fs.writeFileSync(path.join(tmp, 'config.php'),
  `<?php return ['db_dsn' => 'sqlite:${base}', 'correo_remitente' => 'no-reply@prueba.test'];`);

// Los correos "enviados" se guardan en un archivo en vez de mandarse
const php = spawn('php', ['-d', `sendmail_path=sh -c 'cat >> ${correos}' --`, '-S', `127.0.0.1:${PUERTO}`, '-t', tmp], { stdio: 'ignore' });

async function llamar(accion, datos = {}, token) {
  const r = await fetch(API + '?accion=' + accion, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-Racha-Token': token } : {}),
    body: JSON.stringify(datos)
  });
  const j = await r.json();
  return Object.assign(j, { _estado: r.status });
}

(async () => {
  try {
    for (let i = 0; i < 40; i++) { try { await fetch(API); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }

    // Revisión con GET (la base empieza con las 6 tablas de la versión 1: la migración agrega el resto)
    const salud = await (await fetch(API)).json();
    assert.strictEqual(salud.tablas, 8);
    assert.strictEqual(salud.version, 2);
    assert.ok(fs.existsSync(path.join(tmp, 'fotos', '.htaccess')), 'la carpeta de fotos queda cerrada');
    assert.strictEqual(fs.readFileSync(path.join(tmp, 'fotos', 'version.txt'), 'utf8'), '2');

    // Preflight de CORS
    const pre = await fetch(API + '?accion=entrar', { method: 'OPTIONS' });
    assert.strictEqual(pre.status, 204);
    assert.strictEqual(pre.headers.get('access-control-allow-origin'), '*');

    // Registro: validaciones
    assert.match((await llamar('registrar', { correo: 'malo', clave: '12345678', nombre: 'Ana' })).error, /correo válido/);
    assert.match((await llamar('registrar', { correo: 'ana@x.com', clave: 'corta', nombre: 'Ana' })).error, /8 caracteres/);
    assert.match((await llamar('registrar', { correo: 'ana@x.com', clave: '12345678', nombre: 'A' })).error, /2 letras/);

    // Registro correcto (con mayúsculas y espacios en el correo)
    const ana = await llamar('registrar', { correo: '  Ana@X.com ', clave: 'secreta123', nombre: 'Ana', avatar: '🦁' });
    assert.ok(ana.ok, ana.error);
    assert.strictEqual(ana.usuario.correo, 'ana@x.com');
    assert.strictEqual(ana.usuario.avatar, '🦁');
    assert.match(ana.usuario.codigo, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.match(ana.token, /^[a-f0-9]{64}$/);
    assert.match((await llamar('registrar', { correo: 'ana@x.com', clave: 'otra12345', nombre: 'Ana' })).error, /ya tiene una cuenta/);

    // La contraseña NO se guarda en texto
    const filaAna = execFileSync('php', ['-r', `$db=new PDO('sqlite:${base}'); echo $db->query("SELECT clave_hash FROM usuarios WHERE id=1")->fetchColumn();`]).toString();
    assert.ok(!filaAna.includes('secreta123') && filaAna.startsWith('$2y$'));

    // Iniciar sesión
    assert.match((await llamar('entrar', { correo: 'ana@x.com', clave: 'mala-clave' })).error, /incorrectos/);
    const ana2 = await llamar('entrar', { correo: 'ANA@x.com', clave: 'secreta123' });
    assert.ok(ana2.ok);
    assert.notStrictEqual(ana2.token, ana.token);

    // Sin token o con token falso → 401
    assert.strictEqual((await llamar('yo'))._estado, 401);
    assert.strictEqual((await llamar('yo', {}, 'f'.repeat(64)))._estado, 401);
    assert.strictEqual((await llamar('yo', {}, ana.token)).usuario.nombre, 'Ana');

    // Segundo usuario y amistad con código
    const beto = await llamar('registrar', { correo: 'beto@x.com', clave: 'betobeto1', nombre: 'Beto' });
    assert.match((await llamar('agregarAmigo', { codigo: ana.usuario.codigo }, ana.token)).error, /propio código/);
    assert.match((await llamar('agregarAmigo', { codigo: 'ZZZZZZ' }, beto.token)).error, /No existe/);
    assert.match((await llamar('agregarAmigo', { codigo: 'ab' }, beto.token)).error, /6 letras/);
    const amistad = await llamar('agregarAmigo', { codigo: ana.usuario.codigo.toLowerCase() }, beto.token);
    assert.ok(amistad.ok, amistad.error);
    assert.strictEqual(amistad.amigos, 1);
    assert.strictEqual(amistad.amigo.nombre, 'Ana');
    assert.match((await llamar('agregarAmigo', { codigo: ana.usuario.codigo }, beto.token)).error, /Ya son amigos/);
    assert.strictEqual((await llamar('yo', {}, ana.token)).amigos, 1); // la amistad es de ida y vuelta

    // Sincronizar respaldo y estadísticas
    const datos = { habitos: [{ id: 'h1', nombre: 'Leer 📚', hechos: { '2026-11-16': true } }], entrenos: [] };
    const sinc = await llamar('sincronizar', { datos, stats: { xp: 330, nivel: 4, racha: 9, logros: 8, minutosSemana: 120 }, nombre: 'Ana Pro', avatar: '🔥', mostrarEnLinea: true }, ana.token);
    assert.ok(sinc.ok, sinc.error);
    const resp = await llamar('respaldo', {}, ana.token);
    assert.deepStrictEqual(resp.datos, datos);
    assert.strictEqual((await llamar('respaldo', {}, beto.token)).datos, null);

    // Presencia y lista de amigos
    await llamar('presencia', { enLinea: true }, ana.token);
    let lista = await llamar('amigos', {}, beto.token);
    assert.strictEqual(lista.amigos.length, 1);
    assert.strictEqual(lista.amigos[0].nombre, 'Ana Pro');
    assert.strictEqual(lista.amigos[0].xp, 330);
    assert.strictEqual(lista.amigos[0].racha, 9);
    assert.strictEqual(lista.amigos[0].enLinea, true);
    assert.ok(lista.amigos[0].vistoHace <= 2);

    await llamar('presencia', { enLinea: false }, ana.token);
    lista = await llamar('amigos', {}, beto.token);
    assert.strictEqual(lista.amigos[0].enLinea, false);
    assert.strictEqual(typeof lista.amigos[0].vistoHace, 'number');

    // Privacidad: si Ana oculta su estado, Beto no lo ve; y Ana tampoco ve el de Beto
    await llamar('sincronizar', { mostrarEnLinea: false }, ana.token);
    lista = await llamar('amigos', {}, beto.token);
    assert.strictEqual(lista.amigos[0].enLinea, null);
    assert.strictEqual(lista.amigos[0].vistoHace, null);
    assert.strictEqual((await llamar('amigos', {}, ana.token)).amigos[0].enLinea, null);
    assert.strictEqual((await llamar('yo', {}, ana.token)).usuario.mostrarEnLinea, false);
    assert.strictEqual((await llamar('yo', {}, ana.token)).usuario.nombre, 'Ana Pro'); // sincronizar sin nombre no lo borra

    // Datos raros no rompen nada
    const raro = await llamar('sincronizar', { stats: { xp: -50, nivel: 'abc', racha: 1e15 }, nombre: 'x' }, beto.token);
    assert.ok(raro.ok);
    await llamar('sincronizar', { mostrarEnLinea: true }, ana.token);
    const betoEnAna = (await llamar('amigos', {}, ana.token)).amigos[0];
    assert.strictEqual(betoEnAna.xp, 0);
    assert.strictEqual(betoEnAna.nivel, 1);
    assert.strictEqual(betoEnAna.racha, 100000);
    assert.strictEqual(betoEnAna.nombre, 'Beto'); // nombre de 1 letra se ignora


    // ---------- Novedades con fotos ----------
    const caro = await llamar('registrar', { correo: 'caro@x.com', clave: 'carocaro1', nombre: 'Caro' });
    const fotosEnDisco = () => fs.readdirSync(path.join(tmp, 'fotos')).filter((f) => f.endsWith('.jpg')).length;
    assert.match((await llamar('publicar', { clave: 'h:a:2026-11-17', tipo: 'inventado' }, ana.token)).error, /Tipo/);
    assert.match((await llamar('publicar', { clave: 'con espacios', tipo: 'habito' }, ana.token)).error, /no válida/);
    assert.match((await llamar('publicar', { clave: 'h:x:1', tipo: 'habito', foto: 'data:image/png;base64,' + Buffer.from('no soy una foto pero soy larga'.repeat(40)).toString('base64') }, ana.token)).error, /JPG/);
    const pub = await llamar('publicar', { clave: 'h:leer:2026-11-17', tipo: 'habito', titulo: 'completó Leer', emoji: '📚', detalle: '🔥 9 días', puntos: 20, foto: FOTO }, ana.token);
    assert.ok(pub.ok, pub.error);
    assert.strictEqual(pub.foto, true);
    assert.strictEqual(fotosEnDisco(), 1);
    await llamar('publicar', { clave: 'r:2026-11-17', tipo: 'reto', titulo: 'completó el reto Haz 20 lagartijas', emoji: '💪', puntos: 200 }, ana.token);

    let nov = await llamar('novedades', {}, beto.token);
    assert.strictEqual(nov.novedades.length, 2);
    const delLeer = nov.novedades.find((n) => n.tipo === 'habito');
    assert.strictEqual(delLeer.usuario.nombre, 'Ana Pro');
    assert.strictEqual(delLeer.yo, false);
    assert.strictEqual(delLeer.foto, true);
    assert.strictEqual(delLeer.titulo, 'completó Leer');
    assert.strictEqual((await llamar('novedades', {}, caro.token)).novedades.length, 0); // Caro no es su amiga

    // La foto: la ve Beto (amigo), no Caro
    const verFoto = (id, token) => fetch(API + '?accion=foto', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Racha-Token': token }, body: JSON.stringify({ id }) });
    const img = await verFoto(pub.id, beto.token);
    assert.strictEqual(img.status, 200);
    assert.strictEqual(img.headers.get('content-type'), 'image/jpeg');
    const bytes = Buffer.from(await img.arrayBuffer());
    assert.ok(bytes[0] === 0xFF && bytes[1] === 0xD8, 'es un JPG');
    assert.strictEqual((await verFoto(pub.id, caro.token)).status, 403);
    assert.strictEqual((await verFoto(999999, beto.token)).status, 404);

    // Actualizar sin foto conserva la foto; con foto nueva se reemplaza el archivo
    assert.strictEqual((await llamar('publicar', { clave: 'h:leer:2026-11-17', tipo: 'habito', titulo: 'completó Leer 📖' }, ana.token)).foto, true);
    await llamar('publicar', { clave: 'h:leer:2026-11-17', tipo: 'habito', titulo: 'completó Leer', foto: FOTO }, ana.token);
    assert.strictEqual(fotosEnDisco(), 1);
    // Borrar la publicación borra la foto
    assert.strictEqual((await llamar('borrarPublicacion', { clave: 'h:leer:2026-11-17' }, ana.token)).borrada, true);
    assert.strictEqual(fotosEnDisco(), 0);
    assert.strictEqual((await llamar('novedades', {}, beto.token)).novedades.length, 1);

    // Las fotos se borran solas a los 7 días
    await llamar('publicar', { clave: 'h:vieja:2026-11-01', tipo: 'habito', titulo: 'completó algo', foto: FOTO }, ana.token);
    execFileSync('php', ['-r', `$db=new PDO('sqlite:${base}'); $db->exec("UPDATE actividad SET creado = creado - 8*86400 WHERE clave = 'h:vieja:2026-11-01'");`]);
    for (let i = 0; i < 60 && fotosEnDisco() > 0; i++) await llamar('novedades', {}, ana.token);
    assert.strictEqual(fotosEnDisco(), 0);

    // ---------- Subir de nivel aparece en Novedades ----------
    await llamar('sincronizar', { stats: { xp: 410, nivel: 5, racha: 9, logros: 8, minutosSemana: 120, medallas: 2 } }, ana.token);
    nov = await llamar('novedades', {}, beto.token);
    assert.ok(nov.novedades.some((n) => n.tipo === 'nivel' && n.titulo === 'subió al nivel 5'));
    assert.strictEqual((await llamar('amigos', {}, beto.token)).amigos[0].medallas, 2);

    // ---------- Liga semanal ----------
    await llamar('sincronizar', { semanas: { '2026-11-16': 120, '2026-11-09': 300, 'no-es-fecha': 5 } }, ana.token);
    await llamar('sincronizar', { semanas: { '2026-11-16': 80 } }, beto.token);
    await llamar('sincronizar', { semanas: { '2026-11-16': 999 } }, caro.token);   // Caro no es amiga: no aparece
    const liga = await llamar('liga', { semana: '2026-11-16', anterior: '2026-11-09' }, beto.token);
    assert.ok(liga.ok, liga.error);
    assert.deepStrictEqual(liga.tabla.map((f) => [f.nombre, f.puntos, f.yo]), [['Ana Pro', 120, false], ['Beto', 80, true]]);
    assert.deepStrictEqual(liga.anterior.tabla.map((f) => [f.nombre, f.puntos]), [['Ana Pro', 300], ['Beto', 0]]);
    await llamar('sincronizar', { semanas: { '2026-11-16': 150 } }, ana.token); // se reemplaza, no se suma
    assert.strictEqual((await llamar('liga', { semana: '2026-11-16' }, ana.token)).tabla[0].puntos, 150);
    assert.match((await llamar('liga', { semana: '2026-13-40' }, ana.token)).error, /Semana/);

    // Inyección SQL en el correo: solo es un correo inválido
    assert.match((await llamar('entrar', { correo: "' OR 1=1 --", clave: 'x' })).error, /incorrectos/);

    // Quitar amigo
    assert.strictEqual((await llamar('quitarAmigo', { id: ana.usuario.id }, beto.token)).amigos, 0);
    assert.strictEqual((await llamar('yo', {}, ana.token)).amigos, 0);

    // Cambiar contraseña: cierra las otras sesiones
    assert.match((await llamar('cambiarClave', { actual: 'mal', nueva: 'nuevaclave1' }, ana.token)).error, /actual no es correcta/);
    assert.ok((await llamar('cambiarClave', { actual: 'secreta123', nueva: 'nuevaclave1' }, ana.token)).ok);
    assert.strictEqual((await llamar('yo', {}, ana2.token))._estado, 401);
    assert.ok((await llamar('yo', {}, ana.token)).ok);
    assert.ok((await llamar('entrar', { correo: 'ana@x.com', clave: 'nuevaclave1' })).ok);

    // Recuperar contraseña por correo
    const pedido = await llamar('pedirCodigo', { correo: 'ana@x.com' });
    assert.ok(pedido.ok);
    const noExiste = await llamar('pedirCodigo', { correo: 'nadie@x.com' });
    assert.strictEqual(noExiste.mensaje, pedido.mensaje); // no revela si el correo existe
    const correo = fs.readFileSync(correos, 'utf8');
    const codigo = correo.match(/^\s+(\d{6})$/m)[1];
    assert.match(correo, /To: ana@x\.com/);
    assert.match((await llamar('restablecer', { correo: 'ana@x.com', codigo: '000000' === codigo ? '111111' : '000000', clave: 'otraclave9' })).error, /no es correcto/);
    const rest = await llamar('restablecer', { correo: 'ana@x.com', codigo, clave: 'otraclave9' });
    assert.ok(rest.ok, rest.error);
    assert.strictEqual((await llamar('yo', {}, ana.token))._estado, 401); // las sesiones viejas se cierran
    assert.match((await llamar('restablecer', { correo: 'ana@x.com', codigo, clave: 'otraclave9' })).error, /venció/); // el código no se reutiliza
    assert.ok((await llamar('entrar', { correo: 'ana@x.com', clave: 'otraclave9' })).ok);

    // Límite de intentos al iniciar sesión
    let ultimo;
    for (let i = 0; i < 9; i++) ultimo = await llamar('entrar', { correo: 'beto@x.com', clave: 'incorrecta' });
    assert.strictEqual(ultimo._estado, 429);
    assert.strictEqual((await llamar('entrar', { correo: 'beto@x.com', clave: 'betobeto1' }))._estado, 429); // ni con la buena, por 15 min

    // Cerrar sesión y eliminar cuenta
    const anaSesion = await llamar('entrar', { correo: 'ana@x.com', clave: 'otraclave9' });
    assert.ok((await llamar('salir', {}, anaSesion.token)).ok);
    assert.strictEqual((await llamar('yo', {}, anaSesion.token))._estado, 401);
    assert.match((await llamar('eliminarCuenta', { clave: 'mala' }, rest.token)).error, /no es correcta/);
    await llamar('publicar', { clave: 'h:ultima:1', tipo: 'habito', titulo: 'x', foto: FOTO }, rest.token);
    assert.strictEqual(fotosEnDisco(), 1);
    assert.ok((await llamar('eliminarCuenta', { clave: 'otraclave9' }, rest.token)).ok);
    assert.strictEqual(fotosEnDisco(), 0); // al borrar la cuenta se borran sus fotos
    assert.match((await llamar('entrar', { correo: 'ana@x.com', clave: 'otraclave9' })).error, /incorrectos/);

    assert.strictEqual((await llamar('inventada'))._estado, 404);
    console.log('✔ Todas las pruebas del servidor pasaron');
  } finally {
    php.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
