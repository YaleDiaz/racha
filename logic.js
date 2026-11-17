/*
  logic.js — La "matemática" de las rachas.
  Aquí NO hay nada de pantalla: solo funciones que reciben datos y regresan números.
  Por eso se pueden probar solas con `npm test`.

  Un hábito se ve así:
  {
    id: "h1",
    nombre: "Tomar agua",
    emoji: "💧",
    color: "#1C9CF6",
    dias: [1,2,3,4,5],          // 0 = domingo, 1 = lunes ... 6 = sábado
    creado: "2026-11-16",       // día en que se creó
    hechos: { "2026-11-16": true },  // días en que se completó
    fotos: { "2026-11-16": true }    // días en que además subiste foto (puntos extra)
  }

  "congelados" es un objeto { "2026-11-15": true } con los días que cuidó un escudo:
  esos días no rompen ninguna racha (pero tampoco la suman).
*/
(function (raiz) {
  // Convierte una fecha en texto "AAAA-MM-DD" (hora local del teléfono).
  function clave(fecha) {
    var m = String(fecha.getMonth() + 1).padStart(2, '0');
    var d = String(fecha.getDate()).padStart(2, '0');
    return fecha.getFullYear() + '-' + m + '-' + d;
  }

  // Regresa una fecha nueva sumando (o restando) días.
  function sumarDias(fecha, n) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + n);
  }

  // Convierte "AAAA-MM-DD" de vuelta a fecha.
  function aFecha(texto) {
    var p = texto.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  // Lunes de la semana de esa fecha (las semanas van de lunes a domingo).
  function lunes(fecha) {
    return sumarDias(fecha, -((fecha.getDay() + 6) % 7));
  }

  // ¿Este hábito "toca" ese día? (está programado y ya existía)
  function toca(habito, fecha) {
    return habito.dias.indexOf(fecha.getDay()) !== -1 && clave(fecha) >= habito.creado;
  }

  // Racha actual de un hábito: días programados seguidos que sí se cumplieron.
  // Los días que no tocan no rompen la racha, y el día de hoy tampoco
  // la rompe mientras todavía no lo completes. Los días congelados tampoco.
  function rachaHabito(habito, hoy, congelados) {
    var cong = congelados || {};
    var racha = 0;
    var dia = sumarDias(hoy, 0);
    if (!habito.hechos[clave(dia)]) dia = sumarDias(dia, -1);
    while (clave(dia) >= habito.creado) {
      var k = clave(dia);
      if (habito.hechos[k]) racha++;
      else if (!cong[k] && toca(habito, dia)) break;
      dia = sumarDias(dia, -1);
    }
    return racha;
  }

  // La racha más larga que ha tenido un hábito.
  function mejorRacha(habito, hoy, congelados) {
    var cong = congelados || {};
    var mejor = 0;
    var actual = 0;
    var claveHoy = clave(hoy);
    for (var dia = aFecha(habito.creado); clave(dia) <= claveHoy; dia = sumarDias(dia, 1)) {
      var k = clave(dia);
      if (habito.hechos[k]) {
        actual++;
        if (actual > mejor) mejor = actual;
      } else if (toca(habito, dia) && k !== claveHoy && !cong[k]) {
        actual = 0;
      }
    }
    return mejor;
  }

  // Cuántos hábitos tocaban ese día y cuántos se hicieron.
  function estadoDia(habitos, fecha) {
    var k = clave(fecha);
    var tocan = 0;
    var hechos = 0;
    habitos.forEach(function (h) {
      var hecho = !!h.hechos[k];
      if (hecho) hechos++;
      if (hecho || toca(h, fecha)) tocan++;
    });
    return { tocan: tocan, hechos: hechos, completo: tocan > 0 && hechos === tocan };
  }

  // ¿Ese día se completó al menos un hábito?
  function algoHecho(habitos, fecha) {
    var k = clave(fecha);
    return habitos.some(function (h) { return h.hechos[k]; });
  }

  // Racha general: días seguidos en los que completaste al menos un hábito.
  // Un día congelado (escudo) no la rompe.
  function rachaGeneral(habitos, hoy, congelados) {
    var cong = congelados || {};
    var racha = 0;
    var dia = sumarDias(hoy, 0);
    if (!algoHecho(habitos, dia)) dia = sumarDias(dia, -1);
    for (var i = 0; i < 5000; i++) {
      if (algoHecho(habitos, dia)) racha++;
      else if (!cong[clave(dia)]) break;
      dia = sumarDias(dia, -1);
    }
    return racha;
  }

  // ¿Ese día necesita un escudo? Sí, cuando no hiciste nada y venías con racha.
  function necesitaEscudo(habitos, fecha, congelados) {
    if (algoHecho(habitos, fecha)) return false;
    return rachaGeneral(habitos, sumarDias(fecha, -1), congelados) > 0;
  }

  // Total de veces que se ha completado cualquier hábito.
  function totalHechos(habitos) {
    return habitos.reduce(function (suma, h) { return suma + Object.keys(h.hechos).length; }, 0);
  }

  // Total de fotos subidas en hábitos (solo cuentan si el hábito sigue marcado ese día).
  function totalFotos(habitos) {
    return habitos.reduce(function (suma, h) {
      return suma + Object.keys(h.fotos || {}).filter(function (k) { return h.hechos[k]; }).length;
    }, 0);
  }

  // ---------- Logros, experiencia y nivel ----------

  // Días en los que se cumplieron TODOS los hábitos que tocaban.
  function diasPerfectos(habitos, hoy) {
    if (!habitos.length) return 0;
    var inicio = habitos.reduce(function (m, h) { return h.creado < m ? h.creado : m; }, habitos[0].creado);
    var n = 0;
    var claveHoy = clave(hoy);
    for (var dia = aFecha(inicio); clave(dia) <= claveHoy; dia = sumarDias(dia, 1)) {
      if (estadoDia(habitos, dia).completo) n++;
    }
    return n;
  }

  // Cuánto vale cada cosa en puntos
  var PUNTOS = { habito: 10, foto: 10, entreno: 25, amigo: 25, record: 20 };

  // Experiencia (versión simple): 10 por hábito, 25 por entrenamiento y 25 por amigo.
  function experiencia(habitos, entrenos, amigos) {
    return totalHechos(habitos) * PUNTOS.habito + entrenos.length * PUNTOS.entreno + (amigos || 0) * PUNTOS.amigo;
  }

  // Cada 100 puntos subes un nivel.
  function nivel(xp) {
    return { nivel: Math.floor(xp / 100) + 1, avance: xp % 100, meta: 100 };
  }

  // ---------- Gym: ejercicios y récords ----------
  // Una sesión de gym se ve así:
  // { id, fecha: "2026-11-17", inicio: 1763400000000, minutos: 55, nombre: "Pecho",
  //   ejercicios: [ { nombre: "Press banca", series: [ { peso: 60, reps: 8 } ] } ] }

  // "Press Banca " y "press banca" son el mismo ejercicio
  function claveEjercicio(nombre) {
    return String(nombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  // ¿La serie "a" es mejor marca que "b"? Primero cuenta el peso; con el mismo peso, las repeticiones.
  function superaMarca(a, b) {
    if (!b) return true;
    if (a.peso !== b.peso) return a.peso > b.peso;
    return a.reps > b.reps;
  }

  // La mejor serie de una lista
  function mejorSerie(series) {
    return series.reduce(function (m, s) { return superaMarca(s, m) ? s : m; }, null);
  }

  function sesionesOrdenadas(sesiones) {
    return (sesiones || []).slice().sort(function (a, b) {
      return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.inicio || 0) - (b.inicio || 0);
    });
  }

  // Récords rotos a lo largo del tiempo. La primera vez que haces un ejercicio
  // solo marca la base; récord es cuando superas esa marca (máximo uno por ejercicio por sesión).
  function records(sesiones) {
    var mejores = {};
    var lista = [];
    sesionesOrdenadas(sesiones).forEach(function (s) {
      (s.ejercicios || []).forEach(function (ej) {
        var k = claveEjercicio(ej.nombre);
        var top = mejorSerie(ej.series || []);
        if (!k || !top) return;
        var antes = mejores[k];
        if (antes && superaMarca(top, antes)) {
          lista.push({ ejercicio: k, nombre: ej.nombre, peso: top.peso, reps: top.reps, fecha: s.fecha, sesionId: s.id, antes: { peso: antes.peso, reps: antes.reps } });
        }
        if (!antes || superaMarca(top, antes)) mejores[k] = { nombre: ej.nombre, peso: top.peso, reps: top.reps, fecha: s.fecha };
      });
    });
    return lista;
  }

  // Mejor marca de cada ejercicio: { "press banca": { nombre, peso, reps, fecha } }
  function mejoresMarcas(sesiones) {
    var mejores = {};
    sesionesOrdenadas(sesiones).forEach(function (s) {
      (s.ejercicios || []).forEach(function (ej) {
        var k = claveEjercicio(ej.nombre);
        var top = mejorSerie(ej.series || []);
        if (k && top && superaMarca(top, mejores[k])) mejores[k] = { nombre: ej.nombre, peso: top.peso, reps: top.reps, fecha: s.fecha };
      });
    });
    return mejores;
  }

  // Historial de un ejercicio, del más nuevo al más viejo
  function historialEjercicio(sesiones, nombre) {
    var k = claveEjercicio(nombre);
    var lista = [];
    sesionesOrdenadas(sesiones).forEach(function (s) {
      (s.ejercicios || []).forEach(function (ej) {
        if (claveEjercicio(ej.nombre) === k && ej.series && ej.series.length) {
          lista.push({ fecha: s.fecha, sesion: s.nombre, series: ej.series, mejor: mejorSerie(ej.series) });
        }
      });
    });
    return lista.reverse();
  }

  // ---------- Puntos por fechas (meta diaria y liga semanal) ----------
  // Puntos ganados entre dos días (incluidos). Sin "desde" ni "hasta" = todos.
  // No incluye los 25 de cada amigo porque esos no tienen fecha.
  function puntosDe(estado, desde, hasta) {
    function dentro(k) { return (!desde || k >= desde) && (!hasta || k <= hasta); }
    var total = 0;
    (estado.habitos || []).forEach(function (h) {
      Object.keys(h.hechos).forEach(function (k) {
        if (!dentro(k)) return;
        total += PUNTOS.habito;
        if (h.fotos && h.fotos[k]) total += PUNTOS.foto;
      });
    });
    (estado.entrenos || []).forEach(function (e) { if (dentro(e.fecha)) total += PUNTOS.entreno; });
    (estado.retos || []).forEach(function (r) { if (dentro(r.fecha)) total += r.puntos || 0; });
    records(estado.sesiones).forEach(function (r) { if (dentro(r.fecha)) total += PUNTOS.record; });
    return total;
  }

  // Todos tus puntos (con los de tus amigos)
  function xpTotal(estado, amigos) {
    return puntosDe(estado) + (amigos || 0) * PUNTOS.amigo;
  }

  // ---------- Retos sorpresa ----------
  // Salen algunos días a una hora "al azar". Todos los amigos reciben el mismo reto el mismo día.
  var RETOS = [
    { id: 'lagartijas20', emoji: '💪', texto: 'Haz 20 lagartijas', puntos: 200 },
    { id: 'sentadillas30', emoji: '🦵', texto: 'Haz 30 sentadillas', puntos: 150 },
    { id: 'plancha60', emoji: '🧱', texto: 'Aguanta 1 minuto en plancha', puntos: 150 },
    { id: 'abdominales25', emoji: '🔥', texto: 'Haz 25 abdominales', puntos: 150 },
    { id: 'burpees10', emoji: '⚡', texto: 'Haz 10 burpees', puntos: 200 },
    { id: 'tijeras50', emoji: '🦘', texto: 'Haz 50 saltos de tijera', puntos: 150 },
    { id: 'zancadas20', emoji: '🚶', texto: 'Haz 20 zancadas', puntos: 150 },
    { id: 'pared45', emoji: '🧍', texto: 'Sentadilla en la pared 45 segundos', puntos: 150 },
    { id: 'diamante10', emoji: '💎', texto: 'Haz 10 lagartijas diamante', puntos: 200 },
    { id: 'caminar15', emoji: '👟', texto: 'Sal a caminar 15 minutos', puntos: 150 },
    { id: 'escaleras', emoji: '🏢', texto: 'Sube 3 pisos por las escaleras', puntos: 100 },
    { id: 'estirar5', emoji: '🧘', texto: 'Estírate 5 minutos', puntos: 100 },
    { id: 'agua2', emoji: '💧', texto: 'Tómate 2 vasos de agua', puntos: 100 },
    { id: 'fruta', emoji: '🍎', texto: 'Cómete una fruta', puntos: 100 },
    { id: 'verde', emoji: '🥗', texto: 'Come algo verde hoy', puntos: 100 },
    { id: 'leer10', emoji: '📚', texto: 'Lee 10 páginas de un libro', puntos: 150 },
    { id: 'cama', emoji: '🛏️', texto: 'Tiende tu cama', puntos: 100 },
    { id: 'ordenar', emoji: '🧹', texto: 'Ordena tu escritorio o tu cuarto', puntos: 100 },
    { id: 'sol10', emoji: '☀️', texto: 'Toma 10 minutos de sol', puntos: 100 },
    { id: 'series3', emoji: '🏋️', texto: 'Haz 3 series de tu ejercicio favorito', puntos: 200 }
  ];

  // Número "al azar" pero siempre el mismo para el mismo texto (así no se guarda nada)
  function numeroFijo(texto) {
    var h = 2166136261;
    for (var i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Reto de ese día, o null si ese día no hay. Hay reto unos 4 días de cada 7,
  // y aparece entre las 10:00 y las 19:45.
  function retoDelDia(fecha) {
    var k = clave(fecha);
    var n = numeroFijo('racha-reto-' + k);
    if (n % 100 >= 58) return null;
    var reto = RETOS[Math.floor(n / 100) % RETOS.length];
    var hora = 10 + (Math.floor(n / 7) % 10);
    var minuto = (Math.floor(n / 131) % 4) * 15;
    return {
      id: reto.id, emoji: reto.emoji, texto: reto.texto, puntos: reto.puntos, fecha: k,
      hora: String(hora).padStart(2, '0') + ':' + String(minuto).padStart(2, '0')
    };
  }

  // ---------- Logros ----------
  // Lista de logros. Para agregar uno nuevo, copia una línea y cambia sus datos.
  // "mide" dice qué número se compara contra la meta.
  // Un entrenamiento se ve así: { id, deporte: "gym", minutos: 60, fecha: "2026-11-16" }
  var LOGROS = [
    { id: 'racha3', emoji: '✨', titulo: 'Chispa', desc: 'Racha de 3 días en un hábito', mide: 'racha', meta: 3 },
    { id: 'racha7', emoji: '🔥', titulo: 'Semana de fuego', desc: 'Racha de 7 días en un hábito', mide: 'racha', meta: 7 },
    { id: 'racha30', emoji: '🚀', titulo: 'Imparable', desc: 'Racha de 30 días en un hábito', mide: 'racha', meta: 30 },
    { id: 'racha100', emoji: '👑', titulo: 'Leyenda', desc: 'Racha de 100 días en un hábito', mide: 'racha', meta: 100 },
    { id: 'hechos10', emoji: '✅', titulo: 'Primeros pasos', desc: 'Completa 10 hábitos', mide: 'hechos', meta: 10 },
    { id: 'hechos50', emoji: '⭐', titulo: 'Constante', desc: 'Completa 50 hábitos', mide: 'hechos', meta: 50 },
    { id: 'hechos200', emoji: '💎', titulo: 'Disciplina de acero', desc: 'Completa 200 hábitos', mide: 'hechos', meta: 200 },
    { id: 'perfecto1', emoji: '🎯', titulo: 'Día perfecto', desc: 'Cumple todos tus hábitos en un día', mide: 'perfectos', meta: 1 },
    { id: 'perfecto7', emoji: '🏅', titulo: 'Siete perfectos', desc: 'Logra 7 días perfectos', mide: 'perfectos', meta: 7 },
    { id: 'perfecto30', emoji: '🏆', titulo: 'Mes de campeón', desc: 'Logra 30 días perfectos', mide: 'perfectos', meta: 30 },
    { id: 'gym1', emoji: '🏋️', titulo: 'Primer día de gym', desc: 'Registra tu primera sesión de gym', mide: 'gym', meta: 1 },
    { id: 'gym10', emoji: '💪', titulo: 'Rata de gym', desc: 'Registra 10 sesiones de gym', mide: 'gym', meta: 10 },
    { id: 'gym50', emoji: '🦍', titulo: 'Bestia', desc: 'Registra 50 sesiones de gym', mide: 'gym', meta: 50 },
    { id: 'multi3', emoji: '🤸', titulo: 'Multideporte', desc: 'Practica 3 deportes distintos', mide: 'deportes', meta: 3 },
    { id: 'min300', emoji: '⏱️', titulo: '5 horas de sudor', desc: 'Acumula 300 minutos de entrenamiento', mide: 'minutos', meta: 300 },
    { id: 'min1500', emoji: '🥇', titulo: '25 horas de sudor', desc: 'Acumula 1500 minutos de entrenamiento', mide: 'minutos', meta: 1500 },
    { id: 'amigo1', emoji: '🤝', titulo: 'Buena compañía', desc: 'Agrega a tu primer amigo', mide: 'amigos', meta: 1 },
    { id: 'amigo5', emoji: '🎉', titulo: 'La banda', desc: 'Ten 5 amigos en Racha', mide: 'amigos', meta: 5 },
    { id: 'foto1', emoji: '📸', titulo: 'Prueba de fuego', desc: 'Sube tu primera foto de un hábito', mide: 'fotos', meta: 1 },
    { id: 'foto30', emoji: '🎞️', titulo: 'Con pruebas', desc: 'Sube 30 fotos de tus hábitos', mide: 'fotos', meta: 30 },
    { id: 'reto1', emoji: '⚡', titulo: 'Retador', desc: 'Completa tu primer reto sorpresa', mide: 'retos', meta: 1 },
    { id: 'reto10', emoji: '🎖️', titulo: 'Cazador de retos', desc: 'Completa 10 retos sorpresa', mide: 'retos', meta: 10 },
    { id: 'record1', emoji: '🏆', titulo: 'Nuevo récord', desc: 'Supera tu mejor marca en un ejercicio', mide: 'records', meta: 1 },
    { id: 'record10', emoji: '📈', titulo: 'Cada vez más fuerte', desc: 'Rompe 10 récords personales', mide: 'records', meta: 10 },
    { id: 'liga1', emoji: '🥇', titulo: 'Campeón de la semana', desc: 'Gana la liga semanal entre amigos', mide: 'medallas', meta: 1 },
    { id: 'liga5', emoji: '🏟️', titulo: 'Dinastía', desc: 'Gana 5 ligas semanales', mide: 'medallas', meta: 5 }
  ];

  // Regresa cada logro con su avance: { ...logro, valor, logrado }
  // extra (opcional): { congelados, retos, records, medallas }
  function logros(habitos, entrenos, hoy, amigos, extra) {
    var x = extra || {};
    var deportes = {};
    entrenos.forEach(function (e) { deportes[e.deporte] = true; });
    var numeros = {
      racha: habitos.reduce(function (m, h) { return Math.max(m, mejorRacha(h, hoy, x.congelados)); }, 0),
      hechos: totalHechos(habitos),
      perfectos: diasPerfectos(habitos, hoy),
      gym: entrenos.filter(function (e) { return e.deporte === 'gym'; }).length,
      deportes: Object.keys(deportes).length,
      minutos: entrenos.reduce(function (s, e) { return s + e.minutos; }, 0),
      amigos: amigos || 0,
      fotos: totalFotos(habitos),
      retos: x.retos || 0,
      records: x.records || 0,
      medallas: x.medallas || 0
    };
    return LOGROS.map(function (l) {
      var valor = Math.min(numeros[l.mide], l.meta);
      return { id: l.id, emoji: l.emoji, titulo: l.titulo, desc: l.desc, meta: l.meta, valor: valor, logrado: valor >= l.meta };
    });
  }

  var Logica = {
    PUNTOS: PUNTOS,
    RETOS: RETOS,
    diasPerfectos: diasPerfectos,
    experiencia: experiencia,
    nivel: nivel,
    logros: logros,
    clave: clave,
    sumarDias: sumarDias,
    aFecha: aFecha,
    lunes: lunes,
    toca: toca,
    rachaHabito: rachaHabito,
    mejorRacha: mejorRacha,
    estadoDia: estadoDia,
    algoHecho: algoHecho,
    rachaGeneral: rachaGeneral,
    necesitaEscudo: necesitaEscudo,
    totalHechos: totalHechos,
    totalFotos: totalFotos,
    claveEjercicio: claveEjercicio,
    superaMarca: superaMarca,
    mejorSerie: mejorSerie,
    records: records,
    mejoresMarcas: mejoresMarcas,
    historialEjercicio: historialEjercicio,
    puntosDe: puntosDe,
    xpTotal: xpTotal,
    retoDelDia: retoDelDia
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logica;
  else raiz.Logica = Logica;
})(this);
