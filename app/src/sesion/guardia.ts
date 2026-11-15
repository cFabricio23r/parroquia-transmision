/**
 * Guardia «en vivo»: mientras la transmisión está al aire, nada de esta etapa baja, sube,
 * avisa ni cierra la sesión. Lo que tenga que mostrarse al terminar se agenda con `alTerminar`.
 */
export interface GuardiaEnVivo {
  enVivo(): boolean;
  fijar(enVivo: boolean): void;
  /** Fuera del vivo, llama a fn enseguida. En vivo, la llama una sola vez al terminar. Devuelve con qué cancelarla. */
  alTerminar(fn: () => void): () => void;
}

function llamar(fn: () => void) {
  try {
    fn();
  } catch {
    // Una que falla no corta a las demás.
  }
}

export function crearGuardia(): GuardiaEnVivo {
  let vivo = false;
  let pendientes: Array<() => void> = [];

  return {
    enVivo: () => vivo,

    fijar(enVivo) {
      const termina = vivo && !enVivo;
      vivo = enVivo;
      if (!termina) return;
      const ahora = pendientes;
      pendientes = [];
      for (const fn of ahora) llamar(fn);
    },

    alTerminar(fn) {
      if (!vivo) {
        llamar(fn);
        return () => {};
      }
      pendientes.push(fn);
      return () => {
        pendientes = pendientes.filter((p) => p !== fn);
      };
    },
  };
}

/** La de la app. */
export const guardiaEnVivo: GuardiaEnVivo = crearGuardia();
