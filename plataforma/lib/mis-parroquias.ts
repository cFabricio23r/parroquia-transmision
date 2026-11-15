// Las parroquias que ve la persona de la sesión (RLS: un coordinador, las suyas; un admin, todas)
// con el número de su última versión publicada (Decisión 7 del plan 2).
// Nunca lanzan: si PostgREST falla devuelven null, y C1 y C2 muestran «No se pudo cargar» en vez de
// la página de error genérica de Next (revisión).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ParroquiaVisible {
  id: string;
  slug: string;
  nombre: string;
  /** `desactivada_en` no nulo. Solo un admin la ve (RLS); C1 le muestra el chip «Desactivada». */
  desactivada: boolean;
}

export interface ParroquiaElegible extends ParroquiaVisible {
  /** Mayor `versiones.numero`; null si nunca se publicó. No usa parroquias.ultima_version (cuenta reservas). */
  version: number | null;
}

/** Id, slug, nombre y si está desactivada, por nombre. Sin versiones (lo que necesita Mi cuenta). */
export async function parroquiasVisibles(sesion: SupabaseClient): Promise<ParroquiaVisible[] | null> {
  try {
    const { data, error } = await sesion.from('parroquias').select('id, slug, nombre, desactivada_en').order('nombre');
    if (error) return null;
    return ((data ?? []) as { id: string; slug: string; nombre: string; desactivada_en: string | null }[]).map((p) => ({
      id: p.id,
      slug: p.slug,
      nombre: p.nombre,
      desactivada: Boolean(p.desactivada_en),
    }));
  } catch {
    return null;
  }
}

export async function misParroquias(sesion: SupabaseClient): Promise<ParroquiaElegible[] | null> {
  try {
    // Una sola consulta (fix2): la última versión va embebida, `versiones` ordenada desc con limit 1 por
    // parroquia; PostgREST lo resuelve con el índice único (parroquia_id, numero). Antes era una consulta
    // por parroquia y C1 tardaba 12–16 s para un admin con cientos. Traer todas las filas de `versiones`
    // tampoco sirve: PostgREST las corta en max_rows (1000) y el chip mostraría una versión vieja.
    const { data, error } = await sesion
      .from('parroquias')
      .select('id, slug, nombre, desactivada_en, versiones(numero)')
      .order('nombre')
      .order('numero', { referencedTable: 'versiones', ascending: false })
      .limit(1, { referencedTable: 'versiones' });
    if (error) return null;
    type Fila = { id: string; slug: string; nombre: string; desactivada_en: string | null; versiones: { numero: number }[] | null };
    return ((data ?? []) as Fila[]).map((p) => ({
      id: p.id,
      slug: p.slug,
      nombre: p.nombre,
      desactivada: Boolean(p.desactivada_en),
      version: p.versiones?.[0]?.numero ?? null,
    }));
  } catch {
    return null;
  }
}

/** Ids de las parroquias de las que la persona es miembro (RLS deja ver las filas propias de `miembros`). */
export async function idsDeMisMembresias(sesion: SupabaseClient, usuarioId: string): Promise<string[] | null> {
  try {
    const { data, error } = await sesion.from('miembros').select('parroquia_id').eq('usuario_id', usuarioId);
    if (error) return null;
    return ((data ?? []) as { parroquia_id: string }[]).map((f) => f.parroquia_id);
  } catch {
    return null;
  }
}
