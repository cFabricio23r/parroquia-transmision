// «App y transmisión» (etapa 3c, Decisión 9): fuera del borrador, no pasa por Publicar.
import { leerAppTransmision } from '../../../../../lib/app-transmision';
import type { EstadoAppTransmision } from '../../../../../lib/app-transmision-reglas';
import { clienteServidor } from '../../../../../lib/supabase/servidor';
import { SeccionAppTransmision } from './SeccionAppTransmision';

export const metadata = { title: 'App y transmisión · Parroquia en Vivo' };

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await leerAppTransmision(await clienteServidor(), slug);
  const inicial = r.estado === 200 ? (r.cuerpo as EstadoAppTransmision) : null;
  return <SeccionAppTransmision inicial={inicial} />;
}
