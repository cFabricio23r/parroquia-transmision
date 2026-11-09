import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Cliente de Supabase con la sesión de quien visita (cookies). Solo en el servidor. */
export async function clienteServidor() {
  const almacen = await cookies(); // Next 16: cookies() es asíncrono
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return almacen.getAll();
        },
        setAll(lista) {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // Desde un Server Component no se pueden escribir cookies: proxy.ts refresca la sesión.
          }
        },
      },
    },
  );
}
