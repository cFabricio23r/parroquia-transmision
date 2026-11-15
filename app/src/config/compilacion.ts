/**
 * Configuración de compilación de la app: de dónde salen las pantallas y dónde está Supabase.
 *
 * Son tres variables, que van en `app/.env.local` (lo ignora `.gitignore`, `.env*`), nunca en git:
 *   - `EXPO_PUBLIC_PLATAFORMA_ORIGEN`: el origen https de la plataforma, sin ruta
 *     (en desarrollo la dirección `vercel.app`; la versión que se instala espera la dirección final);
 *   - `EXPO_PUBLIC_SUPABASE_URL`: el origen https del proyecto de Supabase;
 *   - `EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA`: la clave publicable (`sb_publishable_…`).
 *     La clave secreta (`sb_secret_…`) nunca entra en la app: si aparece, la configuración se rechaza.
 *
 * `babel-preset-expo` reemplaza `process.env.EXPO_PUBLIC_*` al armar la app, por eso
 * `obtenerConfig()` las escribe literalmente.
 */
import { normalizarOrigen } from '../plataforma/direcciones';

export interface ConfigCompilacion {
  origenPlataforma: string;
  supabaseUrl: string;
  supabaseClavePublica: string;
}

export type LecturaConfig = { ok: true; config: ConfigCompilacion } | { ok: false; falta: string };

export function leerConfigCompilacion(env: Record<string, string | undefined>): LecturaConfig {
  const origenPlataforma = normalizarOrigen(env.EXPO_PUBLIC_PLATAFORMA_ORIGEN ?? '');
  if (!origenPlataforma) return { ok: false, falta: 'EXPO_PUBLIC_PLATAFORMA_ORIGEN' };
  const supabaseUrl = normalizarOrigen(env.EXPO_PUBLIC_SUPABASE_URL ?? '');
  if (!supabaseUrl) return { ok: false, falta: 'EXPO_PUBLIC_SUPABASE_URL' };
  const clave = (env.EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA ?? '').trim();
  if (clave === '' || clave.startsWith('sb_secret_')) return { ok: false, falta: 'EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA' };
  return { ok: true, config: { origenPlataforma, supabaseUrl, supabaseClavePublica: clave } };
}

export function obtenerConfig(): LecturaConfig {
  return leerConfigCompilacion({
    EXPO_PUBLIC_PLATAFORMA_ORIGEN: process.env.EXPO_PUBLIC_PLATAFORMA_ORIGEN,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA: process.env.EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA,
  });
}
