// Guardar el borrador de una parroquia y subir sus imágenes. Sin dependencias de Next:
// recibe el cliente con la sesión de quien actúa, así se prueba contra el Supabase local.
// Los envoltorios están en app/editor/api/[slug]/.
// Quién puede qué lo decide la base (RLS): `parroquias_leer` deja ver la parroquia solo a sus
// miembros y a los administradores, y `puede_usar_borrador` hace lo mismo con el Storage.
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MAX_BYTES_IMAGEN, revisarImagen } from './imagenes';
import { validarBorrador } from './validar';

/** Claves del borrador que edita el formulario de identidad. El resto (pantallas, avisos, tipos…) no se toca. */
export const CAMPOS_IDENTIDAD = ['nombre', 'nombreCorto', 'lugar', 'colores', 'logos', 'fachada', 'patrono', 'fiesta'] as const;

const MAX_CARACTERES_CUERPO = 100 * 1024;
export const SEGUNDOS_URL_FIRMADA = 3600;

export const MENSAJE_SIN_SESION = 'Tu sesión venció. Entra de nuevo';
export const MENSAJE_SIN_PERMISO = 'No tienes permiso para editar esta parroquia';
export const MENSAJE_CONFLICTO =
  'Otra persona guardó cambios mientras editabas. Recarga la página para ver la versión nueva';
const MENSAJE_FALLO = 'No se pudo completar. Intenta de nuevo';

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Reemplaza solo las claves de identidad que vienen en `cambios` y conserva todo lo demás del borrador.
 * Una clave de identidad con valor `null` se quita (así se borra un campo opcional). No muta los argumentos.
 */
export function aplicarIdentidad(borrador: object, cambios: object): object {
  const resultado: Record<string, unknown> = { ...(borrador as Record<string, unknown>) };
  const nuevos = cambios as Record<string, unknown>;
  for (const clave of CAMPOS_IDENTIDAD) {
    if (!Object.prototype.hasOwnProperty.call(nuevos, clave)) continue;
    if (nuevos[clave] === null || nuevos[clave] === undefined) delete resultado[clave];
    else resultado[clave] = nuevos[clave];
  }
  return resultado;
}

export interface Respuesta<T> {
  estado: number;
  cuerpo: T;
}
export type ConError = { error: string };
export const conError = (estado: number, mensaje: string): Respuesta<ConError> => ({ estado, cuerpo: { error: mensaje } });

export function fallo(donde: string, e: unknown): Respuesta<ConError> {
  console.error(`[${donde}]`, e instanceof Error ? e.message : (e as { message?: string })?.message ?? e);
  return conError(500, MENSAJE_FALLO);
}

export type Acceso = { ok: true; parroquiaId: string; usuarioId: string } | { ok: false; respuesta: Respuesta<ConError> };

/** 401 sin sesión; 403 si la parroquia no existe o no es de quien actúa (no se distingue: no se filtra su existencia). */
export async function comprobarAcceso(sesion: SupabaseClient, slug: string): Promise<Acceso> {
  const { data: usuario } = await sesion.auth.getUser();
  if (!usuario.user) return { ok: false, respuesta: conError(401, MENSAJE_SIN_SESION) };
  const { data, error } = await sesion.from('parroquias').select('id').eq('slug', slug).maybeSingle();
  if (error) return { ok: false, respuesta: fallo('comprobarAcceso', error) };
  if (!data) return { ok: false, respuesta: conError(403, MENSAJE_SIN_PERMISO) };
  return { ok: true, parroquiaId: data.id, usuarioId: usuario.user.id };
}

export interface GuardadoOk {
  actualizadoEn: string;
  errores: string[];
}

/**
 * Guarda los cambios de identidad. `actualizadoEn` es el valor que el cliente leyó: el guardado solo
 * ocurre si sigue siendo el de la base (UPDATE condicionado, atómico). Guardar con errores de
 * validación está permitido; publicar no.
 */
