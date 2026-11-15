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
  const lista = await parroquiasVisibles(sesion);
  if (!lista) return null;
  if (!lista.length) return [];
  try {
    // Solo la mayor de cada parroquia (ronda 2): traer todas las filas de `versiones` las corta PostgREST
    // en max_rows (1000 en config.toml) en un orden cualquiera, y el chip mostraría una versión vieja.
    // Una consulta por parroquia, en paralelo, usa el índice único (parroquia_id, numero).
    const maximos = await Promise.all(
      lista.map(async (p) => {
        const { data, error } = await sesion
          .from('versiones')
          .select('numero')
          .eq('parroquia_id', p.id)
          .order('numero', { ascending: false })
          .limit(1);
        if (error) return null;
        const fila = (data ?? [])[0] as { numero: number } | undefined;
        return [p.id, fila?.numero] as const;
      }),
    );
    if (maximos.some((m) => m === null)) return null;
    const ultimas = new Map<string, number>();
    for (const m of maximos) if (m && m[1] !== undefined) ultimas.set(m[0], m[1]);
    return lista.map((p) => ({ ...p, version: ultimas.get(p.id) ?? null }));
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
