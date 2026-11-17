// Pruebas de las rachas. Se corren con:  npm test
const assert = require('node:assert');
const L = require('../www/logic.js');

const d = (texto) => L.aFecha(texto);
const TODOS = [0, 1, 2, 3, 4, 5, 6];
const habito = (creado, dias, hechos) => ({
  id: 'x', nombre: 'x', emoji: 'x', color: '#000', dias, creado,
  hechos: Object.fromEntries(hechos.map((k) => [k, true]))
});

// 2026-11-16 es lunes
assert.strictEqual(d('2026-11-16').getDay(), 1);
assert.strictEqual(L.clave(d('2026-03-05')), '2026-03-05');

// Racha simple: 3 días seguidos incluyendo hoy
let h = habito('2026-11-01', TODOS, ['2026-11-14', '2026-11-15', '2026-11-16']);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 3);

// Hoy todavía sin hacer NO rompe la racha
h = habito('2026-11-01', TODOS, ['2026-11-14', '2026-11-15']);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 2);

// Fallar ayer SÍ la rompe
h = habito('2026-11-01', TODOS, ['2026-11-13', '2026-11-14']);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 0);
h.hechos['2026-11-16'] = true;
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 1);

// Hábito de lunes a viernes: el fin de semana no rompe
h = habito('2026-11-01', [1, 2, 3, 4, 5], ['2026-11-12', '2026-11-13', '2026-11-16']);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 3);

// La racha no cuenta antes de que existiera el hábito
h = habito('2026-11-15', TODOS, ['2026-11-15', '2026-11-16']);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 2);

// Hábito nuevo sin nada hecho
h = habito('2026-11-16', TODOS, []);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 0);
assert.strictEqual(L.mejorRacha(h, d('2026-11-16')), 0);

