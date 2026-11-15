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

/**
 * El «Falta …» de cada campo obligatorio de Identidad y de Patrono y fiesta, para mostrarlo junto al
 * campo (con aria-invalid). Son los mismos campos que `validarConfig` exige: el punto del menú y el
 * Resumen se ponen en rojo por el mismo dato vacío.
 */
export const FALTA_CAMPO = {
  nombre: 'Falta el nombre de la parroquia.',
  lugar: 'Falta el lugar.',
  'colores.principal': 'Falta el color principal.',
  'colores.oscuro': 'Falta el color oscuro.',
  'logos.blanco': 'Falta el logo blanco.',
  fachada: 'Falta la foto de la fachada.',
  'patrono.nombre': 'Falta el nombre del patrono.',
  'patrono.corto': 'Falta el título corto del patrono.',
  'fiesta.dia': 'Falta el día de la fiesta.',
  'fiesta.mes': 'Falta el mes de la fiesta.',
} as const;

export type CampoObligatorio = keyof typeof FALTA_CAMPO;

/** El «Falta …» del campo si su valor está vacío (sin valor, o texto con solo espacios); si no, nada. */
export function faltaCampo(campo: CampoObligatorio, valor: unknown): string | undefined {
  const vacio = valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
  return vacio ? FALTA_CAMPO[campo] : undefined;
}
