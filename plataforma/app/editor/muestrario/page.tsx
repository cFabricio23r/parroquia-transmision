import { notFound } from 'next/navigation';
import { Boton } from '../../componentes/Boton';
import { EnlaceTexto } from '../../componentes/EnlaceTexto';
import { Encabezado } from '../../componentes/Encabezado';
import { MensajeEstado } from '../../componentes/MensajeEstado';
import { ORDEN_A5, type CodigoMensajeAcceso } from '../../../lib/mensajes-acceso';
import { Demostraciones } from './Demostraciones';

// Muestrario de componentes (solo desarrollo): para revisarlos contra los artboards antes de que
// los usen los planes 3 a 5. Está detrás del login, como todo /editor.
export const metadata = { title: 'Muestrario · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

/** Acciones y notas de diseñador de cada tarjeta de A5 (Decisión 15: solo aquí, no en las pantallas reales). */
function accionA5(codigo: CodigoMensajeAcceso) {
  switch (codigo) {
    case 'incorrectos':
      return <EnlaceTexto href="/editor/olvide">Olvidé mi contraseña</EnlaceTexto>;
    case 'clave-no-sirve':
      return <span className="pv-mensaje-nota">Se marca en el campo, mientras escribes.</span>;
    case 'muchos-intentos':
      return <Boton variante="secundario">Entendido</Boton>;
    case 'sin-parroquia':
      return <Boton variante="secundario">Cerrar sesión</Boton>;
    case 'invitacion-vencida':
      return <span className="pv-mensaje-nota">El admin la reenvía desde la lista.</span>;
    case 'enlace-vencido':
      return <Boton variante="secundario">Pedir otro enlace</Boton>;
    case 'sin-conexion':
      return <Boton variante="secundario">Reintentar</Boton>;
    case 'sesion-cerrada':
      return <Boton variante="secundario">Entrar</Boton>;
    default:
      return null;
  }
}

export default async function Muestrario({ searchParams }: { searchParams: Promise<{ seccion?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { seccion } = await searchParams;
  if (seccion === 'mensajes') {
    return (
      <>
        <Encabezado />
        <main className="pv-muestrario-mensajes">
          <h1 className="pv-muestrario-titulo">Mensajes de acceso</h1>
          <p className="pv-muestrario-texto">Los mismos textos en la web y en la app. Por seguridad, «incorrectos» no dice si el correo tiene cuenta.</p>
          <div className="pv-muestrario-grilla">
            {ORDEN_A5.map((c) => (
              <MensajeEstado key={c} codigo={c} accion={accionA5(c)} />
            ))}
          </div>
        </main>
      </>
    );
  }
  return (
    <>
      <Encabezado usuario={{ etiqueta: 'Muestrario · Coordinador', inicial: 'M' }} enlaceInicio />
      <Demostraciones />
    </>
  );
}
