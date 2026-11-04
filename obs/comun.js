/* Parroquia Inmaculada Concepción de María · Ciudad Arce
   Estado compartido entre el panel (dock) y las fuentes de navegador de OBS.
   Todo funciona dentro de OBS: se comparte por localStorage y BroadcastChannel,
   sin websockets ni internet. */

const CLAVE = 'parroquia_obs_estado_v1';
const CLAVE_LATIDO = 'parroquia_obs_latido_v1';

const PREDETERMINADO = {
  tipo: 'novena',            // dominical | otros | prenovena | novena | patronal
  prenovenaDia: 1,
  novenaDia: 1,
  santo: 'San José',
  mostrarCuenta: true,
  diasManual: '',            // vacío = se calcula solo hasta el 8 de diciembre
  frase: '«TODA HERMOSA ERES, MARÍA»',
  virgen: 'a',               // a | b | c
  parroquia: 'Parroquia Inmaculada Concepción de María · Ciudad Arce',

  celebranteRol: 'CELEBRANTE',
  celebrante: 'Pbro. Héctor Cruz',
  lectura1: '',
  salmoNum: '',
  salmoResp: '',
  lectura2: '',
  evangelio: '',
  rosario: '',

  mostrarLogo: true,
  mostrarEnVivo: true,
  mostrarBarra: true,
  barraTexto: '',            // vacío = se usa el título de la celebración

  rotulo: 'ninguno',         // ninguno | celebrante | lectura1 | salmo | lectura2 | evangelio | rosario
  rotuloHasta: 0,            // marca de tiempo para ocultar solo (0 = manual)
  duracionSeg: 0,
  textos: {},                // textos escritos a mano (vacío = automático)

  avisos: [
    { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }
  ]
};

function leerEstado() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    const s = Object.assign({}, PREDETERMINADO, guardado);
    if (!Array.isArray(s.avisos)) s.avisos = PREDETERMINADO.avisos;
    while (s.avisos.length < 4) s.avisos.push({ a: '', f: '' });
    if (!s.textos || typeof s.textos !== 'object') s.textos = {};
    return s;
  } catch (e) {
    return JSON.parse(JSON.stringify(PREDETERMINADO));
  }
}

let canal = null;
try { canal = new BroadcastChannel('parroquia_obs'); } catch (e) { canal = null; }

let ultimoPropio = null;   // lo último que esta misma página guardó (no se vuelve a leer)

function guardarEstado(s) {
  ultimoPropio = JSON.stringify(s);
  try { localStorage.setItem(CLAVE, ultimoPropio); } catch (e) {}
  try { if (canal) canal.postMessage(s); } catch (e) {}
}

/* Llama a cb(estado) al inicio y cada vez que el panel cambia algo. */
function escucharEstado(cb) {
  let ultimo = null;
  const revisar = () => {
    let crudo = '';
    try { crudo = localStorage.getItem(CLAVE) || ''; } catch (e) {}
    if (crudo !== ultimo) {
      ultimo = crudo;
      if (crudo !== ultimoPropio) cb(leerEstado());
    }
  };
  revisar();
  setInterval(revisar, 300);
  window.addEventListener('storage', revisar);
  if (canal) canal.onmessage = (e) => {
    ultimo = JSON.stringify(e.data);
    cb(Object.assign({}, PREDETERMINADO, e.data));
  };
}

/* Las fuentes de navegador avisan que están vivas (el panel muestra "Conectado"). */
function latir(nombre) {
  const enviar = () => {
    try {
      const l = JSON.parse(localStorage.getItem(CLAVE_LATIDO) || '{}');
      l[nombre] = Date.now();
      localStorage.setItem(CLAVE_LATIDO, JSON.stringify(l));
    } catch (e) {}
  };
  enviar(); setInterval(enviar, 1000);
}

function fechaFiesta() {
  const hoy = new Date();
  const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let fiesta = new Date(hoy.getFullYear(), 11, 8);
  if (h0 > fiesta) fiesta = new Date(hoy.getFullYear() + 1, 11, 8);
  return { h0, fiesta };
}

function diasFaltan(s) {
  if (s && String(s.diasManual).trim() !== '') return parseInt(s.diasManual, 10) || 0;
  const { h0, fiesta } = fechaFiesta();
  return Math.round((fiesta - h0) / 86400000);
}

function anioFiesta() { return fechaFiesta().fiesta.getFullYear(); }

