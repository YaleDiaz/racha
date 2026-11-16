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
assert.strictEqual(ls.length, 18);
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

console.log('✔ Todas las pruebas de rachas pasaron');
