/**
 * Direcciones que la app deja abrir y cómo se arman las de una parroquia.
 *
 * Los WebViews permiten solo `file:///android_asset/` y el origen EXACTO de la plataforma:
 * se compara `scheme://host[:puerto]` completo, nunca con `startsWith`. No se usa `URL`
 * porque el de React Native es parcial (no verificado en 0.88): todo va con regex.
 */

/** Igual que el check de `parroquias.slug`: minúsculas, números y guiones sueltos, de 3 a 40. */
export const RE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** La de `vicaria/parroquia.js` (l.193): un archivo directo dentro de `medios/`. */
export const RUTA_MEDIO = /^medios\/[A-Za-z0-9._-]+\.(png|jpe?g|webp|svg)$/i;

const RE_ORIGEN = /^https:\/\/([a-z0-9-]+(\.[a-z0-9-]+)+)(:\d{1,5})?\/?$/;
const RE_ORIGEN_DE_URL = /^([a-z]+:\/\/[^/?#]*)/;
const ASSETS = 'file:///android_asset/';

/** `https://host[:puerto]` en minúsculas y sin barra final, o null si no es un origen https limpio. */
export function normalizarOrigen(texto: string): string | null {
  const m = RE_ORIGEN.exec(texto.trim().toLowerCase());
  if (!m) return null;
  return 'https://' + m[1] + (m[3] ?? '');
}

export function esUrlPermitida(url: string | undefined, origen: string): boolean {
  if (typeof url !== 'string' || url === '') return false;
  if (url.startsWith(ASSETS)) return true;
  const permitido = normalizarOrigen(origen);
  if (!permitido) return false;
  const m = RE_ORIGEN_DE_URL.exec(url.toLowerCase());
  return m !== null && m[1] === permitido;
}

export function esSlugValido(s: string): boolean {
  return typeof s === 'string' && s.length >= 3 && s.length <= 40 && RE_SLUG.test(s);
}

export function esRutaDeMedio(r: string): boolean {
  return typeof r === 'string' && RUTA_MEDIO.test(r);
}

/** `<origen>/<slug>/<resto>`. Lanza si el slug no es válido: nunca se arma la dirección de otra carpeta. */
export function urlDePagina(origen: string, slug: string, resto: string): string {
  if (!esSlugValido(slug)) throw new Error('slug inválido');
  return origen.replace(/\/+$/, '') + '/' + slug + '/' + resto.replace(/^\/+/, '');
}
