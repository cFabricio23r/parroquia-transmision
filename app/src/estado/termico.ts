// Bitrate escalonado por calor (plan de rendimiento, Tarea 2). TypeScript puro, con tests.
// Al calentarse el celular, el video baja de escalón en el acto; vuelve a subir de a uno y solo
// después de 2 minutos sin pedido más alto, para no oscilar.
import type { Calidad } from '../ajustes/ajustes';

export type Escalon = 0 | 1 | 2;

// Nunca por debajo del mínimo de Facebook a 30 fps: 720p 1500 kbps, 1080p 3000 kbps.
export const KBPS: Record<Calidad, readonly [number, number, number]> = {
  '720p': [2500, 1800, 1500],
  '1080p': [4500, 3500, 3000],
};

export const ESPERA_SUBIR_MS = 120_000;

/** El escalón que pide el calor. Manda el estado térmico; sin él, la temperatura de la batería. */
export function escalonPedido(m: { termico: number | null; temperatura: number | null }): Escalon {
  if (m.termico !== null) return m.termico >= 3 ? 2 : m.termico === 2 ? 1 : 0;
  if (m.temperatura !== null) return m.temperatura >= 45 ? 2 : m.temperatura >= 42 ? 1 : 0;
  return 0;
}

/** Baja en el acto; vuelve a subir de a un escalón y solo pasada la espera. `desdeMs` cambia con el escalón. */
export function siguienteEscalon(
  actual: { escalon: Escalon; desdeMs: number },
  pedido: Escalon,
  ahoraMs: number,
): { escalon: Escalon; desdeMs: number } {
  if (pedido > actual.escalon) return { escalon: pedido, desdeMs: ahoraMs };
  if (pedido < actual.escalon && ahoraMs - actual.desdeMs >= ESPERA_SUBIR_MS) {
    return { escalon: (actual.escalon - 1) as Escalon, desdeMs: ahoraMs };
  }
  return actual;
}
