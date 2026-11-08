/* Catálogo de tipos de transmisión y de rótulos, igual para todas las parroquias.
   Todo valor de contenido (títulos, frases, orden de rótulos) vive SOLO aquí: corregirlo es cambiar una
   línea. Lo propio de cada parroquia (fiesta, patrono, nombre, lema) entra por huecos: {fiesta},
   {fiestaMayus}, {patrono}, {patronoCorto}, {parroquia} y {lema}, que salen de su configuración.
   Script clásico (sin módulos); se carga antes de comun.js, cuyas fiestaMMDD y _MESES usa al ser
   llamado (no al cargar).

   Pendiente de confirmar (según la especificación): el orden de los rótulos de la Hora Santa y de la
   procesión. */

/* Bases de rótulo: diseño y ceja por defecto. Cada tipo las usa con `rotulos` (un «uso» por entrada). */
const ROTULOS = {
  persona:   { ceja: 'CELEBRANTE' },
  lectura1:  { ceja: 'PRIMERA LECTURA' },
  lectura2:  { ceja: 'SEGUNDA LECTURA' },
  salmo:     { ceja: 'SALMO RESPONSORIAL' },
  evangelio: { ceja: 'SANTO EVANGELIO' },
  rosario:   { ceja: 'SANTO ROSARIO' },
  santisimo: { ceja: 'EXPOSICIÓN DEL SANTÍSIMO' },
  lugar:     { ceja: 'LUGAR' },
  oracion:   { ceja: 'ORACIÓN' },
  libre:     { ceja: '' }
};

/* Sugerencias del cargo del rótulo «persona» en el panel (se puede escribir otro). */
const CARGOS = ['CELEBRANTE', 'PREDICADOR', 'CONCELEBRANTE', 'DIÁCONO', 'GUÍA', 'CORO'];

/* Rótulos de una misa con segunda lectura (el orden de la misa). */
const _MISA_COMPLETA = [
  { id: 'persona',   base: 'persona',   nombre: 'Celebrante' },
  { id: 'lectura1',  base: 'lectura1',  nombre: '1.ª lectura' },
  { id: 'salmo',     base: 'salmo',     nombre: 'Salmo' },
  { id: 'lectura2',  base: 'lectura2',  nombre: '2.ª lectura' },
  { id: 'evangelio', base: 'evangelio', nombre: 'Evangelio' }
];

/* Misa completa más el Santo Rosario (prenovena, novena y fiesta patronal). Lista nueva: no muta _MISA_COMPLETA. */
const _MISA_CON_ROSARIO = [..._MISA_COMPLETA, { id: 'rosario', base: 'rosario', nombre: 'Santo Rosario' }];

/* `hasta` es un getter: la configuración de la parroquia llega después de cargar este archivo. */
const _CUENTA_FIESTA = { get hasta() { return fiestaMMDD(); }, texto: 'para nuestra\nFiesta Patronal' };
const _FRANJA = '«{lema}»';
const _GRACIAS_CURSIVA = 'Nos vemos en la próxima\ntransmisión';

