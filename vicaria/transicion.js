/* La transición con la identidad de la parroquia (pantallas más opciones, #3).
   Un solo código de dibujo para la vista previa del editor, la app y el video que se descarga: la misma
   animación de herramientas/transiciones/stinger.html y stinger_virgen.html (cuatro franjas inclinadas que
   cruzan, el logo con el nombre y dos líneas), pintada en un canvas de 1920×1080 con los colores, el logo y
   el nombre de config.json. Sin DOM: solo usa el contexto 2D que recibe. Necesita paleta() de parroquia.js. */

const TRANSICION_ANCHO = 1920;
const TRANSICION_ALTO = 1080;
const TRANSICION_DURACION = 2;   // segundos; la animación base dura 1,2 s y se estira (render.js)

/* Los cuatro colores de las franjas, del más claro al más oscuro: [claro, celeste, rey, degradado oscuro → rey]. */
function coloresTransicion(principal, oscuro) {
  const p = paleta(principal, oscuro);
  return [p.claro, p.celeste, p.rey, { de: p.oscuro, a: p.rey }];
}

/* ['logo'] o ['logo', 'patrono']: la versión con la imagen del patrono solo si la parroquia la tiene. */
function versionesTransicion(c) {
  const im = c && c.patrono && c.patrono.imagen;
  return im && typeof im.src === 'string' && im.src ? ['logo', 'patrono'] : ['logo'];
}

const _facilT = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const _entreT = (x) => Math.min(1, Math.max(0, x));

