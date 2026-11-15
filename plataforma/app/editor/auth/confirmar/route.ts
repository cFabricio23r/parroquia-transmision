import { NextResponse, type NextRequest } from 'next/server';
import { confirmarRecuperacion } from '../../../../lib/sesion';
import { clienteServidor } from '../../../../lib/supabase/servidor';

/**
 * Destino del enlace del correo: canjea el token y lleva a elegir la contraseña nueva.
 * La redirección es relativa (revisión fix2): `nextUrl.origin` en `next dev -H 127.0.0.1` sale como
 * localhost, y la cookie de sesión recién puesta en 127.0.0.1 no viaja a localhost (la persona caía
 * en «Entrar»). Con un Location relativo el navegador se queda en el mismo host por el que llegó.
 */
export async function GET(peticion: NextRequest) {
  const { searchParams } = peticion.nextUrl;
  const r = await confirmarRecuperacion(
    await clienteServidor(),
    searchParams.get('token_hash') ?? '',
    searchParams.get('type') ?? '',
  );
  const destino = r.error ? '/editor/olvide?error=enlace' : '/editor/nueva-contrasena';
  return new NextResponse(null, { status: 307, headers: { Location: destino } });
}
