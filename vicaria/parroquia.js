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

const MIN_CONTRASTE = 4.5;

/* Los seis colores de estilos.css (--oscuro --rey --medio --celeste --claro --palido) a partir de los dos de la parroquia. */
function paleta(principal, oscuro) {
  // --medio es texto pequeño sobre blanco (.rotulo .k) y sobre el fondo fijo de las filas (#eef5fc, estilos.css): se
  // acerca al principal hasta llegar a 4.5:1 contra los dos.
  const FONDO_FILA = '#eef5fc';
  const pasa = (hex) => contraste('#ffffff', hex) >= MIN_CONTRASTE && contraste(FONDO_FILA, hex) >= MIN_CONTRASTE;
  let parte = 15;
  while (parte > 0 && !pasa(_conBlanco(principal, parte / 100))) parte--;
  let medio = _conBlanco(principal, parte / 100);
  if (!pasa(medio) && pasa(oscuro)) medio = oscuro;   // principal muy claro: ni sin mezcla alcanza, se usa el oscuro
  return {
    oscuro: oscuro,
    rey: principal,
    medio: medio,
    celeste: _conBlanco(principal, 0.35),
    claro: _conBlanco(principal, 0.6),
    palido: _conBlanco(principal, 0.9)
  };
}

/* Pone la paleta de la parroquia en las variables CSS de :root (--oscuro --rey --medio --celeste --claro --palido). */
function aplicarPaleta(c) {
  const p = paleta(c.colores.principal, c.colores.oscuro);
  for (const k of Object.keys(p)) document.documentElement.style.setProperty('--' + k, p[k]);
}

/* ---------- Validación de config.json (esquema 1) ---------- */

