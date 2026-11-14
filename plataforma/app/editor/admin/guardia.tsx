import { exigirAdmin } from '../../../lib/admin';
import { clienteServidor } from '../../../lib/supabase/servidor';

/** Cliente con la sesión de quien visita, o null si no es administrador. */
export async function sesionDeAdmin() {
  const sesion = await clienteServidor();
  return (await exigirAdmin(sesion)) ? sesion : null;
}
