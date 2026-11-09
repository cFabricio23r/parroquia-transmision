import { createServerClient } from '@supabase/ssr';
import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

// Rutas del editor que se pueden ver sin sesión.
const PUBLICAS = ['/editor/entrar', '/editor/olvide', '/editor/invitacion', '/editor/auth'];

const esPublica = (ruta: string) => PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

export const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Intenta de nuevo en un momento';

/**
 * ¿El error de getUser() es que no se pudo hablar con Supabase (red caída, proyecto en pausa, 5xx)?
 * auth-js (lib/fetch.js, handleError) convierte un fallo de fetch o un 5xx en AuthRetryableFetchError,
 * y una respuesta que no se puede leer en AuthUnknownError. Sin sesión da AuthSessionMissingError, y
 * un token vencido o inválido, AuthApiError: eso sí es «no hay sesión» y lleva a entrar.
 */
export const esFalloDeConexion = (error: unknown): boolean =>
  isAuthRetryableFetchError(error) || (isAuthError(error) && error.name === 'AuthUnknownError');

/** La página que se muestra (con 503) en lugar de mandar a entrar cuando Supabase no responde. */
function paginaSinConexion(): NextResponse {
  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin conexión con el servidor</title>
<style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;background:#fff;line-height:1.5}a{color:#0c3562}</style></head>
<body><main><h1>Sin conexión con el servidor</h1><p role="alert">${MENSAJE_SIN_CONEXION}.</p><p><a href="">Volver a intentar</a></p></main></body>
</html>`;
  return new NextResponse(html, {
    status: 503,
    headers: { 'content-type': 'text/html; charset=utf-8', 'retry-after': '30', 'cache-control': 'no-store' },
  });
}

/**
 * Refresca la sesión de Supabase y manda a /editor/entrar a quien no la tenga. Si Supabase no responde,
 * no finge que la sesión venció: la API contesta 503 en JSON y las páginas muestran el mensaje.
 */
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
  const esApi = peticion.nextUrl.pathname.startsWith('/editor/api/');
  let hayUsuario = false;
  let sinConexion = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    hayUsuario = !!data.user;
    sinConexion = !hayUsuario && esFalloDeConexion(error);
  } catch {
    sinConexion = true; // getUser devuelve los errores de auth; cualquier otra excepción es un fallo de red o similar
  }
  if (!hayUsuario && !esPublica(peticion.nextUrl.pathname)) {
    if (sinConexion) {
      return esApi ? NextResponse.json({ error: MENSAJE_SIN_CONEXION }, { status: 503 }) : paginaSinConexion();
    }
    // La API la llama el formulario con fetch: responde 401 en JSON (una redirección haría que
    // el navegador siguiera a la página de entrar y el formulario perdiera lo escrito).
    if (esApi) {
      return NextResponse.json({ error: 'Tu sesión venció. Entra de nuevo' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/editor/entrar', peticion.url));
  }
  return respuesta;
}

// Solo /editor: las pantallas estáticas de vicaria (/<slug>/…) no pasan por aquí.
export const config = { matcher: ['/editor', '/editor/:path*'] };
