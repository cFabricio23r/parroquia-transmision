import Link from 'next/link';
import { clienteServicio } from '../../../../lib/supabase/servicio';
import { SoloAdmin, sesionDeAdmin } from '../guardia';

export const metadata = { title: 'Registro de cambios' };
export const dynamic = 'force-dynamic';

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Campos del detalle en texto: la lista `campos` de los borradores o los pares clave: valor. */
function describir(detalle: Record<string, unknown>): string {
  if (Array.isArray(detalle.campos)) return detalle.campos.join(', ') || '—';
  const pares = Object.entries(detalle).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return pares.join(', ') || '—';
}

export default async function Registro({ searchParams }: { searchParams: Promise<{ parroquia?: string }> }) {
  const { parroquia: filtroCrudo } = await searchParams;
  const sesion = await sesionDeAdmin();
  if (!sesion) return <SoloAdmin />;
  const filtro = filtroCrudo && RE_UUID.test(filtroCrudo) ? filtroCrudo : '';

  const { data: parroquias } = await sesion.from('parroquias').select('id, nombre').order('nombre');
  let consulta = sesion
    .from('registro')
    .select('id, parroquia_id, usuario_id, accion, detalle, en')
    .order('en', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);
  if (filtro) consulta = consulta.eq('parroquia_id', filtro);
  const { data: filas } = await consulta;

  const nombres = new Map((parroquias ?? []).map((p) => [p.id, p.nombre]));
  const servicio = clienteServicio();
  const ids = [...new Set((filas ?? []).map((f) => f.usuario_id).filter((x): x is string => !!x))];
  const correos = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await servicio.auth.admin.getUserById(id);
      correos.set(id, data.user?.email ?? 'cuenta sin correo');
    }),
  );

  return (
    <main className="tarjeta ancha">
      <h1>Registro de cambios</h1>
      <form method="get" className="filtro">
        <label htmlFor="parroquia">Parroquia</label>
        <select id="parroquia" name="parroquia" defaultValue={filtro}>
          <option value="">Todas</option>
          {(parroquias ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button className="boton boton-corto" type="submit">
          Filtrar
        </button>
      </form>
      {filas?.length ? (
        <div className="tabla-envoltura" role="region" aria-label="Últimas 100 acciones" tabIndex={0}>
          <table>
            <caption>Últimas 100 acciones</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Parroquia</th>
                <th scope="col">Quién</th>
                <th scope="col">Acción</th>
                <th scope="col">Campos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>
                    {/* Fecha local de quien mira: se formatea en el navegador (el servidor tiene otra zona). */}
                    <time dateTime={f.en} suppressHydrationWarning>
                      {new Date(f.en).toLocaleString('es')}
                    </time>
                  </td>
                  <td>{f.parroquia_id ? (nombres.get(f.parroquia_id) ?? 'parroquia eliminada') : '—'}</td>
                  <td>{f.usuario_id ? (correos.get(f.usuario_id) ?? '—') : '—'}</td>
                  <td>{f.accion}</td>
                  <td>{describir((f.detalle ?? {}) as Record<string, unknown>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No hay acciones registradas.</p>
      )}
      <p className="enlaces">
        <Link href="/editor/admin">Volver a las parroquias</Link>
      </p>
    </main>
  );
}
