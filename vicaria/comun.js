/* Estado compartido entre el panel (dock) y las fuentes de navegador de OBS.
   Todo funciona dentro de OBS: se comparte por localStorage y BroadcastChannel,
   sin websockets ni internet.
   Necesita parroquia.js cargado antes (PARROQUIA, claveDe): las claves llevan el slug de la parroquia
   y los textos, la fiesta y las imágenes salen de su configuración. */

const CLAVE = claveDe('estado_v1');
const CLAVE_LATIDO = claveDe('latido_v1');

const PREDETERMINADO = {
  tipo: 'novena',            // una clave de TIPOS (obs/tipos.js)
  prenovenaDia: 1,
  novenaDia: 1,
  santo: '',
  sector: '',
  fecha: '',                 // AAAA-MM-DD (patronal de sector, evento)
  lugar: '',
  evento: '',
  mostrarCuenta: true,       // solo se conserva para migrarlo a `cuenta`
  cuenta: null,              // null = la del tipo; true / false = forzada
  diasManual: '',            // vacío = se calcula solo hasta la fiesta patronal
  frase: '',                 // vacío = la franja del tipo; escrita, reemplaza a la del tipo
  imagen: '',                // vacío = la del tipo (clave de imagen: virgen-a, santo, custodia…)
  esquina: '',               // vacío = la del tipo (hoy | fecha | fiesta | texto)
  esquinaTexto: '',
  parroquia: '',             // vacío = «nombre · lugar» de la configuración de la parroquia

  celebranteRol: 'CELEBRANTE',
  celebrante: '',
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

  rotulo: 'ninguno',         // ninguno | id de un rótulo del tipo (persona, lectura1, salmo…)
  rotuloHasta: 0,            // marca de tiempo para ocultar solo (0 = manual)
  duracionSeg: 0,
  rotulosTexto: {},          // textos de rótulos escritos a mano
  textos: {},                // textos escritos a mano (vacío = automático)

  avisos: [
    { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }, { a: '', f: '' }
  ]
};

const FRASE_ANTIGUA = '«TODA HERMOSA ERES, MARÍA»';

/* Completa un estado guardado con los valores por defecto y lo pasa al formato actual:
   virgen:'b' -> imagen:'virgen-b', rotulo:'celebrante' -> 'persona', mostrarCuenta:false -> cuenta:false. */
function normalizarEstado(guardado) {
  guardado = guardado && typeof guardado === 'object' ? guardado : {};
  const s = Object.assign({}, PREDETERMINADO, guardado);
  // Copias propias de lo anidado: mutar el estado nunca debe tocar PREDETERMINADO (ni lo que recibió).
  ['textos', 'avisos', 'rotulosTexto'].forEach((c) => { if (s[c] && typeof s[c] === 'object') s[c] = JSON.parse(JSON.stringify(s[c])); });
  if (['a', 'b', 'c'].includes(guardado.virgen)) s.imagen = 'virgen-' + guardado.virgen;
  delete s.virgen;
  // Las tres imágenes de la Virgen de Ciudad Arce pasan a ser «la del patrono» de la parroquia.
  if (['virgen-a', 'virgen-b', 'virgen-c'].includes(s.imagen)) s.imagen = 'patrono';
  if (typeof s.parroquia !== 'string') s.parroquia = '';   // vacío = «nombre · lugar» de la configuración, resuelto al usarla (lineaParroquia)
  if (s.rotulo === 'celebrante') s.rotulo = 'persona';
  // mostrarCuenta:false se migra una sola vez: después queda en true para no volver a forzar cuenta:false.
  if (guardado.mostrarCuenta === false) {
    if (guardado.cuenta === undefined || guardado.cuenta === null) s.cuenta = false;
    s.mostrarCuenta = true;
  }
  // La frase por defecto de antes pasa a vacío: cada tipo trae su propia franja.
  if (typeof s.frase === 'string' && s.frase.trim() === FRASE_ANTIGUA) s.frase = '';
  // Un tipo que la parroquia ya no ofrece (apagado, o un propio que se borró) pasa al primero disponible.
  // Mientras la configuración real no llega (origen 'neutra') no se reescribe: un propio guardado se perdería;
  // tipoDe ya cae al primero disponible en memoria, así que las pantallas siguen válidas.
  const disponibles = typeof ordenTipos === 'function' ? ordenTipos() : [];   // sin tipos.js (no cargó) no se reescribe nada
  if (ESTADO_CONFIG.origen !== 'neutra' && !disponibles.includes(s.tipo) && disponibles.length) s.tipo = disponibles[0];
  if (!Array.isArray(s.avisos)) s.avisos = PREDETERMINADO.avisos;
  while (s.avisos.length < 4) s.avisos.push({ a: '', f: '' });
  if (!s.textos || typeof s.textos !== 'object') s.textos = {};
  if (!s.rotulosTexto || typeof s.rotulosTexto !== 'object') s.rotulosTexto = {};
  return s;
}

