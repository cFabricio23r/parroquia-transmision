// Lógica de sesión sin dependencias de Next: recibe los clientes y el envío de correo,
// así se prueba contra el Supabase local. Los envoltorios 'use server' están en
// app/editor/acciones-sesion.ts.
import type { EmailOtpType, SupabaseClient } from '@supabase/supabase-js';
import type { Mensaje } from './correo';
import { correoRecuperar } from './correo';
import { MINIMO_CLAVE } from './clave';
import { esFalloDeConexion } from './conexion';
import { MENSAJES_ACCESO } from './mensajes-acceso';

export { MINIMO_CLAVE };

export const MENSAJE_RECUPERAR = 'Si ese correo tiene cuenta, te llegó un enlace. Vence en 1 hora';
export const MENSAJE_CLAVE_CORTA = 'La contraseña necesita al menos 8 caracteres';
export const MENSAJE_CLAVES_DISTINTAS = 'Las contraseñas no coinciden';
export const MENSAJE_ENLACE = 'El enlace no sirve o ya venció. Pide uno nuevo';
export const MENSAJE_CLAVE_ACTUAL = 'La contraseña actual no es correcta.';
const MENSAJE_SESION_VENCIDA = 'Tu sesión venció. Entra de nuevo';
const MENSAJE_MISMA_CLAVE = 'Elige una contraseña distinta de la anterior';
export const ESPERA_SEGUNDOS = 60;
export const MAXIMO_POR_DIA = 5;

const normalizar = (correo: string) => correo.trim().toLowerCase();

/**
 * ¿Es el límite de intentos de Auth? (Decisión 12 del plan 2). El código existe en ErrorCode de
 * auth-js; que GoTrue lo devuelva en signInWithPassword no está verificado, por eso también vale el 429.
 */
export function esLimiteDeIntentos(error: { code?: string; status?: number } | null | undefined): boolean {
  return !!error && (error.code === 'over_request_rate_limit' || error.status === 429);
}

export type ErrorEntrar = 'incorrectos' | 'muchos-intentos' | 'sin-conexion';

/**
 * Inicia sesión. Ante credenciales malas, un solo código ('incorrectos'): no revela si el correo existe.
 * El límite de intentos se distingue para decir «espera unos minutos», y la falta de conexión con
 * Supabase para no decirle a alguien con el wifi caído que su contraseña está mal (ronda 2).
 */
export async function entrar(cliente: SupabaseClient, correo: string, clave: string): Promise<{ error?: ErrorEntrar }> {
  const { error } = await cliente.auth.signInWithPassword({ email: normalizar(correo), password: clave });
  if (!error) return {};
  if (esFalloDeConexion(error)) return { error: 'sin-conexion' };
  return { error: esLimiteDeIntentos(error) ? 'muchos-intentos' : 'incorrectos' };
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
  if (error) return { error: error.code === 'same_password' ? MENSAJE_MISMA_CLAVE : 'No se pudo cambiar la contraseña. Pide un enlace nuevo' };
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

/** El `correo` del cuerpo JSON de `POST /editor/olvide/pedir` (la app): si no es texto, `''`. */
export function correoDelCuerpo(cuerpo: unknown): string {
  if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return '';
  const correo = (cuerpo as { correo?: unknown }).correo;
  return typeof correo === 'string' ? correo : '';
}

/** URL pública del sitio para los enlaces de los correos. Fuera de desarrollo/pruebas, sin SITIO_URL falla. */
export function resolverSitioUrl(env: { SITIO_URL?: string; NODE_ENV?: string }): string {
  if (env.SITIO_URL) return env.SITIO_URL.replace(/\/+$/, '');
  if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return 'http://localhost:3000';
  throw new Error('Falta SITIO_URL: sin ella los enlaces de los correos apuntarían a localhost');
}

export interface DepsCambioConActual {
  /** La sesión de cookies de quien cambia la clave. */
  sesion: SupabaseClient;
  /** Crea un cliente aparte, sin persistencia, solo para comprobar la clave actual. */
  verificador: () => SupabaseClient;
}

export type ResultadoCambioConActual = {
  error?: string;
  campo?: 'actual' | 'nueva';
  codigo?: 'muchos-intentos' | 'sin-conexion';
};

/**
 * Cambia la clave desde Mi cuenta pidiendo la actual (Decisión 11 del plan 2). La actual se comprueba
 * con un cliente aparte (signInWithPassword y luego signOut local, que no toca otras sesiones); la
 * sesión de cookies no cambia hasta el updateUser.
 */
export async function cambiarClaveConActual(
  deps: DepsCambioConActual,
  actual: string,
  nueva: string,
  repetida: string,
): Promise<ResultadoCambioConActual> {
  if (nueva.length < MINIMO_CLAVE) return { error: MENSAJE_CLAVE_CORTA, campo: 'nueva' };
  if (nueva !== repetida) return { error: MENSAJE_CLAVES_DISTINTAS, campo: 'nueva' };
  const sinConexion = { codigo: 'sin-conexion', error: MENSAJES_ACCESO['sin-conexion'].texto } as const;
  const { data, error: errorSesion } = await deps.sesion.auth.getUser();
  if (esFalloDeConexion(errorSesion)) return sinConexion;
  const correo = data.user?.email;
  if (!data.user || !correo) return { error: MENSAJE_SESION_VENCIDA };

  const verificador = deps.verificador();
  const { error: errorActual } = await verificador.auth.signInWithPassword({ email: correo, password: actual });
  if (errorActual) {
    if (esFalloDeConexion(errorActual)) return sinConexion;
    if (esLimiteDeIntentos(errorActual)) return { codigo: 'muchos-intentos', error: MENSAJES_ACCESO['muchos-intentos'].texto };
    return { error: MENSAJE_CLAVE_ACTUAL, campo: 'actual' };
  }
  await verificador.auth.signOut({ scope: 'local' });

  const { error } = await deps.sesion.auth.updateUser({ password: nueva });
  if (error) {
    if (error.code === 'same_password') return { error: MENSAJE_MISMA_CLAVE, campo: 'nueva' };
    console.error('[cambiarClaveConActual]', error.message);
    return { error: 'No se pudo cambiar la contraseña. Intenta de nuevo' };
  }
  return {};
}
