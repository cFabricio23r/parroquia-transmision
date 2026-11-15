import type { Metadata } from 'next';
import { MENSAJES_ACCESO } from '../../../lib/mensajes-acceso';
import { Boton } from '../../componentes/Boton';
import { MarcoAcceso } from '../../componentes/MarcoAcceso';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { TarjetaAcceso } from '../../componentes/TarjetaAcceso';
import { FormOlvide } from './FormOlvide';

/** Con ?error=enlace la página es el mensaje «Enlace vencido o usado»: el título es el de su h1. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ error?: string }> }): Promise<Metadata> {
  const { error } = await searchParams;
  const titulo = error === 'enlace' ? MENSAJES_ACCESO['enlace-vencido'].titulo : '¿Olvidaste tu contraseña?';
  return { title: `${titulo} · Parroquia en Vivo` };
}

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
            nivel={1}
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