function leerEstado() {
  try {
    return normalizarEstado(JSON.parse(localStorage.getItem(CLAVE) || '{}'));
  } catch (e) {
    return normalizarEstado({});
  }
}

let canal = null;
try { canal = new BroadcastChannel(claveDe('canal')); } catch (e) { canal = null; }

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
    cb(normalizarEstado(e.data));
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

const _DIAS_SEMANA = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const _MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/* 'MM-DD' de la fiesta patronal de la parroquia ('' si la configuración no la tiene). Un 29 de febrero
   se busca como '02-29' y diasHasta lo resuelve. */
function fiestaMMDD() {
  const f = PARROQUIA.fiesta;
  if (!f || !f.mes || !f.dia) return '';
  return (f.mes < 10 ? '0' : '') + f.mes + '-' + (f.dia < 10 ? '0' : '') + f.dia;
}

/* Días hasta la próxima ocurrencia de 'MM-DD' (el mismo día cuenta como 0).
   Un '02-29' en un año sin 29 de febrero cuenta hasta el 1 de marzo (así lo normaliza Date). */
function diasHasta(mmdd, hoy = new Date()) {
  const [m, d] = String(mmdd).split('-').map(Number);
  const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let meta = new Date(hoy.getFullYear(), m - 1, d);
  if (h0 > meta) meta = new Date(hoy.getFullYear() + 1, m - 1, d);
  return Math.round((meta - h0) / 86400000);
}

/* Cuenta regresiva del tipo; si el tipo no tiene y el panel la fuerza, usa la de la fiesta patronal. */
function cuentaDe(s) {
  return tipoDe(s).cuenta || TIPOS.otros.cuenta;
}

function diasFaltan(s, hoy = new Date()) {
  if (s && String(s.diasManual == null ? '' : s.diasManual).trim() !== '') return parseInt(s.diasManual, 10) || 0;
  // La cuenta va al `hasta` de su tipo (en tipos.js es la fiesta patronal de la parroquia, evaluada al usarse).
  const hasta = cuentaDe(s || {}).hasta || fiestaMMDD();
  return hasta ? diasHasta(hasta, hoy) : 0;
}

function cuentaVisible(s, hoy = new Date()) {
  const tipo = tipoDe(s);
  if (s.cuenta === false) return false;
  if (!tipo.cuenta && s.cuenta !== true) return false;
  const d = diasFaltan(s, hoy);
  if (d <= 0) return false;
  // Con la cuenta activada a mano (s.cuenta === true) no se aplica la ventana de desdeDias.
  if (s.cuenta !== true && tipo.cuenta && tipo.cuenta.desdeDias && d > tipo.cuenta.desdeDias) return false;
  return true;
}

/* Fecha 'AAAA-MM-DD' como fecha LOCAL (new Date('AAAA-MM-DD') la toma en UTC y en El Salvador da un día menos). */
function fechaLocal(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || '').trim());
  if (!m) return null;
  const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(f) ? null : f;
}

