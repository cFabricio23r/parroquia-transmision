// Ayudas de las imágenes y colores de Identidad (plan 3, Tarea 12). Sin React: se prueban solas.
import { contraste } from '../contraste';
import { MENSAJES_ACCESO } from '../mensajes-acceso';

export const RE_HEX = /^#[0-9a-fA-F]{6}$/;
export const MENSAJE_HEX = 'Escribe el color como #rrggbb.';
export const MENSAJE_ALT_VACIO = 'Escribe la descripción.';
/** El mismo texto de la tarjeta «Sesión cerrada» (A5). */
export const MENSAJE_SESION = MENSAJES_ACCESO['sesion-cerrada'].texto;
export const MENSAJE_RED_SUBIDA = 'No se pudo subir. Revisa tu conexión y vuelve a intentarlo.';
export const TIPOS_IMAGEN = 'image/png,image/jpeg,image/webp,image/svg+xml';

const OSCURO = '#14223a';
const CLARO = '#ffffff';

/** Decisión 20: el texto (oscuro o claro) que más contrasta sobre el acento. */
export function textoSobreAcento(hex: string): { etiqueta: string; razon: number } {
  const oscuro = contraste(hex, OSCURO);
  const claro = contraste(hex, CLARO);
  return oscuro >= claro
    ? { etiqueta: 'Sobre acento, texto oscuro', razon: oscuro }
    : { etiqueta: 'Sobre acento, texto claro', razon: claro };
}

export type ResultadoSubida = { src: string; url: string } | { error: string; estado: number };

/** Sube una imagen al borrador (`POST /editor/api/<slug>/imagen`). Nunca lanza: devuelve el error. */
export async function subirImagen(slug: string, campo: string, archivo: File, f: typeof fetch = fetch): Promise<ResultadoSubida> {
  const cuerpo = new FormData();
  cuerpo.append('archivo', archivo);
  cuerpo.append('campo', campo);
  let r: Response;
  try {
    r = await f(`/editor/api/${slug}/imagen`, { method: 'POST', body: cuerpo });
  } catch {
    return { error: MENSAJE_RED_SUBIDA, estado: 0 };
  }
  let datos: { src?: unknown; url?: unknown; error?: unknown } = {};
  try {
    datos = await r.json();
  } catch {
    // sin cuerpo JSON
  }
  if (r.status === 401) return { error: MENSAJE_SESION, estado: 401 };
  if (r.status === 200 && typeof datos.src === 'string' && typeof datos.url === 'string') return { src: datos.src, url: datos.url };
  return { error: typeof datos.error === 'string' ? datos.error : MENSAJE_RED_SUBIDA, estado: r.status };
}

/** Un texto de Identidad para el borrador: en un campo opcional, vacío o solo espacios quita la clave. */
export function textoDeBloque(v: string, quitarVacio: boolean): string | undefined {
  return quitarVacio && v.trim() === '' ? undefined : v;
}
