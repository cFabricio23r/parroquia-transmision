// Qué se ve al abrir la app (Tarea 9b, rehecha en la 9f con el guion del lienzo).
// 1. El splash del sistema (expo-splash-screen): el logo quieto sobre azul, mientras cargan las
//    fuentes. En Android 12+ ese splash solo admite un ícono centrado sobre un color.
// 2. La portada animada de React (Portada.tsx), encima de la app ya montada: unos 1,6 s según el
//    guion (TRAMOS). Un toque la salta; con «reducir movimiento» se ve fija, sin animación.
// 3. La app, con un fundido. La portada se va cuando la animación terminó (o se tocó) y además el
//    panel ya cargó: si la app no cargó todavía, la portada sigue.
// Nada la traba: pasada la espera máxima se muestra la app aunque falte algo.

export type FasePortada = 'nativo' | 'portada' | 'app';

/** Tope de la espera desde que arranca la app, para que una carga trabada no deje la portada puesta. */
export const ESPERA_MAXIMA_MS = 4000;

/** Duración total de la animación de la portada (guion del lienzo: unos 1,6 s). */
export const DURACION_ANIMACION_MS = 1600;

/** Un tramo del guion, en ms desde que empieza la animación. */
export interface Tramo {
  desde: number;
  hasta: number;
}

/**
 * El guion del lienzo («Guion del splash»), después del cuadro 1 (el splash del sistema, quieto):
 * - logo: pasa el rayo de luz y el logo sube y crece un poco, con el brillo detrás;
 * - vivo: aparece el punto rojo y late con dos ondas;
 * - textos: suben «Parroquia en Vivo» y «COMUNICACIONES», y abajo aparece la Pastoral.
 */
export const TRAMOS: { logo: Tramo; vivo: Tramo; textos: Tramo } = {
  logo: { desde: 0, hasta: 500 },
  vivo: { desde: 500, hasta: 900 },
  textos: { desde: 900, hasta: DURACION_ANIMACION_MS },
};

/** Si la animación ya no tiene que esperarse: terminó, se tocó o no hay animación. */
export function animacionTerminada(e: {
  transcurridoMs: number;
  tocada: boolean;
  reducirMovimiento: boolean;
}): boolean {
  return e.reducirMovimiento || e.tocada || e.transcurridoMs >= DURACION_ANIMACION_MS;
}

export function fasePortada(e: {
  fuentesListas: boolean;
  panelCargado: boolean;
  animacionTerminada: boolean;
  vencida: boolean;
}): FasePortada {
  if (e.vencida) return 'app';
  if (!e.fuentesListas) return 'nativo';
  if (!e.panelCargado || !e.animacionTerminada) return 'portada';
  return 'app';
}
