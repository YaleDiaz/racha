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

  var Logica = {
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
