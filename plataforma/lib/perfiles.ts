// Nombre de cada persona (tabla `perfiles`). Sin dependencias de Next: recibe el cliente.
import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_NOMBRE = 80;
export const MENSAJE_NOMBRE_VACIO = 'Escribe tu nombre.';
export const MENSAJE_NOMBRE_LARGO = `El nombre puede tener hasta ${MAX_NOMBRE} caracteres.`;
const MENSAJE_FALLO = 'No se pudo guardar. Intenta de nuevo';
const MENSAJE_SESION = 'Tu sesión venció. Entra de nuevo';

/**
 * Recorta y colapsa los espacios internos; de 1 a 80 caracteres (Decisión 9 del plan 2).
 * El largo se cuenta en puntos de código, como char_length de Postgres (un emoji cuenta uno).
 */
export function validarNombre(crudo: string): { nombre: string } | { error: string } {
  const nombre = String(crudo ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre) return { error: MENSAJE_NOMBRE_VACIO };
  if (Array.from(nombre).length > MAX_NOMBRE) return { error: MENSAJE_NOMBRE_LARGO };
  return { nombre };
}

/** El nombre guardado de `usuarioId`, o null si no tiene o RLS no deja verlo. */
export async function leerNombre(cliente: SupabaseClient, usuarioId: string): Promise<string | null> {
  const { data } = await cliente.from('perfiles').select('nombre').eq('usuario_id', usuarioId).maybeSingle();
  return (data as { nombre: string } | null)?.nombre ?? null;
}

/** Guarda el nombre de la persona de la sesión. */
export async function guardarNombre(sesion: SupabaseClient, crudo: string): Promise<{ error?: string }> {
  const v = validarNombre(crudo);
  if ('error' in v) return { error: v.error };
  const { data } = await sesion.auth.getUser();
  const id = data.user?.id;
  if (!id) return { error: MENSAJE_SESION };
  const { error } = await sesion
    .from('perfiles')
    .upsert({ usuario_id: id, nombre: v.nombre, actualizado_en: new Date().toISOString() }, { onConflict: 'usuario_id' });
  if (error) {
    console.error('[guardarNombre]', error.message);
    return { error: MENSAJE_FALLO };
  }
  return {};
}
