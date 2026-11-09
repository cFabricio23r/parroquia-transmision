import Link from 'next/link';
import { consultarInvitacion, MENSAJE_INVITACION_INVALIDA } from '../../../lib/admin';
import { clienteServicio } from '../../../lib/supabase/servicio';
import { clienteServidor } from '../../../lib/supabase/servidor';
import { FormAceptar } from '../admin/formularios';

export const metadata = { title: 'Aceptar la invitación', referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

export default async function Invitacion({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token: crudo } = await searchParams;
  const token = typeof crudo === 'string' ? crudo : '';
  const inv = await consultarInvitacion({ servicio: clienteServicio(), sesion: await clienteServidor() }, token);

  if (!inv) {
    return (
      <main className="tarjeta">
        <h1>Invitación</h1>
        <div role="alert" className="resumen-error">
          {MENSAJE_INVITACION_INVALIDA}
        </div>
      </main>
    );
  }
  const destino = inv.rol === 'administrador' ? 'administrar la plataforma' : `coordinar ${inv.parroquia ?? 'una parroquia'}`;
  return (
    <main className="tarjeta">
      <h1>Te invitaron a {destino}</h1>
      {inv.paso === 'entrar' && (
        <>
          <div role="alert" className="resumen-error">
            Ya tienes una cuenta con {inv.correo}. Entra con ese correo y luego abre otra vez el enlace de la invitación.
          </div>
          <p className="enlaces">
            <Link href="/editor/entrar">Entrar con mi cuenta</Link>
          </p>
        </>
      )}
      {inv.paso === 'otra-sesion' && (
        <>
          <div role="alert" className="resumen-error">
            Esta invitación es para {inv.correo}. Sal de tu cuenta y entra con esa.
          </div>
          <p className="enlaces">
            <Link href="/editor/entrar">Ir a entrar</Link>
          </p>
        </>
      )}
      {(inv.paso === 'crear' || inv.paso === 'aceptar') && (
        <FormAceptar token={token} correo={inv.correo} crearCuenta={inv.paso === 'crear'} />
      )}
    </main>
  );
}
