import Link from 'next/link';
import { SEGUNDOS_URL_FIRMADA } from '../../../../lib/borrador';
import { validarBorrador } from '../../../../lib/validar';
import { clienteServidor } from '../../../../lib/supabase/servidor';
import { FormularioIdentidad, type IdentidadInicial } from './FormularioIdentidad';

export const metadata = { title: 'Identidad de la parroquia' };
export const dynamic = 'force-dynamic';

function NoEncontrada() {
  return (
    <main className="tarjeta">
      <h1>Parroquia</h1>
      <p>No encontramos esa parroquia.</p>
      <Link href="/editor">Volver a mis parroquias</Link>
    </main>
  );
}

export default async function EditarIdentidad({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await clienteServidor();
  // RLS: solo devuelve la parroquia a sus miembros y a los administradores.
  const { data: parroquia } = await sesion.from('parroquias').select('id, nombre').eq('slug', slug).maybeSingle();
  if (!parroquia) return <NoEncontrada />;
  const { data: borrador } = await sesion
    .from('borradores')
    .select('config, actualizado_en')
    .eq('parroquia_id', parroquia.id)
    .maybeSingle();
  if (!borrador) return <NoEncontrada />;

  const config = borrador.config as IdentidadInicial;
  // URLs firmadas de las imágenes que ya tiene el borrador, para mostrarlas en el formulario.
  const imagenes = [config.logos?.blanco, config.logos?.color, config.fachada, config.patrono?.imagen]
    .map((i) => i?.src)
    .filter((s): s is string => typeof s === 'string' && s.startsWith('medios/'));
  const urls: Record<string, string> = {};
  if (imagenes.length) {
    const { data } = await sesion.storage
      .from('borradores')
      .createSignedUrls(imagenes.map((s) => `${parroquia.id}/${s.slice('medios/'.length)}`), SEGUNDOS_URL_FIRMADA);
    data?.forEach((f, i) => {
      if (f.signedUrl && !f.error) urls[imagenes[i]] = f.signedUrl;
    });
  }

  return (
    <main className="tarjeta ancha">
      <p>
        <Link href="/editor">Mis parroquias</Link>
      </p>
      <h1>Identidad de {config.nombre || parroquia.nombre}</h1>
      <p className="ayuda">Lo que cambies aquí se guarda como borrador. Todavía no se publica.</p>
      <FormularioIdentidad
        slug={slug}
        inicial={config}
        actualizadoEn={borrador.actualizado_en}
        errores={validarBorrador(borrador.config, slug).errores}
        urls={urls}
      />
    </main>
  );
}
