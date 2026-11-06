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

/** Cuánto se espera a que la ventana gire antes de mostrar la pantalla igual (review m3 de la 9c). */
export const ESPERA_GIRO_MS = 1500;

/**
 * Qué pantalla se dibuja, según la ventana real.
 * - Si la ventana ya tiene la forma pedida, la pantalla pedida.
 * - Mientras gira (`vencida` false), ninguna: la ventana todavía tiene la forma vieja.
 * - Si no giró a tiempo (fijarOrientacion falló, o el sistema ignoró el pedido), nunca queda vacía:
 *   Preparar con la ventana acostada pasa a Antes de iniciar, que es la pantalla acostada. Antes de
 *   iniciar y al aire se muestran igual aunque la ventana quede parada: así siempre se puede iniciar
 *   y los controles del vivo nunca desaparecen.
 */
export function pantallaVisible(p: Pantalla, ventanaVertical: boolean, vencida: boolean): Pantalla | null {
  if (ventanaVertical === (orientacionPara(p) === 'vertical')) return p;
  if (!vencida) return null;
  if (p === 'preparar') return 'antes';
  return p;
}
