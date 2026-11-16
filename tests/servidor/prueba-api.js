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

    // Revisión con GET
    const salud = await (await fetch(API)).json();
    assert.strictEqual(salud.tablas, 6);

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
    assert.ok((await llamar('eliminarCuenta', { clave: 'otraclave9' }, rest.token)).ok);
    assert.match((await llamar('entrar', { correo: 'ana@x.com', clave: 'otraclave9' })).error, /incorrectos/);

    assert.strictEqual((await llamar('inventada'))._estado, 404);
    console.log('✔ Todas las pruebas del servidor pasaron');
  } finally {
    php.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
