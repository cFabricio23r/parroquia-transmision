// Qué pantalla y qué orientación corresponden a cada fase (Tarea 9c).
// - Preparar va en vertical: vista previa chica, tira de escenas y el panel.
// - «Listo» pasa a «Antes de iniciar», en horizontal.
// - Al aire la orientación queda fija en horizontal, pase lo que pase.
// - Al terminar se vuelve a Preparar, en vertical.
// La transmisión siempre es 16:9; solo gira la pantalla del operador.
import type { Fase } from './transmision';

export type Pantalla = 'preparar' | 'antes' | 'aire';
export type Orientacion = 'vertical' | 'horizontal';

const alAire = (f: Fase): boolean =>
  f === 'iniciando' || f === 'en_vivo' || f === 'reconectando' || f === 'terminando';

/** La pantalla sale de la fase (ruling de la Tarea 8) y de si el operador ya tocó «Listo». */
export function pantallaPara(fase: Fase, listo: boolean): Pantalla {
  if (alAire(fase)) return 'aire';
  return listo ? 'antes' : 'preparar';
}

export function orientacionPara(p: Pantalla): Orientacion {
  return p === 'preparar' ? 'vertical' : 'horizontal';
}

/**
 * Cómo queda «Listo» cuando la fase cambia.
 * - Al terminar (fase `terminado`) se vuelve a Preparar.
 * - Al salir al aire queda puesto: si se cancela o se corta, se vuelve a «Antes de iniciar»
 *   en horizontal, donde se ve el error y está «Iniciar transmisión».
 */
export function listoTrasCambio(listo: boolean, antes: Fase, ahora: Fase): boolean {
  if (antes === ahora) return listo;
  if (ahora === 'terminado') return false;
  if (alAire(ahora)) return true;
  return listo;
}
