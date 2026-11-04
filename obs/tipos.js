/* Parroquia Inmaculada Concepción de María · Ciudad Arce
   Catálogo de tipos de transmisión y de rótulos.
   Todo valor de contenido (títulos, frases, orden de rótulos, umbral de días) vive SOLO aquí:
   corregirlo es cambiar una línea. Script clásico (sin módulos); se carga antes de comun.js.

   Pendiente de confirmar (según la especificación): el orden de los rótulos de la Hora Santa y de la
   procesión, y los 60 días (desdeDias) de la misa dominical. */

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

/* Rótulos de una misa con segunda lectura (el orden de la misa). */
const _MISA_COMPLETA = [
  { id: 'persona',   base: 'persona',   nombre: 'Celebrante' },
  { id: 'lectura1',  base: 'lectura1',  nombre: '1.ª lectura' },
  { id: 'salmo',     base: 'salmo',     nombre: 'Salmo' },
  { id: 'lectura2',  base: 'lectura2',  nombre: '2.ª lectura' },
  { id: 'evangelio', base: 'evangelio', nombre: 'Evangelio' }
];

const _CUENTA_FIESTA = { hasta: '12-08', texto: 'para nuestra\nFiesta Patronal' };
const _FRANJA = '«TODA HERMOSA ERES, MARÍA»';
const _GRACIAS_CURSIVA = 'Nos vemos en la próxima\ntransmisión';

const TIPOS = {
  dominical: {
    nombre: 'Misa dominical',
    descripcion: 'Misa del domingo. La cuenta al 8 de diciembre aparece 60 días antes.',
    titulo: 'SANTA MISA DOMINICAL',
    ceja: 'CAMINO A NUESTRAS FIESTAS PATRONALES',
    cursiva: '¡Ya se acerca la fiesta\nde nuestra Patrona!',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL 8 DE DICIEMBRE',
    imagen: 'virgen-a',
    esquina: 'hoy',
    esquinaTexto: '',
    cuenta: { hasta: '12-08', texto: 'para nuestra\nFiesta Patronal', desdeDias: 60 },
    rotulos: _MISA_COMPLETA,
    datos: []
  },
  semana: {
    nombre: 'Misa entre semana',
    descripcion: 'Misa del miércoles o del sábado.',
    titulo: 'SANTA MISA',
    ceja: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    cursiva: 'Ven, Señor Jesús',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    imagen: 'fachada',
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
    imagen: 'custodia',
    esquina: 'texto',
    esquinaTexto: 'JUEVES\nEUCARÍSTICO',
    cuenta: false,
    rotulos: [
      { id: 'guia',      base: 'persona',   nombre: 'Guía', ceja: 'GUÍA' },
      { id: 'santisimo', base: 'santisimo', nombre: 'Exposición del Santísimo' },
      { id: 'lectura1',  base: 'lectura1',  nombre: 'Lectura' },
      { id: 'oracion',   base: 'oracion',   nombre: 'Oración' },
      { id: 'bendicion', base: 'libre',     nombre: 'Bendición', ceja: 'BENDICIÓN', texto: 'Bendición con el Santísimo' }
    ],
    datos: []
  },
  sector: {
    nombre: 'Misa en sector',
    descripcion: 'Misa celebrada en un sector o comunidad.',
    titulo: 'SANTA MISA · {sector}',
    ceja: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    cursiva: 'Iglesia en salida,\ncomunidad en camino',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '{sector}',
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
    cursiva: 'Oh María sin pecado concebida,\nrogad por nosotros que recurrimos a vos',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '¡FELICES FIESTAS PATRONALES!',
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
    cursiva: 'Caminamos juntos\ncon María',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'PROCESIÓN · {santo}',
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
      { id: 'persona', base: 'persona', nombre: 'Guía' }
    ],
    datos: ['santo', 'lugar']
  },
  otros: {
    nombre: 'Misa de otro santo',
    descripcion: 'Misa en honor a un santo. Lleva la cuenta al 8 de diciembre.',
    titulo: 'MISA EN HONOR A {santo}',
    ceja: 'CAMINO A NUESTRA FIESTA PATRONAL',
    cursiva: 'rumbo a la fiesta de la\nInmaculada Concepción',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL 8 DE DICIEMBRE',
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
    cursiva: 'preparándonos para celebrar\na nuestra Patrona',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL 8 DE DICIEMBRE',
    imagen: 'virgen-a',
    esquina: 'fiesta',
    esquinaTexto: '',
    cuenta: _CUENTA_FIESTA,
    rotulos: _MISA_COMPLETA,
    datos: ['dia']
  },
  novena: {
    nombre: 'Novena',
    descripcion: 'Los nueve días antes de la fiesta patronal.',
    titulo: 'NOVENA · DÍA {dia}',
    ceja: 'FIESTAS PATRONALES {anio}',
    cursiva: 'en honor a la Inmaculada\nConcepción de María',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'CAMINO AL 8 DE DICIEMBRE',
    imagen: 'virgen-a',
    esquina: 'fiesta',
    esquinaTexto: '',
    cuenta: _CUENTA_FIESTA,
    rotulos: _MISA_COMPLETA,
    datos: ['dia']
  },
  patronal: {
    nombre: 'Fiesta patronal',
    descripcion: 'Misa del 8 de diciembre.',
    titulo: 'SANTA MISA PATRONAL',
    ceja: 'SOLEMNIDAD DE LA INMACULADA CONCEPCIÓN',
    cursiva: '¡Felices Fiestas Patronales!',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: '¡FELICES FIESTAS PATRONALES!',
    imagen: 'virgen-a',
    esquina: 'fiesta',
    esquinaTexto: '',
    cuenta: false,
    rotulos: _MISA_COMPLETA,
    datos: []
  },
  evento: {
    nombre: 'Evento especial',
    descripcion: 'Cualquier otro evento de la parroquia.',
    titulo: '{evento}',
    ceja: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    cursiva: 'Te esperamos\ncon alegría',
    franja: _FRANJA,
    graciasCursiva: _GRACIAS_CURSIVA,
    graciasPie: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    imagen: 'logo',
    esquina: 'texto',
    esquinaTexto: '{evento}',
    cuenta: false,
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

/* Tipo de la transmisión; si la clave no existe (estado viejo o dañado) usa el dominical. */
function tipoDe(s) {
  return (s && Object.prototype.hasOwnProperty.call(TIPOS, s.tipo)) ? TIPOS[s.tipo] : TIPOS.dominical;
}

/* Reemplaza {dia}, {santo}, {sector}, {lugar}, {evento} y {anio}. Dato vacío = [santo], [sector]…
   Nunca deja una llave sin reemplazar. */
function rellenar(plantilla, s) {
  s = s || {};
  const hoy = new Date();
  const pasoLaFiesta = hoy.getMonth() === 11 && hoy.getDate() > 8;   // ya pasó el 8 de diciembre
  const valores = {
    dia: s.tipo === 'prenovena' ? s.prenovenaDia : s.novenaDia,
    santo: s.santo,
    sector: s.sector,
    lugar: s.lugar,
    evento: s.evento,
    anio: hoy.getFullYear() + (pasoLaFiesta ? 1 : 0)
  };
  return String(plantilla == null ? '' : plantilla).replace(/\{(\w+)\}/g, (llave, clave) => {
    if (!(clave in valores)) return '[' + clave + ']';
    const v = valores[clave];
    const texto = v === undefined || v === null ? '' : String(v).trim();
    return texto || '[' + clave + ']';
  });
}