/* Parte `texto` en líneas de `ancho` como mucho (por palabras), con la letra que tenga puesta `g`. */
function _lineasT(g, texto, ancho) {
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const w of palabras) {
    const prueba = actual ? actual + ' ' + w : w;
    if (actual && g.measureText(prueba).width > ancho) {
      lineas.push(actual);
      actual = w;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/* El nombre en hasta `maxLineas` líneas de `ancho`; si no cabe, achica la letra (nunca corta). */
function _encajarNombreT(g, texto, peso, tamano, espacio, ancho, maxLineas) {
  let t = tamano;
  for (;;) {
    g.font = peso + ' ' + t + 'px Mont, sans-serif';
    g.letterSpacing = Math.round(espacio * t / tamano) + 'px';
    const lineas = _lineasT(g, texto, ancho);
    const anchas = lineas.some((l) => g.measureText(l).width > ancho);
    if ((lineas.length <= maxLineas && !anchas) || t <= 14) return { tamano: t, lineas: lineas };
    t -= 2;
  }
}

/* Dibuja el cuadro del segundo `t` (0 a 2) en el contexto 2D `g` de 1920×1080, sobre fondo transparente.
   d = { version: 'logo' | 'patrono', colores, nombre, lugar, logo: imagen | null, patrono: imagen | null }.
   Devuelve dónde quedó el nombre: { lineas: [{ texto, x, ancho }] } (x a la izquierda, en px del canvas). */
function dibujarTransicion(g, t, d) {
  const W = TRANSICION_ANCHO, H = TRANSICION_ALTO;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const tiempo = _entreT(t / TRANSICION_DURACION) * 1.2;
  const recorrido = W * 1.6;
  const sesgo = Math.tan(-18 * Math.PI / 180);
  // las franjas: 150 % × 120 % de la pantalla, centradas, inclinadas 18°; entran por la derecha y salen por la izquierda
  for (let i = 0; i < 4; i++) {
    const inS = i * 0.07, inE = inS + 0.36;
    const outS = 0.68 + (3 - i) * 0.05, outE = outS + 0.36;
    const x = tiempo < outS ? (1 - _facilT(_entreT((tiempo - inS) / (inE - inS)))) * recorrido : -_facilT(_entreT((tiempo - outS) / (outE - outS))) * recorrido;
    const w = W * 1.5, h = H * 1.2;
    g.setTransform(1, 0, sesgo, 1, W / 2 + x, H / 2);
    const c = d.colores[i];
    if (typeof c === 'string') g.fillStyle = c;
    else {
      // linear-gradient(135deg, oscuro, rey 60%, …) sobre la caja de la franja
      const l = (w + h) * Math.SQRT1_2 / 2;
      const gr = g.createLinearGradient(-l * Math.SQRT1_2, -l * Math.SQRT1_2, l * Math.SQRT1_2, l * Math.SQRT1_2);
      gr.addColorStop(0, c.de);
      gr.addColorStop(0.6, c.a);
      gr.addColorStop(1, c.a);
      g.fillStyle = gr;
    }
    g.fillRect(-w / 2, -h / 2, w, h);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);

  // el logo y el nombre: aparecen con la franja oscura y salen con ella
  const lin = _entreT((tiempo - 0.40) / 0.15), lout = _entreT((tiempo - 0.68) / 0.14);
  const op = lin * (1 - lout);
  const escala = 0.86 + 0.14 * _facilT(lin) + 0.06 * lout;
  const lk = _entreT((tiempo - 0.42) / 0.35);
  const claroLinea = typeof d.colores[0] === 'string' ? d.colores[0] : '#8cc0ef';
  const sub = d.colorLugar || claroLinea;
  const salida = { lineas: [] };

  // las dos líneas, como .line de stinger.html
  if (op > 0) {
    g.globalAlpha = op;
    [430, 650].forEach((y, j) => {
      const k = 0.3 + 0.7 * _facilT(lk);
      const dx = (j ? -1 : 1) * (1 - _facilT(lk)) * 600;
      g.setTransform(k, 0, 0, 1, W / 2 + dx, 0);
      const gr = g.createLinearGradient(-W / 2, 0, W / 2, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.5, claroLinea);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(-W / 2, y, W, 4);
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // el bloque se mide siempre (también invisible), para poder decir dónde queda el nombre
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  const nombre = String(d.nombre || '').toUpperCase();
  const lugar = String(d.lugar || '').toUpperCase();
  const dibujar = op > 0;
  if (dibujar) {
    g.globalAlpha = op;
    g.setTransform(escala, 0, 0, escala, W / 2 * (1 - escala), H / 2 * (1 - escala));
  }
  if (d.version === 'patrono' && d.patrono) {
    // stinger_virgen.html: la imagen a la izquierda (860 px de alto), el logo y el nombre a la derecha
    const ph = 860, pw = Math.min(900, ph * (d.patrono.naturalWidth || d.patrono.width || 1) / (d.patrono.naturalHeight || d.patrono.height || 1));
    const n = _encajarNombreT(g, nombre, 800, 44, 4, 760, 3);
    const altoLinea = Math.round(n.tamano * 1.1);
    const logoH = d.logo ? 110 : 0;
    const anchoLogo = d.logo ? logoH * (d.logo.naturalWidth || d.logo.width || 1) / (d.logo.naturalHeight || d.logo.height || 1) : 0;
    g.font = '600 22px Mont, sans-serif'; g.letterSpacing = '8px';
    const anchoLugar = lugar ? g.measureText(lugar).width : 0;
    g.font = '800 ' + n.tamano + 'px Mont, sans-serif'; g.letterSpacing = Math.round(4 * n.tamano / 44) + 'px';
    const anchos = n.lineas.map((l) => g.measureText(l).width);
    const col = Math.max(anchoLogo, anchoLugar, ...anchos);
    const fila = pw + 60 + col;
    const x0 = Math.max(0, W / 2 - fila / 2);
    const xc = x0 + pw + 60;
    const altoCol = logoH + (logoH ? 18 : 0) + n.lineas.length * altoLinea + (lugar ? 18 + 27 : 0);
    let y = H / 2 - altoCol / 2;
    if (dibujar) {
      g.save();
      g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 40; g.shadowOffsetY = 20;
      g.drawImage(d.patrono, x0, H / 2 - ph / 2, pw, ph);
      g.restore();
      if (d.logo) g.drawImage(d.logo, xc, y, anchoLogo, logoH);
    }
    y += logoH + (logoH ? 18 : 0);
    n.lineas.forEach((l, i) => {
      y += altoLinea;
      if (dibujar) g.fillText(l, xc, y - Math.round(altoLinea * 0.2));
      salida.lineas.push({ texto: l, x: xc, ancho: anchos[i] });
    });
    if (lugar && dibujar) {
      g.font = '600 22px Mont, sans-serif'; g.letterSpacing = '8px'; g.fillStyle = sub;
      g.fillText(lugar, xc, y + 18 + 22);
    }
  } else {
    // stinger.html: el logo (170 px de alto) arriba, el nombre y el lugar debajo, centrados
    const n = _encajarNombreT(g, nombre, 800, 34, 6, 1600, 2);
    const altoLinea = Math.round(n.tamano * 1.25);
    const logoH = d.logo ? 170 : 0;
    const anchoLogo = d.logo ? logoH * (d.logo.naturalWidth || d.logo.width || 1) / (d.logo.naturalHeight || d.logo.height || 1) : 0;
    const alto = logoH + (logoH ? 22 : 0) + n.lineas.length * altoLinea + (lugar ? 22 + 27 : 0);
    let y = H / 2 - alto / 2;
    if (dibujar && d.logo) g.drawImage(d.logo, W / 2 - anchoLogo / 2, y, anchoLogo, logoH);
    y += logoH + (logoH ? 22 : 0);
    g.font = '800 ' + n.tamano + 'px Mont, sans-serif'; g.letterSpacing = Math.round(6 * n.tamano / 34) + 'px';
    for (const l of n.lineas) {
      const a = g.measureText(l).width;
      y += altoLinea;
      if (dibujar) g.fillText(l, W / 2 - a / 2, y - Math.round(altoLinea * 0.22));
      salida.lineas.push({ texto: l, x: W / 2 - a / 2, ancho: a });
    }
    if (lugar && dibujar) {
      g.font = '600 22px Mont, sans-serif'; g.letterSpacing = '8px'; g.fillStyle = sub;
      const a = g.measureText(lugar).width;
      g.fillText(lugar, W / 2 - a / 2, y + 22 + 22);
    }
  }
  g.restore();
  return salida;
}

/* El sonido de la transición: el mismo de render.js (soplo suave + campanita, misma semilla), en dos canales
   de `frecuencia` muestras por segundo durante `duracion` s, con el pico en 0,6. */
function sonidoTransicion(frecuencia, duracion) {
  const sr = frecuencia, D = duracion, n = Math.floor(sr * D), s = D / 1.2;
  let semilla = 7;
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) % 4294967296; return semilla / 4294967296 * 2 - 1; };
  const L = new Float32Array(n), R = new Float32Array(n);
  let p = 0, q = 0, max = 0;
  const mezcla = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = Math.exp(-(((t - 0.42 * s) / (0.17 * s)) ** 2)) * 0.9 + Math.exp(-(((t - 0.86 * s) / (0.15 * s)) ** 2)) * 0.6;
    const corte = 600 + 3400 * Math.exp(-(((t - 0.45 * s) / (0.2 * s)) ** 2)) + 1800 * Math.exp(-(((t - 0.86 * s) / (0.18 * s)) ** 2));
    const a = 1 - Math.exp(-2 * Math.PI * corte / sr);
    p += a * (azar() - p); q += a * (p - q);
    mezcla[i] = (p - 0.6 * q) * env;
    max = Math.max(max, Math.abs(mezcla[i]));
  }
  const t0 = 0.55 * s; let maxC = 0; const camp = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const tt = i / sr - t0; if (tt < 0) continue;
    let c = 0;
    for (const [f, amp] of [[1318.5, 1], [1975.5, 0.45], [2637, 0.25], [659.25, 0.35]]) c += amp * Math.sin(2 * Math.PI * f * tt) * Math.exp(-tt * 3.0);
    camp[i] = c * Math.min(1, tt / 0.004); maxC = Math.max(maxC, Math.abs(camp[i]));
  }
  let maxF = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const m = (0.55 * mezcla[i] / max + 0.35 * camp[i] / maxC) * Math.min(1, Math.max(0, (D - t) / 0.2));
    const pan = 1 - t / D;
    L[i] = m * (0.6 + 0.4 * (1 - pan)); R[i] = m * (0.6 + 0.4 * pan);
    maxF = Math.max(maxF, Math.abs(L[i]), Math.abs(R[i]));
  }
  for (let i = 0; i < n; i++) { L[i] = L[i] / maxF * 0.6; R[i] = R[i] / maxF * 0.6; }
  return { izq: L, der: R };
}
