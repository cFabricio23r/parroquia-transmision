import { NextResponse } from 'next/server';
import { comprobarAcceso } from '../../../../../../../lib/borrador';
import {
  nuevoEstado,
  NOMBRE_COOKIE_ESTADO,
  RUTA_COOKIE_ESTADO,
  SEGUNDOS_COOKIE_ESTADO,
  urlDialogo,
  urlVolver,
} from '../../../../../../../lib/facebook/conexion';
import { resolverSitioUrl } from '../../../../../../../lib/sesion';
import { clienteServidor } from '../../../../../../../lib/supabase/servidor';

// Envoltorio fino: comprueba el acceso, guarda el state (con el slug) en una cookie y manda a Facebook.
export async function GET(_peticion: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const acceso = await comprobarAcceso(await clienteServidor(), slug);
  if (!acceso.ok) {
    return NextResponse.json(acceso.respuesta.cuerpo, { status: acceso.respuesta.estado, headers: { 'Cache-Control': 'no-store' } });
  }
  const { estado, cookie } = nuevoEstado(slug);
  const respuesta = NextResponse.redirect(urlDialogo(estado, urlVolver(resolverSitioUrl(process.env))));
  respuesta.cookies.set(NOMBRE_COOKIE_ESTADO, cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SEGUNDOS_COOKIE_ESTADO,
    path: RUTA_COOKIE_ESTADO,
  });
  respuesta.headers.set('Cache-Control', 'no-store');
  return respuesta;
}
