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

export async function misParroquias(sesion: SupabaseClient): Promise<ParroquiaElegible[]> {
  const { data: parroquias, error } = await sesion.from('parroquias').select('id, slug, nombre').order('nombre');
  if (error) throw error;
  const lista = (parroquias ?? []) as { id: string; slug: string; nombre: string }[];
  if (!lista.length) return [];
  // Solo la mayor de cada parroquia (ronda 2): traer todas las filas de `versiones` las corta PostgREST
  // en max_rows (1000 en config.toml) en un orden cualquiera, y el chip mostraría una versión vieja.
  // Una consulta por parroquia, en paralelo, usa el índice único (parroquia_id, numero).
  const maximos = await Promise.all(
    lista.map(async (p) => {
      const { data, error: errorVersion } = await sesion
        .from('versiones')
        .select('numero')
        .eq('parroquia_id', p.id)
        .order('numero', { ascending: false })
        .limit(1);
      if (errorVersion) throw errorVersion;
      const fila = (data ?? [])[0] as { numero: number } | undefined;
      return [p.id, fila?.numero] as const;
    }),
  );
  const ultimas = new Map<string, number>();
  for (const [id, n] of maximos) if (n !== undefined) ultimas.set(id, n);
  return lista.map((p) => ({ ...p, version: ultimas.get(p.id) ?? null }));
}

/** Ids de las parroquias de las que la persona es miembro (RLS deja ver las filas propias de `miembros`). */
export async function idsDeMisMembresias(sesion: SupabaseClient, usuarioId: string): Promise<string[]> {
  const { data, error } = await sesion.from('miembros').select('parroquia_id').eq('usuario_id', usuarioId);
  if (error) throw error;
  return ((data ?? []) as { parroquia_id: string }[]).map((f) => f.parroquia_id);
}
