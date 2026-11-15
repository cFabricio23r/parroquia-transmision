// Coordinadores de todas las parroquias (D2): el listado global de miembros e invitaciones, asignar a
// otra parroquia, anular y reenviar invitaciones. Sin dependencias de Next; recibe los clientes
// inyectados como lib/admin.ts. Los envoltorios 'use server' están en app/editor/admin/acciones.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MENSAJE_PARROQUIA_DESACTIVADA,
  MENSAJE_SOLO_ADMIN,
  RE_UUID,
  exigirAdmin,
  fallo,
  invitar,
  registrar,
  type DepsAdmin,
  type Resultado,
} from './admin';
import { personasPorId, todasLasFilas, type Persona } from './admin-parroquias';
import { compararEs, type EstadoCoordinador, type FilaCoordinador } from './admin-textos';

export { chipCoordinador } from './admin-textos';
export type { EstadoCoordinador, FilaCoordinador } from './admin-textos';
import { nombreVisible } from './persona';

export const MENSAJE_YA_COORDINA = 'Ya coordina esa parroquia.';
export const MENSAJE_SIN_CUENTA = 'Esa persona no tiene cuenta.';
export const MENSAJE_INVITACION_NO_PENDIENTE = 'Esa invitación ya no está pendiente.';
const MENSAJE_NO_EXISTE = 'Esa parroquia no existe.';

export interface EntradaFilas {
  miembros: { usuarioId: string; parroquiaId: string }[];
  personas: Record<string, Persona>;
  invitaciones: { id: string; correo: string; parroquiaId: string; venceEn: string; creadaEn: string }[];
  parroquias: Record<string, { nombre: string; slug: string }>;
}

const ORDEN: Record<EstadoCoordinador, number> = { activo: 0, 'invitacion-enviada': 1, 'invitacion-vencida': 2 };
const normalizar = (correo: string) => correo.trim().toLowerCase();

/**
 * Las filas de D2 (Decisión 11): una por membresía (Activo) y una por la invitación más reciente de
 * cada (correo, parroquia) que no esté usada ni anulada y cuyo correo no sea ya miembro de esa
 * parroquia. Vence justo al llegar `vence_en`, como estadoInvitacion. Orden: activos, enviadas,
 * vencidas; dentro de cada grupo, por parroquia y después por persona.
 */
export function armarFilasCoordinadores(e: EntradaFilas, ahora: number): FilaCoordinador[] {
  const filas: FilaCoordinador[] = [];
  const miembroDe = new Set<string>(); // `${correo}|${parroquiaId}`
  for (const m of e.miembros) {
    const persona = e.personas[m.usuarioId];
    const parroquia = e.parroquias[m.parroquiaId];
    if (!persona || !parroquia) continue;
    miembroDe.add(`${normalizar(persona.correo)}|${m.parroquiaId}`);
    filas.push({
      clave: `m:${m.usuarioId}:${m.parroquiaId}`,
      tipo: 'miembro',
      usuarioId: m.usuarioId,
      invitacionId: null,
      nombre: persona.nombre,
      correo: persona.correo,
      parroquiaId: m.parroquiaId,
      parroquiaNombre: parroquia.nombre,
      parroquiaSlug: parroquia.slug,
      estado: 'activo',
      ultimaEntrada: persona.ultimaEntrada,
    });
  }
  const recientes = new Map<string, EntradaFilas['invitaciones'][number]>();
  for (const i of e.invitaciones) {
    const llave = `${normalizar(i.correo)}|${i.parroquiaId}`;
    const previa = recientes.get(llave);
    if (!previa || Date.parse(i.creadaEn) > Date.parse(previa.creadaEn)) recientes.set(llave, i);
  }
  for (const [llave, i] of recientes) {
    const parroquia = e.parroquias[i.parroquiaId];
    if (!parroquia || miembroDe.has(llave)) continue;
    const vence = Date.parse(i.venceEn);
    filas.push({
      clave: `i:${i.id}`,
      tipo: 'invitacion',
      usuarioId: null,
      invitacionId: i.id,
      nombre: null,
      correo: i.correo,
      parroquiaId: i.parroquiaId,
      parroquiaNombre: parroquia.nombre,
      parroquiaSlug: parroquia.slug,
      estado: !Number.isNaN(vence) && vence > ahora ? 'invitacion-enviada' : 'invitacion-vencida',
      ultimaEntrada: null,
    });
  }
  return filas.sort(
    (a, b) =>
      ORDEN[a.estado] - ORDEN[b.estado] ||
      compararEs(a.parroquiaNombre, b.parroquiaNombre) ||
      compararEs(nombreVisible(a.nombre, a.correo), nombreVisible(b.nombre, b.correo)),
  );
}

