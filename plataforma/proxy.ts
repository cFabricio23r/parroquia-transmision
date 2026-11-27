import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { esFalloDeConexion } from './lib/conexion';
import { MENSAJES_ACCESO } from './lib/mensajes-acceso';

// Rutas del editor que se pueden ver sin sesión.
const PUBLICAS = ['/editor/entrar', '/editor/olvide', '/editor/invitacion', '/editor/auth'];

const RUTA_DE_APP = /^\/editor\/api\/[^/]+\/app\/(facebook|vivo(\/[^/]+)?)\/?$/;

const esPublica = (ruta: string) => PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

export const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor. Intenta de nuevo en un momento';

export { esFalloDeConexion }; // vive en lib/conexion.ts (también lo usa lib/sesion.ts)

/**
 * La página que se muestra (con 503) en lugar de mandar a entrar cuando Supabase no responde:
 * la tarjeta «Sin conexión» de A5 bajo la franja del encabezado. HTML suelto con estilos en línea
 * (el proxy no pasa por los layouts); Montserrat sale de /fuentes, sin red de terceros.
 */
function paginaSinConexion(): NextResponse {
  const m = MENSAJES_ACCESO['sin-conexion'];
  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${m.titulo} · Parroquia en Vivo</title>
<style>
@font-face{font-family:'Montserrat';font-weight:600;font-display:swap;src:url('/fuentes/montserrat-latin-600-normal.woff2') format('woff2')}
@font-face{font-family:'Montserrat';font-weight:700;font-display:swap;src:url('/fuentes/montserrat-latin-700-normal.woff2') format('woff2')}
@font-face{font-family:'Montserrat';font-weight:800;font-display:swap;src:url('/fuentes/montserrat-latin-800-normal.woff2') format('woff2')}
*{box-sizing:border-box}
body{margin:0;background:#f4f7fb;color:#14223a;font-family:'Montserrat',sans-serif}
header{height:64px;background:#0c3562;color:#fff;display:flex;align-items:center;padding:0 28px;font-weight:800;font-size:16px}
main{display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 64px);padding:24px 16px}
.tarjeta{width:min(440px,100%);background:#fff;border:1px solid #d5e0ee;border-radius:14px;padding:22px;display:flex;flex-direction:column;gap:10px}
.cabeza{display:flex;align-items:center;gap:10px}
.punto{width:10px;height:10px;border-radius:50%;background:#1155a4;flex-shrink:0}
h1{margin:0;font-size:16px;font-weight:800}
p{margin:0;font-size:14px;line-height:1.5;color:#56657a}
a{align-self:flex-start;display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border:1.5px solid #d5e0ee;border-radius:10px;background:#fff;color:#14223a;font-weight:700;font-size:15px;text-decoration:none}
a:focus-visible{outline:3px solid #1155a4;outline-offset:2px}
</style></head>
<body><header>Parroquia en Vivo</header><main><div class="tarjeta"><div class="cabeza"><span class="punto" aria-hidden="true"></span><h1>${m.titulo}</h1></div><p role="alert">${m.texto}</p><a href="">Reintentar</a></div></main></body>
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
  // La app del celular llama a /editor/api/<slug>/app/… con `Authorization: Bearer` y sin cookies: esas rutas
  // validan el token ellas mismas (lib/supabase/con-token.ts) y responden 401 por su cuenta.
  if (RUTA_DE_APP.test(peticion.nextUrl.pathname) && /^Bearer\s+\S+$/i.test(peticion.headers.get('authorization')?.trim() ?? '')) {
    return NextResponse.next({ request: peticion });
  }
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
