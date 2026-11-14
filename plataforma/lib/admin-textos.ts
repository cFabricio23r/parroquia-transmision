// Textos y estados de la administración (D1 y D2), puros: sin Supabase ni Next, así los usan también
// los componentes de cliente. lib/admin-parroquias.ts y lib/admin-coordinadores.ts los reexportan.
import type { TonoChip } from '../app/componentes/Chip';
import { revisarSlug } from './slug';

export const compararEs = (a: string, b: string) => a.localeCompare(b, 'es');

// ── Listado de D1 ────────────────────────────────────────────────────────────

export type EstadoParroquia =
  | { clave: 'publicada'; version: number }
  | { clave: 'borrador' }
  | { clave: 'sin-configurar' }
  | { clave: 'desactivada' };

/** Claves del borrador que pone «Nueva parroquia»: con solo estas, la parroquia está «Sin configurar». */
const CLAVES_INICIALES = new Set(['nombre', 'lugar']);

/** Decisión 7: desactivada → publicada (mayor versión) → borrador (alguna clave fuera de nombre y lugar) → sin configurar. */
export function estadoParroquia(p: { desactivadaEn: string | null; version: number | null; clavesBorrador: string[] }): EstadoParroquia {
  if (p.desactivadaEn) return { clave: 'desactivada' };
  if (p.version !== null) return { clave: 'publicada', version: p.version };
  if (p.clavesBorrador.some((c) => !CLAVES_INICIALES.has(c))) return { clave: 'borrador' };
  return { clave: 'sin-configurar' };
}

export function chipParroquia(e: EstadoParroquia): { texto: string; tono: TonoChip } {
  switch (e.clave) {
    case 'publicada':
      return { texto: `Publicada · v${e.version}`, tono: 'verde' };
    case 'borrador':
      return { texto: 'Borrador', tono: 'ambar' };
    case 'sin-configurar':
      return { texto: 'Sin configurar', tono: 'azul' };
    case 'desactivada':
      return { texto: 'Desactivada', tono: 'gris' };
  }
}

/**
 * El link sugerido para «Nueva parroquia» (Decisión 10): sin tildes ni el prefijo «parroquia »,
 * minúsculas con guiones, hasta 40 caracteres. Si quedan menos de 3, ''.
 */
export function sugerirSlug(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/^parroquia\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const corto = base.slice(0, 40).replace(/-+$/, '');
  return corto.length >= 3 ? corto : '';
}

export const MAX_LUGAR = 200;
export type CampoNuevaParroquia = 'nombre' | 'slug' | 'lugar';

/**
 * Errores de «Nueva parroquia» en el orden del formulario (nombre, link, lugar), todos a la vez (ronda 2
 * del plan 5). Con nombre y link vacíos no culpa al link: sale del nombre, que ya tiene su error.
 */
export function validarNuevaParroquia(
  nombreCrudo: string,
  slugCrudo: string,
  lugarCrudo: string,
  slugsDelRepo: string[],
): { campo: CampoNuevaParroquia; texto: string }[] {
  const nombre = nombreCrudo.trim();
  const slug = slugCrudo.trim().toLowerCase();
  const lugar = lugarCrudo.trim();
  const errores: { campo: CampoNuevaParroquia; texto: string }[] = [];
  if (!nombre) errores.push({ campo: 'nombre', texto: 'Escribe el nombre de la parroquia.' });
  const errorSlug = !nombre && !slug ? null : revisarSlug(slug, slugsDelRepo);
  if (errorSlug) errores.push({ campo: 'slug', texto: errorSlug });
  if (!lugar) errores.push({ campo: 'lugar', texto: 'Escribe el lugar.' });
  else if (lugar.length > MAX_LUGAR) errores.push({ campo: 'lugar', texto: `El lugar puede tener hasta ${MAX_LUGAR} caracteres.` });
  return errores;
}

export interface FilaParroquia {
  id: string;
  slug: string;
  nombre: string;
  /** `lugar` de la última versión publicada o, si no hay, del borrador. */
  lugar: string | null;
  estado: EstadoParroquia;
  /** `nombreVisible` de cada miembro, en orden alfabético. */
  coordinadores: string[];
  /** Hay una invitación de coordinador vigente (no usada, no anulada, no vencida). */
  invitacionPendiente: boolean;
}

/** Columna Coordinadores (Decisión 8). */
export function textoCoordinadores(f: FilaParroquia): string {
  if (f.coordinadores.length) return f.coordinadores.join(', ');
  return f.invitacionPendiente ? 'invitación enviada' : '—';
}

// ── D2 ───────────────────────────────────────────────────────────────────────

export type EstadoCoordinador = 'activo' | 'invitacion-enviada' | 'invitacion-vencida';

export interface FilaCoordinador {
  /** Única en la lista (para `key`). */
  clave: string;
  tipo: 'miembro' | 'invitacion';
  usuarioId: string | null;
  invitacionId: string | null;
  /** Solo de un miembro con nombre en `perfiles`. */
  nombre: string | null;
  correo: string;
  parroquiaId: string;
  parroquiaNombre: string;
  parroquiaSlug: string;
  estado: EstadoCoordinador;
  /** `last_sign_in_at` (ISO) de un miembro; null si nunca entró o es una invitación. */
  ultimaEntrada: string | null;
}

export function chipCoordinador(e: EstadoCoordinador): { texto: string; tono: TonoChip } {
  if (e === 'activo') return { texto: 'Activo', tono: 'verde' };
  if (e === 'invitacion-enviada') return { texto: 'Invitación enviada', tono: 'azul' };
  return { texto: 'Invitación vencida', tono: 'ambar' };
}