const TIPOS = {
  dominical: {
    nombre: 'Misa dominical',
    descripcion: 'Misa del domingo. La cuenta al {fiesta} aparece cuando se acerca la fiesta.',
    titulo: 'SANTA MISA DOMINICAL',
    ceja: 'CAMINO A NUESTRAS FIESTAS PATRONALES',
    cursiva: '¡Ya se acerca\nnuestra fiesta patronal!',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL {fiestaMayus}',
    barra: 'Camino al {fiesta}',
    imagen: 'patrono',
    esquina: 'hoy',
    esquinaTexto: '',
    cuenta: {
      get hasta() { return fiestaMMDD(); },
      texto: 'para nuestra\nFiesta Patronal',
      get desdeDias() { return (PARROQUIA.fiesta && PARROQUIA.fiesta.cuentaDesdeDias) || 60; }
    },
    rotulos: _MISA_COMPLETA,
    datos: []
  },
  semana: {
    nombre: 'Misa entre semana',
    descripcion: 'Misa del miércoles o del sábado.',
    titulo: 'SANTA MISA',
    ceja: '{parroquia}',
    cursiva: 'Ven, Señor Jesús',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '{parroquia}',
    barra: '{parroquia}',
    imagen: 'patrono',
    esquina: 'hoy',
    esquinaTexto: '',
    cuenta: false,
    rotulos: [
      { id: 'persona',   base: 'persona',   nombre: 'Celebrante' },
      { id: 'lectura1',  base: 'lectura1',  nombre: '1.ª lectura' },
      { id: 'salmo',     base: 'salmo',     nombre: 'Salmo' },
      { id: 'evangelio', base: 'evangelio', nombre: 'Evangelio' }
    ],
    datos: []
  },
  horasanta: {
    nombre: 'Hora Santa',
    descripcion: 'Adoración al Santísimo del jueves eucarístico.',
    titulo: 'HORA SANTA',
    ceja: 'JUEVES EUCARÍSTICO',
    cursiva: 'Adoremos a Jesús\nSacramentado',
    franja: '«BENDITO Y ALABADO SEA JESÚS SACRAMENTADO»',
    graciasCursiva: 'Que Jesús Sacramentado\nnos bendiga',
    graciasPie: 'JUEVES EUCARÍSTICO',
    barra: 'Jueves Eucarístico',
    imagen: 'custodia',
    esquina: 'texto',
    esquinaTexto: 'JUEVES\nEUCARÍSTICO',
    cuenta: false,
    rotulos: [
      { id: 'guia',      base: 'persona',   nombre: 'Guía', ceja: 'GUÍA' },
      { id: 'santisimo', base: 'santisimo', nombre: 'Exposición del Santísimo' },
      { id: 'lectura1',  base: 'lectura1',  nombre: 'Lectura', ceja: 'LECTURA' },
      { id: 'oracion',   base: 'oracion',   nombre: 'Oración' },
      { id: 'bendicion', base: 'libre',     nombre: 'Bendición', ceja: 'BENDICIÓN', texto: 'Bendición con el Santísimo' }
    ],
    datos: []
  },
  sector: {
    nombre: 'Misa en sector',
    descripcion: 'Misa celebrada en un sector o comunidad.',
    titulo: 'SANTA MISA · {sector}',
    ceja: '{parroquia}',
    cursiva: 'Iglesia en salida,\ncomunidad en camino',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '{sector}',
    barra: '{sector}',
    imagen: 'fachada',
    esquina: 'texto',
    esquinaTexto: '{sector}',
    cuenta: false,
    rotulos: [
      { id: 'persona',   base: 'persona',   nombre: 'Celebrante' },
      { id: 'lugar',     base: 'lugar',     nombre: 'Lugar' },
      { id: 'lectura1',  base: 'lectura1',  nombre: '1.ª lectura' },
      { id: 'salmo',     base: 'salmo',     nombre: 'Salmo' },
      { id: 'evangelio', base: 'evangelio', nombre: 'Evangelio' }
    ],
    datos: ['sector', 'lugar']
  },
  patronalsector: {
    nombre: 'Patronal de sector',
    descripcion: 'Misa patronal de un sector, el día de su patrono. No lleva cuenta regresiva.',
    titulo: 'MISA PATRONAL · {sector}',
    ceja: 'EN HONOR A {santo}',
    cursiva: 'Ruega por nosotros, {santo}',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '¡FELICES FIESTAS PATRONALES!',
    barra: '¡Felices Fiestas Patronales!',
    imagen: 'santo',
    esquina: 'fecha',
    esquinaTexto: '',
    cuenta: false,
    rotulos: _MISA_COMPLETA,
    datos: ['sector', 'santo', 'fecha']
  },
  procesion: {
    nombre: 'Procesión',
    descripcion: 'Procesión con el santo o la imagen del día.',
    titulo: 'PROCESIÓN',
    ceja: 'EN HONOR A {santo}',
    cursiva: 'Caminamos juntos\nen la fe',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'PROCESIÓN · {santo}',
    barra: 'En honor a {santo}',
    imagen: 'santo',
    esquina: 'hoy',
    esquinaTexto: '',
    cuenta: false,
    tituloInicio: 'En breve\nsalimos',
    salida: true,
    rotulos: [
      { id: 'lugar',   base: 'lugar',   nombre: 'Estación' },
      { id: 'oracion', base: 'oracion', nombre: 'Oración' },
      { id: 'rosario', base: 'rosario', nombre: 'Rosario' },
      { id: 'persona', base: 'persona', nombre: 'Guía', ceja: 'GUÍA' }
    ],
    datos: ['santo', 'lugar']
  },
  otros: {
    nombre: 'Misa de otro santo',
    descripcion: 'Misa en honor a un santo. Lleva la cuenta al {fiesta}.',
    titulo: 'MISA EN HONOR A {santo}',
    ceja: 'CAMINO A NUESTRA FIESTA PATRONAL',
    cursiva: 'rumbo a la fiesta de\n{patrono}',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL {fiestaMayus}',
    barra: 'Camino al {fiesta}',
    imagen: 'santo',
    esquina: 'hoy',
    esquinaTexto: '',
    cuenta: _CUENTA_FIESTA,
    rotulos: _MISA_COMPLETA,
    datos: ['santo']
  },
  prenovena: {
    nombre: 'Prenovena',
    descripcion: 'Días de preparación antes de la novena.',
    titulo: 'PRENOVENA · DÍA {dia}',
    ceja: 'FIESTAS PATRONALES {anio}',
    cursiva: 'preparándonos para celebrar\nnuestra fiesta patronal',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL {fiestaMayus}',
    barra: 'Fiestas Patronales {anio}',
    imagen: 'patrono',
    esquina: 'fiesta',
    esquinaTexto: '',
    cuenta: _CUENTA_FIESTA,
    portada: 'fiesta',
    rotulos: _MISA_CON_ROSARIO,
    datos: ['dia']
  },
  novena: {
    nombre: 'Novena',
    descripcion: 'Los nueve días antes de la fiesta patronal.',
    titulo: 'NOVENA · DÍA {dia}',
    ceja: 'FIESTAS PATRONALES {anio}',
    cursiva: 'en honor a\n{patrono}',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL {fiestaMayus}',
    barra: 'Fiestas Patronales {anio}',
    imagen: 'patrono',
    esquina: 'fiesta',
    esquinaTexto: '',
    cuenta: _CUENTA_FIESTA,
    portada: 'fiesta',
    rotulos: _MISA_CON_ROSARIO,
    datos: ['dia']
  },
  patronal: {
    nombre: 'Fiesta patronal',
    descripcion: 'Misa del {fiesta}.',
    titulo: 'SANTA MISA PATRONAL',
    ceja: 'SOLEMNIDAD DE {patrono}',
    cursiva: '¡Felices Fiestas Patronales!',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '¡FELICES FIESTAS PATRONALES!',
    barra: '¡Felices Fiestas Patronales!',
    imagen: 'patrono',
    esquina: 'fiesta',
    esquinaTexto: '',
    cuenta: false,
    portada: 'fiesta',
    rotulos: _MISA_CON_ROSARIO,
    datos: []
  },
  evento: {
    nombre: 'Evento especial',
    descripcion: 'Cualquier otro evento de la parroquia.',
    titulo: '{evento}',
    ceja: '{parroquia}',
    cursiva: 'Te esperamos\ncon alegría',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '{parroquia}',
    barra: '{parroquia}',
    imagen: 'logo',
    esquina: 'texto',
    esquinaTexto: '{evento}',
    cuenta: false,
    portada: 'evento',
    portadaCeja: 'EVENTO ESPECIAL',
    portadaCursiva: 'les invita a',
    rotulos: [
      { id: 'persona', base: 'persona', nombre: 'Persona' },
      { id: 'libre',   base: 'libre',   nombre: 'Texto libre' }
    ],
    datos: ['evento', 'fecha', 'lugar']
  }
};

