import Link from 'next/link';
import { SEGUNDOS_URL_FIRMADA } from '../../../../lib/borrador';
import { formatearFecha } from '../../../../lib/fecha';
import { validarBorrador } from '../../../../lib/validar';
import { recogerMedios } from '../../../../lib/vista-previa';
import { clienteServicio } from '../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../lib/supabase/servidor';
import { EditorParroquia } from './EditorParroquia';
import type { IdentidadInicial } from './FormularioIdentidad';
import type { VersionPublicada } from './Versiones';

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
  // URLs firmadas de todas las imágenes del borrador (identidad, galería, fondos…), para el formulario y la vista previa.
  const imagenes = recogerMedios(borrador.config);
  const urls: Record<string, string> = {};
  if (imagenes.length) {
    const { data } = await sesion.storage
      .from('borradores')
      .createSignedUrls(imagenes.map((s) => `${parroquia.id}/${s.slice('medios/'.length)}`), SEGUNDOS_URL_FIRMADA);
    data?.forEach((f, i) => {
      if (f.signedUrl && !f.error) urls[imagenes[i]] = f.signedUrl;
    });
  }

  // Versiones publicadas (RLS: las ve quien ve la parroquia). El correo de quien publicó solo lo puede
  // leer el servidor; esta página ya comprobó arriba que la persona es de esta parroquia o administradora.
  const { data: filas, error: errorVersiones } = await sesion
    .from('versiones')
    .select('numero, publicada_en, publicada_por, origen_numero')
    .eq('parroquia_id', parroquia.id)
    .order('numero', { ascending: false });
  if (errorVersiones) console.error('[página de la parroquia] no se pudieron leer las versiones:', errorVersiones.message);
  const correos = new Map<string, string>();
  const servicio = clienteServicio();
  await Promise.all(
    [...new Set((filas ?? []).map((f) => f.publicada_por as string | null).filter((id): id is string => !!id))].map(async (id) => {
      const { data, error } = await servicio.auth.admin.getUserById(id);
      if (error) console.error('[página de la parroquia] no se pudo leer quién publicó:', error.message);
      if (data.user?.email) correos.set(id, data.user.email);
    }),
  );
  const versiones: VersionPublicada[] = (filas ?? []).map((f) => ({
    numero: f.numero as number,
    fecha: formatearFecha(f.publicada_en as string),
    quien: correos.get(f.publicada_por as string) ?? '—',
    origen: (f.origen_numero as number | null) ?? null,
  }));

  return (
    <main className="tarjeta ancha">
      <p>
        <Link href="/editor">Mis parroquias</Link>
      </p>
      <h1>Identidad de {config.nombre || parroquia.nombre}</h1>
      <p className="ayuda">Lo que cambies aquí se guarda como borrador. Todavía no se publica.</p>
      <EditorParroquia
        slug={slug}
        inicial={config}
        actualizadoEn={borrador.actualizado_en}
        errores={validarBorrador(borrador.config, slug).errores}
        urls={urls}
        versiones={versiones}
      />
    </main>
  );
}
