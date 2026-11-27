// «App y transmisión» (etapa 3c, Decisión 9): fuera del borrador, no pasa por Publicar.
// La tarjeta «Facebook de la parroquia» (Tarea 6) se lee con el cliente de servicio DESPUÉS de comprobar el acceso.
import { leerAppTransmision } from '../../../../../lib/app-transmision';
import type { EstadoAppTransmision } from '../../../../../lib/app-transmision-reglas';
import { clienteServicio } from '../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../lib/supabase/servidor';
import { SeccionAppTransmision } from './SeccionAppTransmision';

export const metadata = { title: 'App y transmisión · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const r = await leerAppTransmision(await clienteServidor(), slug, clienteServicio());
  const inicial = r.estado === 200 ? (r.cuerpo as EstadoAppTransmision) : null;
  const errorFacebook = error === 'no-invitada' || error === '1' ? error : null;
  return <SeccionAppTransmision inicial={inicial} errorFacebook={errorFacebook} />;
}
