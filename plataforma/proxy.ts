import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rutas del editor que se pueden ver sin sesión.
const PUBLICAS = ['/editor/entrar', '/editor/olvide', '/editor/invitacion', '/editor/auth'];

const esPublica = (ruta: string) => PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

/** Refresca la sesión de Supabase y manda a /editor/entrar a quien no la tenga. */
export async function proxy(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll(lista) {
          lista.forEach(({ name, value }) => peticion.cookies.set(name, value));
          respuesta = NextResponse.next({ request: peticion });
          lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  if (!data.user && !esPublica(peticion.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/editor/entrar', peticion.url));
  }
  return respuesta;
}

// Solo /editor: las pantallas estáticas de vicaria (/<slug>/…) no pasan por aquí.
export const config = { matcher: ['/editor', '/editor/:path*'] };
