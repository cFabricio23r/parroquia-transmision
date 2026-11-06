// Puente entre la app y el panel (obs/panel.html?modo=app en un WebView).
// El panel guarda su estado en localStorage['parroquia_obs_estado_v1']; la app lo lee cada
// 300 ms con SCRIPT_PANEL y se lo pasa a la capa con actualizarEstado(json) (decisión 1 del plan).
// Ese estado nunca lleva la clave: la clave vive solo en Ajustes (expo-secure-store).
import { ESCENAS_VALIDAS, type Escena } from '../estado/transmision';

/** Se corre antes de que cargue la página: activa el modo compacto aunque se pierda ?modo=app. */
export const SCRIPT_ANTES_DE_CARGAR = 'window.modoApp = true; true;';

/** Cada 300 ms, si el estado guardado cambió, lo manda a la app como {tipo:'estado', json}. */
export const SCRIPT_PANEL = `(function () {
  var ultimo = null;
  function revisar() {
    var json = null;
    try { json = window.localStorage.getItem('parroquia_obs_estado_v1'); } catch (e) { json = null; }
    if (typeof json !== 'string' || json === ultimo) return;
    ultimo = json;
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ tipo: 'estado', json: json })); } catch (e) {}
  }
  revisar();
  setInterval(revisar, 300);
})();
true;`;

/** Al salir al aire, el panel pasa solo a la pestaña En vivo. */
export const SCRIPT_IR_A_EN_VIVO =
  "(function () { var b = document.getElementById('tab-vivo'); if (b) b.click(); })(); true;";

/** Al terminar, el panel vuelve a Preparar, listo para la próxima transmisión (spec, pantalla 1). */
export const SCRIPT_IR_A_PREPARAR =
  "(function () { var b = document.getElementById('tab-preparar'); if (b) b.click(); })(); true;";

/** Las páginas propias de la app: todo lo demás se bloquea o se ignora. */
export const ORIGEN_PANEL = 'file:///android_asset/';

/** true si el mensaje viene de una página de la app (defensa extra: no se carga ninguna otra). */
export function esDelPanel(url: string | undefined): boolean {
  return typeof url === 'string' && url.startsWith(ORIGEN_PANEL);
}

/** Le dice al panel en qué escena está la app: fuera de Cámara bloquea los rótulos (Tarea 2b). */
export function SCRIPT_ESCENA(escena: Escena): string {
  // Solo se inyectan los nombres conocidos: nunca un texto armado con otra cosa.
  if (!ESCENAS_VALIDAS.includes(escena)) return 'true;';
  return `window.fijarEscenaApp && window.fijarEscenaApp('${escena}'); true;`;
}

/** Lee un mensaje del panel. Da null ante cualquier cosa que no sea {tipo:'estado', json: texto}. */
export function leerMensaje(data: string): { tipo: 'estado'; json: string } | null {
  let m: unknown;
  try {
    m = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return null;
  const { tipo, json } = m as { tipo?: unknown; json?: unknown };
  if (tipo !== 'estado' || typeof json !== 'string') return null;
  return { tipo: 'estado', json };
}
