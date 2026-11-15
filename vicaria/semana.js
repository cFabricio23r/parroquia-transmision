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

/* ---------- Campos de cada tipo y «Faltan N datos» (plan 3b, Decisiones 2 a 4 y 11) ---------- */

/* Los datos de la transmisión que pide cada tipo, con las etiquetas del panel (panel.html, «Datos»). */
const _SEM_DATOS = {
  sector: { etiqueta: 'Sector o comunidad', entrada: 'texto' },
  santo: { etiqueta: 'Santo o patrono', entrada: 'texto' },
  fecha: { etiqueta: 'Fecha', entrada: 'fecha' },
  lugar: { etiqueta: 'Lugar', entrada: 'texto' },
  evento: { etiqueta: 'Nombre del evento', entrada: 'texto' }
};
/* Bases de rótulo y su nombre para un tipo propio (el _NOMBRE_BASE de tipos.js). */
const _SEM_NOMBRE_BASE = {
  persona: 'Persona', lectura1: '1.ª lectura', lectura2: '2.ª lectura', salmo: 'Salmo', evangelio: 'Evangelio',
  rosario: 'Santo Rosario', santisimo: 'Exposición del Santísimo', lugar: 'Lugar', oracion: 'Oración', libre: 'Texto libre'
};
const _SEM_DATOS_EVENTO = ['evento', 'fecha', 'lugar'];
/* Lo único que guarda `datos`: estos textos, rotulosTexto y dia. */
const _SEM_TEXTOS = ['sector', 'santo', 'fecha', 'lugar', 'evento', 'celebrante', 'lectura1', 'lectura2', 'evangelio', 'salmoResp'];
const _SEM_CLAVES_TRANSMISION = Object.freeze(['sector', 'santo', 'fecha', 'lugar', 'evento', 'celebrante', 'celebranteRol',
  'lectura1', 'salmoNum', 'salmoResp', 'lectura2', 'evangelio', 'rosario', 'rotulosTexto', 'imagen', 'esquina',
  'esquinaTexto', 'cuenta']);

