import Link from 'next/link';
import { FormNuevaParroquia } from './formularios';
import { SoloAdmin, sesionDeAdmin } from './guardia';

export const metadata = { title: 'Administración de parroquias' };
export const dynamic = 'force-dynamic';

export default async function Admin() {
  const sesion = await sesionDeAdmin();
  if (!sesion) return <SoloAdmin />;
  const { data: parroquias } = await sesion.from('parroquias').select('slug, nombre').order('nombre');
  return (
    <main className="tarjeta ancha">
      <h1>Parroquias</h1>
      {parroquias?.length ? (
        <ul className="lista">
          {parroquias.map((p) => (
            <li key={p.slug}>
              <Link href={`/editor/admin/parroquia/${p.slug}`}>{p.nombre}</Link> <span className="ayuda">({p.slug})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Todavía no hay parroquias.</p>
      )}
      <p>
        <Link href="/editor/admin/registro">Ver el registro de cambios</Link>
      </p>
      <h2>Nueva parroquia</h2>
      <FormNuevaParroquia />
    </main>
  );
}
