import type { Metadata } from 'next';
import { cache } from 'react';
import { consultarInvitacion } from '../../../lib/admin';
import { formatearDiaMes } from '../../../lib/fecha';
import { tituloInvitacion } from '../../../lib/mensajes-acceso';
import { clienteServicio } from '../../../lib/supabase/servicio';
import { clienteServidor } from '../../../lib/supabase/servidor';
import { Boton } from '../../componentes/Boton';
import { Chip } from '../../componentes/Chip';
import { MarcoAcceso } from '../../componentes/MarcoAcceso';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { TarjetaAcceso } from '../../componentes/TarjetaAcceso';
import { FormInvitacion } from './FormInvitacion';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ token?: string | string[] }> };

const leerToken = async (searchParams: Props['searchParams']) => {
  const { token } = await searchParams;
  return typeof token === 'string' ? token : '';
};

// Una sola consulta por pedido: la usan generateMetadata y la página.
const consultar = cache(async (token: string) =>
  consultarInvitacion({ servicio: clienteServicio(), sesion: await clienteServidor() }, token),
);

/** El título de la pestaña es el mismo texto que el h1 (vigente según el rol, vencida o que ya no sirve). */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const inv = await consultar(await leerToken(searchParams));
  return { title: `${tituloInvitacion(inv)} · Parroquia en Vivo`, referrer: 'no-referrer' };
}

/** A2 · Invitación (AB/VicAccesoInvitacion). */
export default async function Invitacion({ searchParams }: Props) {
  const token = await leerToken(searchParams);
  const inv = await consultar(token);

  if (inv.estado !== 'vigente') {
    return (
      <MarcoAcceso>
        <TarjetaAcceso ancho={480} separacion={12}>
          {inv.estado === 'vencida' ? (
            <MensajeEstado codigo="invitacion-vencida" incrustado rol="alert" nivel={1} />
          ) : (
            // Ronda 2: quien ya creó su cuenta y vuelve a abrir el correo cae aquí; tiene que poder entrar.
            <MensajeEstado
              codigo="invitacion-no-sirve"
              incrustado
              nivel={1}
              rol="alert"
              accion={
                <Boton variante="secundario" href="/editor/entrar">
                  Ir a entrar
                </Boton>
              }
            />
          )}
        </TarjetaAcceso>
      </MarcoAcceso>
    );
  }

  const esAdmin = inv.rol === 'administrador';
  const titulo = tituloInvitacion(inv);
  const texto = esAdmin ? (
    <>La Pastoral de Comunicaciones te invitó a administrar la plataforma.</>
  ) : (
    <>
      La Pastoral de Comunicaciones te invitó a coordinar la parroquia <b>{inv.parroquia ?? 'asignada'}</b>.
    </>
  );
  const pie = `La invitación vence el ${formatearDiaMes(inv.venceEn)}.`;

  return (
    <MarcoAcceso>
      <TarjetaAcceso ancho={480} separacion={12}>
        <div>
          <Chip tono="azul">Invitación</Chip>
        </div>
        <h1 className="pv-titulo-acceso">{titulo}</h1>
        <p className="pv-texto-acceso">{texto}</p>
        {inv.paso === 'entrar' && (
          <>
            <div role="alert" className="pv-alerta">
              Ya tienes una cuenta con {inv.correo}. Entra con ese correo y luego abre otra vez el enlace de la invitación.
            </div>
            <Boton variante="secundario" anchoCompleto href="/editor/entrar">
              Entrar con mi cuenta
            </Boton>
          </>
        )}
        {inv.paso === 'otra-sesion' && (
          <>
            <div role="alert" className="pv-alerta">
              Esta invitación es para {inv.correo}. Sal de tu cuenta y entra con esa.
            </div>
            <Boton variante="secundario" anchoCompleto href="/editor/entrar">
              Ir a entrar
            </Boton>
          </>
        )}
        {(inv.paso === 'crear' || inv.paso === 'aceptar') && (
          <FormInvitacion token={token} correo={inv.correo} crearCuenta={inv.paso === 'crear'} pie={pie} />
        )}
      </TarjetaAcceso>
    </MarcoAcceso>
  );
}
