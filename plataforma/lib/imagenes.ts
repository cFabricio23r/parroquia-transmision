import sharp from 'sharp';

export const MAX_BYTES_IMAGEN = 3 * 1024 * 1024;
export const MAX_PIXELES_IMAGEN = 40_000_000;

export type Extension = 'png' | 'jpg' | 'webp' | 'svg';
export type ResultadoImagen =
  | { ok: true; bytes: Uint8Array; extension: Extension }
  | { ok: false; error: string };

function detectar(b: Uint8Array): Extension | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') {
    return 'webp';
  }
  return null;
}

// Un SVG puede llevar código: se rechaza (no se "limpia") todo lo que ejecute o cargue algo de fuera.
const PELIGROS_SVG: Array<[RegExp, string]> = [
  // Los elementos pueden llevar prefijo de espacio de nombres (<s:script>, <h:iframe>).
  [/<\s*(?:[\w.-]+:)?script\b/i, 'lleva un <script>'],
  [/<\s*(?:[\w.-]+:)?foreignObject\b/i, 'lleva <foreignObject>'],
  [/<\s*(?:[\w.-]+:)?(?:iframe|embed|object)\b/i, 'lleva contenido incrustado'],
  // Animaciones: pueden cambiar un href a otro valor en tiempo de ejecución.
  [/<\s*(?:[\w.-]+:)?(?:set|animate|animateMotion|animateTransform)\b/i, 'lleva animaciones (set o animate)'],
  // Las referencias numéricas (&#106;) esconden texto como "javascript:": se rechazan todas.
  [/&#/, 'lleva referencias numéricas de caracteres (&#...)'],
  [/[\s/"']on[a-z]+\s*=/i, 'lleva un evento (como onload)'],
  [/<!\s*(ENTITY|DOCTYPE)/i, 'lleva una declaración DOCTYPE o ENTITY'],
  [/javascript\s*:/i, 'lleva un enlace javascript:'],
  [/(?:xlink:)?href\s*=\s*["']\s*(?!#)/i, 'enlaza a algo de fuera (href)'],
  [/url\(\s*["']?\s*(?!#)/i, 'carga recursos de fuera (url())'],
  [/@import/i, 'lleva @import'],
];

function revisarSvg(bytes: Uint8Array, campo: string): ResultadoImagen | null {
  const texto = new TextDecoder('utf-8').decode(bytes);
  // Debe empezar (tras BOM, declaración XML y comentarios) con <svg.
  const inicio = texto
    .replace(/^﻿/, '')
    .replace(/^\s*(<\?xml[\s\S]*?\?>|<!--[\s\S]*?-->|\s)*/i, '');
  if (!/^<svg[\s>]/i.test(inicio)) return null;
  for (const [patron, motivo] of PELIGROS_SVG) {
    if (patron.test(texto)) {
      return { ok: false, error: `${campo}: el SVG no es seguro porque ${motivo}. Sube un SVG sin scripts ni enlaces externos.` };
    }
  }
  return { ok: true, bytes, extension: 'svg' };
}

/**
 * Revisa una imagen subida: tipo real por sus primeros bytes (no por el nombre), tamaño,
 * SVG sin código, y para PNG/JPG/WebP la vuelve a codificar con sharp, que quita todo el
 * metadato (EXIF con GPS incluido) y aplica la orientación.
 */
export async function revisarImagen(bytes: Uint8Array, campo: string): Promise<ResultadoImagen> {
  if (bytes.length > MAX_BYTES_IMAGEN) {
    return { ok: false, error: `${campo}: la imagen pesa más de 3 MB. Reduce su tamaño y vuelve a subirla.` };
  }
  const tipo = detectar(bytes);
  if (tipo === null) {
    const svg = revisarSvg(bytes, campo);
    return svg ?? { ok: false, error: `${campo}: el archivo no es una imagen PNG, JPG, WebP ni SVG.` };
  }
  try {
    // Sin withMetadata()/keepExif(), sharp descarta EXIF, XMP e IPTC. rotate() sin ángulo orienta según EXIF.
    const base = sharp(bytes, { limitInputPixels: MAX_PIXELES_IMAGEN }).rotate();
    const salida =
      tipo === 'png' ? base.png() : tipo === 'jpg' ? base.jpeg({ quality: 90 }) : base.webp({ quality: 90 });
    const limpio = await salida.toBuffer();
    return { ok: true, bytes: new Uint8Array(limpio), extension: tipo };
  } catch (e) {
    if (/pixel limit/i.test(String(e))) {
      return { ok: false, error: `${campo}: la imagen tiene demasiados píxeles (máximo 40 millones). Redúcela y vuelve a subirla.` };
    }
    return { ok: false, error: `${campo}: la imagen está dañada o no se pudo leer.` };
  }
}