function tituloCelebracion(s) {
  switch (s.tipo) {
    case 'dominical': return 'SANTA MISA DOMINICAL';
    case 'otros': return ('MISA EN HONOR A ' + (s.santo || '')).toUpperCase().trim();
    case 'prenovena': return 'PRENOVENA · DÍA ' + s.prenovenaDia;
    case 'novena': return 'NOVENA · DÍA ' + s.novenaDia;
    case 'patronal': return 'SANTA MISA PATRONAL';
    default: return '';
  }
}

/* ---------- Textos editables ----------
   Cada texto tiene un valor automático (según la celebración). Si en el panel
   se escribe algo, eso reemplaza al automático. Salto de línea = Enter. */
function textosBase(s) {
  const anio = anioFiesta();
  const d = diasFaltan(s);
  const porTipo = {
    dominical: { ceja: 'CAMINO A NUESTRAS FIESTAS PATRONALES', cursiva: '¡Ya se acerca la fiesta\nde nuestra Patrona!', gracias: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Camino al 8 de diciembre' },
    otros:     { ceja: 'CAMINO A NUESTRA FIESTA PATRONAL', cursiva: 'rumbo a la fiesta de la\nInmaculada Concepción', gracias: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Camino al 8 de diciembre' },
    prenovena: { ceja: 'FIESTAS PATRONALES ' + anio, cursiva: 'preparándonos para celebrar\na nuestra Patrona', gracias: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Fiestas Patronales ' + anio },
    novena:    { ceja: 'FIESTAS PATRONALES ' + anio, cursiva: 'en honor a la Inmaculada\nConcepción de María', gracias: 'CAMINO AL 8 DE DICIEMBRE', barra: 'Fiestas Patronales ' + anio },
    patronal:  { ceja: 'SOLEMNIDAD DE LA INMACULADA CONCEPCIÓN', cursiva: '¡Felices Fiestas Patronales!', gracias: '¡FELICES FIESTAS PATRONALES!', barra: '¡Felices Fiestas Patronales!' }
  }[s.tipo] || {};
  return {
    marca: 'Parroquia Inmaculada\nConcepción de María · Ciudad Arce',
    inicio_pildora: tituloCelebracion(s),
    inicio_ceja: porTipo.ceja,
    inicio_titulo: 'En breve\ncomenzamos',
    inicio_cursiva: porTipo.cursiva,
    inicio_cuenta: (d === 1 ? 'día' : 'días') + ' para nuestra\nFiesta Patronal',
    portada_ceja: 'FIESTAS PATRONALES ' + anio,
    portada_cursiva: 'en honor a la',
    portada_titulo: 'Inmaculada\nConcepción\nde María',
    portada_fecha: 'DE DICIEMBRE',
    portada_sub: 'Solemnidad de nuestra Patrona',
    gracias_pildora: tituloCelebracion(s),
    gracias_titulo: '¡Gracias por\nacompañarnos!',
    gracias_cursiva: 'Nos vemos en la próxima\ntransmisión',
    gracias_ceja: porTipo.gracias,
    avisos_sub: 'PARROQUIA INMACULADA CONCEPCIÓN DE MARÍA',
    avisos_titulo: 'Avisos',
    capa_logo: 'Parroquia Inmaculada\nConcepción de María',
    barra_y: porTipo.barra,
    k_lectura1: 'PRIMERA LECTURA',
    k_salmo: 'SALMO RESPONSORIAL',
    k_lectura2: 'SEGUNDA LECTURA',
    k_evangelio: 'SANTO EVANGELIO',
    k_rosario: 'ORACIÓN',
    t_rosario: 'Santo Rosario'
  };
}

function tx(s, clave) {
  const propio = s.textos && typeof s.textos[clave] === 'string' ? s.textos[clave].trim() : '';
  return propio || textosBase(s)[clave] || '';
}

function imagenVirgen(s) {
  return 'img/virgen-' + (['a', 'b', 'c'].includes(s.virgen) ? s.virgen : 'a') + '.png';
}

/* Escala el escenario de 1920×1080 al tamaño real de la fuente de navegador. */
function escalarEscenario() {
  const el = document.querySelector('.escenario');
  if (!el) return;
  const ajustar = () => {
    const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    const x = (window.innerWidth - 1920 * k) / 2, y = (window.innerHeight - 1080 * k) / 2;
    el.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  };
  ajustar();
  window.addEventListener('resize', ajustar);
}
document.addEventListener('DOMContentLoaded', escalarEscenario);

/* Reduce el tamaño de letra hasta que el texto quepa en el ancho dado. */
function ajustarTexto(el, anchoMax, tamMax, tamMin) {
  let t = tamMax;
  el.style.fontSize = t + 'px';
  while (el.scrollWidth > anchoMax && t > tamMin) { t -= 2; el.style.fontSize = t + 'px'; }
}