export async function guardarBorrador(
  sesion: SupabaseClient,
  slug: string,
  entrada: unknown,
): Promise<Respuesta<GuardadoOk | ConError>> {
  try {
    const acceso = await comprobarAcceso(sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    if (JSON.stringify(entrada ?? null).length > MAX_CARACTERES_CUERPO) return conError(400, 'Los cambios son demasiado grandes.');
    if (!esObjeto(entrada) || !esObjeto(entrada.cambios) || typeof entrada.actualizadoEn !== 'string' || !entrada.actualizadoEn) {
      return conError(400, 'La petición no es válida.');
    }
    const { data: actual, error: errorLectura } = await sesion
      .from('borradores')
      .select('config')
      .eq('parroquia_id', acceso.parroquiaId)
      .maybeSingle();
    if (errorLectura) throw errorLectura;
    if (!actual) return conError(404, 'Esta parroquia todavía no tiene borrador.');

    const config = aplicarIdentidad(actual.config as object, entrada.cambios);
    // El candado va en el propio UPDATE: si otra persona guardó antes, no se actualiza ninguna fila.
    // actualizado_en y actualizado_por los fija un disparador de la base, no el cliente.
    const { data: filas, error: errorGuardar } = await sesion
      .from('borradores')
      .update({ config })
      .eq('parroquia_id', acceso.parroquiaId)
      .eq('actualizado_en', entrada.actualizadoEn)
      .select('actualizado_en');
    if (errorGuardar) {
      // Un valor que no es una fecha no es un conflicto: la petición está mal hecha.
      if (errorGuardar.code === '22007' || errorGuardar.code === '22008') return conError(400, 'La petición no es válida.');
      throw errorGuardar;
    }
    if (!filas || filas.length === 0) return conError(409, MENSAJE_CONFLICTO);
    return {
      estado: 200,
      cuerpo: { actualizadoEn: filas[0].actualizado_en as string, errores: validarBorrador(config, slug).errores },
    };
  } catch (e) {
    return fallo('guardarBorrador', e);
  }
}

export const TIPOS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};
const RE_CAMPO = /^[a-z][a-z0-9-]{0,29}$/;

/** Lo que el envoltorio sacó del formulario multipart (o el motivo por el que no pudo). */
export type EntradaImagen = { campo: string; bytes: Uint8Array } | { error: string };

/**
 * Sube una imagen a `borradores/<parroquia_id>/`. Primero se comprueba el permiso (nada se lee ni se
 * sube antes), luego `revisarImagen` (tipo real, 3 MB, SVG sin código, EXIF fuera). Devuelve el `src`
 * para el borrador y una URL firmada de 1 hora para mostrar la imagen.
 */
export async function subirImagen(
  sesion: SupabaseClient,
  slug: string,
  leer: () => Promise<EntradaImagen>,
): Promise<Respuesta<{ src: string; url: string } | ConError>> {
  try {
    const acceso = await comprobarAcceso(sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const entrada = await leer();
    if ('error' in entrada) return conError(400, entrada.error);
    if (!RE_CAMPO.test(entrada.campo)) return conError(400, 'El campo de la imagen no es válido.');
    const revisada = await revisarImagen(entrada.bytes, entrada.campo);
    if (!revisada.ok) return conError(400, revisada.error);

    const archivo = `${entrada.campo}-${randomBytes(4).toString('hex')}.${revisada.extension}`;
    const ruta = `${acceso.parroquiaId}/${archivo}`;
    const { error: errorSubida } = await sesion.storage
      .from('borradores')
      .upload(ruta, revisada.bytes, { contentType: TIPOS[revisada.extension], upsert: false });
    if (errorSubida) throw errorSubida;
    const { data: firmada, error: errorFirma } = await sesion.storage
      .from('borradores')
      .createSignedUrl(ruta, SEGUNDOS_URL_FIRMADA);
    if (errorFirma || !firmada) throw errorFirma ?? new Error('sin URL firmada');
    return { estado: 200, cuerpo: { src: `medios/${archivo}`, url: firmada.signedUrl } };
  } catch (e) {
    return fallo('subirImagen', e);
  }
}

/** Tope del cuerpo de una subida: la imagen más el sobre multipart. Lo usa el envoltorio antes de leerlo. */
export const MAX_BYTES_SUBIDA = MAX_BYTES_IMAGEN + 512 * 1024;
