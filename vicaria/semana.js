/* Núcleo de las transmisiones de la semana (etapa 3b): arma la semana con las fijas, las series y los
   días tocados, lista los campos de cada tipo, cuenta «Faltan N datos» y arma lo que «Usar esta» le
   pasa al panel.

   JS plano, para tres lugares (plan 3b, Decisión 1): sin import, sin DOM y sin PARROQUIA.
   - La plataforma lo copia como lib/generado/semana.mjs (herramientas/copiar-vicaria.mjs cambia la
     última línea por `export default SEMANA;`).
   - La app usa una copia byte a byte, app/src/generado/semana.js, que se actualiza con
     `npm --prefix app run copiar-vicaria`.
   - Las páginas de vicaria/ NO lo cargan: el panel tiene su propio faltas(), y una prueba de
     navegador comprueba que cuentan lo mismo.

   Los nombres de nivel superior llevan el prefijo _sem para no chocar con los de las páginas; lo
   público vive solo dentro de SEMANA. Las fechas son 'AAAA-MM-DD' con aritmética en UTC: no dependen
   de la zona del aparato. */

const _SEM_DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const _SEM_DIAS_PLURAL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
const _SEM_HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const _SEM_TIPO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function _semObjeto(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function _semFechaUTC(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function _semDeUTC(ms) {
  const d = new Date(ms);
  const dos = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + dos(d.getUTCMonth() + 1) + '-' + dos(d.getUTCDate());
}

function _semEsFecha(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return _semDeUTC(_semFechaUTC(s)) === s;
}

function _semSumarDias(fecha, n) {
  return _semDeUTC(_semFechaUTC(fecha) + n * 86400000);
}

function _semDiaSemana(fecha) {
  const d = new Date(_semFechaUTC(fecha)).getUTCDay();
  return d === 0 ? 7 : d;
}

function _semLunesDe(fecha) {
  return _semSumarDias(fecha, 1 - _semDiaSemana(fecha));
}

function _semDiasEntre(desde, hasta) {
  return Math.round((_semFechaUTC(hasta) - _semFechaUTC(desde)) / 86400000);
}

function _semTexto(x) {
  return typeof x === 'string' && x.length > 0;
}

function _semItem(base) {
  return Object.assign({
    fijaId: null, serieId: null, serie: null, diaSemanaFija: null,
    id: null, saltada: false, editada: false, actualizadoEn: null, actualizadoDesde: null
  }, base);
}

function _semFilaValida(t) {
  return _semObjeto(t) && _semTexto(t.clave) && _semEsFecha(t.fecha) && typeof t.hora === 'string' &&
    _SEM_HORA.test(t.hora) && _semTexto(t.tipo) && _semObjeto(t.datos) &&
    (t.origen === 'fija' || t.origen === 'serie' || t.origen === 'unica');
}

function _semArmarSemana(e) {
  if (!_semObjeto(e) || !_semEsFecha(e.lunes)) return [];
  const lunes = e.lunes;
  const domingo = _semSumarDias(lunes, 6);
  const lista = (x) => (Array.isArray(x) ? x : []);
  const generados = new Map();

  for (const f of lista(e.fijas)) {
    if (!_semObjeto(f) || f.activa !== true || !_semTexto(f.id)) continue;
    if (!Number.isInteger(f.dia_semana) || f.dia_semana < 1 || f.dia_semana > 7) continue;
    if (typeof f.hora !== 'string' || !_SEM_HORA.test(f.hora) || !_semTexto(f.tipo)) continue;
    const fecha = _semSumarDias(lunes, f.dia_semana - 1);
    const clave = 'fija:' + f.id + ':' + fecha;
    generados.set(clave, _semItem({
      clave, fecha, hora: f.hora, tipo: f.tipo, datos: _semObjeto(f.datos) ? Object.assign({}, f.datos) : {},
      origen: 'fija', fijaId: f.id, diaSemanaFija: f.dia_semana
    }));
  }

  for (const s of lista(e.series)) {
    if (!_semObjeto(s) || !_semTexto(s.id) || !_semEsFecha(s.inicio) || !_semTexto(s.nombre)) continue;
    if (!Number.isInteger(s.dias) || s.dias < 1 || s.dias > 60) continue;
    if (typeof s.hora !== 'string' || !_SEM_HORA.test(s.hora) || !_semTexto(s.tipo)) continue;
    const desde = Math.max(0, _semDiasEntre(s.inicio, lunes));
    const hasta = Math.min(s.dias - 1, _semDiasEntre(s.inicio, domingo));
    for (let i = desde; i <= hasta; i++) {
      const fecha = _semSumarDias(s.inicio, i);
      const clave = 'serie:' + s.id + ':' + fecha;
      const datos = Object.assign({}, _semObjeto(s.datos) ? s.datos : {}, { dia: i + 1 });
      generados.set(clave, _semItem({
        clave, fecha, hora: s.hora, tipo: s.tipo, datos, origen: 'serie', serieId: s.id,
        serie: { nombre: s.nombre, dias: s.dias, dia: i + 1 }
      }));
    }
  }

  const items = new Map(generados);
  for (const t of lista(e.transmisiones)) {
    if (!_semFilaValida(t) || t.fecha < lunes || t.fecha > domingo) continue;
    const meta = {
      id: _semTexto(t.id) ? t.id : null,
      actualizadoEn: _semTexto(t.actualizado_en) ? t.actualizado_en : null,
      actualizadoDesde: t.actualizado_desde === 'app' || t.actualizado_desde === 'web' ? t.actualizado_desde : null
    };
    const desdeFila = () => ({
      clave: t.clave, fecha: t.fecha, hora: t.hora, tipo: t.tipo, datos: Object.assign({}, t.datos),
      origen: t.origen, fijaId: _semTexto(t.fija_id) ? t.fija_id : null, serieId: _semTexto(t.serie_id) ? t.serie_id : null
    });
    const g = generados.get(t.clave);
    if (g) {
      if (t.saltada === true) {
        items.set(t.clave, Object.assign({}, g, meta, { saltada: true }));
      } else if (t.editada === true) {
        const propio = desdeFila();
        if (g.origen === 'serie' && !Number.isInteger(propio.datos.dia)) propio.datos.dia = g.serie.dia;
        items.set(t.clave, Object.assign({}, g, propio, meta, { editada: true, fijaId: g.fijaId, serieId: g.serieId }));
      }
    } else if (t.saltada !== true && (t.origen === 'unica' || t.editada === true)) {
      items.set(t.clave, _semItem(Object.assign(desdeFila(), meta, { editada: t.editada === true })));
    }
  }

  return Array.from(items.values()).sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 :
    a.hora < b.hora ? -1 : a.hora > b.hora ? 1 :
    a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0);
}

function _semTextoDia(fecha) {
  return _SEM_DIAS_CORTOS[_semDiaSemana(fecha) - 1] + ' ' + Number(fecha.slice(8, 10));
}

function _semTextoOrigen(item) {
  if (!_semObjeto(item)) return '';
  if (item.origen === 'fija' && Number.isInteger(item.diaSemanaFija)) {
    return 'Fija (todos los ' + _SEM_DIAS_PLURAL[item.diaSemanaFija - 1] + ')';
  }
  if (item.origen === 'serie' && _semObjeto(item.serie)) {
    return 'Parte de "' + item.serie.nombre + '" (' + item.serie.dias + (item.serie.dias === 1 ? ' día)' : ' días)');
  }
  if (item.origen === 'unica') return 'Una sola vez';
  return '';
}

const SEMANA = Object.freeze({
  esFecha: _semEsFecha,
  sumarDias: _semSumarDias,
  diaSemana: _semDiaSemana,
  lunesDe: _semLunesDe,
  claveFija: (fijaId, fecha) => 'fija:' + fijaId + ':' + fecha,
  claveSerie: (serieId, fecha) => 'serie:' + serieId + ':' + fecha,
  claveUnica: (id) => 'unica:' + id,
  armarSemana: _semArmarSemana,
  textoDia: _semTextoDia,
  textoOrigen: _semTextoOrigen
});
if (typeof module === 'object' && module && module.exports) module.exports = SEMANA; // salida-cjs
