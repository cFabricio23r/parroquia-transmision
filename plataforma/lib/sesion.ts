// Lógica de sesión sin dependencias de Next: recibe los clientes y el envío de correo,
// así se prueba contra el Supabase local. Los envoltorios 'use server' están en
// app/editor/acciones-sesion.ts.
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import type { Mensaje } from './correo';
import { correoRecuperar } from './correo';

export const MENSAJE_ENTRAR = 'El correo o la contraseña no coinciden';
export const MENSAJE_RECUPERAR = 'Si ese correo tiene cuenta, te llegó un enlace. Vence en 1 hora';
export const MENSAJE_CLAVE_CORTA = 'La contraseña necesita al menos 8 caracteres';
export const MENSAJE_CLAVES_DISTINTAS = 'Las contraseñas no coinciden';
export const MENSAJE_ENLACE = 'El enlace no sirve o ya venció. Pide uno nuevo';
export const MINIMO_CLAVE = 8;
export const ESPERA_SEGUNDOS = 60;
export const MAXIMO_POR_DIA = 5;

const normalizar = (correo: string) => correo.trim().toLowerCase();

/** Inicia sesión. Ante cualquier fallo el mismo mensaje: no revela si el correo existe. */
export async function entrar(cliente: SupabaseClient, correo: string, clave: string): Promise<{ error?: string }> {
  const { error } = await cliente.auth.signInWithPassword({ email: normalizar(correo), password: clave });
  return error ? { error: MENSAJE_ENTRAR } : {};
}

export interface DepsRecuperacion {
  servicio: SupabaseClient; // service_role
  enviar: (m: Mensaje) => Promise<void>;
  sitioUrl: string;
}

/**
 * Manda el enlace de recuperación si el correo tiene cuenta y no se pasó de los límites
 * (1 por minuto, 5 por día, contados en `envios_correo`). Responde SIEMPRE lo mismo.
 */
export async function pedirRecuperacion(deps: DepsRecuperacion, correoCrudo: string): Promise<{ mensaje: string }> {
  const respuesta = { mensaje: MENSAJE_RECUPERAR };
  const correo = normalizar(correoCrudo);
  if (!correo || !correo.includes('@')) return respuesta;
  try {
    const ahora = Date.now();
    const contar = async (segundos: number) => {
      const desde = new Date(ahora - segundos * 1000).toISOString();
      const { count, error } = await deps.servicio
        .from('envios_correo')
        .select('id', { count: 'exact', head: true })
        .eq('correo', correo)
        .eq('tipo', 'recuperar')
        .gte('en', desde);
      if (error) throw error;
      return count ?? 0;
    };
    if ((await contar(ESPERA_SEGUNDOS)) > 0) return respuesta;
    if ((await contar(24 * 3600)) >= MAXIMO_POR_DIA) return respuesta;

    const { data, error } = await deps.servicio.auth.admin.generateLink({ type: 'recovery', email: correo });
    const hash = data?.properties?.hashed_token;
    if (error || !hash) return respuesta; // sin cuenta: misma respuesta, sin correo

    // Se registra antes de enviar: dos pedidos a la vez no mandan dos correos de sobra.
    const { error: errorRegistro } = await deps.servicio.from('envios_correo').insert({ correo, tipo: 'recuperar' });
    if (errorRegistro) throw errorRegistro;
    const enlace = `${deps.sitioUrl}/editor/auth/confirmar?token_hash=${encodeURIComponent(hash)}&type=recovery`;
    const c = correoRecuperar({ enlace });
    await deps.enviar({ para: correo, ...c });
  } catch (e) {
    // Un fallo interno tampoco se muestra: quedaría distinguible de «no existe».
    console.error('[pedirRecuperacion]', e instanceof Error ? e.message : e);
  }
  return respuesta;
}

/** Canjea el token del enlace (una sola vez) y deja la sesión de recuperación en `cliente`. */
export async function confirmarRecuperacion(
  cliente: SupabaseClient,
  tokenHash: string,
  tipo: string,
): Promise<{ error?: string }> {
  if (!tokenHash || tipo !== 'recovery') return { error: MENSAJE_ENLACE };
  const { error } = await cliente.auth.verifyOtp({ token_hash: tokenHash, type: tipo as EmailOtpType });
  return error ? { error: MENSAJE_ENLACE } : {};
}

/** Cambia la clave de la sesión actual. */
export async function cambiarClave(cliente: SupabaseClient, clave: string, repetida: string): Promise<{ error?: string }> {
  if (clave.length < MINIMO_CLAVE) return { error: MENSAJE_CLAVE_CORTA };
  if (clave !== repetida) return { error: MENSAJE_CLAVES_DISTINTAS };
  const { error } = await cliente.auth.updateUser({ password: clave });
  if (error) return { error: error.code === 'same_password' ? 'Elige una contraseña distinta de la anterior' : 'No se pudo cambiar la contraseña. Pide un enlace nuevo' };
  return {};
}

/**
 * Responde MENSAJE_RECUPERAR al instante y deja todo el trabajo (generateLink, registro y envío)
 * para `programar` (en Next, `after`). Así el tiempo de respuesta no distingue si el correo tiene cuenta.
 */
export function pedirRecuperacionDiferida(
  deps: DepsRecuperacion,
  correo: string,
  programar: (tarea: () => Promise<unknown>) => void,
): { mensaje: string } {
  programar(() => pedirRecuperacion(deps, correo));
  return { mensaje: MENSAJE_RECUPERAR };
}

/** URL pública del sitio para los enlaces de los correos. Fuera de desarrollo/pruebas, sin SITIO_URL falla. */
export function resolverSitioUrl(env: { SITIO_URL?: string; NODE_ENV?: string }): string {
  if (env.SITIO_URL) return env.SITIO_URL.replace(/\/+$/, '');
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return 'http://localhost:3000';
  throw new Error('Falta SITIO_URL: sin ella los enlaces de los correos apuntarían a localhost');
}
