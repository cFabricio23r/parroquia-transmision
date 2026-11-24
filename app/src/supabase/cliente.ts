/**
 * Cliente chico de Supabase hecho con `fetch` (Auth y PostgREST), detrás de `ClienteSupabase`.
 * `@supabase/supabase-js` no entra en la app.
 *
 * Formato verificado en `plataforma/node_modules/@supabase` (ver el plan 3a):
 *   - entrar:  POST {url}/auth/v1/token?grant_type=password       con {email, password};
 *   - renovar: POST {url}/auth/v1/token?grant_type=refresh_token  con {refresh_token};
 *   - la clave `sb_publishable_…` va solo en `apikey`, nunca como Bearer.
 *
 * Nada de este archivo escribe en `console.*` ni pone un token o una contraseña en un resultado.
 */

export interface SesionSupabase {
  accessToken: string;
  refreshToken: string;
  /** epoch en s */
  expiraEn: number;
  usuarioId: string;
  correo: string;
}

export type ErrorSupabase =
  | { tipo: 'sin-conexion' }
  | { tipo: 'incorrectos' }
  | { tipo: 'muchos-intentos' }
  | { tipo: 'sesion-invalida' }
  | { tipo: 'permiso' }
  /** `codigo`: el `code` del cuerpo de PostgREST, si vino (23505 nombre repetido, P0001…). */
  | { tipo: 'servidor'; estado: number; codigo?: string };

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: ErrorSupabase };

export interface ClienteSupabase {
  entrar(correo: string, clave: string): Promise<Resultado<SesionSupabase>>;
  renovar(refreshToken: string): Promise<Resultado<SesionSupabase>>;
  /** GET /rest/v1/<tabla>?<consulta>. `consulta` va tal cual en PostgREST: { select: 'id,slug', visible: 'eq.true', order: 'nombre.asc' }. */
  seleccionar<T>(sesion: SesionSupabase, tabla: string, consulta: Readonly<Record<string, string>>): Promise<Resultado<T[]>>;
  /** POST /rest/v1/<tabla>?on_conflict=<conflicto>, con Prefer: resolution=merge-duplicates,return=representation. */
  upsert<T>(sesion: SesionSupabase, tabla: string, filas: readonly object[], conflicto: string): Promise<Resultado<T[]>>;
  /** POST /rest/v1/rpc/<funcion> con `args` en el cuerpo. El valor es el cuerpo leído como JSON (null si vino vacío). */
  rpc(sesion: SesionSupabase, funcion: string, args: object): Promise<Resultado<unknown>>;
}

export const PLAZO_POR_DEFECTO_MS = 20_000;

const RE_NOMBRE = /^[a-z_]+$/;
const RE_CONFLICTO = /^[a-z_,]+$/;

/** Lo que vuelve de un pedido: el estado y el cuerpo en texto, o null si no hubo respuesta (red caída o plazo vencido). */
export type Respuesta = { estado: number; texto: string } | null;

/**
 * `fetch` con plazo: `Promise.race` con un temporizador y, si existe, `AbortController`.
 * Nunca rechaza y nunca deja ver el error original (puede traer la URL o el cuerpo).
 */
