// Lectura de los mensajes de `validarConfig` (vicaria/parroquia.js): cada mensaje lleva la ruta del
// dato entre paréntesis, por ejemplo «Falta el lugar (lugar).». Sin imports de Node: lo usa el cliente.
import { BLOQUES, type Bloque } from './secciones';

const RE_RUTA = /\(([A-Za-z0-9_.\[\]]+)\)/g;

/**
 * El bloque del borrador al que se refiere un mensaje: el primer `(ruta)` cuyo comienzo (hasta el
 * primer `.` o `[`) es un bloque. Se salta los paréntesis que no son rutas de bloque, como «(alt)».
 */
export function bloqueDeError(mensaje: string): Bloque | null {
  for (const m of mensaje.matchAll(RE_RUTA)) {
    const cabeza = m[1].split(/[.[]/)[0];
    if ((BLOQUES as readonly string[]).includes(cabeza)) return cabeza as Bloque;
  }
  return null;
}

/** El mensaje sin las rutas entre paréntesis («Falta el lugar.»). «(alt)» se queda: es parte del texto. */
export function limpiarMensaje(mensaje: string): string {
  return mensaje.replace(/ \(([A-Za-z0-9_.\[\]]+)\)/g, (todo, ruta: string) => (ruta === 'alt' ? todo : ''));
}