// Mejor racha: 4 seguidos, falla, luego 2
h = habito('2026-11-01', TODOS, ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-15', '2026-11-16']);
assert.strictEqual(L.mejorRacha(h, d('2026-11-16')), 4);
assert.strictEqual(L.rachaHabito(h, d('2026-11-16')), 2);

// Cambio de mes y de año
h = habito('2026-12-01', TODOS, ['2026-12-30', '2026-12-31', '2027-01-01']);
assert.strictEqual(L.rachaHabito(h, d('2027-01-01')), 3);

// Estado del día
const a = habito('2026-11-01', TODOS, ['2026-11-16']);
const b = habito('2026-11-01', [2], []); // solo martes
const c = habito('2026-11-01', TODOS, []);
assert.deepStrictEqual(L.estadoDia([a, b], d('2026-11-16')), { tocan: 1, hechos: 1, completo: true });
assert.deepStrictEqual(L.estadoDia([a, b, c], d('2026-11-16')), { tocan: 2, hechos: 1, completo: false });
assert.deepStrictEqual(L.estadoDia([], d('2026-11-16')), { tocan: 0, hechos: 0, completo: false });

// Racha general: al menos un hábito por día
const g1 = habito('2026-11-01', TODOS, ['2026-11-14', '2026-11-16']);
const g2 = habito('2026-11-01', TODOS, ['2026-11-15']);
assert.strictEqual(L.rachaGeneral([g1, g2], d('2026-11-16')), 3);
assert.strictEqual(L.rachaGeneral([g1, g2], d('2026-11-17')), 3); // hoy pendiente
assert.strictEqual(L.rachaGeneral([g1, g2], d('2026-11-18')), 0); // un día completo sin nada
assert.strictEqual(L.rachaGeneral([], d('2026-11-16')), 0);
assert.strictEqual(L.totalHechos([g1, g2]), 3);

// ---------- Logros, experiencia y nivel ----------
const e = (deporte, minutos) => ({ id: 'e', deporte, minutos, fecha: '2026-11-16' });
const logro = (lista, id) => lista.find((l) => l.id === id);

// Días perfectos: a y c tocan diario; solo cuenta cuando ambos se hicieron
const p1 = habito('2026-11-14', TODOS, ['2026-11-14', '2026-11-15', '2026-11-16']);
const p2 = habito('2026-11-14', TODOS, ['2026-11-14', '2026-11-16']);
assert.strictEqual(L.diasPerfectos([p1, p2], d('2026-11-16')), 2);
assert.strictEqual(L.diasPerfectos([], d('2026-11-16')), 0);

// Experiencia y nivel
assert.strictEqual(L.experiencia([p1, p2], [e('gym', 60)]), 5 * 10 + 25);
assert.strictEqual(L.experiencia([p1, p2], [e('gym', 60)], 3), 5 * 10 + 25 + 3 * 25); // 25 por amigo
assert.deepStrictEqual(L.nivel(0), { nivel: 1, avance: 0, meta: 100 });
assert.deepStrictEqual(L.nivel(275), { nivel: 3, avance: 75, meta: 100 });

// Logros
let ls = L.logros([], [], d('2026-11-16'));
assert.strictEqual(ls.length, 26);
assert.ok(ls.every((l) => !l.logrado && l.valor === 0));

ls = L.logros([p1, p2], [e('gym', 200), e('correr', 60), e('futbol', 40)], d('2026-11-16'));
assert.ok(logro(ls, 'racha3').logrado);          // p1 lleva 3 seguidos
assert.ok(!logro(ls, 'racha7').logrado);
assert.strictEqual(logro(ls, 'racha7').valor, 3);
assert.ok(logro(ls, 'perfecto1').logrado);
assert.ok(logro(ls, 'gym1').logrado);
assert.ok(!logro(ls, 'gym10').logrado);
assert.ok(logro(ls, 'multi3').logrado);          // 3 deportes distintos
assert.ok(logro(ls, 'min300').logrado);          // 300 minutos exactos
assert.strictEqual(logro(ls, 'hechos10').valor, 5);
assert.strictEqual(logro(ls, 'min300').valor, 300); // el valor nunca pasa de la meta
assert.ok(!logro(ls, 'amigo1').logrado);
ls = L.logros([], [], d('2026-11-16'), 2);
assert.ok(logro(ls, 'amigo1').logrado);
assert.strictEqual(logro(ls, 'amigo5').valor, 2);


// ---------- Escudos (días congelados) ----------
// Racha del 10 al 14, el 15 no hizo nada, el 16 sí: sin escudo la racha es 1, con escudo 6
const f1 = habito('2026-11-01', TODOS, ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-16']);
assert.strictEqual(L.rachaHabito(f1, d('2026-11-16')), 1);
assert.strictEqual(L.rachaHabito(f1, d('2026-11-16'), { '2026-11-15': true }), 6);
assert.strictEqual(L.rachaGeneral([f1], d('2026-11-16')), 1);
assert.strictEqual(L.rachaGeneral([f1], d('2026-11-16'), { '2026-11-15': true }), 6);
assert.strictEqual(L.mejorRacha(f1, d('2026-11-16'), { '2026-11-15': true }), 6);
// Hoy pendiente y ayer congelado: la racha sigue viva
assert.strictEqual(L.rachaGeneral([habito('2026-11-01', TODOS, ['2026-11-14'])], d('2026-11-16'), { '2026-11-15': true }), 1);
// ¿Necesita escudo? Solo si ese día no hiciste nada y venías con racha
assert.strictEqual(L.necesitaEscudo([f1], d('2026-11-15')), true);
assert.strictEqual(L.necesitaEscudo([f1], d('2026-11-14')), false);           // ese día sí hizo algo
assert.strictEqual(L.necesitaEscudo([f1], d('2026-11-09')), false);           // no venía con racha
assert.strictEqual(L.necesitaEscudo([f1], d('2026-11-17'), { '2026-11-15': true }), true);

// ---------- Puntos por fechas ----------
const conFoto = habito('2026-11-01', TODOS, ['2026-11-16', '2026-11-17']);
conFoto.fotos = { '2026-11-16': true, '2026-11-10': true }; // la del 10 no cuenta: ese día no está marcado
assert.strictEqual(L.totalFotos([conFoto]), 1);
const est = {
  habitos: [conFoto],
  entrenos: [{ id: 'e1', deporte: 'gym', minutos: 50, fecha: '2026-11-16' }],
  retos: [{ id: 'lagartijas20', fecha: '2026-11-17', puntos: 200 }],
  sesiones: []
};
assert.strictEqual(L.puntosDe(est, '2026-11-16', '2026-11-16'), 10 + 10 + 25);
assert.strictEqual(L.puntosDe(est, '2026-11-17', '2026-11-17'), 10 + 200);
assert.strictEqual(L.puntosDe(est), 10 + 10 + 25 + 10 + 200);
assert.strictEqual(L.xpTotal(est, 2), 255 + 50);
assert.strictEqual(L.clave(L.lunes(d('2026-11-22'))), '2026-11-16'); // domingo → su lunes
assert.strictEqual(L.clave(L.lunes(d('2026-11-16'))), '2026-11-16');

// ---------- Récords del gym ----------
const ses = (id, fecha, ejercicios) => ({ id, fecha, inicio: 0, minutos: 50, nombre: 'Pecho', ejercicios });
const s1 = ses('s1', '2026-11-10', [{ nombre: 'Press banca', series: [{ peso: 50, reps: 10 }, { peso: 55, reps: 6 }] }]);
const s2 = ses('s2', '2026-11-12', [{ nombre: 'press  BANCA', series: [{ peso: 55, reps: 8 }] }, { nombre: 'Dominadas', series: [{ peso: 0, reps: 8 }] }]);
const s3 = ses('s3', '2026-11-14', [{ nombre: 'Press banca', series: [{ peso: 52, reps: 12 }] }, { nombre: 'Dominadas', series: [{ peso: 0, reps: 10 }] }]);
const rs = L.records([s3, s1, s2]); // el orden de entrada no importa
assert.strictEqual(rs.length, 2);
assert.deepStrictEqual(rs.map((r) => [r.ejercicio, r.peso, r.reps, r.fecha]), [['press banca', 55, 8, '2026-11-12'], ['dominadas', 0, 10, '2026-11-14']]);
assert.deepStrictEqual(L.mejoresMarcas([s1, s2, s3])['press banca'].peso, 55);
assert.strictEqual(L.mejoresMarcas([s1, s2, s3])['press banca'].reps, 8);
assert.strictEqual(L.historialEjercicio([s1, s2, s3], 'Press Banca').length, 3);
assert.strictEqual(L.historialEjercicio([s1, s2, s3], 'press banca')[0].fecha, '2026-11-14'); // el más nuevo primero
assert.strictEqual(L.puntosDe({ habitos: [], entrenos: [], sesiones: [s1, s2, s3] }), 2 * 20);
assert.ok(L.superaMarca({ peso: 60, reps: 1 }, { peso: 55, reps: 12 }));
assert.ok(!L.superaMarca({ peso: 55, reps: 8 }, { peso: 55, reps: 8 }));

// ---------- Retos sorpresa ----------
let dias = 0, conReto = 0;
for (let i = 0; i < 70; i++) {
  const r = L.retoDelDia(L.sumarDias(d('2026-11-16'), i));
  dias++;
  if (!r) continue;
  conReto++;
  assert.match(r.hora, /^(1\d):(00|15|30|45)$/);
  assert.ok(r.puntos >= 100 && r.puntos <= 200);
  assert.ok(L.RETOS.some((x) => x.id === r.id));
}
assert.ok(conReto > 25 && conReto < 55, 'unos 4 de cada 7 días tienen reto: ' + conReto);
assert.deepStrictEqual(L.retoDelDia(d('2026-11-20')), L.retoDelDia(d('2026-11-20'))); // siempre el mismo
assert.strictEqual(new Set(L.RETOS.map((r) => r.id)).size, L.RETOS.length);

// Logros nuevos
ls = L.logros([conFoto], [], d('2026-11-17'), 0, { retos: 1, records: 2, medallas: 1 });
assert.ok(logro(ls, 'foto1').logrado);
assert.ok(logro(ls, 'reto1').logrado);
assert.ok(logro(ls, 'record1').logrado && !logro(ls, 'record10').logrado);
assert.ok(logro(ls, 'liga1').logrado);
assert.strictEqual(new Set(ls.map((l) => l.id)).size, ls.length); // ids sin repetir

console.log('✔ Todas las pruebas de rachas pasaron');
