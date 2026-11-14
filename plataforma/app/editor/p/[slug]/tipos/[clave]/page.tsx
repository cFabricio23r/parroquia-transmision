import { clienteServidor } from '../../../../../../lib/supabase/servidor';
import { filasComunes } from '../../../../../../lib/editor/tipos';
import { tiposComunes } from '../../../../../../lib/validar';
import { SeccionTipoEditar } from './SeccionTipoEditar';

type Params = Promise<{ slug: string; clave: string }>;

/** El nombre de un propio sale del borrador (RLS: solo lo ven sus miembros). */
async function nombrePropio(slug: string, clave: string): Promise<string | null> {
  try {
    const sesion = await clienteServidor();
    const { data: p } = await sesion.from('parroquias').select('id').eq('slug', slug).maybeSingle();
    if (!p) return null;
    const { data: b } = await sesion.from('borradores').select('config').eq('parroquia_id', p.id).maybeSingle();
    const propios = (b?.config as { tipos?: { propios?: unknown } } | null)?.tipos?.propios;
    const propio = Array.isArray(propios) ? propios.find((x) => x && typeof x === 'object' && x.clave === clave) : undefined;
    return typeof propio?.nombre === 'string' && propio.nombre ? propio.nombre : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug, clave } = await params;
  if (clave === 'nuevo') return { title: 'Nuevo tipo · Parroquia en Vivo' };
  const fila = filasComunes(tiposComunes()).find((f) => f.id === clave);
  const nombre = fila?.nombre ?? (await nombrePropio(slug, clave));
  return { title: `${nombre ?? 'Tipos de transmisión'} · Parroquia en Vivo` };
}

/** F8 · Editar tipo (plan 4, Tarea 9). */
export default async function Pagina({ params }: { params: Params }) {
  const { clave } = await params;
  return <SeccionTipoEditar clave={clave} />;
}
