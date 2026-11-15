/**
 * Punto donde se enganchan las descargas de la app (3a, 3c y 3b) y las limpiezas por parroquia.
 *
 * La app llama a `sincronizador.sincronizar(momento, …)` en tres momentos:
 *   - 'abrir': una vez por proceso, con la parroquia lista y con red (si no hay red, cuando vuelve);
 *   - 'antes-de-iniciar': cada vez que se muestra la pantalla Antes de iniciar;
 *   - 'al-terminar': cuando `enAire` pasa de true a false.
 *
 * Las tareas van en serie, en el orden en que se registraron. Antes de cada una, si `enVivo()`
 * o `!sigueElegida()`, queda 'saltada'. Un error queda 'fallo', con
 * `console.warn('sincronizar: <nombre> falló')` y sin el mensaje del error. Nunca rechaza.
 */
import type { SesionApp } from '../sesion/sesion';
import type { ParroquiaApp } from '../sesion/tipos';
import type { ClienteSupabase } from '../supabase/cliente';

export type Momento = 'abrir' | 'antes-de-iniciar' | 'al-terminar';

export interface ContextoSincronizar {
  momento: Momento;
  parroquia: ParroquiaApp;
  sesion: SesionApp;
  cliente: ClienteSupabase;
  enVivo(): boolean;
  sigueElegida(): boolean;
}

export type TareaSincronizar = (c: ContextoSincronizar) => Promise<void>;
export type ResultadoTarea = 'ok' | 'fallo' | 'saltada';

export interface Sincronizador {
  registrarTarea(nombre: string, momentos: readonly Momento[], tarea: TareaSincronizar): () => void;
  sincronizar(momento: Momento, base: Omit<ContextoSincronizar, 'momento'>): Promise<Record<string, ResultadoTarea>>;
}

export type AlcanceLimpieza = { tipo: 'parroquia'; parroquia: ParroquiaApp } | { tipo: 'todo' };

export interface Limpiezas {
  registrar(nombre: string, fn: (a: AlcanceLimpieza) => Promise<void>): () => void;
  limpiar(a: AlcanceLimpieza): Promise<Record<string, 'ok' | 'fallo'>>;
}

type Registrada = { nombre: string; momentos: readonly Momento[]; tarea: TareaSincronizar };

export function crearSincronizador(): Sincronizador {
  let tareas: Registrada[] = [];
  const enVuelo = new Map<Momento, Promise<Record<string, ResultadoTarea>>>();

  async function correr(momento: Momento, base: Omit<ContextoSincronizar, 'momento'>) {
    const contexto: ContextoSincronizar = { ...base, momento };
    const resultado: Record<string, ResultadoTarea> = {};
    for (const t of tareas.filter((r) => r.momentos.includes(momento))) {
      let saltar = true;
      try {
        saltar = base.enVivo() || !base.sigueElegida();
      } catch {
        // Si no se puede saber, se salta: nunca se baja nada en vivo por error.
      }
      if (saltar) {
        resultado[t.nombre] = 'saltada';
        continue;
      }
      try {
        await t.tarea(contexto);
        resultado[t.nombre] = 'ok';
      } catch {
        resultado[t.nombre] = 'fallo';
        console.warn('sincronizar: ' + t.nombre + ' falló');
      }
    }
    return resultado;
  }

  return {
    registrarTarea(nombre, momentos, tarea) {
      const r: Registrada = { nombre, momentos: [...momentos], tarea };
      tareas = [...tareas, r];
      return () => {
        tareas = tareas.filter((x) => x !== r);
      };
    },

    sincronizar(momento, base) {
      const ya = enVuelo.get(momento);
      if (ya) return ya;
      const p = correr(momento, base).finally(() => {
        if (enVuelo.get(momento) === p) enVuelo.delete(momento);
      });
      enVuelo.set(momento, p);
      return p;
    },
  };
}

export function crearLimpiezas(): Limpiezas {
  let registradas: Array<{ nombre: string; fn: (a: AlcanceLimpieza) => Promise<void> }> = [];

  return {
    registrar(nombre, fn) {
      const r = { nombre, fn };
      registradas = [...registradas, r];
      return () => {
        registradas = registradas.filter((x) => x !== r);
      };
    },

    async limpiar(a) {
      const resultado: Record<string, 'ok' | 'fallo'> = {};
      for (const r of registradas) {
        try {
          await r.fn(a);
          resultado[r.nombre] = 'ok';
        } catch {
          resultado[r.nombre] = 'fallo';
          console.warn('limpiar: ' + r.nombre + ' falló');
        }
      }
      return resultado;
    },
  };
}

/** Los de la app. */
export const sincronizador: Sincronizador = crearSincronizador();
export const limpiezas: Limpiezas = crearLimpiezas();