function _semPropia(o, k) {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/* Un uso de rótulo con solo lo que sirve para los campos. */
function _semUso(u) {
  const r = { id: u.id, base: u.base, nombre: u.nombre };
  if (typeof u.ceja === 'string') r.ceja = u.ceja;
  if (typeof u.texto === 'string') r.texto = u.texto;
  if (u.opcional === true) r.opcional = true;
  return r;
}

/* Los tipos comunes, sacados del TIPOS de tipos.js sin leer sus getters (cuenta lee PARROQUIA). */
function _semTiposParaCampos(tipos, orden) {
  if (!_semObjeto(tipos) || !Array.isArray(orden)) return [];
  return orden.filter((k) => _semPropia(tipos, k) && _semObjeto(tipos[k])).map((k) => {
    const t = tipos[k];
    return {
      clave: k,
      nombre: _semTexto(t.nombrePanel) ? t.nombrePanel : t.nombre,
      datos: Array.isArray(t.datos) ? t.datos.slice() : [],
      rotulos: (Array.isArray(t.rotulos) ? t.rotulos : []).filter(_semObjeto).map(_semUso)
    };
  });
}

function _semNoVacio(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/* Un tipo propio de config.json (tipos.propios[i]) como lo arma _tipoPropio de tipos.js. */
function _semTipoPropio(p) {
  const opcionales = Array.isArray(p.opcionales) ? p.opcionales : [];
  const usadas = {};
  const rotulos = (Array.isArray(p.rotulos) ? p.rotulos : []).filter((b) => typeof b === 'string' && _semPropia(_SEM_NOMBRE_BASE, b)).map((base) => {
    usadas[base] = (usadas[base] || 0) + 1;
    const id = usadas[base] === 1 ? base : base + '-' + usadas[base];
    const u = { id, base, nombre: _SEM_NOMBRE_BASE[base] };
    if (opcionales.includes(id)) u.opcional = true;
    return u;
  });
  return {
    clave: p.clave,
    nombre: _semNoVacio(p.nombrePanel) ? p.nombrePanel : p.nombre,
    datos: p.portada === 'evento' ? _SEM_DATOS_EVENTO.slice() : [],
    rotulos
  };
}

/* Los tipos que ofrece la parroquia: los comunes sin los apagados, con sus ajustes, y después los propios. */
function _semTiposDisponibles(comunes, cfg) {
  const lista = Array.isArray(comunes) ? comunes : [];
  const c = _semObjeto(cfg) ? cfg : {};
  const apagados = Array.isArray(c.apagados) ? c.apagados : [];
  const ajustes = _semObjeto(c.ajustes) ? c.ajustes : {};
  const claves = new Set(lista.map((t) => t.clave));
  const salida = lista.filter((t) => !apagados.includes(t.clave)).map((t) => {
    const a = _semPropia(ajustes, t.clave) && _semObjeto(ajustes[t.clave]) ? ajustes[t.clave] : null;
    if (!a) return t;
    const r = Object.assign({}, t);
    if (_semNoVacio(a.nombrePanel)) r.nombre = a.nombrePanel;
    if (Array.isArray(a.ocultarRotulos)) r.rotulos = t.rotulos.filter((u) => !a.ocultarRotulos.includes(u.id));
    return r;
  });
  const propios = Array.isArray(c.propios) ? c.propios : [];
  for (const p of propios) {
    if (!_semObjeto(p) || !_semTexto(p.clave) || claves.has(p.clave) || !_semTexto(p.nombre)) continue;
    claves.add(p.clave);
    salida.push(_semTipoPropio(p));
  }
  return salida;
}

function _semTipoDeClave(lista, clave) {
  return (Array.isArray(lista) ? lista : []).find((t) => t && t.clave === clave) || null;
}

/* Los campos que pide un tipo, en el orden de faltas() del panel: sus datos (menos dia) y el texto
   principal de cada rótulo. */
function _semCamposDeTipo(tipo) {
  if (!_semObjeto(tipo)) return [];
  const campos = [];
  const vistas = new Set();
  const poner = (ruta, etiqueta, opcional, entrada) => {
    if (vistas.has(ruta)) return;
    vistas.add(ruta);
    campos.push({ ruta, etiqueta, opcional: opcional === true, entrada: entrada || 'texto' });
  };
  const datos = Array.isArray(tipo.datos) ? tipo.datos : [];
  for (const d of datos) {
    if (_semPropia(_SEM_DATOS, d)) poner(d, _SEM_DATOS[d].etiqueta, false, _SEM_DATOS[d].entrada);
  }
  const conLugar = datos.includes('lugar');
  for (const u of Array.isArray(tipo.rotulos) ? tipo.rotulos : []) {
    if (!_semObjeto(u) || !_semTexto(u.id)) continue;
    const propio = 'rotulosTexto.' + u.id + '.t';
    let ruta = null;
    switch (u.base) {
      case 'persona': ruta = typeof u.ceja === 'string' && u.ceja ? propio : 'celebrante'; break;
      case 'lectura1': case 'lectura2': case 'evangelio': ruta = u.base; break;
      case 'salmo': ruta = 'salmoResp'; break;
      case 'rosario': ruta = null; break;
      case 'lugar': ruta = conLugar ? null : propio; break;
      default: ruta = _semTexto(u.texto) ? null : propio;
    }
    if (ruta) poner(ruta, u.nombre, u.opcional === true, 'texto');
  }
  return campos;
}

function _semLeerCampo(datos, ruta) {
  let v = datos;
  for (const parte of String(ruta).split('.')) {
    if (!_semObjeto(v) || !_semPropia(v, parte)) return '';
    v = v[parte];
  }
  return typeof v === 'string' ? v : '';
}

function _semEscribirCampo(datos, ruta, valor) {
  const partes = String(ruta).split('.');
  const raiz = Object.assign({}, _semObjeto(datos) ? datos : {});
  let o = raiz;
  for (let i = 0; i < partes.length - 1; i++) {
    const k = partes[i];
    o[k] = Object.assign({}, _semObjeto(o[k]) ? o[k] : {});
    o = o[k];
  }
  o[partes[partes.length - 1]] = valor;
  return raiz;
}

/* Solo las claves de campo conocidas: lo que entra a `datos` y al estado del panel pasa por aquí. */
function _semLimpiarDatos(datos) {
  const r = {};
  if (!_semObjeto(datos)) return r;
  for (const k of _SEM_TEXTOS) {
    if (_semPropia(datos, k) && typeof datos[k] === 'string') r[k] = datos[k].slice(0, 200);
  }
  if (_semPropia(datos, 'dia') && Number.isInteger(datos.dia) && datos.dia >= 1 && datos.dia <= 60) r.dia = datos.dia;
  if (_semPropia(datos, 'rotulosTexto') && _semObjeto(datos.rotulosTexto)) {
    const rt = {};
    for (const id of Object.keys(datos.rotulosTexto)) {
      const v = datos.rotulosTexto[id];
      if (_SEM_TIPO.test(id) && id.length <= 40 && _semObjeto(v) && typeof v.t === 'string') rt[id] = { t: v.t.slice(0, 200) };
    }
    if (Object.keys(rt).length) r.rotulosTexto = rt;
  }
  return r;
}

function _semContarFaltas(tipo, datos) {
  if (!_semObjeto(tipo)) return null;
  const d = _semObjeto(datos) ? datos : {};
  return _semCamposDeTipo(tipo).filter((c) => !c.opcional && _semLeerCampo(d, c.ruta).trim() === '').length;
}

/* Los campos del tipo que tiene ahora el estado del panel (el día sale de prenovenaDia o novenaDia). */
function _semDatosDeEstado(estado, tipo) {
  let r = {};
  if (!_semObjeto(estado) || !_semObjeto(tipo)) return r;
  for (const c of _semCamposDeTipo(tipo)) {
    const v = _semLeerCampo(estado, c.ruta);
    if (v !== '') r = _semEscribirCampo(r, c.ruta, v);
  }
  if (Array.isArray(tipo.datos) && tipo.datos.includes('dia')) {
    r.dia = tipo.clave === 'prenovena' ? estado.prenovenaDia : estado.novenaDia;
  }
  return _semLimpiarDatos(r);
}

/* Lo que «Usar esta» le pone al estado del panel: limpiar vuelve a lo predeterminado, poner se aplica después. */
function _semParcheDePanel(item, tipo) {
  const it = _semObjeto(item) ? item : {};
  const limpio = _semLimpiarDatos(it.datos);
  const dia = limpio.dia;
  delete limpio.dia;
  const poner = Object.assign({ tipo: it.tipo }, limpio);
  if (Number.isInteger(dia)) {
    const clave = _semObjeto(tipo) ? tipo.clave : it.tipo;
    if (clave === 'prenovena') poner.prenovenaDia = dia;
    else poner.novenaDia = clave === 'novena' ? Math.min(dia, 9) : dia;
  }
  return { limpiar: _SEM_CLAVES_TRANSMISION.slice(), poner };
}

function _semTextoEstado(faltan) {
  if (!Number.isInteger(faltan)) return '● Tipo no disponible';
  if (faltan === 0) return '● Listo';
  return faltan === 1 ? '● Falta 1 dato' : '● Faltan ' + faltan + ' datos';
}

const SEMANA = Object.freeze({
  tiposParaCampos: _semTiposParaCampos,
  tiposDisponibles: _semTiposDisponibles,
  tipoDeClave: _semTipoDeClave,
  camposDeTipo: _semCamposDeTipo,
  leerCampo: _semLeerCampo,
  escribirCampo: _semEscribirCampo,
  limpiarDatos: _semLimpiarDatos,
  contarFaltas: _semContarFaltas,
  datosDeEstado: _semDatosDeEstado,
  parcheDePanel: _semParcheDePanel,
  CLAVES_DE_TRANSMISION: _SEM_CLAVES_TRANSMISION,
  textoEstado: _semTextoEstado,
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