/* Esquina del cintillo: número grande + texto debajo. */
function esquinaDe(s, hoy = new Date()) {
  const tipo = tipoDe(s);
  const modo = s.esquina || tipo.esquina;
  if (modo === 'fiesta') {
    const f = PARROQUIA.fiesta;
    return f ? { num: String(f.dia), txt: 'DE\n' + _MESES[f.mes - 1] } : { num: '', txt: '' };
  }
  if (modo === 'texto') return { num: '', txt: rellenar(s.esquinaTexto || tipo.esquinaTexto, s) };
  if (modo === 'fecha') {
    const f = fechaLocal(s.fecha) || hoy;
    return { num: String(f.getDate()), txt: 'DE\n' + _MESES[f.getMonth()] };
  }
  return { num: String(hoy.getDate()), txt: _DIAS_SEMANA[hoy.getDay()] + '\n' + _MESES[hoy.getMonth()] };
}

/* Título de la celebración, siempre en mayúsculas (como antes). */
function tituloCelebracion(s) {
  return rellenar(tipoDe(s).titulo, s).toUpperCase().trim();
}

/* ---------- Textos editables
   Cada texto tiene un valor automático (según la celebración). Si en el panel
   se escribe algo, eso reemplaza al automático. Salto de línea = Enter. */
