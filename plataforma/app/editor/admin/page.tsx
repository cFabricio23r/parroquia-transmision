import { listarParroquias } from '../../../lib/admin-parroquias';
import { leerEstadosFacebook, type EstadoFacebook } from '../../../lib/facebook/asignaciones';
import { clienteServidor } from '../../../lib/supabase/servidor';
import { servicioDeAdmin } from './guardia';
import { TablaParroquias } from './TablaParroquias';
import { TarjetaFacebookAdmin } from './TarjetaFacebookAdmin';

export const metadata = { title: 'Parroquias · Administración · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** D1 · Parroquias (AB/VicAdminParroquias). Sin admin no lee nada (el layout muestra el aviso). */
export default async function Parroquias() {
  const servicio = await servicioDeAdmin();
  if (!servicio) return null;
  const filas = await listarParroquias(servicio);
  // La columna «Facebook» (E1) no tumba la tabla: si no se puede leer, la celda lo dice. Sin tokens ni page_id.
  let facebook: Record<string, EstadoFacebook> | null = null;
  try {
    const estados = await leerEstadosFacebook({ sesion: await clienteServidor(), servicio });
    if (estados.estado === 200) facebook = estados.cuerpo as Record<string, EstadoFacebook>;
  } catch {
    console.error('[parroquias] no se pudo leer la columna de Facebook');
  }
  return (
    <main className="pv-admin">
      <TablaParroquias filas={filas} facebook={facebook} />
      <TarjetaFacebookAdmin />
    </main>
  );
}
