import { listarParroquias } from '../../../lib/admin-parroquias';
import { servicioDeAdmin } from './guardia';
import { TablaParroquias } from './TablaParroquias';

export const metadata = { title: 'Parroquias · Administración · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** D1 · Parroquias (AB/VicAdminParroquias). Sin admin no lee nada (el layout muestra el aviso). */
export default async function Parroquias() {
  const servicio = await servicioDeAdmin();
  if (!servicio) return null;
  const filas = await listarParroquias(servicio);
  return (
    <main className="pv-admin">
      <TablaParroquias filas={filas} />
    </main>
  );
}
