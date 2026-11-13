import Link from 'next/link';
import { formatearFecha } from '../../../../../lib/fecha';
import { clienteServicio } from '../../../../../lib/supabase/servicio';
import { BotonQuitar, FormInvitar } from '../../formularios';
import { SoloAdmin, sesionDeAdmin } from '../../guardia';

export const metadata = { title: 'Parroquia' };
export const dynamic = 'force-dynamic';

export default async function PaginaParroquia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await sesionDeAdmin();
  if (!sesion) return <SoloAdmin />;
  const { data: parroquia } = await sesion.from('parroquias').select('id, nombre, slug').eq('slug', slug).maybeSingle();
  if (!parroquia) {
    return (
      <main className="tarjeta">
        <h1>Parroquia</h1>
        <p>No encontramos esa parroquia.</p>
        <Link href="/editor/admin">Volver a las parroquias</Link>
      </main>
    );
  }
  const { data: miembros } = await sesion.from('miembros').select('usuario_id').eq('parroquia_id', parroquia.id);
  const servicio = clienteServicio();
  const coordinadores = await Promise.all(
    (miembros ?? []).map(async (m) => {
      const { data } = await servicio.auth.admin.getUserById(m.usuario_id);
      return { id: m.usuario_id, correo: data.user?.email ?? 'cuenta sin correo' };
    }),
  );
  const { data: pendientes } = await sesion
    .from('invitaciones')
    .select('id, correo, vence_en')
    .eq('parroquia_id', parroquia.id)
    .is('usada_en', null)
    .is('anulada_en', null)
    .gt('vence_en', new Date().toISOString())
    .order('creada_en', { ascending: false });
  return (
    <main className="tarjeta ancha">
      <h1>{parroquia.nombre}</h1>
      <p className="ayuda">Dirección: {parroquia.slug}</p>

      <h2>Coordinadores</h2>
      {coordinadores.length ? (
        <ul className="lista">
          {coordinadores.map((c) => (
            <li key={c.id}>
              <span>{c.correo}</span>
              <BotonQuitar parroquiaId={parroquia.id} usuarioId={c.id} correo={c.correo} />
            </li>
          ))}
        </ul>
      ) : (
        <p>Esta parroquia todavía no tiene coordinadores.</p>
      )}

      <h2>Invitaciones pendientes</h2>
      {pendientes?.length ? (
        <ul className="lista">
          {pendientes.map((i) => (
            <li key={i.id}>
              {i.correo} <span className="ayuda">(vence el {formatearFecha(i.vence_en, false)})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No hay invitaciones pendientes.</p>
      )}

      <h2>Invitar coordinador</h2>
      <FormInvitar parroquiaId={parroquia.id} />
      <p className="enlaces">
        <Link href="/editor/admin">Volver a las parroquias</Link>
      </p>
    </main>
  );
}
