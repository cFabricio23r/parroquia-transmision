// Estado de la transmisión: TypeScript puro, sin React ni código nativo.
// Las pantallas despachan eventos; cada segundo llega un 'tic'. Cuando
// debeCortar(antes, despues) da true, la app llama al terminar() nativo una sola vez.

export type Escena = 'camara' | 'inicio' | 'portada' | 'avisos' | 'gracias';
export type Fase = 'preparando' | 'iniciando' | 'en_vivo' | 'reconectando' | 'terminando' | 'terminado';

export interface EstadoTransmision {
  fase: Fase;
  escena: Escena;
  segundos: number;
  /** Segundos que faltan para cortar; null si no hay cuenta (o ya se cortó). */
  cuentaFinal: number | null;
  error: string | null;
}

export type Evento =
  | { tipo: 'iniciar' }
  | { tipo: 'conectado' }
  | { tipo: 'reconectando' }
  | { tipo: 'cortado'; mensaje: string }
  | { tipo: 'escena'; escena: Escena }
  | { tipo: 'tic' }
  | { tipo: 'terminar_con_gracias' }
  | { tipo: 'terminar_ahora' }
  | { tipo: 'seguir' }
  | { tipo: 'terminado' };

/** Duración de la cuenta de despedida, en segundos. */
const CUENTA_GRACIAS = 10;

export const ESTADO_INICIAL: EstadoTransmision = Object.freeze({
  fase: 'preparando',
  escena: 'inicio',
  segundos: 0,
  cuentaFinal: null,
  error: null,
});

const alAire = (e: EstadoTransmision): boolean => e.fase === 'en_vivo' || e.fase === 'reconectando';

// Pasa a 'terminando' sin cuenta: es la señal para cortar de inmediato.
// Si ya se cortó (sin cuenta, o la cuenta llegó a 0) no cambia nada, para no cortar dos veces.
const terminarYa = (e: EstadoTransmision): EstadoTransmision =>
  e.fase === 'terminando' && (e.cuentaFinal === null || e.cuentaFinal === 0)
    ? e
    : { ...e, fase: 'terminando', cuentaFinal: null };

/**
 * Función pura: nunca modifica `e`. Si el evento no tiene sentido en la fase actual
 * (o no cambia nada), devuelve el mismo objeto.
 */
export function reducir(e: EstadoTransmision, ev: Evento): EstadoTransmision {
  switch (ev.tipo) {
    case 'iniciar':
      if (e.fase === 'preparando') return { ...e, fase: 'iniciando', error: null };
      // Otra transmisión después de terminar: arranca de cero (Tarea 8).
      if (e.fase === 'terminado') return { ...ESTADO_INICIAL, fase: 'iniciando' };
      return e;

    case 'conectado':
      // Desde 'reconectando' vuelve sin tocar segundos.
      return e.fase === 'iniciando' || e.fase === 'reconectando' ? { ...e, fase: 'en_vivo' } : e;

    case 'reconectando':
      // En 'terminando' no se toca: la cuenta sigue y se corta igual.
      return e.fase === 'en_vivo' ? { ...e, fase: 'reconectando' } : e;

    case 'cortado':
      // Rechazo al iniciar (p. ej. clave): el nativo ya arrancó, debeCortar lo libera.
      if (e.fase === 'iniciando') return { ...e, fase: 'preparando', error: ev.mensaje };
      // Se agotaron los reintentos con la emisión al aire: se vuelve a cero.
      if (alAire(e)) return { ...ESTADO_INICIAL, error: ev.mensaje };
      if (e.fase === 'terminando') return terminarYa(e);
      return e;

    case 'escena':
      return alAire(e) && e.escena !== ev.escena ? { ...e, escena: ev.escena } : e;

    case 'tic':
      if (alAire(e)) return { ...e, segundos: e.segundos + 1 };
      if (e.fase === 'terminando') {
        const cuenta = e.cuentaFinal !== null && e.cuentaFinal > 0 ? e.cuentaFinal - 1 : e.cuentaFinal;
        return { ...e, segundos: e.segundos + 1, cuentaFinal: cuenta };
      }
      return e;

    case 'terminar_con_gracias':
      // Durante 'iniciando' se cancela el arranque que quedó colgado.
      if (e.fase === 'iniciando') return { ...e, fase: 'preparando', error: null };
      return alAire(e) ? { ...e, fase: 'terminando', escena: 'gracias', cuentaFinal: CUENTA_GRACIAS } : e;

    case 'terminar_ahora':
      if (e.fase === 'iniciando') return { ...e, fase: 'preparando', error: null };
      return alAire(e) || e.fase === 'terminando' ? terminarYa(e) : e;

    case 'seguir':
      // Solo mientras la cuenta corre; si ya se cortó no se revive.
      return e.fase === 'terminando' && e.cuentaFinal !== null && e.cuentaFinal > 0
        ? { ...e, fase: 'en_vivo', cuentaFinal: null }
        : e;

    case 'terminado':
      return e.fase === 'terminado' ? e : { ...e, fase: 'terminado', cuentaFinal: null };
  }
}

/**
 * true solo en el instante en que hay que parar la transmisión nativa:
 *  - paso a 'terminando' sin cuenta (terminar ahora, o cortado durante la cuenta);
 *  - la cuenta llega a 0;
 *  - se cae la emisión estando al aire, o falla/se cancela el arranque (vuelve a 'preparando').
 * Cada uno ocurre una sola vez, porque después el estado ya no cambia de esa forma.
 */
export function debeCortar(antes: EstadoTransmision, despues: EstadoTransmision): boolean {
  if (despues.fase === 'terminando') {
    if (despues.cuentaFinal === null) {
      return antes.fase !== 'terminando' || antes.cuentaFinal !== null;
    }
    return despues.cuentaFinal === 0 && antes.fase === 'terminando' && (antes.cuentaFinal ?? 0) > 0;
  }
  return despues.fase === 'preparando'
    && (antes.fase === 'iniciando' || antes.fase === 'en_vivo' || antes.fase === 'reconectando');
}
