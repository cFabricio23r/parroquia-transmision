// Sin dependencias de Next: lo usan proxy.ts y lib/sesion.ts.
import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * ¿El error de Auth es que no se pudo hablar con Supabase (red caída, proyecto en pausa, 5xx)?
 * auth-js (lib/fetch.js, handleError) convierte un fallo de fetch o un 5xx en AuthRetryableFetchError,
 * y una respuesta que no se puede leer en AuthUnknownError. Sin sesión da AuthSessionMissingError, y
 * un token vencido o inválido, AuthApiError: eso sí es «no hay sesión» y lleva a entrar.
 */
export const esFalloDeConexion = (error: unknown): boolean =>
  isAuthRetryableFetchError(error) || (isAuthError(error) && error.name === 'AuthUnknownError');
