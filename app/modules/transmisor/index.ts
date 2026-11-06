// API del transmisor (cámara a Facebook por RTMPS).
import type { Calidad, Microfono } from '../../src/ajustes/ajustes';
import Modulo from './src/TransmisorModule';
import type { Escena } from '../../src/estado/transmision';
import { crearColaEscenas } from './src/escenas';
import { EventoEstado, MENSAJES, aEventoEstado, armarUrl, traducirError } from './src/eventos';

export { default as VistaTransmisor } from './src/TransmisorView';
export type { Conexion, EventoEstado } from './src/eventos';
export { ErrorTransmisor, pideVolverAPreparar } from './src/eventos';

/** Si en este tiempo no llega «conectado» ni un corte, se da el inicio por fallido. */
export const ESPERA_INICIO_MS = 20_000;

const oyentes = new Set<(e: EventoEstado) => void>();
let suscripcion: { remove(): void } | null = null;
let espera: ReturnType<typeof setTimeout> | null = null;
// Cuenta los inicios: el «cortado» de un timeout viejo no debe llegar a un inicio nuevo (review M8).
let intentos = 0;

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
  const intento = ++intentos;
  // La espera se arma antes de llamar al nativo: «conectado» puede llegar antes de que resuelva.
  espera = setTimeout(() => {
    espera = null;
    // Se espera a que el nativo termine antes de avisar el corte: los eventos y la respuesta
    // salen en orden por el hilo principal, así que un «conectado» tardío llega antes y el
    // «cortado» queda último (review N1).
    void Modulo.terminar()
      .catch(() => undefined)
      .then(() => {
        if (intento === intentos) avisar({ conexion: 'cortado', mbps: null, mensaje: MENSAJES.sinRespuesta, motivo: 'sin_respuesta' });
      });
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

// La escena actual la sabe el nativo (Capa.kt): si el JS se recarga, la capa sigue como estaba.
// Por eso la cola empieza sin escena conocida y el primer pedido siempre va al nativo, que
// responde enseguida si ya se ve esa escena.
const cola = crearColaEscenas((escena) => Modulo.cambiarEscena(escena), null);

/**
 * Cambia la escena de la capa con la transición del logo. Resuelve al terminar la transición.
 * Si llegan pedidos mientras corre una, se hace solo el último.
 */
export function cambiarEscena(escena: Escena): Promise<void> {
  return cola.pedir(escena);
}

let ultimoEstado: string | null = null;

/**
 * Pasa el estado del panel (JSON de parroquia_obs_estado_v1) a las escenas de la capa.
 * Si es igual al último enviado no hace nada (el puente lo lee cada 300 ms).
 */
export function actualizarEstado(json: string): void {
  if (json === ultimoEstado) return;
  ultimoEstado = json;
  // Sin capa todavía (antes de prepararVista) el nativo lo guarda igual; un error no corta nada.
  Modulo.actualizarEstado(json).catch(() => undefined);
}
