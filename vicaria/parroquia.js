/* Identidad de la parroquia: slug de la página, claves de almacenamiento, validación de config.json y paleta.
   Script clásico (sin módulos). Va antes de comun.js en cada página.
   El slug sale de la ruta: /<slug>/panel.html. Toda clave de almacenamiento lleva el slug,
   así nunca se mezclan datos de dos parroquias. */

/* Slug válido: minúsculas y dígitos separados por guiones, de 2 a 40 caracteres. No se pasa a minúsculas. */
const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* slugDe('/ciudad-arce/panel.html') -> 'ciudad-arce'. Si el primer segmento no es un slug válido, null. */
function slugDe(ruta) {
  const m = /^\/([^/]*)/.exec(String(ruta));
  if (!m) return null;
  const s = m[1];
  return s.length >= 2 && s.length <= 40 && RE_SLUG.test(s) ? s : null;
}

const SLUG = slugDe(location.pathname);

/* claveDe('estado_v1') -> 'pev_ciudad-arce_estado_v1'. Con SLUG nulo da 'pev__estado_v1' (clave que nadie lee). */
function claveDe(nombre) {
  return 'pev_' + (SLUG === null ? '' : SLUG) + '_' + nombre;
}

/* ---------- Color ---------- */

const RE_HEX = /^#[0-9a-fA-F]{6}$/;

function _rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function _luminancia(hex) {
  const [r, g, b] = _rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/* Razón de contraste WCAG entre dos colores #rrggbb (de 1 a 21). */
function contraste(hexA, hexB) {
  const a = _luminancia(hexA);
  const b = _luminancia(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* Mezcla `hex` con blanco: parte = 0 deja el color, parte = 1 da blanco. */
function _conBlanco(hex, parte) {
  const ch = _rgb(hex).map((v) => {
    const n = Math.round(v + (255 - v) * parte);
    return (n < 16 ? '0' : '') + n.toString(16);
  });
  return '#' + ch.join('');
}

/* Los seis colores de estilos.css (--oscuro --rey --medio --celeste --claro --palido) a partir de los dos de la parroquia. */
function paleta(principal, oscuro) {
  return {
    oscuro: oscuro,
    rey: principal,
    medio: _conBlanco(principal, 0.15),
    celeste: _conBlanco(principal, 0.35),
    claro: _conBlanco(principal, 0.6),
    palido: _conBlanco(principal, 0.9)
  };
}

/* ---------- Validación de config.json (esquema 1) ---------- */

const MIN_CONTRASTE = 4.5;

function _texto(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function _objeto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/* Una imagen de la configuración: { src, alt }. El alt es obligatorio (accesibilidad). */
function _validarImagen(img, campo, errores) {
  if (!_objeto(img)) {
    errores.push('Falta ' + campo + '.');
    return;
  }
  if (!_texto(img.src)) errores.push('Falta el archivo de ' + campo + ' (' + campo + '.src).');
  if (!_texto(img.alt)) errores.push('Falta la descripción (alt) de ' + campo + '.');
}

function _diasDelMes(mes) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

/* validarConfig(c) -> { ok, errores }. Los errores son frases en español para mostrar en el panel. */
function validarConfig(c) {
  const errores = [];
  if (!_objeto(c)) return { ok: false, errores: ['La configuración no es un objeto válido.'] };

  if (c.esquema !== 1) errores.push('El esquema (esquema) debe ser 1.');
  if (!Number.isInteger(c.version) || c.version < 1) errores.push('La versión (version) debe ser un número entero desde 1.');
  if (!_texto(c.publicado) || isNaN(Date.parse(c.publicado))) errores.push('Falta la fecha de publicación (publicado) o no es válida.');

  if (SLUG === null || c.slug !== SLUG) errores.push('El slug (slug) no coincide con el de la dirección de esta página.');
  if (!_texto(c.nombre)) errores.push('Falta el nombre de la parroquia (nombre).');
  if ('nombreCorto' in c && c.nombreCorto !== undefined && !_texto(c.nombreCorto)) errores.push('El nombre corto (nombreCorto) está vacío.');
  if (!_texto(c.lugar)) errores.push('Falta el lugar (lugar).');

  const col = c.colores;
  if (!_objeto(col)) {
    errores.push('Faltan los colores (colores).');
  } else {
    if (!_texto(col.principal) || !RE_HEX.test(col.principal)) {
      errores.push('El color principal (colores.principal) debe tener la forma #rrggbb.');
    } else if (contraste('#ffffff', col.principal) < MIN_CONTRASTE) {
      errores.push('El texto blanco no se lee sobre el color principal (colores.principal): elige uno más oscuro.');
    }
    if (!_texto(col.oscuro) || !RE_HEX.test(col.oscuro)) {
      errores.push('El color oscuro (colores.oscuro) debe tener la forma #rrggbb.');
    } else if (contraste('#ffffff', col.oscuro) < MIN_CONTRASTE) {
      errores.push('El texto blanco no se lee sobre el color oscuro (colores.oscuro): elige uno más oscuro.');
    }
  }

  if (!_objeto(c.logos)) {
    errores.push('Faltan los logos (logos).');
  } else {
    _validarImagen(c.logos.blanco, 'el logo blanco (logos.blanco)', errores);
    if (c.logos.color !== undefined) _validarImagen(c.logos.color, 'el logo a color (logos.color)', errores);
  }

  _validarImagen(c.fachada, 'la fachada (fachada)', errores);

  const p = c.patrono;
  if (!_objeto(p)) {
    errores.push('Falta el patrono (patrono).');
  } else {
    if (!_texto(p.nombre)) errores.push('Falta el nombre del patrono (patrono.nombre).');
    if (!_texto(p.corto)) errores.push('Falta el nombre corto del patrono (patrono.corto).');
    if (p.imagen !== undefined) _validarImagen(p.imagen, 'la imagen del patrono (patrono.imagen)', errores);
  }

  const f = c.fiesta;
  if (!_objeto(f)) {
    errores.push('Falta la fiesta patronal (fiesta).');
  } else {
    if (!Number.isInteger(f.mes) || f.mes < 1 || f.mes > 12) {
      errores.push('El mes de la fiesta (fiesta.mes) debe ser un número de 1 a 12.');
    } else if (!Number.isInteger(f.dia) || f.dia < 1 || f.dia > _diasDelMes(f.mes)) {
      errores.push('El día de la fiesta (fiesta.dia) no existe en ese mes.');
    }
    if (f.lema !== undefined && typeof f.lema !== 'string') errores.push('El lema de la fiesta (fiesta.lema) debe ser texto.');
    if (f.cuentaDesdeDias !== undefined && (!Number.isInteger(f.cuentaDesdeDias) || f.cuentaDesdeDias < 1)) {
      errores.push('Los días de cuenta regresiva (fiesta.cuentaDesdeDias) deben ser un entero desde 1.');
    }
  }

  return { ok: errores.length === 0, errores: errores };
}

/* Configuración de respaldo para pantallas neutras (sin logo, sin fachada, sin nombre).
   NO pasa por validarConfig a propósito y NUNCA se guarda como copia de la parroquia:
   solo se muestra cuando no hay configuración. (La carga de la configuración, en la Tarea 2, lo respeta.) */
const CONFIG_NEUTRA = {
  esquema: 1,
  version: 0,
  slug: SLUG,
  nombre: '',
  colores: { principal: '#1155a4', oscuro: '#0c3562' }
};