function textosBase(s) {
  const tipo = tipoDe(s);
  const nombre = PARROQUIA.nombre || '';
  const patrono = PARROQUIA.patrono && PARROQUIA.patrono.nombre ? PARROQUIA.patrono.nombre : '';
  const mesFiesta = PARROQUIA.fiesta ? _MESES[PARROQUIA.fiesta.mes - 1] : '';
  const d = diasFaltan(s);
  const frase = typeof s.frase === 'string' ? s.frase.trim() : '';
  return {
    marca: _nombreYLugar(),
    inicio_pildora: tituloCelebracion(s),
    inicio_ceja: rellenar(tipo.ceja, s).toUpperCase(),
    inicio_titulo: tipo.tituloInicio || 'En breve\ncomenzamos',
    inicio_cursiva: rellenar(tipo.cursiva, s),
    inicio_cuenta: tipo.cuenta || s.cuenta === true ? (d === 1 ? 'día ' : 'días ') + cuentaDe(s).texto : '',
    portada_ceja: 'FIESTAS PATRONALES ' + rellenar('{anio}', s),
    portada_cursiva: 'en honor a',
    portada_titulo: patrono,
    portada_fecha: mesFiesta ? 'DE ' + mesFiesta : '',
    portada_sub: 'Solemnidad de nuestro patrono',
    gracias_pildora: tituloCelebracion(s),
    gracias_titulo: '¡Gracias por\nacompañarnos!',
    gracias_cursiva: rellenar(tipo.graciasCursiva, s),
    gracias_ceja: rellenar(tipo.graciasPie, s).toUpperCase(),
    avisos_sub: nombre.toUpperCase(),
    avisos_titulo: 'Avisos',
    horarios_titulo: 'Horarios de misa',
    capa_logo: nombre,
    barra_y: rellenar(tipo.barra, s),
    franja: frase || rellenar(tipo.franja, s),
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

/* «Nombre · lugar» de la parroquia ('' si la configuración no los tiene). */
function _nombreYLugar() {
  return [PARROQUIA.nombre, PARROQUIA.lugar].filter((t) => typeof t === 'string' && t.trim() !== '').join(' · ');
}

/* La línea de parroquia bajo los rótulos: la escrita en el panel, o «nombre · lugar» de la configuración EN USO
   (no se guarda en el estado: si la configuración cambia, la línea la sigue). */
function lineaParroquia(s) {
  const propia = s && typeof s.parroquia === 'string' ? s.parroquia.trim() : '';
  return propia || _nombreYLugar();
}

/* Imagen de la configuración { src, alt }, o null si esa parroquia no la tiene. */
function _imagenConfig(img) {
  return img && typeof img.src === 'string' && img.src !== '' ? img : null;
}

/* La imagen de la transmisión: { src, alt }. La clave es la elegida en el panel o la del tipo.
   'patrono' -> imagen del patrono, o la fachada si no hay; 'fachada'; 'logo' -> logo blanco;
   'custodia' y 'santo' son comunes (img/); cualquier otra clave -> la fachada.
   Sin imágenes en la configuración (neutra) -> { src: '', alt: '' }. */
function _imagenElegida(s) {
  const clave = s.imagen || tipoDe(s).imagen;
  if (clave === 'custodia') return { src: 'img/custodia.png', alt: 'Custodia con el Santísimo' };
  if (clave === 'santo') return { src: 'img/santo.png', alt: 'Imagen del santo' };
  if (clave === 'ninguna') return { src: '', alt: '' };
  let img = null;
  // 'galeria:<id>' (pantallas.js): la de la galería; si ya no existe cae a la fachada, como una imagen que falla.
  if (typeof clave === 'string' && clave.indexOf('galeria:') === 0 && typeof imagenGaleria === 'function') img = imagenGaleria(clave.slice(8));
  else if (clave === 'logo') img = _imagenConfig(PARROQUIA.logos && PARROQUIA.logos.blanco);
  else if (clave === 'patrono') img = _imagenConfig(PARROQUIA.patrono && PARROQUIA.patrono.imagen);
  if (!img && clave !== 'logo') img = _imagenConfig(PARROQUIA.fachada);
  return img ? { src: img.src, alt: typeof img.alt === 'string' ? img.alt : '' } : { src: '', alt: '' };
}

/* Ruta de la imagen de la transmisión ('' si la parroquia no tiene esa imagen). */
function imagenDe(s) {
  return _imagenElegida(s).src;
}

/* Texto alternativo de la imagen que devuelve imagenDe. */
function altDe(s) {
  return _imagenElegida(s).alt;
}

/* Caja de la portada patronal: { num: '8', mes: 'DIC' }, o null si la parroquia no tiene fiesta
   (así la portada no pinta «DE » ni un número vacío). */
function cajaFiesta() {
  const f = PARROQUIA.fiesta;
  if (!f || !f.dia || !f.mes) return null;
  return { num: String(f.dia), mes: _MESES[f.mes - 1].slice(0, 3) };
}

/* Clase CSS de la imagen de la transmisión según su ruta: 'foto' si es la fachada de la configuración
   (horizontal, con marco), 'logo' si es el logo blanco, 'a' para cualquier otra (vertical). */
function claseDeImagen(src) {
  const fachada = _imagenConfig(PARROQUIA.fachada);
  const logo = _imagenConfig(PARROQUIA.logos && PARROQUIA.logos.blanco);
  if (fachada && src === fachada.src) return 'foto';
  if (logo && src === logo.src) return 'logo';
  return 'a';
}

/* Qué imagen sigue cuando `src` no carga: la fachada { src, alt }; o null si ya era la fachada o no hay
   fachada (entonces la imagen se oculta y queda el degradado de los colores). */
function respaldoDeImagen(src) {
  const fachada = _imagenConfig(PARROQUIA.fachada);
  if (!fachada || src === fachada.src) return null;
  return { src: fachada.src, alt: typeof fachada.alt === 'string' ? fachada.alt : '' };
}

/* Pone en un <img> la imagen { src, alt } de la configuración. Sin imagen (o si ya falló) el <img> se oculta:
   nunca queda el ícono de imagen rota. Una ruta que falla no se vuelve a pedir mientras la ruta sea la misma. */
function ponerImagen(img, im) {
  const src = im && typeof im.src === 'string' ? im.src : '';
  if (img.dataset.pedida !== src) {
    img.dataset.pedida = src;
    img.dataset.fallo = '';
    if (src) img.setAttribute('src', src); else img.removeAttribute('src');
    if (src && !img.dataset.vigilada) {
      img.dataset.vigilada = '1';
      img.addEventListener('error', () => { img.dataset.fallo = '1'; img.hidden = true; });
    }
  }
  img.alt = im && typeof im.alt === 'string' ? im.alt : '';
  img.hidden = !src || img.dataset.fallo === '1';
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
