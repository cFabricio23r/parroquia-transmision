import { listarParroquias } from '../../../lib/admin-parroquias';
import { clienteServicio } from '../../../lib/supabase/servicio';
import { TablaParroquias } from './TablaParroquias';

export const metadata = { title: 'Parroquias · Administración · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** D1 · Parroquias (AB/VicAdminParroquias). El layout ya comprobó que quien entra es admin. */
export default async function Parroquias() {
  const filas = await listarParroquias(clienteServicio());
  return (
    <main className="pv-admin">
      <TablaParroquias filas={filas} />
    </main>
  );
}
