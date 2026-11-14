import { listarCoordinadores } from '../../../../lib/admin-coordinadores';
import { listarParroquias } from '../../../../lib/admin-parroquias';
import { servicioDeAdmin } from '../guardia';
import { TablaCoordinadores } from './TablaCoordinadores';

export const metadata = { title: 'Coordinadores · Administración · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/**
 * D2 · Coordinadores (AB/VicAdminCoordinadores). Sin admin no lee nada (el layout muestra el aviso).
 * `?parroquia=<slug>` deja solo las filas de esa parroquia; un slug que no existe se ignora.
 * Se lista toda la vicaría una vez y se filtra aquí, porque «Asignar» necesita saber en qué
 * parroquias está cada persona aunque el filtro las oculte.
 */
export default async function Coordinadores({ searchParams }: { searchParams: Promise<{ parroquia?: string }> }) {
  const { parroquia } = await searchParams;
  const servicio = await servicioDeAdmin();
  if (!servicio) return null;
  const [todas, parroquias] = await Promise.all([listarCoordinadores(servicio), listarParroquias(servicio)]);
  const activas = parroquias.filter((p) => p.estado.clave !== 'desactivada').map((p) => ({ id: p.id, nombre: p.nombre }));
  const membresias: Record<string, string[]> = {};
  for (const f of todas) {
    if (f.tipo === 'miembro' && f.usuarioId) (membresias[f.usuarioId] ??= []).push(f.parroquiaId);
  }
  const elegida = typeof parroquia === 'string' ? parroquias.find((p) => p.slug === parroquia) : undefined;
  const filas = elegida ? todas.filter((f) => f.parroquiaId === elegida.id) : todas;
  return (
    <main className="pv-admin">
      <TablaCoordinadores
        filas={filas}
        activas={activas}
        membresias={membresias}
        filtro={elegida ? { id: elegida.id, nombre: elegida.nombre } : null}
      />
    </main>
  );
}
