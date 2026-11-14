import { Boton } from '../../componentes/Boton';
import { MarcoAcceso } from '../../componentes/MarcoAcceso';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { TarjetaAcceso } from '../../componentes/TarjetaAcceso';
import { FormOlvide } from './FormOlvide';

export const metadata = { title: '¿Olvidaste tu contraseña? · Parroquia en Vivo' };

export default async function Olvide({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <MarcoAcceso>
      <TarjetaAcceso>
        {error === 'enlace' ? (
          // Adonde manda auth/confirmar cuando el enlace del correo ya no sirve (Decisión 14).
          <MensajeEstado
            codigo="enlace-vencido"
            incrustado
            rol="alert"
            enfocar
            accion={
              <Boton variante="secundario" href="/editor/olvide">
                Pedir otro enlace
              </Boton>
            }
          />
        ) : (
          <FormOlvide key="formulario" />
        )}
      </TarjetaAcceso>
    </MarcoAcceso>
  );
}
