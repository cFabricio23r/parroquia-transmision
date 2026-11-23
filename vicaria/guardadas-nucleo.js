/* Núcleo de las transmisiones guardadas compartidas: lo que el panel de OBS y la app de Android
   hacen igual al sincronizar con la nube (tabla public.guardadas). Todo es puro: sin DOM, sin
   localStorage, sin red y sin relojes (la hora y el azar se pasan como argumentos).

   JS plano, como semana.js: sin import. La app usa una copia byte a byte en app/src/generado/.
   Nombres de nivel superior con prefijo _gua para no chocar con guardadas.js; lo público vive
   solo dentro de GUARDADAS.

   Guardada local = { id, nombre, tipo, guardadaEn, usadaEn, actualizadoEn, borradaEn, datos } (ms epoch).
   Fila de la nube = { id, parroquia_id, nombre, tipo, datos, guardada_en, usada_en, actualizado_en,
   actualizado_desde, actualizado_por, borrada_en } (ISO). */

const _GUA_LIMITE = 50;
const _GUA_CAMPOS_DE_AIRE = ['rotulo', 'rotuloHasta', 'rotuloDesde'];

const _guaMismoNombre = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const _guaIso = (ms) => new Date(ms).toISOString();

/* <ms en base36>-<6 de base36 al azar>. Cumple /^[a-z0-9]{4,24}(-[a-z0-9]{4,12})?$/. */
function _guaIdNuevo(ahoraMs, azar) {
  let sufijo = '';
  for (let i = 0; i < 6; i++) sufijo += Math.min(35, Math.floor(azar() * 36)).toString(36);
  return Math.floor(ahoraMs).toString(36) + '-' + sufijo;
}

/* Local -> fila de la nube. `datos` va sin el rótulo al aire. actualizado_por lo pone el servidor. */
function _guaAFila(g, desde, parroquiaId) {
  const datos = JSON.parse(JSON.stringify(g.datos || {}));
  _GUA_CAMPOS_DE_AIRE.forEach((c) => { delete datos[c]; });
  const actualizadoEn = g.actualizadoEn != null ? g.actualizadoEn : Math.max(g.guardadaEn || 0, g.usadaEn || 0);
  return {
    id: g.id,
    parroquia_id: parroquiaId,
    nombre: g.nombre,
    tipo: g.tipo,
    datos,
    guardada_en: _guaIso(g.guardadaEn),
    usada_en: _guaIso(g.usadaEn || g.guardadaEn),   // la columna no admite null
    actualizado_en: _guaIso(actualizadoEn),
    actualizado_desde: desde,
    borrada_en: g.borradaEn != null ? _guaIso(g.borradaEn) : null
  };
}

/* Fila de la nube -> local (la inversa de aFila). */
function _guaDeFila(f) {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    guardadaEn: Date.parse(f.guardada_en),
    usadaEn: Date.parse(f.usada_en),
    actualizadoEn: Date.parse(f.actualizado_en),
    borradaEn: f.borrada_en ? Date.parse(f.borrada_en) : null,
    datos: JSON.parse(JSON.stringify(f.datos || {}))
  };
}

/* Anota una operación pendiente. Para un mismo id, guardar o borrar reemplaza a los anteriores de
   cualquiera de los dos. Un usar se agrega solo si no hay un guardar del mismo id posterior.
   No modifica el arreglo recibido. */
function _guaAnotar(pendientes, p) {
  if (p.op === 'usar') {
    const hayGuardarPosterior = pendientes.some((x) => x.id === p.id && x.op === 'guardar' && x.cuando > p.cuando);
    return hayGuardarPosterior ? pendientes.slice() : pendientes.concat([p]);
  }
  return pendientes.filter((x) => !(x.id === p.id && (x.op === 'guardar' || x.op === 'borrar'))).concat([p]);
}

/* La lista para pintar: la nube activa, más las locales con guardar pendiente (gana la local si su
   actualizadoEn es mayor), menos las que tienen borrar pendiente. Una borrada en la nube solo vuelve
   si hay un guardar local posterior a la baja. Una copia local sin pendiente que la nube ya no tiene
   se ignora. */
function _guaFusionar(local, nube, pendientes) {
  const conGuardar = new Set(pendientes.filter((p) => p.op === 'guardar').map((p) => p.id));
  const conBorrar = new Set(pendientes.filter((p) => p.op === 'borrar').map((p) => p.id));
  const locales = new Map(local.map((g) => [g.id, g]));
  const vistos = new Set();
  const salida = [];

  for (const f of nube) {
    vistos.add(f.id);
    if (conBorrar.has(f.id)) continue;
    const l = conGuardar.has(f.id) ? locales.get(f.id) : undefined;
    if (f.borrada_en) {
      if (l && l.actualizadoEn > Date.parse(f.borrada_en)) salida.push(l);
      continue;
    }
    salida.push(l && l.actualizadoEn > Date.parse(f.actualizado_en) ? l : _guaDeFila(f));
  }
  for (const g of local) {
    if (vistos.has(g.id) || !conGuardar.has(g.id) || conBorrar.has(g.id)) continue;
    salida.push(g);
  }
  return salida;
}

/* «X (copia)», «X (copia 2)»… el primero que no esté en `ocupados` (mismo criterio que mismoNombre). */
function _guaNombreLibre(nombre, ocupados) {
  const base = String(nombre).trim();
  const libre = (n) => !ocupados.some((o) => _guaMismoNombre(o, n));
  let candidato = base + ' (copia)';
  for (let n = 2; !libre(candidato); n++) candidato = base + ' (copia ' + n + ')';
  return candidato;
}

const GUARDADAS = Object.freeze({
  LIMITE: _GUA_LIMITE,
  CAMPOS_DE_AIRE: Object.freeze(_GUA_CAMPOS_DE_AIRE.slice()),
  idNuevo: _guaIdNuevo,
  aFila: _guaAFila,
  deFila: _guaDeFila,
  anotar: _guaAnotar,
  fusionar: _guaFusionar,
  nombreLibre: _guaNombreLibre
});
if (typeof module === 'object' && module && module.exports) module.exports = GUARDADAS; // salida-cjs
