// «¿Dónde sale la misa?» (artboard C3): el coordinador elige la página principal y las extras.
// Se lee con el cliente de servicio DESPUÉS de comprobar el acceso a esta parroquia (lib/facebook).
import Link from 'next/link';
import { leerAsignacion, type VistaAsignacion } from '../../../../../../lib/facebook/asignaciones';
import { leerConexion, type VistaConexion } from '../../../../../../lib/facebook/conexion';
import { clienteServicio } from '../../../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../../../lib/supabase/servidor';
import { clasesBoton } from '../../../../../componentes/Boton';
import { ElegirPaginas, TITULO_ELEGIR } from './ElegirPaginas';

export const metadata = { title: '¿Dónde sale la misa? · Parroquia en Vivo' };
export const dynamic = 'force-dynamic';

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const base = `/editor/p/${encodeURIComponent(slug)}/app-y-transmision`;
  const d = { sesion: await clienteServidor(), servicio: clienteServicio() };
  const c = await leerConexion(d, slug);
  const a = c.estado === 200 ? await leerAsignacion(d, slug) : c;

  const aviso = (texto: string, accion?: { href: string; texto: string }) => (
    <div className="pv-fb">
      <Link href={base} className="pv-fb-volver">
        ‹ App y transmisión
      </Link>
      <h1 className="pv-fb-titulo">{TITULO_ELEGIR}</h1>
      <div role="alert" className="pv-alerta">
        {texto}
      </div>
      {accion && (
        <div className="pv-fb-acciones">
          {/* <a> y no <Link>: es una ruta que redirige a Facebook y no se debe precargar. */}
          <a href={accion.href} className={clasesBoton()}>
            {accion.texto}
          </a>
        </div>
      )}
    </div>
  );

  if (c.estado !== 200 || a.estado !== 200) return aviso('No se pudieron leer las páginas. Recarga la página.');
  const conexion = c.cuerpo as VistaConexion;
  if (conexion.estado === 'sin-conectar') {
    return aviso('Todavía no conectaste Facebook. Conéctalo para elegir dónde sale la misa.', {
      href: `${base}/facebook/conectar`,
      texto: 'Conectar con Facebook',
    });
  }
  if (conexion.estado === 'reconectar') {
    return aviso('Facebook pide que vuelvas a conectar. Mientras tanto, la app usa la clave de transmisión.', {
      href: `${base}/facebook/conectar`,
      texto: 'Volver a conectar',
    });
  }
  return <ElegirPaginas slug={slug} conexion={conexion} asignacion={a.cuerpo as VistaAsignacion} />;
}
