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
    hechos: { "2026-11-16": true }   // días en que se completó
  }
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

  // ¿Este hábito "toca" ese día? (está programado y ya existía)
  function toca(habito, fecha) {
    return habito.dias.indexOf(fecha.getDay()) !== -1 && clave(fecha) >= habito.creado;
  }

  // Racha actual de un hábito: días programados seguidos que sí se cumplieron.
  // Los días que no tocan no rompen la racha, y el día de hoy tampoco
  // la rompe mientras todavía no lo completes.
  function rachaHabito(habito, hoy) {
    var racha = 0;
    var dia = sumarDias(hoy, 0);
    if (!habito.hechos[clave(dia)]) dia = sumarDias(dia, -1);
    while (clave(dia) >= habito.creado) {
      if (habito.hechos[clave(dia)]) racha++;
      else if (toca(habito, dia)) break;
      dia = sumarDias(dia, -1);
    }
    return racha;
  }

  // La racha más larga que ha tenido un hábito.
  function mejorRacha(habito, hoy) {
    var mejor = 0;
    var actual = 0;
    var claveHoy = clave(hoy);
    for (var dia = aFecha(habito.creado); clave(dia) <= claveHoy; dia = sumarDias(dia, 1)) {
      var k = clave(dia);
      if (habito.hechos[k]) {
        actual++;
        if (actual > mejor) mejor = actual;
      } else if (toca(habito, dia) && k !== claveHoy) {
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

  // Racha general: días seguidos en los que completaste al menos un hábito.
  function rachaGeneral(habitos, hoy) {
    function algo(fecha) {
      var k = clave(fecha);
      return habitos.some(function (h) { return h.hechos[k]; });
    }
    var racha = 0;
    var dia = sumarDias(hoy, 0);
    if (!algo(dia)) dia = sumarDias(dia, -1);
    while (algo(dia)) {
      racha++;
      dia = sumarDias(dia, -1);
    }
    return racha;
  }

  // Total de veces que se ha completado cualquier hábito.
  function totalHechos(habitos) {
    return habitos.reduce(function (suma, h) { return suma + Object.keys(h.hechos).length; }, 0);
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

  // Experiencia: 10 puntos por hábito cumplido, 25 por entrenamiento y 25 por cada amigo.
  function experiencia(habitos, entrenos, amigos) {
    return totalHechos(habitos) * 10 + entrenos.length * 25 + (amigos || 0) * 25;
  }

  // Cada 100 puntos subes un nivel.
  function nivel(xp) {
    return { nivel: Math.floor(xp / 100) + 1, avance: xp % 100, meta: 100 };
  }

  // Un entrenamiento se ve así: { id, deporte: "gym", minutos: 60, fecha: "2026-11-16" }
  // Lista de logros. Para agregar uno nuevo, copia una línea y cambia sus datos.
  // "mide" dice qué número se compara contra la meta.
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
    { id: 'amigo5', emoji: '🎉', titulo: 'La banda', desc: 'Ten 5 amigos en Racha', mide: 'amigos', meta: 5 }
  ];

  // Regresa cada logro con su avance: { ...logro, valor, logrado }
  function logros(habitos, entrenos, hoy, amigos) {
    var deportes = {};
    entrenos.forEach(function (e) { deportes[e.deporte] = true; });
    var numeros = {
      racha: habitos.reduce(function (m, h) { return Math.max(m, mejorRacha(h, hoy)); }, 0),
      hechos: totalHechos(habitos),
      perfectos: diasPerfectos(habitos, hoy),
      gym: entrenos.filter(function (e) { return e.deporte === 'gym'; }).length,
      deportes: Object.keys(deportes).length,
      minutos: entrenos.reduce(function (s, e) { return s + e.minutos; }, 0),
      amigos: amigos || 0
    };
    return LOGROS.map(function (l) {
      var valor = Math.min(numeros[l.mide], l.meta);
      return { id: l.id, emoji: l.emoji, titulo: l.titulo, desc: l.desc, meta: l.meta, valor: valor, logrado: valor >= l.meta };
    });
  }

  var Logica = {
    diasPerfectos: diasPerfectos,
    experiencia: experiencia,
    nivel: nivel,
    logros: logros,
    clave: clave,
    sumarDias: sumarDias,
    aFecha: aFecha,
    toca: toca,
    rachaHabito: rachaHabito,
    mejorRacha: mejorRacha,
    estadoDia: estadoDia,
    rachaGeneral: rachaGeneral,
    totalHechos: totalHechos
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Logica;
  else raiz.Logica = Logica;
})(this);