export async function pedirConPlazo(
  f: typeof fetch,
  url: string,
  init: RequestInit,
  plazoMs: number,
): Promise<Respuesta> {
  const control = typeof AbortController === 'function' ? new AbortController() : null;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<null>((resolver) => {
    temporizador = setTimeout(() => {
      try {
        control?.abort();
      } catch {
        // nada: el plazo ya resolvió
      }
      resolver(null);
    }, plazoMs);
  });
  const pedido = (async (): Promise<Respuesta> => {
    try {
      const r = await f(url, control ? { ...init, signal: control.signal } : init);
      const texto = await r.text();
      return { estado: r.status, texto };
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([pedido, plazo]);
  } finally {
    if (temporizador !== undefined) clearTimeout(temporizador);
  }
}

export function leerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sesionDeToken(cuerpo: unknown, ahoraS: number): SesionSupabase | null {
  if (!esObjeto(cuerpo)) return null;
  const { access_token, refresh_token, expires_in, expires_at, user } = cuerpo;
  if (typeof access_token !== 'string' || access_token === '') return null;
  if (typeof refresh_token !== 'string' || refresh_token === '') return null;
  if (!esObjeto(user) || typeof user.id !== 'string' || user.id === '') return null;
  let expiraEn: number;
  if (typeof expires_at === 'number' && Number.isFinite(expires_at)) expiraEn = Math.floor(expires_at);
  else if (typeof expires_in === 'number' && Number.isFinite(expires_in)) expiraEn = ahoraS + Math.floor(expires_in);
  else return null;
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiraEn,
    usuarioId: user.id,
    correo: typeof user.email === 'string' ? user.email : '',
  };
}

function falla<T>(error: ErrorSupabase): Resultado<T> {
  return { ok: false, error };
}

export function crearClienteSupabase(o: {
  url: string;
  clavePublica: string;
  fetch?: typeof fetch;
  plazoMs?: number;
}): ClienteSupabase {
  const base = o.url.replace(/\/+$/, '');
  const plazoMs = o.plazoMs ?? PLAZO_POR_DEFECTO_MS;
  const f = (...args: Parameters<typeof fetch>) => (o.fetch ?? fetch)(...args);

  async function token(tipo: 'password' | 'refresh_token', cuerpo: object): Promise<Respuesta> {
    return pedirConPlazo(
      f,
      base + '/auth/v1/token?grant_type=' + tipo,
      {
        method: 'POST',
        headers: { apikey: o.clavePublica, 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
      },
      plazoMs,
    );
  }

  function sesionDeRespuesta(r: { estado: number; texto: string }): Resultado<SesionSupabase> {
    const s = sesionDeToken(leerJson(r.texto), Math.floor(Date.now() / 1000));
    return s ? { ok: true, valor: s } : falla({ tipo: 'servidor', estado: r.estado });
  }

  function cabecerasRest(sesion: SesionSupabase): Record<string, string> {
    return { apikey: o.clavePublica, authorization: 'Bearer ' + sesion.accessToken };
  }

  function errorRest<T>(r: Respuesta): Resultado<T> | null {
    if (r === null || r.estado >= 500) return falla({ tipo: 'sin-conexion' });
    if (r.estado === 401) return falla({ tipo: 'sesion-invalida' });
    if (r.estado === 403) return falla({ tipo: 'permiso' });
    if (r.estado < 200 || r.estado >= 300) {
      const cuerpo = leerJson(r.texto);
      const codigo = esObjeto(cuerpo) && typeof cuerpo.code === 'string' ? cuerpo.code : undefined;
      return falla(codigo === undefined ? { tipo: 'servidor', estado: r.estado } : { tipo: 'servidor', estado: r.estado, codigo });
    }
    return null;
  }

  function filasDe<T>(r: { estado: number; texto: string }): Resultado<T[]> {
    const cuerpo = leerJson(r.texto);
    return Array.isArray(cuerpo) ? { ok: true, valor: cuerpo as T[] } : falla({ tipo: 'servidor', estado: r.estado });
  }

  return {
    async entrar(correo, clave) {
      const r = await token('password', { email: correo.trim().toLowerCase(), password: clave });
      if (r === null || r.estado >= 500) return falla({ tipo: 'sin-conexion' });
      if (r.estado === 429) return falla({ tipo: 'muchos-intentos' });
      if (r.estado >= 400) {
        const cuerpo = leerJson(r.texto);
        if (esObjeto(cuerpo) && cuerpo.code === 'over_request_rate_limit') return falla({ tipo: 'muchos-intentos' });
        if (r.estado === 400 || r.estado === 401 || r.estado === 422) return falla({ tipo: 'incorrectos' });
        return falla({ tipo: 'servidor', estado: r.estado });
      }
      return sesionDeRespuesta(r);
    },

    async renovar(refreshToken) {
      const r = await token('refresh_token', { refresh_token: refreshToken });
      if (r === null || r.estado >= 500) return falla({ tipo: 'sin-conexion' });
      if (r.estado === 400 || r.estado === 401) return falla({ tipo: 'sesion-invalida' });
      if (r.estado === 429) return falla({ tipo: 'muchos-intentos' });
      if (r.estado >= 300 || r.estado < 200) return falla({ tipo: 'servidor', estado: r.estado });
      return sesionDeRespuesta(r);
    },

    async seleccionar<T>(sesion: SesionSupabase, tabla: string, consulta: Readonly<Record<string, string>>) {
      const claves = Object.keys(consulta);
      if (!RE_NOMBRE.test(tabla) || claves.some((k) => !RE_NOMBRE.test(k))) throw new Error('Consulta inválida.');
      const qs = claves.map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(consulta[k])).join('&');
      const r = await pedirConPlazo(
        f,
        base + '/rest/v1/' + tabla + (qs ? '?' + qs : ''),
        { method: 'GET', headers: cabecerasRest(sesion) },
        plazoMs,
      );
      return errorRest<T[]>(r) ?? filasDe<T>(r!);
    },

    async upsert<T>(sesion: SesionSupabase, tabla: string, filas: readonly object[], conflicto: string) {
      if (!RE_NOMBRE.test(tabla) || !RE_CONFLICTO.test(conflicto)) throw new Error('Consulta inválida.');
      const r = await pedirConPlazo(
        f,
        base + '/rest/v1/' + tabla + '?on_conflict=' + encodeURIComponent(conflicto),
        {
          method: 'POST',
          headers: {
            ...cabecerasRest(sesion),
            'content-type': 'application/json',
            prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(filas),
        },
        plazoMs,
      );
      return errorRest<T[]>(r) ?? filasDe<T>(r!);
    },

    async rpc(sesion, funcion, args) {
      if (!RE_NOMBRE.test(funcion)) throw new Error('Consulta inválida.');
      const r = await pedirConPlazo(
        f,
        base + '/rest/v1/rpc/' + funcion,
        {
          method: 'POST',
          headers: { ...cabecerasRest(sesion), 'content-type': 'application/json' },
          body: JSON.stringify(args),
        },
        plazoMs,
      );
      const e = errorRest<unknown>(r);
      if (e) return e;
      return { ok: true, valor: leerJson(r!.texto) ?? null };
    },
  };
}
