import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirAdmin } from '../../lib/admin';
import { clienteServidor } from '../../lib/supabase/servidor';
import { salir } from './acciones-sesion';

export const metadata = { title: 'Mis parroquias' };
export const dynamic = 'force-dynamic';

export default async function MisParroquias() {
  const sesion = await clienteServidor();
  // RLS: un coordinador ve solo sus parroquias; un administrador, todas.
  const { data } = await sesion.from('parroquias').select('slug, nombre').order('nombre');
  const parroquias = data ?? [];
  const esAdmin = Boolean(await exigirAdmin(sesion));
  // Con una sola parroquia se va directo a ella (un administrador se queda: necesita el enlace a la administración).
  if (parroquias.length === 1 && !esAdmin) redirect(`/editor/p/${parroquias[0].slug}`);
  return (
    <main className="tarjeta">
      <h1>Mis parroquias</h1>
      {parroquias.length ? (
        <ul className="lista">
          {parroquias.map((p) => (
            <li key={p.slug}>
              <Link href={`/editor/p/${p.slug}`}>{p.nombre}</Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>Todavía no tienes ninguna parroquia asignada. Pide al administrador que te invite.</p>
      )}
      {esAdmin && (
        <p>
          <Link href="/editor/admin">Administrar parroquias</Link>
        </p>
      )}
      <form action={salir}>
        <button className="boton" type="submit">
          Salir
        </button>
      </form>
    </main>
  );
}
