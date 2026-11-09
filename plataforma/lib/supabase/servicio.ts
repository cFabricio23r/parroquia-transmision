import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Cliente con la llave secreta (service_role): salta RLS. Jamás en un componente cliente. */
export function clienteServicio() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
