import { clienteServidor } from '../../../lib/supabase/servidor';
import { MarcoAcceso } from '../../componentes/MarcoAcceso';
import { TarjetaAcceso } from '../../componentes/TarjetaAcceso';
import { FormNuevaClave } from './FormNuevaClave';

export const metadata = { title: 'Crea una contraseña nueva · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

// Se llega desde auth/confirmar con la sesión de recuperación (proxy.ts exige sesión en esta ruta).
export default async function NuevaContrasena() {
  const { data } = await (await clienteServidor()).auth.getUser();
  return (
    <MarcoAcceso>
      <TarjetaAcceso separacion={14}>
        <FormNuevaClave correo={data.user?.email ?? ''} />
      </TarjetaAcceso>
    </MarcoAcceso>
  );
}
