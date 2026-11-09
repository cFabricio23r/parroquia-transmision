import { NextResponse, type NextRequest } from 'next/server';
import { confirmarRecuperacion } from '../../../../lib/sesion';
import { clienteServidor } from '../../../../lib/supabase/servidor';

/** Destino del enlace del correo: canjea el token y lleva a elegir la contraseña nueva. */
export async function GET(peticion: NextRequest) {
  const { searchParams, origin } = peticion.nextUrl;
  const r = await confirmarRecuperacion(
    await clienteServidor(),
    searchParams.get('token_hash') ?? '',
    searchParams.get('type') ?? '',
  );
  const destino = r.error ? '/editor/olvide?error=enlace' : '/editor/nueva-contrasena';
  return NextResponse.redirect(new URL(destino, origin));
}
