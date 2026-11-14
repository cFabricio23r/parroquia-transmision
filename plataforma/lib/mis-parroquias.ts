// Las parroquias que ve la persona de la sesión (RLS: un coordinador, las suyas; un admin, todas)
// con el número de su última versión publicada (Decisión 7 del plan 2).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ParroquiaElegible {
  id: string;
  slug: string;
  nombre: string;
  /** Mayor `versiones.numero`; null si nunca se publicó. No usa parroquias.ultima_version (cuenta reservas). */
  version: number | null;
}

/** Mayor número de versión por parroquia. */
export function ultimaVersionPorParroquia(filas: { parroquia_id: string; numero: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of filas) {
    const actual = m.get(f.parroquia_id);
    if (actual === undefined || f.numero > actual) m.set(f.parroquia_id, f.numero);
  }
  return m;
}

export async function misParroquias(sesion: SupabaseClient): Promise<ParroquiaElegible[]> {
  const { data: parroquias, error } = await sesion.from('parroquias').select('id, slug, nombre').order('nombre');
  if (error) throw error;
  const lista = (parroquias ?? []) as { id: string; slug: string; nombre: string }[];
  if (!lista.length) return [];
  // RLS ya limita las versiones a las parroquias visibles (sin .in(): con muchas parroquias la URL crece).
  const { data: versiones, error: errorVersiones } = await sesion.from('versiones').select('parroquia_id, numero');
  if (errorVersiones) throw errorVersiones;
  const ultimas = ultimaVersionPorParroquia((versiones ?? []) as { parroquia_id: string; numero: number }[]);
  return lista.map((p) => ({ ...p, version: ultimas.get(p.id) ?? null }));
}

/** Ids de las parroquias de las que la persona es miembro (RLS deja ver las filas propias de `miembros`). */
export async function idsDeMisMembresias(sesion: SupabaseClient, usuarioId: string): Promise<string[]> {
  const { data, error } = await sesion.from('miembros').select('parroquia_id').eq('usuario_id', usuarioId);
  if (error) throw error;
  return ((data ?? []) as { parroquia_id: string }[]).map((f) => f.parroquia_id);
}
