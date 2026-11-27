// La celda «Facebook» de la tabla de Parroquias (artboard E1). Puro y sin imports de servidor: lo usa un
// componente cliente (TablaParroquias), y traer lib/facebook/asignaciones.ts metería al navegador `sharp`
// y compañía (Module not found: child_process).
import type { EstadoFacebook } from './asignaciones';

/** Columna «Facebook» (artboard E1): solo lectura. El estado siempre con texto, la principal debajo. */
export function celdaFacebook(e: EstadoFacebook | undefined): { texto: string; tono: 'verde' | 'ambar' | 'gris'; detalle: string | null } {
  if (!e) return { texto: 'Sin conectar', tono: 'gris', detalle: null };
  if (e.estado === 'reconectar') return { texto: 'Hay que volver a conectar', tono: 'ambar', detalle: 'Usa la clave de transmisión' };
  const detalle = e.principal ? (e.extras > 0 ? `${e.principal} + ${e.extras}` : e.principal) : 'Todavía sin página principal';
  return { texto: 'Conectado', tono: 'verde', detalle };
}
