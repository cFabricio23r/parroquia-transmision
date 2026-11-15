// API del transmisor (cámara a Facebook por RTMPS).
import { estiloFinalValido, type Calidad, type EstiloFinal, type Microfono } from '../../src/ajustes/ajustes';
import Modulo from './src/TransmisorModule';
import type { Orientacion } from '../../src/estado/orientacion';
import type { Escena } from '../../src/estado/transmision';
import { esRutaDeMedio, esSlugValido, normalizarOrigen } from '../../src/plataforma/direcciones';
import { crearColaEscenas } from './src/escenas';
import { EventoEstado, MENSAJES, aEventoEstado, armarUrl, traducirError } from './src/eventos';
export { MENSAJES } from './src/eventos';

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
 * Pasa el estado del panel (JSON de pev_<slug>_estado_v1) a las escenas de la capa.
 * Si es igual al último enviado no hace nada (el puente lo lee cada 300 ms).
 */
export function actualizarEstado(json: string): void {
  if (json === ultimoEstado) return;
  ultimoEstado = json;
  // Sin capa todavía (antes de prepararVista) el nativo lo guarda igual; un error no corta nada.
  Modulo.actualizarEstado(json).catch(() => undefined);
}

// --- Tarea 9: avisos, registro de rendimiento y No molestar ---

export type { MedidaNativa } from './src/TransmisorModule';

/** Estado térmico, temperatura de la batería, memoria y fps (para los avisos y el registro). */
export function medir() {
  return Modulo.medir();
}

/** Lo que usan los avisos (cada 10 s): sin la memoria, que es lenta de leer (review M5). */
export function medirAvisos(): Promise<{ termico: number | null; temperatura: number | null; fpsVideo: number | null }> {
  return Modulo.medirAvisos();
}

/** Rango del zoom de la cámara, o null (Tarea 9g). */
export function rangoZoom(): Promise<{ min: number; max: number } | null> {
  return Modulo.rangoZoom();
}

/** Pone el zoom de la cámara. Sale al aire. */
export function ponerZoom(nivel: number): Promise<void> {
  return Modulo.ponerZoom(nivel);
}

/**
 * Avisa con un mensaje en español si el servicio en primer plano no pudo arrancar: la transmisión
 * sigue, pero se congela si la app pasa a segundo plano (review M4).
 */
const oyentesServicio = new Set<(mensaje: string) => void>();
let suscripcionServicio: { remove(): void } | null = null;

export function addServicioListener(cb: (mensaje: string) => void): { remove(): void } {
  if (!suscripcionServicio) {
    suscripcionServicio = Modulo.addListener('onServicio', (n) => {
      if (n.ok) return;
      for (const f of [...oyentesServicio]) f(MENSAJES.servicio);
    });
  }
  oyentesServicio.add(cb);
  return { remove: () => oyentesServicio.delete(cb) };
}

export function abrirRegistro(nombre: string, encabezado: string): Promise<void> {
  return Modulo.abrirRegistro(nombre, encabezado);
}

export function anotarRegistro(linea: string): Promise<void> {
  return Modulo.anotarRegistro(linea);
}

export function cerrarRegistro(): Promise<void> {
  return Modulo.cerrarRegistro();
}

/** Ruta del registro más nuevo (para compartirlo), o null si todavía no hay. */
export function ultimoRegistro(): Promise<string | null> {
  return Modulo.ultimoRegistro();
}

export function noMolestarActivo(): Promise<boolean | null> {
  return Modulo.noMolestarActivo();
}

export function abrirNoMolestar(): Promise<boolean> {
  return Modulo.abrirNoMolestar();
}

// --- Tarea 9c: orientación ---

/** Vertical para Preparar; horizontal para Antes de iniciar y al aire. Queda fija hasta el próximo pedido. */
export function fijarOrientacion(orientacion: Orientacion): Promise<void> {
  // Dentro de una promesa, como zonasSeguras: con un dev client viejo, sin la función nativa, rechaza
  // en vez de tirar un TypeError dentro del useEffect de App (review m2 de la 9c).
  return Promise.resolve().then(() => Modulo.fijarOrientacion(orientacion));
}

export type { ZonasSeguras } from './src/TransmisorModule';

