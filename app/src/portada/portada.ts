// Qué se ve al abrir la app (Tarea 9b).
// 1. El splash del sistema (expo-splash-screen): el logo sobre azul, mientras cargan las fuentes.
//    En Android 12+ ese splash solo admite un ícono centrado sobre un color.
// 2. La portada de React (diseño 8 completo, con «Parroquia en vivo»), encima de la app ya montada,
//    mientras carga el panel.
// 3. La app.
// Nada la traba: pasada la espera máxima se muestra la app aunque falte algo.

export type FasePortada = 'nativo' | 'portada' | 'app';

/** Tope de la espera desde que arranca la app, para que una carga trabada no deje la portada puesta. */
export const ESPERA_MAXIMA_MS = 4000;

export function fasePortada(e: { fuentesListas: boolean; panelCargado: boolean; vencida: boolean }): FasePortada {
  if (e.vencida) return 'app';
  if (!e.fuentesListas) return 'nativo';
  if (!e.panelCargado) return 'portada';
  return 'app';
}
