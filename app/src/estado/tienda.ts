// Guarda el estado de la transmisión fuera de React y aplica `reducir` evento por evento.
// Así `debeCortar` ve cada paso, aunque React junte varios despachos en un solo render
// (con useReducer y un efecto se podría perder un paso intermedio y, con él, un corte).
import { ESTADO_INICIAL, debeCortar, reducir, type EstadoTransmision, type Evento } from './transmision';

export interface Tienda {
  obtener(): EstadoTransmision;
  despachar(ev: Evento): void;
  /** Devuelve la función para dejar de escuchar. */
  suscribir(cb: () => void): () => void;
}

/** `alCortar(despues)` se llama una sola vez por cada paso en que `debeCortar` da true. */
export function crearTienda(alCortar: (despues: EstadoTransmision) => void): Tienda {
  let estado: EstadoTransmision = ESTADO_INICIAL;
  const oyentes = new Set<() => void>();
  return {
    obtener: () => estado,
    despachar(ev) {
      const antes = estado;
      const despues = reducir(antes, ev);
      if (despues === antes) return;
      estado = despues;
      if (debeCortar(antes, despues)) alCortar(despues);
      for (const cb of [...oyentes]) cb();
    },
    suscribir(cb) {
      oyentes.add(cb);
      return () => {
        oyentes.delete(cb);
      };
    },
  };
}