/** Barra de estado, recorte de la cámara y barra de navegación, en dp. Cambian al girar. */
export function zonasSeguras() {
  // Dentro de una promesa: con un APK viejo, sin la función nativa, rechaza en vez de tirar en el render.
  return Promise.resolve().then(() => Modulo.zonasSeguras());
}

// --- Tarea 9d: pantalla final «Producción» ---

/**
 * Elige el estilo de la escena Producción (produccion.html?estilo=…). Si la escena ya está
 * cargada, el nativo la recarga con el estilo nuevo. Solo pasan «claro» o «azul».
 */
export function fijarEstiloFinal(estilo: EstiloFinal): Promise<void> {
  const valido = estiloFinalValido(estilo);
  // Dentro de una promesa: con un dev client viejo, sin la función nativa, rechaza en vez de tirar.
  return Promise.resolve().then(() => Modulo.fijarEstiloFinal(valido));
}

// --- Etapa 3a: la parroquia elegida y su copia guardada ---

/**
 * Elige la plataforma y la parroquia de la capa y del panel. El origen tiene que venir ya
 * normalizado (`https://host[:puerto]`, sin barra) y el slug ser válido: si no, rechaza sin
 * llamar al nativo. Lo nativo rechaza EN_VIVO si la copia está congelada.
 */
export function fijarParroquia(origen: string, slug: string): Promise<void> {
  if (normalizarOrigen(origen) !== origen || !esSlugValido(slug)) {
    return Promise.reject(new Error('Parroquia inválida.'));
  }
  return Promise.resolve()
    .then(() => Modulo.fijarParroquia(origen, slug))
    .then(() => {
      // Otra parroquia: el próximo estado del panel se manda aunque sea igual al último (el nativo
      // olvida el de la anterior).
      ultimoEstado = null;
    });
}

/** Congela (true) o suelta (false) la copia guardada. `iniciar` la congela del lado nativo. */
export function fijarEnVivo(enVivo: boolean): Promise<void> {
  return Promise.resolve().then(() => Modulo.fijarEnVivo(enVivo === true));
}

export type ResultadoCopia = { version: number; guardadaEn: string; paginasCambiaron: boolean };
export type EstadoCopia = { version: number; guardadaEn: string };

/**
 * Baja la copia de la parroquia: las páginas comunes, `config` (ya validado) y los medios.
 * Rechaza sin llamar al nativo si el slug no vale o un medio no es `medios/<archivo>`.
 */
export function descargarCopia(slug: string, config: string, medios: readonly string[]): Promise<ResultadoCopia> {
  if (!esSlugValido(slug)) return Promise.reject(new Error('Parroquia inválida.'));
  if (!medios.every(esRutaDeMedio)) return Promise.reject(new Error('Medio inválido.'));
  return Promise.resolve()
    .then(() => Modulo.descargarCopia(slug, config, [...medios]))
    .then((r) => r as ResultadoCopia);
}

/** La copia guardada de la parroquia, o null si no hay (o si lo nativo da algo que no es una copia). */
export async function estadoCopia(slug: string): Promise<EstadoCopia | null> {
  if (!esSlugValido(slug)) return null;
  const e = (await Modulo.estadoCopia(slug)) as { version?: unknown; guardadaEn?: unknown } | null;
  if (!e || typeof e !== 'object') return null;
  if (typeof e.version !== 'number' || !Number.isInteger(e.version) || e.version < 1) return null;
  if (typeof e.guardadaEn !== 'string' || e.guardadaEn === '') return null;
  return { version: e.version, guardadaEn: e.guardadaEn };
}

/** Borra la copia de una parroquia. Rechaza EN_VIVO con la copia congelada. */
export function borrarCopia(slug: string): Promise<void> {
  if (!esSlugValido(slug)) return Promise.reject(new Error('Parroquia inválida.'));
  return Promise.resolve().then(() => Modulo.borrarCopia(slug));
}

/** Borra las copias de todas las parroquias. Rechaza EN_VIVO con la copia congelada. */
export function borrarCopias(): Promise<void> {
  return Promise.resolve().then(() => Modulo.borrarCopias());
}

/** Vuelve a cargar las escenas cargadas (después de una copia con páginas nuevas). */
export function recargarEscenas(): Promise<void> {
  return Promise.resolve().then(() => Modulo.recargarEscenas());
}
