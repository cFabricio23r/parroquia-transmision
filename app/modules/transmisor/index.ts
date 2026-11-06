// API del transmisor (cámara a Facebook por RTMPS).
import type { Calidad, Microfono } from '../../src/ajustes/ajustes';
import Modulo from './src/TransmisorModule';
import { EventoEstado, MENSAJES, aEventoEstado, armarUrl, traducirError } from './src/eventos';

export { default as VistaTransmisor } from './src/TransmisorView';
export type { Conexion, EventoEstado } from './src/eventos';
export { ErrorTransmisor } from './src/eventos';

/** Si en este tiempo no llega «conectado» ni un corte, se da el inicio por fallido. */
export const ESPERA_INICIO_MS = 20_000;

const oyentes = new Set<(e: EventoEstado) => void>();
let suscripcion: { remove(): void } | null = null;
let espera: ReturnType<typeof setTimeout> | null = null;

function avisar(e: EventoEstado) {
  for (const cb of [...oyentes]) cb(e);
}

function cancelarEspera() {
  if (espera !== null) {
    clearTimeout(espera);
    espera = null;
  }
}

// Una sola suscripción al nativo; cualquier evento cancela la espera del inicio.
function asegurarSuscripcion() {
  if (suscripcion) return;
  suscripcion = Modulo.addListener('onEstado', (n) => {
    cancelarEspera();
    avisar(aEventoEstado(n));
  });
}

/** Prepara cámara y micrófono con la calidad elegida y arranca la vista previa. */
export function prepararVista(calidad: Calidad, microfono: Microfono): Promise<void> {
  return Modulo.prepararVista(calidad, microfono);
}

/**
 * Sale al aire. El servidor y la clave se recortan; la clave nunca se registra.
 * Rechaza con ErrorTransmisor (mensaje en español) si el nativo no puede empezar.
 */
export async function iniciar(servidor: string, clave: string): Promise<void> {
  const url = armarUrl(servidor, clave);
  asegurarSuscripcion();
  cancelarEspera();
  // La espera se arma antes de llamar al nativo: «conectado» puede llegar antes de que resuelva.
  espera = setTimeout(() => {
    espera = null;
    Modulo.terminar().catch(() => undefined);
    avisar({ conexion: 'cortado', mbps: null, mensaje: MENSAJES.sinRespuesta });
  }, ESPERA_INICIO_MS);
  try {
    await Modulo.iniciar(url, clave.trim());
  } catch (e) {
    cancelarEspera();
    throw traducirError(e);
  }
}

export function terminar(): Promise<void> {
  cancelarEspera();
  return Modulo.terminar();
}

export function addEstadoListener(cb: (e: EventoEstado) => void): { remove(): void } {
  asegurarSuscripcion();
  oyentes.add(cb);
  return { remove: () => oyentes.delete(cb) };
}
