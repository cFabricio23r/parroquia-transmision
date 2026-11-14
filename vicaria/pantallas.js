/* Personalización de pantallas y avisos fijos: lógica pura, sin tocar el DOM.
   Va después de parroquia.js, tipos.js y comun.js. PARROQUIA es un `let` que cambia cuando llega la
   configuración, así que cada ayudante la lee AL LLAMARSE y nunca guarda una copia.
   Una pantalla solo se personaliza con modo 'personalizada'; con modo ausente o 'como-viene' todo
   da los valores de siempre y el resto del bloque se ignora. */

const MAX_FILAS_AVISOS = 6;
const MAX_FILAS_GRACIAS = 6;

/* Imagen de la galería { src, alt } o null si no existe ese id. */
function imagenGaleria(id) {
  const g = Array.isArray(PARROQUIA.galeria) ? PARROQUIA.galeria.find((im) => im && im.id === id) : null;
  return g && typeof g.src === 'string' && g.src !== '' ? { src: g.src, alt: typeof g.alt === 'string' ? g.alt : '' } : null;
}

/* Fondo de la vista: { tipo: 'degradado' } | { tipo: 'color', color } | { tipo: 'imagen', src, alt }.
   Un fondo de imagen cuya galería ya no existe cae al degradado. */
function fondoDe(vista) {
  const b = _sinFondo(vista) ? null : bloquePantalla(vista);
  const f = b && b.fondo;
  if (f && f.tipo === 'color' && typeof f.color === 'string') return { tipo: 'color', color: f.color };
  if (f && f.tipo === 'imagen') {
    const im = imagenGaleria(f.imagen);
    if (im) return { tipo: 'imagen', src: im.src, alt: im.alt };
  }
  return { tipo: 'degradado' };
}

/* Producción y la capa EN VIVO no tienen fondo, imagen ni distribución: si la configuración los trae, se ignoran. */
function _sinFondo(vista) {
  return vista === 'produccion' || vista === 'envivo';
}

/* Ajustes de la vista. Sin personalizar: los valores de hoy. El título no es ocultable: 'titulo' nunca está en `ocultar`.
   `mostrar` son los elementos pedidos a propósito (ELEMENTOS_MOSTRABLES); sin personalizar, ninguno. */
function ajustesDe(vista) {
  const b = bloquePantalla(vista);
  const conFondo = b && !_sinFondo(vista);
  return {
    personalizada: b !== null,
    fondo: fondoDe(vista),
    imagen: conFondo && typeof b.imagen === 'string' ? b.imagen : 'automatica',
    distribucion: conFondo && typeof b.distribucion === 'string' ? b.distribucion : 'izquierda',
    ocultar: b && Array.isArray(b.ocultar) ? b.ocultar.filter((e) => typeof e === 'string' && e !== 'titulo') : [],
    mostrar: b && Array.isArray(b.mostrar) ? b.mostrar.filter((e) => ELEMENTOS_MOSTRABLES.includes(e)) : [],
    textos: b && b.textos && typeof b.textos === 'object' ? Object.assign({}, b.textos) : {}
  };
}

/* ¿Se muestra este elemento? El título siempre. Redes y horarios solo si la vista los pide en `mostrar`;
   lo demás, salvo que esté en `ocultar`. */
function visible(vista, elemento) {
  if (elemento === 'titulo') return true;
  const a = ajustesDe(vista);
  if (ELEMENTOS_MOSTRABLES.includes(elemento)) return a.mostrar.indexOf(elemento) !== -1;
  return a.ocultar.indexOf(elemento) === -1;
}

/* Imagen de la vista { src, alt, clase }. 'automatica' = la de hoy; 'ninguna' = sin imagen;
   'galeria:<id>' = la de la galería (si ya no existe, la automática); otra clave = esa imagen fija.
   Una imagen elegida en el panel (s.imagen) gana a la de la pantalla: la de la pantalla solo reemplaza a la automática. */
