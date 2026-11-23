// Puente entre la app y el panel de la parroquia (`https://<plataforma>/<slug>/panel.html?modo=app`,
// en la vista nativa VistaPanel). El panel guarda su estado en localStorage['pev_<slug>_estado_v1'];
// la app lo lee cada 300 ms con scriptPanel(slug) y se lo pasa a la capa con actualizarEstado(json).
// Ese estado nunca lleva la clave: la clave vive solo en Ajustes (expo-secure-store).
import { ESCENAS_VALIDAS, type Escena } from '../estado/transmision';
import { guardadasValidas, pendientesValidos } from '../guardadas/nucleo';
import type { MensajeGuardadas } from '../guardadas/puente';
import { esSlugValido, esUrlPermitida, urlDePagina } from '../plataforma/direcciones';

/** La clave del estado del panel de esa parroquia. Lanza si el slug no es válido. */
export function claveEstado(slug: string): string {
  if (!esSlugValido(slug)) throw new Error('slug inválido');
  return 'pev_' + slug + '_estado_v1';
}

/** El panel de la parroquia en modo app (`?modo=app` pone el modo compacto). */
export function urlPanel(origen: string, slug: string): string {
  return urlDePagina(origen, slug, 'panel.html?modo=app');
}

/**
 * La dirección del panel solo cuando lo nativo ya sabe la parroquia (`fijarParroquia` terminó).
 * Antes, Interceptor.kt no tiene origen y responde 403 vacío: el WebView muestra «Página web no
 * disponible» y no vuelve a intentar, porque la dirección no cambia.
 */
export function urlPanelSiLista(origen: string, slug: string, lista: boolean): string | null {
  return lista ? urlPanel(origen, slug) : null;
}

/** true si el mensaje viene del origen exacto de la plataforma (nunca de los assets ni de otro). */
export function esMensajeDelPanel(url: string | undefined, origen: string): boolean {
  if (typeof url !== 'string' || url.startsWith('file:')) return false;
  return esUrlPermitida(url, origen);
}

/**
 * Cada 300 ms, si el estado guardado de la parroquia cambió, lo manda a la app como
 * {tipo:'estado', json}. Lo corre lo nativo al terminar de cargar la página.
 */
export function scriptPanel(slug: string): string {
  // claveEstado valida el slug: en el script nunca entra un texto armado con otra cosa.
  const clave = claveEstado(slug);
  return `(function () {
  var ultimo = null;
  function revisar() {
    var json = null;
    try { json = window.localStorage.getItem('${clave}'); } catch (e) { json = null; }
    if (typeof json !== 'string' || json === ultimo) return;
    ultimo = json;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'estado', json: json })); } catch (e) {}
  }
  revisar();
  setInterval(revisar, 300);
})();
true;`;
}

/** Al salir al aire, el panel pasa solo a la pestaña En vivo. */
export const SCRIPT_IR_A_EN_VIVO =
  "(function () { var b = document.getElementById('tab-vivo'); if (b) b.click(); })(); true;";

/** Al terminar, el panel vuelve a Preparar, listo para la próxima transmisión (spec, pantalla 1). */
export const SCRIPT_IR_A_PREPARAR =
  "(function () { var b = document.getElementById('tab-preparar'); if (b) b.click(); })(); true;";

/** Le dice al panel en qué escena está la app: fuera de Cámara bloquea los rótulos (Tarea 2b). */
export function SCRIPT_ESCENA(escena: Escena): string {
  // Solo se inyectan los nombres conocidos: nunca un texto armado con otra cosa.
  if (!ESCENAS_VALIDAS.includes(escena)) return 'true;';
  return `window.fijarEscenaApp && window.fijarEscenaApp('${escena}'); true;`;
}

/**
 * Lee un mensaje del panel: {tipo:'estado', json: texto} o {tipo:'guardadas', lista, pendientes}
 * (Tarea 6), con `lista` y `pendientes` arreglos; de esos se quedan solo las entradas bien formadas.
 * Da null ante cualquier otra cosa.
 */
export function leerMensaje(data: string): { tipo: 'estado'; json: string } | MensajeGuardadas | null {
  let m: unknown;
  try {
    m = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return null;
  const { tipo, json, lista, pendientes } = m as { tipo?: unknown; json?: unknown; lista?: unknown; pendientes?: unknown };
  if (tipo === 'guardadas') {
    if (!Array.isArray(lista) || !Array.isArray(pendientes)) return null;
    return { tipo: 'guardadas', lista: guardadasValidas(lista), pendientes: pendientesValidos(pendientes) };
  }
  if (tipo !== 'estado' || typeof json !== 'string') return null;
  return { tipo: 'estado', json };
}