function _texto(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function _objeto(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/* Ruta de una imagen de la configuración: solo dentro de la carpeta medios/ de la parroquia,
   sin subcarpetas, sin «..», sin barra invertida, sin http(s):// ni //. */
const RUTA_MEDIO = /^medios\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|svg)$/i;

/* Una imagen de la configuración: { src, alt }. El alt es obligatorio (accesibilidad). */
function _validarImagen(img, campo, errores) {
  if (!_objeto(img)) {
    errores.push('Falta ' + campo + '.');
    return;
  }
  if (!_texto(img.src)) errores.push('Falta el archivo de ' + campo + ' (' + campo + '.src).');
  else if (!RUTA_MEDIO.test(img.src)) errores.push('La ruta de ' + campo + ' (' + campo + '.src) debe ser medios/archivo con extensión png, jpg, jpeg, webp o svg.');
  if (!_texto(img.alt)) errores.push('Falta la descripción (alt) de ' + campo + '.');
}

function _diasDelMes(mes) {
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

/* ---------- Bloques opcionales de la etapa 1b ---------- */

/* Listas fijas: parroquia.js se carga antes que tipos.js y comun.js, así que no puede leer ORDEN_TIPOS,
   ROTULOS ni textosBase. Una prueba compara cada lista con su fuente. */
const CLAVES_COMUNES = ['dominical', 'semana', 'horasanta', 'sector', 'patronalsector', 'procesion', 'otros', 'prenovena', 'novena', 'patronal', 'evento'];
const BASES_ROTULO = ['persona', 'lectura1', 'lectura2', 'salmo', 'evangelio', 'rosario', 'santisimo', 'lugar', 'oracion', 'libre'];
const CLAVES_TEXTOS = [
  'marca', 'inicio_pildora', 'inicio_ceja', 'inicio_titulo', 'inicio_cursiva', 'inicio_cuenta',
  'portada_ceja', 'portada_cursiva', 'portada_titulo', 'portada_fecha', 'portada_sub',
  'gracias_pildora', 'gracias_titulo', 'gracias_cursiva', 'gracias_ceja',
  'avisos_sub', 'avisos_titulo', 'horarios_titulo', 'capa_logo', 'barra_y', 'franja',
  'k_lectura1', 'k_salmo', 'k_lectura2', 'k_evangelio', 'k_rosario', 't_rosario'
];

const VISTAS_PERSONALIZABLES = ['inicio', 'portada', 'gracias', 'avisos', 'horarios'];
const MODOS_PANTALLA = ['como-viene', 'personalizada'];
const TIPOS_FONDO = ['degradado', 'color', 'imagen'];
const IMAGENES_PANTALLA = ['automatica', 'patrono', 'fachada', 'logo', 'custodia', 'santo', 'ninguna'];
const DISTRIBUCIONES = ['izquierda', 'derecha', 'centro'];
const ELEMENTOS_OCULTABLES = ['marca', 'envivo', 'chispas', 'rayos', 'fachada', 'franja', 'esquina'];
const TIPOGRAFIAS = ['montserrat'];
const ESQUINAS_ROTULO = ['redondeadas', 'rectas'];
const POSICIONES_ROTULO = ['izquierda', 'centro'];
const ESQUINAS_TIPO = ['hoy', 'fecha', 'fiesta', 'texto'];
const REDES = ['facebook', 'youtube', 'instagram', 'whatsapp', 'web'];
const MAX_TEXTO = 200;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HTTPS = /^https:\/\/\S+$/i;

/* Comprueba que `v` sea una lista de hasta `max` elementos; false si no es lista. */
function _lista(v, campo, max, errores) {
  if (!Array.isArray(v)) {
    errores.push('El valor (' + campo + ') debe ser una lista.');
    return false;
  }
  if (v.length > max) errores.push('La lista (' + campo + ') admite como máximo ' + max + ' elementos.');
  return true;
}

/* Texto opcional (si viene debe ser texto de hasta 200 caracteres) u obligatorio (además, no vacío). */
function _textoCorto(v, campo, errores, obligatorio) {
  if (v === undefined) {
    if (obligatorio) errores.push('Falta el texto (' + campo + ').');
    return;
  }
  if (typeof v !== 'string') errores.push('El valor (' + campo + ') debe ser texto.');
  else if (obligatorio && v.trim() === '') errores.push('Falta el texto (' + campo + ').');
  else if (v.length > MAX_TEXTO) errores.push('El texto (' + campo + ') pasa de ' + MAX_TEXTO + ' caracteres.');
}

function _unoDe(v, validos, campo, errores) {
  if (v !== undefined && !validos.includes(v)) errores.push('El valor (' + campo + ') debe ser uno de: ' + validos.join(', ') + '.');
}

/* Color #rrggbb bajo texto blanco: debe leerse (contraste >= 4.5). */
function _validarColorConBlanco(v, campo, errores) {
  if (typeof v !== 'string' || !RE_HEX.test(v)) errores.push('El color (' + campo + ') debe tener la forma #rrggbb.');
  else if (contraste('#ffffff', v) < MIN_CONTRASTE) errores.push('El texto blanco no se lee sobre el color (' + campo + '): elige uno más oscuro.');
}

/* `id` debe ser el id de una imagen de la galería; ids = los ids válidos. */
function _validarRefGaleria(id, campo, ids, errores) {
  if (typeof id !== 'string' || !ids.includes(id)) errores.push('La imagen (' + campo + ') no está en la galería (galeria).');
}

/* Imagen de una pantalla o de un tipo propio: una clave de `claves` o galeria:<id> con id existente. */
function _validarImagenElegida(v, campo, ids, errores, claves) {
  if (v === undefined) return;
  if (typeof v === 'string' && v.indexOf('galeria:') === 0) _validarRefGaleria(v.slice(8), campo, ids, errores);
  else if (!claves.includes(v)) errores.push('La imagen (' + campo + ') debe ser una de: ' + claves.join(', ') + ' o galeria:<id>.');
}

function _validarPantalla(pa, campo, ids, errores) {
  if (!_objeto(pa)) {
    errores.push('La pantalla (' + campo + ') debe ser un objeto.');
    return;
  }
  _unoDe(pa.modo, MODOS_PANTALLA, campo + '.modo', errores);
  if (pa.fondo !== undefined) {
    const fo = pa.fondo;
    const cf = campo + '.fondo';
    if (!_objeto(fo)) {
      errores.push('El fondo (' + cf + ') debe ser un objeto.');
    } else {
      if (!TIPOS_FONDO.includes(fo.tipo)) errores.push('El tipo de fondo (' + cf + '.tipo) debe ser uno de: ' + TIPOS_FONDO.join(', ') + '.');
      if (fo.tipo === 'color' || fo.color !== undefined) {
        if (fo.color === undefined) errores.push('Falta el color del fondo (' + cf + '.color).');
        else _validarColorConBlanco(fo.color, cf + '.color', errores);
      }
      if (fo.tipo === 'imagen' || fo.imagen !== undefined) {
        if (fo.imagen === undefined) errores.push('Falta la imagen del fondo (' + cf + '.imagen).');
        else _validarRefGaleria(fo.imagen, cf + '.imagen', ids, errores);
      }
    }
  }
  _validarImagenElegida(pa.imagen, campo + '.imagen', ids, errores, IMAGENES_PANTALLA);
  _unoDe(pa.distribucion, DISTRIBUCIONES, campo + '.distribucion', errores);
  if (pa.ocultar !== undefined && _lista(pa.ocultar, campo + '.ocultar', ELEMENTOS_OCULTABLES.length, errores)) {
    pa.ocultar.forEach((e, i) => {
      if (!ELEMENTOS_OCULTABLES.includes(e)) errores.push('Ese elemento no se puede ocultar (' + campo + '.ocultar[' + i + ']): solo ' + ELEMENTOS_OCULTABLES.join(', ') + '.');
    });
  }
  if (pa.textos !== undefined) {
    if (!_objeto(pa.textos)) {
      errores.push('Los textos (' + campo + '.textos) deben ser un objeto.');
    } else {
      for (const k of Object.keys(pa.textos)) {
        if (!CLAVES_TEXTOS.includes(k)) errores.push('Ese texto no existe (' + campo + '.textos.' + k + ').');
        else _textoCorto(pa.textos[k], campo + '.textos.' + k, errores, false);
      }
    }
  }
}

function _validarPantallas(pantallas, ids, errores) {
  if (pantallas === undefined) return;
  if (!_objeto(pantallas)) {
    errores.push('Las pantallas (pantallas) deben ser un objeto.');
    return;
  }
  for (const v of Object.keys(pantallas)) {
    if (!VISTAS_PERSONALIZABLES.includes(v)) errores.push('Esa pantalla no existe (pantallas.' + v + '): solo ' + VISTAS_PERSONALIZABLES.join(', ') + '.');
    else _validarPantalla(pantallas[v], 'pantallas.' + v, ids, errores);
  }
}

function _validarRotulos(r, errores) {
  if (r === undefined) return;
  if (!_objeto(r)) {
    errores.push('Los rótulos (rotulos) deben ser un objeto.');
    return;
  }
  _unoDe(r.tipografia, TIPOGRAFIAS, 'rotulos.tipografia', errores);
  _unoDe(r.esquinas, ESQUINAS_ROTULO, 'rotulos.esquinas', errores);
  _unoDe(r.posicion, POSICIONES_ROTULO, 'rotulos.posicion', errores);
  if (r.colorLado !== undefined) _validarColorConBlanco(r.colorLado, 'rotulos.colorLado', errores);
  if (r.cargos !== undefined && _lista(r.cargos, 'rotulos.cargos', 12, errores)) {
    r.cargos.forEach((t, i) => _textoCorto(t, 'rotulos.cargos[' + i + ']', errores, true));
  }
}

function _validarTipoPropio(t, i, claves, ids, errores) {
  const campo = 'tipos.propios[' + i + ']';
  if (!_objeto(t)) {
    errores.push('El tipo (' + campo + ') debe ser un objeto.');
    return;
  }
  if (typeof t.clave !== 'string' || t.clave.length < 2 || t.clave.length > 40 || !RE_SLUG.test(t.clave)) {
    errores.push('La clave del tipo (' + campo + '.clave) debe tener de 2 a 40 letras minúsculas, números y guiones.');
  } else if (CLAVES_COMUNES.includes(t.clave)) {
    errores.push('La clave del tipo (' + campo + '.clave) ya la usa un tipo común.');
  } else if (claves.includes(t.clave)) {
    errores.push('La clave del tipo (' + campo + '.clave) está repetida.');
  } else {
    claves.push(t.clave);
  }
  _textoCorto(t.nombre, campo + '.nombre', errores, true);
  for (const k of ['descripcion', 'titulo', 'ceja', 'cursiva', 'franja', 'esquinaTexto']) _textoCorto(t[k], campo + '.' + k, errores, false);
  _validarImagenElegida(t.imagen, campo + '.imagen', ids, errores, IMAGENES_PANTALLA.filter((k) => k !== 'automatica'));
  _unoDe(t.esquina, ESQUINAS_TIPO, campo + '.esquina', errores);
  if (t.rotulos !== undefined && _lista(t.rotulos, campo + '.rotulos', BASES_ROTULO.length, errores)) {
    t.rotulos.forEach((b, j) => {
      if (!BASES_ROTULO.includes(b)) errores.push('Ese rótulo no existe (' + campo + '.rotulos[' + j + ']): solo ' + BASES_ROTULO.join(', ') + '.');
    });
  }
}

function _validarTipos(tp, ids, errores) {
  if (tp === undefined) return;
  if (!_objeto(tp)) {
    errores.push('Los tipos (tipos) deben ser un objeto.');
    return;
  }
  let apagados = [];
  if (tp.apagados !== undefined && _lista(tp.apagados, 'tipos.apagados', CLAVES_COMUNES.length, errores)) {
    tp.apagados.forEach((k, i) => {
      if (!CLAVES_COMUNES.includes(k)) errores.push('Ese tipo común no existe (tipos.apagados[' + i + ']).');
    });
    apagados = tp.apagados.filter((k) => CLAVES_COMUNES.includes(k));
  }
  let propios = 0;
  if (tp.propios !== undefined && _lista(tp.propios, 'tipos.propios', 10, errores)) {
    const claves = [];
    tp.propios.forEach((t, i) => _validarTipoPropio(t, i, claves, ids, errores));
    propios = tp.propios.length;
  }
  if (propios === 0 && CLAVES_COMUNES.every((k) => apagados.includes(k))) {
    errores.push('No se pueden apagar todos los tipos (tipos.apagados): debe quedar al menos uno disponible.');
  }
}

/* Valida la galería y devuelve los ids válidos, para que otros bloques los referencien. */
function _validarGaleria(g, errores) {
  const ids = [];
  if (g === undefined || !_lista(g, 'galeria', 30, errores)) return ids;
  g.forEach((im, i) => {
    const campo = 'galeria[' + i + ']';
    if (!_objeto(im)) {
      errores.push('La imagen (' + campo + ') debe ser un objeto.');
      return;
    }
    if (typeof im.id !== 'string' || im.id.length < 2 || im.id.length > 40 || !RE_SLUG.test(im.id)) {
      errores.push('El id de la imagen (' + campo + '.id) debe tener de 2 a 40 letras minúsculas, números y guiones.');
    } else if (ids.includes(im.id)) {
      errores.push('El id de la imagen (' + campo + '.id) está repetido.');
    } else {
      ids.push(im.id);
    }
    if (!_texto(im.src)) errores.push('Falta el archivo de la imagen (' + campo + '.src).');
    else if (!RUTA_MEDIO.test(im.src)) errores.push('La ruta de la imagen (' + campo + '.src) debe ser medios/archivo con extensión png, jpg, jpeg, webp o svg.');
    if (!_texto(im.alt)) errores.push('Falta la descripción de la imagen (' + campo + '.alt).');
    else if (im.alt.length > MAX_TEXTO) errores.push('La descripción de la imagen (' + campo + '.alt) pasa de ' + MAX_TEXTO + ' caracteres.');
    if (im.etiquetas !== undefined && _lista(im.etiquetas, campo + '.etiquetas', 10, errores)) {
      im.etiquetas.forEach((e, j) => _textoCorto(e, campo + '.etiquetas[' + j + ']', errores, true));
    }
  });
  return ids;
}

function _validarHorarios(h, errores) {
  if (h === undefined || !_lista(h, 'horarios', 12, errores)) return;
  h.forEach((x, i) => {
    const campo = 'horarios[' + i + ']';
    if (!_objeto(x)) {
      errores.push('El horario (' + campo + ') debe ser un objeto.');
      return;
    }
    _textoCorto(x.dia, campo + '.dia', errores, true);
    _textoCorto(x.hora, campo + '.hora', errores, true);
    _textoCorto(x.nota, campo + '.nota', errores, false);
  });
}

function _validarRedes(r, errores) {
  if (r === undefined || !_lista(r, 'redes', 6, errores)) return;
  r.forEach((x, i) => {
    const campo = 'redes[' + i + ']';
    if (!_objeto(x)) {
      errores.push('La red (' + campo + ') debe ser un objeto.');
      return;
    }
    if (!REDES.includes(x.red)) errores.push('La red (' + campo + '.red) debe ser una de: ' + REDES.join(', ') + '.');
    if (typeof x.url !== 'string' || !RE_HTTPS.test(x.url)) errores.push('La dirección (' + campo + '.url) debe empezar con https://.');
    _textoCorto(x.texto, campo + '.texto', errores, true);
  });
}

/* 'AAAA-MM-DD' que existe en el calendario (con años bisiestos). */
function _fechaValida(v) {
  const m = typeof v === 'string' ? RE_FECHA.exec(v) : null;
  if (!m) return false;
  const a = Number(m[1]);
  const mes = Number(m[2]);
  const d = Number(m[3]);
  if (mes < 1 || mes > 12 || d < 1) return false;
  const bisiesto = (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
  return d <= (mes === 2 && !bisiesto ? 28 : _diasDelMes(mes));
}

function _validarAvisos(av, errores) {
  if (av === undefined || !_lista(av, 'avisos', 10, errores)) return;
  av.forEach((x, i) => {
    const campo = 'avisos[' + i + ']';
    if (!_objeto(x)) {
      errores.push('El aviso (' + campo + ') debe ser un objeto.');
      return;
    }
    _textoCorto(x.texto, campo + '.texto', errores, true);
    _textoCorto(x.detalle, campo + '.detalle', errores, false);
    let fechasOk = true;
    for (const k of ['desde', 'hasta']) {
      if (x[k] !== undefined && !_fechaValida(x[k])) {
        errores.push('La fecha (' + campo + '.' + k + ') debe ser AAAA-MM-DD y existir en el calendario.');
        fechasOk = false;
      }
    }
    if (fechasOk && x.desde !== undefined && x.hasta !== undefined && x.desde > x.hasta) {
      errores.push('La fecha de inicio (' + campo + '.desde) no puede ser posterior al fin (' + campo + '.hasta).');
    }
    if (x.orden !== undefined && !Number.isInteger(x.orden)) errores.push('El orden (' + campo + '.orden) debe ser un número entero.');
  });
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

  const ids = _validarGaleria(c.galeria, errores);
  _validarPantallas(c.pantallas, ids, errores);
  _validarRotulos(c.rotulos, errores);
  _validarTipos(c.tipos, ids, errores);
  _validarHorarios(c.horarios, errores);
  _validarRedes(c.redes, errores);
  _validarAvisos(c.avisos, errores);

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

/* ---------- Cargar, guardar la copia y avisar ---------- */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/* '2026-11-07T12:00:00Z' -> '7 de noviembre de 2026' (hora local de la página). Texto vacío si no es una fecha. */
function _fechaLarga(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
}

/* La copia guardada de ESTA parroquia, o null si no hay, está rota, es de otra parroquia o es la neutra.
   La clave lleva el slug y validarConfig exige que el slug de dentro coincida: dos candados contra datos ajenos. */
function _leerCopia() {
  if (SLUG === null) return null;
  try {
    const c = JSON.parse(localStorage.getItem(claveDe('config_v1')));
    return c && c.version >= 1 && validarConfig(c).ok ? c : null;
  } catch (e) {
    return null;
  }
}

function _guardarCopia(c) {
  try {
    localStorage.setItem(claveDe('config_v1'), JSON.stringify(c));
  } catch (e) {
    /* sin almacenamiento la configuración se usa igual, solo que no queda de respaldo */
  }
}

/* Aviso de que se usa la copia guardada (sin red o sin respuesta). Ya vale desde el arranque. */
function _avisoCopia(fecha) {
  return 'Usando la configuración guardada del ' + fecha;
}

/* La configuración en uso. Al cargar el script: la copia guardada válida de este slug, o la neutra. */
let PARROQUIA = _leerCopia() || CONFIG_NEUTRA;

/* origen: 'servidor' | 'copia' | 'neutra'. fecha: «7 de noviembre de 2026» o null. aviso: texto para el panel ('' si todo bien). */
let ESTADO_CONFIG = PARROQUIA === CONFIG_NEUTRA
  ? { origen: 'neutra', fecha: null, aviso: '' }
  : { origen: 'copia', fecha: _fechaLarga(PARROQUIA.publicado), aviso: _avisoCopia(_fechaLarga(PARROQUIA.publicado)) };

/* true si el slug es inválido, o si el servidor respondió 404 y no hay copia guardada. */
let PARROQUIA_NO_EXISTE = SLUG === null;

const _oyentesParroquia = [];

function alCambiarParroquia(cb) {
  _oyentesParroquia.push(cb);
}

function _avisarParroquia() {
  for (const cb of _oyentesParroquia.slice()) {
    try {
      cb(PARROQUIA);
    } catch (e) {
      console.error(e);
    }
  }
}

/* Estado derivado de lo que hay en PARROQUIA (copia o neutra) con un aviso dado. */
function _estadoSinServidor(aviso) {
  return PARROQUIA === CONFIG_NEUTRA
    ? { origen: 'neutra', fecha: null, aviso: aviso.neutra }
    : { origen: 'copia', fecha: _fechaLarga(PARROQUIA.publicado), aviso: aviso.copia(_fechaLarga(PARROQUIA.publicado)) };
}

const _AVISOS = {
  sinRed: {
    neutra: 'Sin conexión y sin configuración guardada: se muestran pantallas neutras.',
    copia: _avisoCopia
  },
  danada: {
    neutra: 'La configuración del servidor está dañada: se muestran pantallas neutras.',
    copia: () => 'La configuración del servidor está dañada: se usa la guardada.'
  },
  noExiste: {
    neutra: '',
    copia: (f) => 'El link de esta parroquia ya no está en el servidor. Se usa la configuración guardada del ' + f + '.'
  }
};

/* Si el servidor no responde en este tiempo, se cuenta como «sin red» y la vuelta siguiente puede intentar de nuevo. */
const PLAZO_PEDIDO_MS = 20000;

let _pedidoEnVuelo = null;

/* Pide config.json (relativo a la página: /<slug>/config.json). Nunca rechaza: cualquier fallo deja lo que había.
   Avisa a los oyentes si cambia la versión, PARROQUIA_NO_EXISTE o ESTADO_CONFIG; si nada cambió, no avisa. */
async function _cargarParroquia() {
  if (SLUG === null) return;
  const antes = JSON.stringify([PARROQUIA.version, PARROQUIA_NO_EXISTE, ESTADO_CONFIG]);

  let noExiste = false;
  let estado;
  let ctl = null;
  let plazo = null;
  try {
    const opciones = { cache: 'no-store' };
    if (typeof AbortController === 'function') {
      ctl = new AbortController();
      opciones.signal = ctl.signal;
      plazo = setTimeout(() => ctl.abort(), PLAZO_PEDIDO_MS);
    }
    const res = await fetch('config.json', opciones);
    if (res.status === 404) {
      noExiste = PARROQUIA === CONFIG_NEUTRA;
      estado = _estadoSinServidor(_AVISOS.noExiste);
    } else if (!res.ok) {
      estado = _estadoSinServidor(_AVISOS.sinRed);
    } else {
      let c = null;
      try {
        c = await res.json();
      } catch (e) {
        c = null;
      }
      if (c === null || !validarConfig(c).ok) {
        estado = _estadoSinServidor(_AVISOS.danada);
      } else {
        if (c.version !== PARROQUIA.version) {
          _guardarCopia(c);
          PARROQUIA = c;
        }
        estado = { origen: 'servidor', fecha: _fechaLarga(c.publicado), aviso: '' };
      }
    }
  } catch (e) {
    estado = _estadoSinServidor(_AVISOS.sinRed);
  } finally {
    if (plazo !== null) clearTimeout(plazo);
  }

  PARROQUIA_NO_EXISTE = noExiste;
  ESTADO_CONFIG = estado;
  if (JSON.stringify([PARROQUIA.version, PARROQUIA_NO_EXISTE, ESTADO_CONFIG]) !== antes) _avisarParroquia();
}

/* Un solo pedido a la vez: si hay uno en vuelo se devuelve esa misma promesa (así los tics de vigilarParroquia se saltan). */
function cargarParroquia() {
  if (_pedidoEnVuelo === null) {
    _pedidoEnVuelo = _cargarParroquia().finally(() => { _pedidoEnVuelo = null; });
  }
  return _pedidoEnVuelo;
}

/* Carga ahora y vuelve a revisar cada `ms` (60 s: un cambio llega a OBS en uno o dos minutos). */
function vigilarParroquia(ms = 60000) {
  cargarParroquia();
  setInterval(cargarParroquia, ms);
}