/* Orden de los botones del panel (tablero S2PanelElegir). */
const ORDEN_TIPOS = [
  'dominical', 'semana', 'horasanta', 'sector', 'patronalsector', 'procesion',
  'otros', 'prenovena', 'novena', 'patronal', 'evento'
];

/* Tipos propios de la parroquia (configuración `tipos.propios`), tal como los validó parroquia.js. Se lee al llamarse. */
function _propios() {
  const l = PARROQUIA.tipos && Array.isArray(PARROQUIA.tipos.propios) ? PARROQUIA.tipos.propios : [];
  return l.filter((t) => t && typeof t === 'object' && typeof t.clave === 'string' && t.clave !== '' && !Object.prototype.hasOwnProperty.call(TIPOS, t.clave));
}

/* Claves de los tipos que ofrece la parroquia, en orden: los comunes sin los apagados y después los propios
   (en el orden de la configuración). ORDEN_TIPOS no cambia; esta lista se evalúa cada vez que se llama. */
function ordenTipos() {
  const apagados = PARROQUIA.tipos && Array.isArray(PARROQUIA.tipos.apagados) ? PARROQUIA.tipos.apagados : [];
  return ORDEN_TIPOS.filter((k) => !apagados.includes(k)).concat(_propios().map((t) => t.clave));
}