/** Las filas de D2, opcionalmente de una sola parroquia (por slug; uno desconocido se ignora). Lee con el servicio. */
export async function listarCoordinadores(servicio: SupabaseClient, filtroSlug?: string, ahora: number = Date.now()): Promise<FilaCoordinador[]> {
  const parroquias = await todasLasFilas<{ id: string; slug: string; nombre: string }>((d, h) =>
    servicio.from('parroquias').select('id, slug, nombre').order('id').range(d, h),
  );
  const filtro = filtroSlug ? parroquias.find((p) => p.slug === filtroSlug)?.id : undefined;
  const [miembros, invitaciones] = await Promise.all([
    todasLasFilas<{ parroquia_id: string; usuario_id: string }>((d, h) => {
      const q = servicio.from('miembros').select('parroquia_id, usuario_id');
      return (filtro ? q.eq('parroquia_id', filtro) : q).order('parroquia_id').order('usuario_id').range(d, h);
    }),
    todasLasFilas<{ id: string; correo: string; parroquia_id: string; vence_en: string; creada_en: string }>((d, h) => {
      const q = servicio
        .from('invitaciones')
        .select('id, correo, parroquia_id, vence_en, creada_en')
        .eq('rol', 'coordinador')
        .is('usada_en', null)
        .is('anulada_en', null);
      return (filtro ? q.eq('parroquia_id', filtro) : q).order('id').range(d, h);
    }),
  ]);
  const personas = await personasPorId(
    servicio,
    miembros.map((m) => m.usuario_id),
  );
  return armarFilasCoordinadores(
    {
      miembros: miembros.map((m) => ({ usuarioId: m.usuario_id, parroquiaId: m.parroquia_id })),
      personas: Object.fromEntries(personas),
      invitaciones: invitaciones.map((i) => ({
        id: i.id,
        correo: i.correo,
        parroquiaId: i.parroquia_id,
        venceEn: i.vence_en,
        creadaEn: i.creada_en,
      })),
      parroquias: Object.fromEntries(parroquias.map((p) => [p.id, { nombre: p.nombre, slug: p.slug }])),
    },
    ahora,
  );
}

/** Asigna a una persona que ya tiene cuenta a otra parroquia activa. Solo administradores. */
export async function asignar(deps: DepsAdmin, usuarioId: string, parroquiaId: string): Promise<Resultado> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  if (!RE_UUID.test(parroquiaId)) return { error: MENSAJE_NO_EXISTE };
  if (!RE_UUID.test(usuarioId)) return { error: MENSAJE_SIN_CUENTA };
  try {
    const { data: parroquia } = await deps.servicio.from('parroquias').select('desactivada_en').eq('id', parroquiaId).maybeSingle();
    if (!parroquia) return { error: MENSAJE_NO_EXISTE };
    if (parroquia.desactivada_en) return { error: MENSAJE_PARROQUIA_DESACTIVADA };
    const { data: usuario } = await deps.servicio.auth.admin.getUserById(usuarioId);
    if (!usuario?.user) return { error: MENSAJE_SIN_CUENTA };
    const { data, error } = await deps.servicio
      .from('miembros')
      .upsert({ parroquia_id: parroquiaId, usuario_id: usuarioId, rol: 'coordinador' }, { onConflict: 'parroquia_id,usuario_id', ignoreDuplicates: true })
      .select('usuario_id');
    if (error) throw error;
    if (!data || data.length === 0) return { error: MENSAJE_YA_COORDINA };
    await registrar(deps.servicio, { parroquia_id: parroquiaId, usuario_id: quien, accion: 'asignar', detalle: { usuario_id: usuarioId } });
    return {};
  } catch (e) {
    return fallo('asignar', e);
  }
}

async function invitacionPendiente(
  servicio: SupabaseClient,
  invitacionId: string,
): Promise<{ id: string; correo: string; parroquia_id: string } | null> {
  if (!RE_UUID.test(invitacionId)) return null;
  const { data, error } = await servicio
    .from('invitaciones')
    .select('id, correo, parroquia_id')
    .eq('id', invitacionId)
    .eq('rol', 'coordinador')
    .is('usada_en', null)
    .is('anulada_en', null)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string; correo: string; parroquia_id: string } | null) ?? null;
}

/** Anula una invitación pendiente (vigente o vencida): el enlace deja de servir. Solo administradores. */
export async function anularInvitacion(deps: DepsAdmin, invitacionId: string): Promise<Resultado> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  try {
    if (!RE_UUID.test(invitacionId)) return { error: MENSAJE_INVITACION_NO_PENDIENTE };
    const { data, error } = await deps.servicio
      .from('invitaciones')
      .update({ anulada_en: new Date().toISOString() })
      .eq('id', invitacionId)
      .eq('rol', 'coordinador') // D2 no muestra las de administrador: no las anula (como invitacionPendiente)
      .is('usada_en', null)
      .is('anulada_en', null)
      .select('correo, parroquia_id');
    if (error) throw error;
    const fila = (data ?? [])[0] as { correo: string; parroquia_id: string | null } | undefined;
    if (!fila) return { error: MENSAJE_INVITACION_NO_PENDIENTE };
    await registrar(deps.servicio, { parroquia_id: fila.parroquia_id, usuario_id: quien, accion: 'anular_invitacion', detalle: { correo: fila.correo } });
    return {};
  } catch (e) {
    return fallo('anularInvitacion', e);
  }
}

/** Manda una invitación nueva al mismo correo y parroquia (`invitar` anula la anterior). Solo administradores. */
export async function reenviarInvitacion(deps: DepsAdmin, invitacionId: string): Promise<Resultado & { correo?: string }> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  try {
    const inv = await invitacionPendiente(deps.servicio, invitacionId);
    if (!inv) return { error: MENSAJE_INVITACION_NO_PENDIENTE };
    const r = await invitar(deps, inv.correo, inv.parroquia_id);
    if (r.error) return { error: r.error };
    return { correo: inv.correo };
  } catch (e) {
    return fallo('reenviarInvitacion', e);
  }
}
