import { exigirAdmin, MENSAJE_SOLO_ADMIN } from '../../../lib/admin';
import { clienteServidor } from '../../../lib/supabase/servidor';

/** Cliente con la sesión de quien visita, o null si no es administrador. */
export async function sesionDeAdmin() {
  const sesion = await clienteServidor();
  return (await exigirAdmin(sesion)) ? sesion : null;
}

export function SoloAdmin() {
  return (
    <main className="tarjeta">
      <h1>Administración</h1>
      <div role="alert" className="resumen-error">
        {MENSAJE_SOLO_ADMIN}
      </div>
    </main>
  );
}
