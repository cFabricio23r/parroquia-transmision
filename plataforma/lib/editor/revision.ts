// «Revisar y publicar» (F12): los mensajes que comparten el cliente y el servidor.
// Puro: sin Supabase ni Next.
import { bloqueDeError, limpiarMensaje } from './errores';
import type { EstadoSeccion } from './estados';
import type { EstadoGuardado } from './guardado';
import { SECCIONES, seccion, type IdSeccion } from './secciones';

/** Publicar o restaurar una parroquia desactivada (Decisión 3 del plan 5). */
export const MENSAJE_DESACTIVADA_PUBLICAR = 'Esta parroquia está desactivada. Reactívala en Administración para publicar.';

/**
 * Publicar con algo todavía sin guardar (plan 3). Con el guardado automático no hay un «Guardar»
 * general: mientras guarda se espera; un formulario con su propio botón (como «Editar aviso») sí se
 * guarda a mano; y si el guardado falló, el aviso de la sección dice qué hacer.
 */
export const MENSAJE_GUARDANDO = 'Guardando tus cambios. En un momento puedes publicar.';
export const MENSAJE_FORMULARIO_SIN_GUARDAR = 'Tienes un formulario sin guardar. Guárdalo para poder publicar.';
export const MENSAJE_GUARDADO_FALLO = 'Tus últimos cambios no se guardaron. Revisa el aviso de arriba para poder publicar.';

export function mensajeSinGuardar(estado: EstadoGuardado, formularioSucio: boolean): string {
  if (formularioSucio) return MENSAJE_FORMULARIO_SIN_GUARDAR;
  if (estado === 'guardando' || estado === 'pendiente') return MENSAJE_GUARDANDO;
  return MENSAJE_GUARDADO_FALLO;
}

// ---- Tarea 12 del plan 5: «Antes de publicar», el botón y las versiones ----

export interface ItemRevision {
  titulo: string;
  detalle: string;
  seccion: IdSeccion;
  /** Texto del enlace a la sección («Corregir en Galería», «Ver Rótulos y estilo»); null sin enlace. */
  enlace: string | null;
  tono: 'rojo' | 'ambar' | 'verde';
}

export const DETALLE_SIN_SECCION = 'Revisa este dato antes de publicar.';

/**
 * Decisión 20: primero los errores de cada sección en el orden del menú, después los errores que
 * ninguna sección reclama (van a Resumen) y al final los avisos. La fila «Todo listo» la pone el
 * componente cuando las dos listas vienen vacías.
 */
export function revisarParaPublicar(
  estados: Record<Exclude<IdSeccion, 'publicar'>, EstadoSeccion>,
  errores: string[],
): { errores: ItemRevision[]; avisos: ItemRevision[] } {
  const rojos: ItemRevision[] = [];
  const ambar: ItemRevision[] = [];
  for (const s of SECCIONES) {
    if (s.id === 'publicar') continue;
    const e = estados[s.id];
    if (!e) continue;
    for (const p of e.errores) rojos.push({ ...p, enlace: `Corregir en ${seccion(p.seccion).texto}`, tono: 'rojo' });
    for (const p of e.avisos) ambar.push({ ...p, enlace: `Ver ${seccion(p.seccion).texto}`, tono: 'ambar' });
  }
  for (const m of errores) {
    if (bloqueDeError(m) !== null) continue;
    rojos.push({ titulo: limpiarMensaje(m), detalle: DETALLE_SIN_SECCION, seccion: 'resumen', enlace: 'Ver Resumen', tono: 'rojo' });
  }
  return { errores: rojos, avisos: ambar };
}

/** Decisión 21: el mensaje junto al botón deshabilitado. */
export function textoBloqueo(k: number): string {
  return `Corrige ${k} ${k === 1 ? 'problema' : 'problemas'} para poder publicar.`;
}

/** Review Focus 5: `reservar_version` cuenta desde `parroquias.ultima_version`, que puede tener huecos. */
export function siguienteVersion(ultimaReservada: number | null, mayorPublicada: number | null): number {
  return Math.max(ultimaReservada ?? 0, mayorPublicada ?? 0) + 1;
}

export const NOTA_VERSIONES = '«Volver a esta» publica de nuevo esa versión como una nueva; no se borra ninguna.';

/** Decisión 25: las etiquetas del artboard de F12 (F1 conserva las suyas). */
/** Los mismos links que Resumen: uno por escena (pedido del usuario, 2026-11-14). */
export { LINKS_OBS as LINKS_OBS_PUBLICAR } from './links-obs';
