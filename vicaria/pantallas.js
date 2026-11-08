/* Personalización de pantallas y avisos fijos: lógica pura, sin tocar el DOM.
   Va después de parroquia.js, tipos.js y comun.js. PARROQUIA es un `let` que cambia cuando llega la
   configuración, así que cada ayudante la lee AL LLAMARSE y nunca guarda una copia.
   Una pantalla solo se personaliza con modo 'personalizada'; con modo ausente o 'como-viene' todo
   da los valores de siempre y el resto del bloque se ignora. */

const MAX_FILAS_AVISOS = 6;

/* El bloque de configuración de la vista, o null si no está personalizada. */
function _bloquePantalla(vista) {
  const b = PARROQUIA.pantallas && PARROQUIA.pantallas[vista];
  return b && typeof b === 'object' && b.modo === 'personalizada' ? b : null;
}

/* Imagen de la galería { src, alt } o null si no existe ese id. */
function imagenGaleria(id) {
  const g = Array.isArray(PARROQUIA.galeria) ? PARROQUIA.galeria.find((im) => im && im.id === id) : null;
  return g && typeof g.src === 'string' && g.src !== '' ? { src: g.src, alt: typeof g.alt === 'string' ? g.alt : '' } : null;
}

/* Fondo de la vista: { tipo: 'degradado' } | { tipo: 'color', color } | { tipo: 'imagen', src, alt }.
   Un fondo de imagen cuya galería ya no existe cae al degradado. */
function fondoDe(vista) {
  const b = _bloquePantalla(vista);
  const f = b && b.fondo;
  if (f && f.tipo === 'color' && typeof f.color === 'string') return { tipo: 'color', color: f.color };
  if (f && f.tipo === 'imagen') {
    const im = imagenGaleria(f.imagen);
    if (im) return { tipo: 'imagen', src: im.src, alt: im.alt };
  }
  return { tipo: 'degradado' };
}

/* Ajustes de la vista. Sin personalizar: los valores de hoy. El título no es ocultable: 'titulo' nunca está en `ocultar`. */
function ajustesDe(vista) {
  const b = _bloquePantalla(vista);
  return {
    personalizada: b !== null,
    fondo: fondoDe(vista),
    imagen: b && typeof b.imagen === 'string' ? b.imagen : 'automatica',
    distribucion: b && typeof b.distribucion === 'string' ? b.distribucion : 'izquierda',
    ocultar: b && Array.isArray(b.ocultar) ? b.ocultar.filter((e) => typeof e === 'string' && e !== 'titulo') : [],
    textos: b && b.textos && typeof b.textos === 'object' ? Object.assign({}, b.textos) : {}
  };
}

/* ¿Se muestra este elemento? El título siempre. */
function visible(vista, elemento) {
  return elemento === 'titulo' || ajustesDe(vista).ocultar.indexOf(elemento) === -1;
}

/* Imagen de la vista { src, alt, clase }. 'automatica' = la de hoy; 'ninguna' = sin imagen;
   'galeria:<id>' = la de la galería (si ya no existe, la automática); otra clave = esa imagen fija. */
function imagenDeVista(s, vista) {
  const eleccion = ajustesDe(vista).imagen;
  let im;
  if (eleccion === 'ninguna') {
    im = { src: '', alt: '' };
  } else if (eleccion.indexOf('galeria:') === 0) {
    im = imagenGaleria(eleccion.slice(8)) || { src: imagenDe(s), alt: altDe(s) };
  } else if (eleccion === 'automatica') {
    im = { src: imagenDe(s), alt: altDe(s) };
  } else {
    const fija = Object.assign({}, s, { imagen: eleccion });
    im = { src: imagenDe(fija), alt: altDe(fija) };
  }
  return { src: im.src, alt: im.alt, clase: claseDeImagen(im.src) };
}

/* Texto de la vista: lo escrito en el panel > el de la configuración (con huecos rellenados) > el automático. */
function textoDe(s, vista, clave) {
  const propio = s && s.textos && typeof s.textos[clave] === 'string' ? s.textos[clave].trim() : '';
  if (propio) return propio;
  const config = ajustesDe(vista).textos[clave];
  const deConfig = typeof config === 'string' ? rellenar(config, s).trim() : '';
  return deConfig || textosBase(s)[clave] || '';
}

/* ---------- Avisos, horarios y redes ---------- */

/* Aviso fijo vigente hoy: `desde` y `hasta` son inclusivos y se leen como fechas LOCALES. */
function _vigente(a, hoy) {
  const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const desde = a.desde === undefined ? null : fechaLocal(a.desde);
  const hasta = a.hasta === undefined ? null : fechaLocal(a.hasta);
  if (desde && h0 < desde) return false;
  if (hasta && h0 > hasta) return false;
  return true;
}

/* Filas de la pantalla de avisos [{a, f}]: primero los fijos vigentes (por `orden`, y a igual orden por
   posición; sin `orden` van al final), después los del panel que no estén vacíos. Máximo 6. */
function avisosPara(s, hoy = new Date()) {
  const fijos = (Array.isArray(PARROQUIA.avisos) ? PARROQUIA.avisos : [])
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a && typeof x.a.texto === 'string' && x.a.texto.trim() !== '' && _vigente(x.a, hoy))
    .sort((p, q) => {
      const po = Number.isInteger(p.a.orden) ? p.a.orden : Infinity;
      const qo = Number.isInteger(q.a.orden) ? q.a.orden : Infinity;
      return po === qo ? p.i - q.i : po < qo ? -1 : 1;
    })
    .map((x) => ({ a: x.a.texto, f: typeof x.a.detalle === 'string' ? x.a.detalle : '' }));
  const delPanel = (s && Array.isArray(s.avisos) ? s.avisos : [])
    .filter((x) => x && typeof x.a === 'string' && x.a.trim() !== '')
    .map((x) => ({ a: x.a, f: typeof x.f === 'string' ? x.f : '' }));
  return fijos.concat(delPanel).slice(0, MAX_FILAS_AVISOS);
}

/* Horarios de misa de la configuración [{dia, hora, nota}]. */
function horariosPara() {
  return (Array.isArray(PARROQUIA.horarios) ? PARROQUIA.horarios : [])
    .map((h) => ({ dia: h.dia, hora: h.hora, nota: typeof h.nota === 'string' ? h.nota : '' }));
}

/* Redes [{red, texto}]. La URL no se muestra (OBS no hace clic): solo el texto. */
function redesPara() {
  return (Array.isArray(PARROQUIA.redes) ? PARROQUIA.redes : []).map((r) => ({ red: r.red, texto: r.texto }));
}