/* Nombre de cada base de rótulo, para los rótulos de un tipo propio. */
const _NOMBRE_BASE = {
  persona: 'Persona', lectura1: '1.ª lectura', lectura2: '2.ª lectura', salmo: 'Salmo', evangelio: 'Evangelio',
  rosario: 'Santo Rosario', santisimo: 'Exposición del Santísimo', lugar: 'Lugar', oracion: 'Oración', libre: 'Texto libre'
};

/* Arma un tipo completo a partir de un tipo propio de la configuración: lo que no trae sale de valores por
   defecto (imagen del patrono, esquina de hoy, sin cuenta ni portada, sin datos). Los textos son plantillas
   que rellenar() completa como las de los tipos comunes. Devuelve un objeto nuevo. */
function _tipoPropio(p) {
  const texto = (v, defecto) => (typeof v === 'string' && v.trim() !== '' ? v : defecto);
  const usadas = {};
  const rotulos = (Array.isArray(p.rotulos) ? p.rotulos : []).filter((b) => Object.prototype.hasOwnProperty.call(ROTULOS, b)).map((base) => {
    usadas[base] = (usadas[base] || 0) + 1;
    return { id: usadas[base] === 1 ? base : base + '-' + usadas[base], base, nombre: _NOMBRE_BASE[base] || base };
  });
  const titulo = texto(p.titulo, p.nombre);
  return {
    nombre: p.nombre,
    descripcion: texto(p.descripcion, ''),
    titulo,
    ceja: texto(p.ceja, '{parroquia}'),
    cursiva: texto(p.cursiva, ''),
    franja: texto(p.franja, _FRANJA),
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: texto(p.ceja, '{parroquia}'),
    barra: titulo,
    imagen: texto(p.imagen, 'patrono'),
    esquina: texto(p.esquina, 'hoy'),
    esquinaTexto: texto(p.esquinaTexto, ''),
    cuenta: false,
    rotulos,
    datos: []
  };
}

/* Tipo de la transmisión: un común, o uno propio de la parroquia. Si la clave no está entre los que ofrece
   la parroquia (estado viejo o dañado, tipo apagado o propio borrado) usa el primero disponible. */
function tipoDe(s) {
  const clave = s ? s.tipo : undefined;
  const orden = ordenTipos();
  const hay = (k) => Object.prototype.hasOwnProperty.call(TIPOS, k);
  const apagados = PARROQUIA.tipos && Array.isArray(PARROQUIA.tipos.apagados) ? PARROQUIA.tipos.apagados : [];
  const propio = _propios().find((t) => t.clave === clave);
  if (propio) return _tipoPropio(propio);
  if (hay(clave) && !apagados.includes(clave)) return TIPOS[clave];
  const primero = orden[0];
  const p = _propios().find((t) => t.clave === primero);
  return hay(primero) ? TIPOS[primero] : p ? _tipoPropio(p) : TIPOS.dominical;
}

/* Reemplaza los huecos de una plantilla.
   De la transmisión: {dia}, {santo}, {sector}, {lugar} y {evento}; vacío = [santo], [sector]…
   De la parroquia (salen de su configuración): {fiesta} («8 de diciembre»), {fiestaMayus}, {patrono},
   {patronoCorto}, {parroquia}, {lema} y {anio} (el de la próxima fiesta: si este año ya pasó, el siguiente);
   si la parroquia no lo tiene, el hueco queda en blanco, sin corchetes. Unas comillas latinas que
   quedan vacías («{lema}» sin lema) también se quitan. Nunca deja una llave sin reemplazar.
   `hoy` solo se pasa en las pruebas. */
