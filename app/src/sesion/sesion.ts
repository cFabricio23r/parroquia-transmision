/**
 * La sesión vigente de la app y su renovación.
 *
 * El `refresh_token` de Supabase rota: dos renovaciones en paralelo con el mismo token hacen
 * que la segunda falle y la app cerraría la sesión sin motivo. Por eso hay una sola renovación
 * en vuelo (`renovando`), que comparten todos los pedidos que la necesitan.
 *
 * - Sin red al renovar: se devuelve `sin-conexion` y la sesión guardada queda (la app sigue con lo suyo).
 * - Renovación rechazada (400/401 → `sesion-invalida`): se borra la sesión y se avisa a `alInvalidarse`.
 *
 * Nada de acá escribe en `console.*`.
 */
import type { ClienteSupabase, Resultado, SesionSupabase } from '../supabase/cliente';
import type { AlmacenSesion } from './almacen';

/** Se renueva si el token vence en menos de esto. */
export const MARGEN_RENOVAR_S = 60;

export interface SesionApp {
  /** Del almacén. */
  cargar(): Promise<SesionSupabase | null>;
  guardar(s: SesionSupabase): Promise<void>;
  olvidar(): Promise<void>;
  actual(): SesionSupabase | null;
  /** Corre fn con una sesión vigente: renueva si vence en menos de 60 s (una sola renovación en vuelo) y reintenta una vez si fn da 'sesion-invalida'. */
  conSesion<T>(fn: (s: SesionSupabase) => Promise<Resultado<T>>): Promise<Resultado<T>>;
  alInvalidarse(cb: () => void): () => void;
}

const SESION_INVALIDA = { ok: false, error: { tipo: 'sesion-invalida' } } as const;

export function crearSesionApp(d: {
  cliente: ClienteSupabase;
  almacen: Pick<AlmacenSesion, 'leerSesion' | 'guardarSesion' | 'borrarSesion'>;
  /** En ms, como `Date.now`. */
  ahora?: () => number;
}): SesionApp {
  const ahora = d.ahora ?? Date.now;
  let actual: SesionSupabase | null = null;
  let renovando: Promise<Resultado<SesionSupabase>> | null = null;
  const avisos = new Set<() => void>();

  function vencePronto(s: SesionSupabase): boolean {
    return s.expiraEn - ahora() / 1000 < MARGEN_RENOVAR_S;
  }

  async function invalidar(): Promise<void> {
    actual = null;
    try {
      await d.almacen.borrarSesion();
    } catch {
      // El keystore falló al borrar: la sesión en memoria ya no está, y la próxima renovación la volverá a rechazar.
    }
    for (const cb of [...avisos]) {
      try {
        cb();
      } catch {
        // Un aviso que falla no corta a los demás.
      }
    }
  }

  /** Una sola renovación en vuelo, a partir de la sesión `desde`. */
  function renovar(desde: SesionSupabase): Promise<Resultado<SesionSupabase>> {
    if (renovando) return renovando;
    renovando = (async () => {
      const r = await d.cliente.renovar(desde.refreshToken);
      // Si mientras tanto entró otra sesión (o se cerró), no se pisa nada.
      const sigue = actual !== null && actual.refreshToken === desde.refreshToken;
      if (r.ok) {
        if (sigue) {
          actual = r.valor;
          try {
            await d.almacen.guardarSesion(r.valor);
          } catch {
            // Se sigue con la sesión nueva en memoria.
          }
        }
        return r;
      }
      if (r.error.tipo === 'sesion-invalida' && sigue) await invalidar();
      return r;
    })();
    const esta = renovando;
    esta.finally(() => {
      if (renovando === esta) renovando = null;
    }).catch(() => {});
    return esta;
  }

  async function vigente(): Promise<Resultado<SesionSupabase>> {
    if (renovando) return renovando;
    const s = actual;
    if (!s) return SESION_INVALIDA;
    if (!vencePronto(s)) return { ok: true, valor: s };
    return renovar(s);
  }

  return {
    async cargar() {
      actual = await d.almacen.leerSesion();
      return actual;
    },

    async guardar(s) {
      actual = s;
      await d.almacen.guardarSesion(s);
    },

    async olvidar() {
      actual = null;
      await d.almacen.borrarSesion();
    },

    actual() {
      return actual;
    },

    async conSesion<T>(fn: (s: SesionSupabase) => Promise<Resultado<T>>): Promise<Resultado<T>> {
      const v = await vigente();
      if (!v.ok) return v;
      const r = await fn(v.valor);
      if (r.ok || r.error.tipo !== 'sesion-invalida') return r;
      // El servidor rechazó un token que parecía vigente: se renueva (si nadie lo hizo ya) y se reintenta una vez.
      let otra: Resultado<SesionSupabase>;
      if (renovando) otra = await renovando;
      else if (actual && actual.accessToken !== v.valor.accessToken) otra = { ok: true, valor: actual };
      else if (actual) otra = await renovar(actual);
      else return SESION_INVALIDA;
      if (!otra.ok) return otra;
      return fn(otra.valor);
    },

    alInvalidarse(cb) {
      avisos.add(cb);
      return () => {
        avisos.delete(cb);
      };
    },
  };
}