function imagenDeVista(s, vista) {
  const eleccion = s && s.imagen ? 'automatica' : ajustesDe(vista).imagen;
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

/* Texto de la vista: lo escrito en el panel > el del tipo (tipos.ajustes o el propio) > el de la pantalla en la
   configuración > el automático. Los de la configuración van con los huecos rellenados. */
function textoDe(s, vista, clave) {
  const propio = s && s.textos && typeof s.textos[clave] === 'string' ? s.textos[clave].trim() : '';
  if (propio) return propio;
  const textosTipo = tipoDe(s).textosTipo || {};
  const delTipo = typeof textosTipo[clave] === 'string' ? rellenar(textosTipo[clave], s).trim() : '';
  if (delTipo) return delTipo;
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

/* Filas de la pantalla de avisos [{a, f}]: primero los fijos activos y vigentes (por `orden`, y a igual orden por
   posición; sin `orden` van al final), después los del panel con texto o detalle (como en la 1a) y, si la
   pantalla de avisos pide los horarios (mostrar), las filas de horarios. Máximo 6. */
function avisosPara(s, hoy = new Date()) {
  const fijos = (Array.isArray(PARROQUIA.avisos) ? PARROQUIA.avisos : [])
    .map((a, i) => ({ a, i }))
    .filter((x) => x.a && x.a.activo !== false && typeof x.a.texto === 'string' && x.a.texto.trim() !== '' && _vigente(x.a, hoy))
    .sort((p, q) => {
      const po = Number.isInteger(p.a.orden) ? p.a.orden : Infinity;
      const qo = Number.isInteger(q.a.orden) ? q.a.orden : Infinity;
      return po === qo ? p.i - q.i : po < qo ? -1 : 1;
    })
    .map((x) => ({ a: x.a.texto, f: typeof x.a.detalle === 'string' ? x.a.detalle : '' }));
  const delPanel = (s && Array.isArray(s.avisos) ? s.avisos : [])
    .map((x) => (x && typeof x === 'object' ? { a: typeof x.a === 'string' ? x.a : '', f: typeof x.f === 'string' ? x.f : '' } : null))
    .filter((x) => x && (x.a.trim() !== '' || x.f.trim() !== ''));
  const horarios = visible('avisos', 'horarios') ? filasHorarios() : [];
  return fijos.concat(delPanel, horarios).slice(0, MAX_FILAS_AVISOS);
}

/* Horarios de misa de la configuración [{dia, horas: [{hora, nota}], lugar}]. La forma vieja {dia, hora, nota}
   se lee como una sola hora con esa nota. */
function horariosPara() {
  const texto = (v) => (typeof v === 'string' ? v : '');
  return (Array.isArray(PARROQUIA.horarios) ? PARROQUIA.horarios : [])
    .filter((h) => h && typeof h === 'object')
    .map((h) => ({
      dia: h.dia,
      horas: Array.isArray(h.horas)
        ? h.horas.filter((o) => o && typeof o === 'object').map((o) => ({ hora: o.hora, nota: texto(o.nota) }))
        : [{ hora: h.hora, nota: texto(h.nota) }],
      lugar: texto(h.lugar)
    }));
}

/* Horarios como filas de avisos [{a, f}]: `a` es el día y sus notas no vacías, `f` las horas; unidos con « · ».
   Ejemplo (artboard F11): { a: 'Jueves · Hora Santa', f: '6:00 p. m.' }. */
function filasHorarios() {
  const unir = (l) => l.filter((t) => typeof t === 'string' && t.trim() !== '').join(' · ');
  return horariosPara().map((h) => ({
    a: unir([h.dia].concat(h.horas.map((o) => o.nota))),
    f: unir(h.horas.map((o) => o.hora))
  }));
}

/* Horarios de la caja de Gracias: las filas de horarios, como mucho MAX_FILAS_GRACIAS (como los avisos), para que la
   caja quede debajo del texto sin sacar el título del cuadro ni pisar la franja. */
function filasGracias() {
  return filasHorarios().slice(0, MAX_FILAS_GRACIAS);
}

/* Redes [{red, texto}]. La URL no se muestra (OBS no hace clic): solo el texto. */
function redesPara() {
  return (Array.isArray(PARROQUIA.redes) ? PARROQUIA.redes : []).filter((r) => r && typeof r === 'object').map((r) => ({ red: r.red, texto: r.texto }));
}

/* Redes de una vista que no es la de horarios: solo si la vista las pide (mostrar: ['redes']); si no, []. */
function redesVisibles(vista) {
  return visible(vista, 'redes') ? redesPara() : [];
}

/* ---------- Rótulos ---------- */

/* Estilo de los rótulos. Sin bloque `rotulos` (o con valores fuera de lo permitido): los de hoy.
   colorLado y colorLinea: #rrggbb o un nombre (principal, oscuro, acento, blanco), resueltos con colorDe; null si
   no hay o no se resuelve. Sin colorLinea, la línea es el acento si existe (si no, null: la de hoy).
   ladoClaro: el lateral es claro (contraste con blanco menor que 3), y lleva el logo a color.
   logoEsquina: mientras hay rótulo, el logo blanco queda solo en la esquina (F6:24); vale true cuando falta. */
function estiloRotulos() {
  const r = PARROQUIA.rotulos && typeof PARROQUIA.rotulos === 'object' ? PARROQUIA.rotulos : {};
  const colores = PARROQUIA.colores;
  const colorLado = colorDe(r.colorLado, colores);
  const linea = colorDe(r.colorLinea, colores);
  return {
    tipografia: TIPOGRAFIAS.includes(r.tipografia) ? r.tipografia : 'montserrat',
    // el nombre del diseño (R3): 'redondeadas' de una configuración vieja se ve como 'suaves'; sin valor, 'suaves'
    esquinas: ESQUINAS_ROTULO.includes(r.esquinas) ? ESQUINAS_DISENO[r.esquinas] : 'suaves',
    posicion: r.posicion === 'centro' ? 'centro' : 'izquierda',
    colorLado,
    colorLinea: linea || colorDe('acento', colores),
    ladoClaro: colorLado !== null && contraste('#ffffff', colorLado) < 3,
    logoEsquina: r.logoEsquina !== false
  };
}

/* Cargos que sugiere el panel: los de la configuración, o CARGOS si no hay (o la lista queda vacía). */
function cargosDe() {
  const l = PARROQUIA.rotulos && Array.isArray(PARROQUIA.rotulos.cargos)
    ? PARROQUIA.rotulos.cargos.filter((t) => typeof t === 'string' && t.trim() !== '') : [];
  return l.length ? l : CARGOS.slice();
}
