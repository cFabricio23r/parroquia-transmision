import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirAdmin } from '../../../lib/admin';
import { clienteServicio } from '../../../lib/supabase/servicio';
import { clienteServidor } from '../../../lib/supabase/servidor';

/** Cliente con la sesión de quien visita, o null si no es administrador. */
export async function sesionDeAdmin() {
  const sesion = await clienteServidor();
  return (await exigirAdmin(sesion)) ? sesion : null;
}

/**
 * Cliente de servicio (salta RLS) solo si quien visita es administrador; si no, null. Las páginas del
 * admin leen únicamente con este: el layout cambia `children` por un aviso, pero Next igual ejecuta la
 * página y manda lo que devuelve en el HTML y en el RSC (ronda 2 del plan 5).
 */
export async function servicioDeAdmin(): Promise<SupabaseClient | null> {
  return (await sesionDeAdmin()) ? clienteServicio() : null;
}
