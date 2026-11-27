import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clienteServidor } from './servidor';

/**
 * El cliente de Supabase de quien hace la petición, para las rutas que también llama la app del celular.
 *  - Con `Authorization: Bearer <jwt>`: un cliente con ese token en `global.headers` (así `auth.getUser()` y
 *    RLS lo usan), validado con `auth.getUser()`. Un token inválido, vencido o mal escrito da `null`: la
 *    ruta responde 401 con MENSAJE_SIN_SESION.
 *  - Sin ese encabezado: el cliente de cookies (`clienteServidor`), así las mismas rutas sirven desde el navegador.
 * El token nunca se escribe en la consola ni en ningún error.
 */
export async function clienteConToken(peticion: Request): Promise<SupabaseClient | null> {
  const encabezado = peticion.headers.get('authorization');
  if (encabezado === null) return clienteServidor();
  const coincide = /^Bearer\s+(\S+)$/i.exec(encabezado.trim());
  if (!coincide) return null;
  const cliente = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${coincide[1]}` } },
    },
  );
  try {
    const { data, error } = await cliente.auth.getUser();
    return error || !data.user ? null : cliente;
  } catch {
    return null;
  }
}
