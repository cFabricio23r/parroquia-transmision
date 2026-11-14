import { consultarInvitacion } from '../../../lib/admin';
import { formatearDiaMes } from '../../../lib/fecha';
import { clienteServicio } from '../../../lib/supabase/servicio';
import { clienteServidor } from '../../../lib/supabase/servidor';
import { Boton } from '../../componentes/Boton';
import { Chip } from '../../componentes/Chip';
import { MarcoAcceso } from '../../componentes/MarcoAcceso';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { TarjetaAcceso } from '../../componentes/TarjetaAcceso';
import { FormInvitacion } from './FormInvitacion';

export const metadata = { title: 'Te invitaron a coordinar · Parroquia en Vivo', referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

/** A2 · Invitación (AB/VicAccesoInvitacion). */
export default async function Invitacion({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token: crudo } = await searchParams;
  const token = typeof crudo === 'string' ? crudo : '';
  const inv = await consultarInvitacion({ servicio: clienteServicio(), sesion: await clienteServidor() }, token);

  if (inv.estado !== 'vigente') {
    return (
      <MarcoAcceso>
        <TarjetaAcceso ancho={480} separacion={12}>
          <MensajeEstado codigo={inv.estado === 'vencida' ? 'invitacion-vencida' : 'invitacion-no-sirve'} incrustado rol="alert" />
        </TarjetaAcceso>
      </MarcoAcceso>
    );
  }

  const esAdmin = inv.rol === 'administrador';
  const titulo = esAdmin ? 'Te invitaron a administrar' : 'Te invitaron a coordinar';
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
