// Registro de cambios (D3): cada acción como una frase, con su chip de tipo. Las funciones de texto son
// puras; `listarRegistro` lee con el cliente de servicio (quien llama ya comprobó que es admin).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TonoChip } from '../app/componentes/Chip';
import { personasPorId, porLotes, todasLasFilas } from './admin-parroquias';
import { cuandoRegistro } from './fecha';
import { nombreVisible } from './persona';

/** Las acciones que muestra D3 (Decisión 16). `guardar_borrador` queda afuera y no ocupa lugar en las 100. */
export const ACCIONES_VISIBLES = [
  'publicar',
  'restaurar',
  'invitar',
  'aceptar_invitacion',
  'asignar',
  'quitar_acceso',
  'anular_invitacion',
  'crear_parroquia',
  'desactivar',
  'reactivar',
  'cambiar_visible',
] as const;

const CHIPS: Record<string, { texto: 'Publicación' | 'Acceso' | 'Parroquia'; tono: TonoChip }> = {
  publicar: { texto: 'Publicación', tono: 'verde' },
  restaurar: { texto: 'Publicación', tono: 'verde' },
  invitar: { texto: 'Acceso', tono: 'azul' },
  aceptar_invitacion: { texto: 'Acceso', tono: 'azul' },
  asignar: { texto: 'Acceso', tono: 'azul' },
  quitar_acceso: { texto: 'Acceso', tono: 'ambar' },
  anular_invitacion: { texto: 'Acceso', tono: 'ambar' },
  crear_parroquia: { texto: 'Parroquia', tono: 'gris' },
  desactivar: { texto: 'Parroquia', tono: 'gris' },
  reactivar: { texto: 'Parroquia', tono: 'gris' },
  cambiar_visible: { texto: 'Parroquia', tono: 'gris' },
};

export function chipRegistro(accion: string): { texto: 'Publicación' | 'Acceso' | 'Parroquia'; tono: TonoChip } | null {
  return CHIPS[accion] ?? null;
}

const texto = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');

/**
 * La frase de una fila. `parroquia` es el nombre actual de la parroquia (null si se borró: se usa
 * `detalle.nombre` o «una parroquia eliminada»). `persona` da el nombre visible de un `usuario_id`
 * del detalle, o null si la cuenta ya no existe. Una acción desconocida se devuelve tal cual.
 */
export function fraseRegistro(
  f: { accion: string; detalle: Record<string, unknown>; parroquia: string | null },
  persona: (usuarioId: string) => string | null,
): string {
  const d = f.detalle ?? {};
  const P = f.parroquia ?? (texto(d.nombre) || 'una parroquia eliminada');
  const quien = () => (typeof d.usuario_id === 'string' ? persona(d.usuario_id) : null) ?? 'una cuenta borrada';
  switch (f.accion) {
    case 'publicar':
      return `Publicó ${P} · v${texto(d.numero)}`;
    case 'restaurar':
      return `Volvió a la versión ${texto(d.numero)} de ${P} · v${texto(d.nuevo)}`;
    case 'invitar':
      return `Invitó a ${texto(d.correo)} a ${P}`;
    case 'aceptar_invitacion':
      return d.rol === 'administrador' ? 'Aceptó la invitación de administrador' : `Aceptó la invitación a ${P}`;
    case 'asignar':
      return `Asignó a ${quien()} a ${P}`;
    case 'quitar_acceso':
      return `Quitó el acceso de ${quien()} a ${P}`;
    case 'anular_invitacion':
      return `Anuló la invitación de ${texto(d.correo)} a ${P}`;
    case 'crear_parroquia':
      return `Creó ${P}`;
    case 'desactivar':
      return `Desactivó ${P}`;
    case 'reactivar':
      return `Reactivó ${P}`;
    case 'cambiar_visible':
      return d.visible === true ? `Mostró ${P} en la app` : `Quitó ${P} de la app`;
    default:
      return f.accion;
  }
}

/** Quién (Decisión 17): el nombre visible más « (admin)» si hoy es administrador; sin usuario, «—». */
export function quienRegistro(p: { nombre: string | null; correo: string; esAdmin: boolean } | null): string {
  if (!p) return '—';
  return `${nombreVisible(p.nombre, p.correo)}${p.esAdmin ? ' (admin)' : ''}`;
}

export interface FilaRegistro {
  id: number;
  /** ISO, para `<time dateTime>`. */
  en: string;
  cuando: string;
  quien: string;
  frase: string;
  chip: { texto: string; tono: TonoChip };
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las últimas 100 acciones visibles (por `en` descendente), de todas las parroquias o de una. */
export async function listarRegistro(servicio: SupabaseClient, filtroParroquiaId?: string, ahora: Date = new Date()): Promise<FilaRegistro[]> {
  let consulta = servicio
    .from('registro')
    .select('id, parroquia_id, usuario_id, accion, detalle, en')
    .in('accion', [...ACCIONES_VISIBLES])
    .order('en', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);
  if (filtroParroquiaId && RE_UUID.test(filtroParroquiaId)) consulta = consulta.eq('parroquia_id', filtroParroquiaId);
  const { data, error } = await consulta;
  if (error) throw error;
  const filas = (data ?? []) as {
    id: number;
    parroquia_id: string | null;
    usuario_id: string | null;
    accion: string;
    detalle: Record<string, unknown> | null;
    en: string;
  }[];
  if (!filas.length) return [];

  const idsParroquias = [...new Set(filas.map((f) => f.parroquia_id).filter((x): x is string => Boolean(x)))];
  const parroquias = await porLotes<{ id: string; nombre: string }>(idsParroquias, (lote) =>
    servicio.from('parroquias').select('id, nombre').in('id', lote),
  );
  const nombreParroquia = new Map(parroquias.map((p) => [p.id, p.nombre]));

  const idsPersonas = filas.flatMap((f) => [f.usuario_id, typeof f.detalle?.usuario_id === 'string' ? f.detalle.usuario_id : null]);
  const personas = await personasPorId(
    servicio,
    idsPersonas.filter((x): x is string => typeof x === 'string' && RE_UUID.test(x)),
  );
  const admins = new Set(
    (
      await todasLasFilas<{ usuario_id: string }>((d, h) => servicio.from('administradores').select('usuario_id').order('usuario_id').range(d, h))
    ).map((a) => a.usuario_id),
  );
  const visible = (id: string) => {
    const p = personas.get(id);
    return p ? nombreVisible(p.nombre, p.correo) : null;
  };

  return filas.map((f) => {
    const p = f.usuario_id ? personas.get(f.usuario_id) : undefined;
    return {
      id: f.id,
      en: f.en,
      cuando: cuandoRegistro(f.en, ahora),
      quien: quienRegistro(p && f.usuario_id ? { ...p, esAdmin: admins.has(f.usuario_id) } : null),
      frase: fraseRegistro(
        { accion: f.accion, detalle: f.detalle ?? {}, parroquia: f.parroquia_id ? (nombreParroquia.get(f.parroquia_id) ?? null) : null },
        visible,
      ),
      chip: chipRegistro(f.accion) ?? { texto: f.accion, tono: 'gris' },
    };
  });
}
