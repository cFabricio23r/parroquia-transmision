import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { SEGUNDOS_URL_FIRMADA } from '../../../../lib/borrador';
import { clasificarErrores } from '../../../../lib/editor/validacion';
import { siguienteVersion } from '../../../../lib/editor/revision';
import { cuandoVersion } from '../../../../lib/fecha';
import { autorDeVersion, etiquetaUsuario, inicial } from '../../../../lib/persona';
import { clienteServicio } from '../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../lib/supabase/servidor';
import { usuarioActual } from '../../../../lib/usuario-actual';
import { tiposComunes } from '../../../../lib/validar';
import { recogerMedios } from '../../../../lib/vista-previa';
import { MarcoEditor } from './MarcoEditor';
import { NoEncontrada } from './NoEncontrada';
import { ProveedorBorrador, type DatosEditor, type VersionPublicada } from './ProveedorBorrador';

export const dynamic = 'force-dynamic';

/**
 * Marco del editor de una parroquia (spec, sección 3; Enfoque A): carga una sola vez el borrador, la
 * última versión publicada, las URLs de las imágenes y el usuario. El proveedor cliente no se desmonta
 * al navegar entre secciones: el guardado y la vista previa siguen vivos.
 */
export default async function LayoutEditorParroquia({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await clienteServidor();
  const u = await usuarioActual(sesion);
  if (!u) redirect('/editor/entrar');
  const usuario = { etiqueta: etiquetaUsuario(u, true), inicial: inicial(u.nombre, u.correo) };

  // RLS: solo devuelve la parroquia a sus miembros y a los administradores.
  const { data: parroquia } = await sesion.from('parroquias').select('id, nombre, ultima_version, desactivada_en').eq('slug', slug).maybeSingle();
  if (!parroquia) return <NoEncontrada usuario={usuario} />;
  const { data: borrador } = await sesion
    .from('borradores')
    .select('config, actualizado_en')
    .eq('parroquia_id', parroquia.id)
    .maybeSingle();
  if (!borrador) return <NoEncontrada usuario={usuario} />;
  const config = (borrador.config ?? {}) as Record<string, unknown>;

  // URLs firmadas de las imágenes del borrador (el Storage `borradores` es privado).
  const urls: Record<string, string> = {};
  const imagenes = recogerMedios(config);
  if (imagenes.length) {
    const { data } = await sesion.storage
      .from('borradores')
      .createSignedUrls(imagenes.map((s) => `${parroquia.id}/${s.slice('medios/'.length)}`), SEGUNDOS_URL_FIRMADA);
    data?.forEach((f, i) => {
      if (f.signedUrl && !f.error) urls[imagenes[i]] = f.signedUrl;
    });
  }

  // Versiones (RLS: las ve quien ve la parroquia). La última trae su config, para «Qué cambia».
  const { data: filas, error: errorVersiones } = await sesion
    .from('versiones')
    .select('numero, publicada_en, publicada_por, origen_numero')
    .eq('parroquia_id', parroquia.id)
    .order('numero', { ascending: false });
  if (errorVersiones) console.error('[editor] no se pudieron leer las versiones:', errorVersiones.message);
  let publicada: DatosEditor['publicada'] = null;
  if (filas?.length) {
    const { data: ultima } = await sesion
      .from('versiones')
      .select('numero, config')
      .eq('parroquia_id', parroquia.id)
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultima) {
      const configPublicada = (ultima.config ?? {}) as Record<string, unknown>;
      const urlsPublicadas: Record<string, string> = {};
      for (const src of recogerMedios(configPublicada)) {
        urlsPublicadas[src] = sesion.storage.from('publicado').getPublicUrl(`${slug}/${src}`).data.publicUrl;
      }
      publicada = { numero: ultima.numero as number, config: configPublicada, urls: urlsPublicadas };
    }
  }

  // Quién publicó: el correo solo lo lee el servidor, y el nombre (`perfiles`) y si es admin
  // (`administradores`) se leen con el servicio. Ya se comprobó arriba que la persona ve la parroquia.
  const autores = new Map<string, { esAdmin: boolean; nombre: string | null; correo: string | null }>();
  const ids = [...new Set((filas ?? []).map((f) => f.publicada_por as string | null).filter((id): id is string => !!id))];
  if (ids.length) {
    const servicio = clienteServicio();
    const [perfiles, admins] = await Promise.all([
      servicio.from('perfiles').select('usuario_id, nombre').in('usuario_id', ids),
      servicio.from('administradores').select('usuario_id').in('usuario_id', ids),
    ]);
    if (perfiles.error) console.error('[editor] no se pudieron leer los perfiles de quien publicó:', perfiles.error.message);
    if (admins.error) console.error('[editor] no se pudo leer quién es admin:', admins.error.message);
    const nombres = new Map((perfiles.data ?? []).map((p) => [p.usuario_id as string, (p.nombre as string | null) ?? null]));
    const esAdmin = new Set((admins.data ?? []).map((a) => a.usuario_id as string));
    await Promise.all(
      ids.map(async (id) => {
        const { data, error } = await servicio.auth.admin.getUserById(id);
        if (error) console.error('[editor] no se pudo leer quién publicó:', error.message);
        if (!data.user) return;
        autores.set(id, { esAdmin: esAdmin.has(id), nombre: nombres.get(id) ?? null, correo: data.user.email ?? null });
      }),
    );
  }
  const versiones: VersionPublicada[] = (filas ?? []).map((f) => ({
    numero: f.numero as number,
    fecha: cuandoVersion(f.publicada_en as string),
    quien: autorDeVersion(autores.get(f.publicada_por as string) ?? null),
    origen: (f.origen_numero as number | null) ?? null,
  }));
  const mayorPublicada = filas?.length ? Math.max(...filas.map((f) => f.numero as number)) : null;

  const datos: DatosEditor = {
    slug,
    parroquiaId: parroquia.id as string,
    nombreParroquia: parroquia.nombre as string,
    config,
    actualizadoEn: borrador.actualizado_en as string,
    errores: clasificarErrores(config, slug).todos,
    urls,
    publicada,
    versiones,
    siguienteVersion: siguienteVersion((parroquia.ultima_version as number | null) ?? null, mayorPublicada),
    desactivada: parroquia.desactivada_en != null,
    tiposComunes: tiposComunes(),
    usuario,
  };
  return (
    <ProveedorBorrador datos={datos}>
      <MarcoEditor>{children}</MarcoEditor>
    </ProveedorBorrador>
  );
}