function rellenar(plantilla, s, hoy = new Date()) {
  s = s || {};
  const f = PARROQUIA.fiesta;
  const patrono = PARROQUIA.patrono || {};
  const texto = (v) => (typeof v === 'string' ? v.trim() : '');
  const fiesta = f && f.dia && f.mes ? f.dia + ' de ' + _MESES[f.mes - 1].toLowerCase() : '';
  const valores = {
    dia: s.tipo === 'prenovena' ? s.prenovenaDia : s.novenaDia,
    santo: s.santo,
    sector: s.sector,
    lugar: s.lugar,
    evento: s.evento
  };
  const deParroquia = {
    fiesta,
    fiestaMayus: fiesta.toUpperCase(),
    patrono: texto(patrono.nombre),
    patronoCorto: texto(patrono.corto) || texto(patrono.nombre),
    parroquia: texto(PARROQUIA.nombre),
    lema: f ? texto(f.lema) : '',
    anio: _anioDeLaFiesta(hoy)
  };
  return String(plantilla == null ? '' : plantilla).replace(/\{(\w+)\}/g, (llave, clave) => {
    const propia = (o) => Object.prototype.hasOwnProperty.call(o, clave);
    if (propia(deParroquia)) return String(deParroquia[clave]);
    if (!propia(valores)) return '[' + clave + ']';
    const v = valores[clave];
    const t = v === undefined || v === null ? '' : String(v).trim();
    return t || '[' + clave + ']';
  }).replace(/«\s*»/g, '');
}

/* Año de la próxima fiesta patronal: el de hoy, o el siguiente si ya pasó (el mismo día aún cuenta). */
function _anioDeLaFiesta(hoy) {
  const [m, d] = fiestaMMDD().split('-').map(Number);
  if (!m) return hoy.getFullYear();
  const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return hoy.getFullYear() + (h0 > new Date(hoy.getFullYear(), m - 1, d) ? 1 : 0);
}

/* Rótulos de la transmisión, en el orden del tipo. Cada uno trae su texto ya resuelto:
   { id, base, nombre, texto: { k (ceja), t (texto grande), s (subtexto), chico } }.
   Las bases heredadas (persona, lecturas, salmo, rosario) leen los campos de siempre del estado y la
   ceja de tx() (que respeta lo escrito en la pestaña Textos), para verse igual que antes. Las demás
   leen s.rotulosTexto[id], con respaldo en el uso y en la base (lugar: en s.lugar y s.sector). Devuelve objetos nuevos: nunca muta
   tipo.rotulos (varios tipos comparten la misma lista). Usa tx() de comun.js solo al ser llamada. */
function rotulosDe(s) {
  s = s || {};
  const propio = s.rotulosTexto || {};
  return tipoDe(s).rotulos.map((uso) => {
    const p = propio[uso.id] || {};
    const parroquia = lineaParroquia(s);
    let texto;
    switch (uso.base) {
      case 'persona':
        // Con ceja propia (Guía de la Hora Santa o de la procesión) es otra persona que el celebrante:
        // su nombre vive en rotulosTexto[id].t. Sin ceja propia, el celebrante de siempre.
        texto = uso.ceja
          ? { k: p.k || uso.ceja, t: p.t || '', s: parroquia }
          : { k: p.k || s.celebranteRol || ROTULOS.persona.ceja, t: s.celebrante || '', s: parroquia };
        break;
      case 'lectura1':
      case 'lectura2':
        // Ceja: lo escrito en el rótulo, luego la del uso (p. ej. la lectura única de la Hora Santa), luego la heredada.
        texto = { k: p.k || uso.ceja || tx(s, 'k_' + uso.base), t: s[uso.base] || '', s: parroquia };
        break;
      case 'evangelio':
        texto = { k: p.k || tx(s, 'k_' + uso.base), t: s[uso.base] || '', s: parroquia };
        break;
      case 'salmo':
        texto = { k: p.k || tx(s, 'k_salmo') + (s.salmoNum ? ' · ' + s.salmoNum.toUpperCase() : ''), t: s.salmoResp || '', s: parroquia, chico: true };
        break;
      case 'rosario':
        texto = { k: p.k || tx(s, 'k_rosario'), t: tx(s, 't_rosario'), s: s.rosario || parroquia };
        break;
      case 'lugar': {
        // Sin texto propio usa los datos de la transmisión: así el lugar se escribe una sola vez.
        const lugar = String(s.lugar || '').trim();
        const sector = String(s.sector || '').trim();
        texto = {
          k: p.k || uso.ceja || ROTULOS.lugar.ceja,
          t: p.t || uso.texto || lugar,
          s: p.s || sector || parroquia
        };
        break;
      }
      default:
        texto = {
          k: p.k || uso.ceja || ROTULOS[uso.base].ceja,
          t: p.t || uso.texto || '',
          s: p.s || parroquia
        };
    }
    texto.chico = !!texto.chico;
    return { id: uso.id, base: uso.base, nombre: uso.nombre, texto };
  });
}
