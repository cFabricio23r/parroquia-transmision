// API del transmisor (cámara a Facebook por RTMPS).
import type { Calidad, Microfono } from '../../src/ajustes/ajustes';
import Modulo from './src/TransmisorModule';
import { EventoEstado, aEventoEstado, armarUrl } from './src/eventos';

export { default as VistaTransmisor } from './src/TransmisorView';
export type { Conexion, EventoEstado } from './src/eventos';

/** Prepara cámara y micrófono con la calidad elegida y arranca la vista previa. */
export function prepararVista(calidad: Calidad, microfono: Microfono): Promise<void> {
  return Modulo.prepararVista(calidad, microfono);
}

/** Sale al aire. El servidor y la clave se recortan; la clave nunca se registra. */
export function iniciar(servidor: string, clave: string): Promise<void> {
  return Modulo.iniciar(armarUrl(servidor, clave), clave.trim());
}

export function terminar(): Promise<void> {
  return Modulo.terminar();
}

export function addEstadoListener(cb: (e: EventoEstado) => void): { remove(): void } {
  const s = Modulo.addListener('onEstado', (n) => cb(aEventoEstado(n)));
  return { remove: () => s.remove() };
}
