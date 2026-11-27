import { NextResponse, type NextRequest } from 'next/server';
import { crearGraph } from '../../../../lib/facebook/graph';
import {
  NOMBRE_COOKIE_ESTADO,
  procesarVuelta,
  RUTA_COOKIE_ESTADO,
  urlVolver,
} from '../../../../lib/facebook/conexion';
import { resolverSitioUrl } from '../../../../lib/sesion';
import { clienteServicio } from '../../../../lib/supabase/servicio';
import { clienteServidor } from '../../../../lib/supabase/servidor';

// La vuelta de Facebook: una sola dirección para todas las parroquias (la que se registra en Meta).
// Envoltorio fino: la lógica está en lib/facebook/conexion.ts. Nunca escribe el `code` ni los tokens.
export async function GET(peticion: NextRequest) {
  const cookie = peticion.cookies.get(NOMBRE_COOKIE_ESTADO)?.value;
  const graph = crearGraph({ appId: process.env.FACEBOOK_APP_ID ?? '', secreto: process.env.FACEBOOK_APP_SECRETO ?? '' });
  const redirect = urlVolver(resolverSitioUrl(process.env));
  const r = await procesarVuelta(
    { sesion: await clienteServidor(), servicio: clienteServicio(), graph },
    { params: peticion.nextUrl.searchParams, cookie, redirect },
  );
  const respuesta =
    r.estado === 400
      ? NextResponse.json({ error: 'La petición no es válida.' }, { status: 400 })
      : NextResponse.redirect(new URL(r.ubicacion, redirect));
  respuesta.cookies.set(NOMBRE_COOKIE_ESTADO, '', { maxAge: 0, path: RUTA_COOKIE_ESTADO });
  respuesta.headers.set('Cache-Control', 'no-store');
  return respuesta;
}
