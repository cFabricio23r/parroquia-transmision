// Administración de parroquias (D1): desactivar, reactivar, el listado con su estado y las ayudas
// puras del diálogo «Nueva parroquia». Sin dependencias de Next; recibe los clientes inyectados como
// lib/admin.ts. Los envoltorios 'use server' están en app/editor/admin/acciones.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TonoChip } from '../app/componentes/Chip';
import { exigirAdmin, fallo, MENSAJE_SOLO_ADMIN, RE_UUID, registrar, type DepsAdmin, type Resultado } from './admin';
import { avisarDespliegue, type EstadoHook } from './despliegue';
import { nombreVisible } from './persona';

export const MENSAJE_YA_DESACTIVADA = 'Esa parroquia ya está desactivada.';
export const MENSAJE_YA_ACTIVA = 'Esa parroquia ya está activa.';
const MENSAJE_NO_EXISTE = 'Esa parroquia no existe.';

/**
 * Cambia `desactivada_en` solo si hace falta (UPDATE condicionado): pedir lo que ya está hecho
 * devuelve un aviso, sin registro ni aviso a Vercel. Cada cambio se registra con `{ slug, nombre }`
 * y avisa a Vercel con el mismo hook que publicar (Decisión 5 del plan 5).
 */
async function cambiarEstado(
  deps: DepsAdmin,
  parroquiaId: string,
  desactivar: boolean,
): Promise<Resultado & { hook?: EstadoHook }> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  if (!RE_UUID.test(parroquiaId)) return { error: MENSAJE_NO_EXISTE };
  try {
    const consulta = deps.servicio
      .from('parroquias')
      .update({ desactivada_en: desactivar ? new Date().toISOString() : null })
      .eq('id', parroquiaId);
    const { data, error } = await (desactivar ? consulta.is('desactivada_en', null) : consulta.not('desactivada_en', 'is', null)).select(
      'slug, nombre',
    );
    if (error) throw error;
    const fila = (data ?? [])[0] as { slug: string; nombre: string } | undefined;
    if (!fila) {
      const { data: existe } = await deps.servicio.from('parroquias').select('id').eq('id', parroquiaId).maybeSingle();
      if (!existe) return { error: MENSAJE_NO_EXISTE };
      return { error: desactivar ? MENSAJE_YA_DESACTIVADA : MENSAJE_YA_ACTIVA };
    }
    await registrar(deps.servicio, {
      parroquia_id: parroquiaId,
      usuario_id: quien,
      accion: desactivar ? 'desactivar' : 'reactivar',
      detalle: { slug: fila.slug, nombre: fila.nombre },
    });
    return { hook: await avisarDespliegue(deps.hookUrl) };
  } catch (e) {
    return fallo(desactivar ? 'desactivarParroquia' : 'reactivarParroquia', e);
  }
}

/** Desactiva la parroquia: el link deja de funcionar y sus coordinadores pierden el acceso. No borra nada. */
export function desactivarParroquia(deps: DepsAdmin, parroquiaId: string): Promise<Resultado & { hook?: EstadoHook }> {
  return cambiarEstado(deps, parroquiaId, true);
}

/** Reactiva la parroquia. No copia nada: todo seguía donde estaba. */
export function reactivarParroquia(deps: DepsAdmin, parroquiaId: string): Promise<Resultado & { hook?: EstadoHook }> {
  return cambiarEstado(deps, parroquiaId, false);
}


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

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const textoDe = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const compararEs = (a: string, b: string) => a.localeCompare(b, 'es');

export interface Persona {
  nombre: string | null;
  correo: string;
  ultimaEntrada: string | null;
}

const TAM_PAGINA = 1000; // max_rows de PostgREST (config.toml)
const TAM_LOTE = 100; // ids por filtro `in`: más hace la URL demasiado larga

/** Todas las filas de una consulta, de a páginas (`range`): PostgREST corta en max_rows. La consulta debe tener un orden estable. */
export async function todasLasFilas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += TAM_PAGINA) {
    const { data, error } = await consulta(desde, desde + TAM_PAGINA - 1);
    if (error) throw error;
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < TAM_PAGINA) return filas;
  }
}

/** `consulta` por lotes de ids (filtro `in`), con los resultados juntos. */
export async function porLotes<T>(
  ids: string[],
  consulta: (lote: string[]) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let i = 0; i < ids.length; i += TAM_LOTE) {
    const { data, error } = await consulta(ids.slice(i, i + TAM_LOTE));
    if (error) throw error;
    filas.push(...((data ?? []) as T[]));
  }
  return filas;
}

/**
 * Nombre, correo y última entrada de cada usuario: `perfiles` y Auth (una vez por id). Una cuenta
 * borrada no sale. Con muchos ids se lista Auth de a páginas en vez de pedir uno por uno.
 */
export async function personasPorId(servicio: SupabaseClient, ids: string[]): Promise<Map<string, Persona>> {
  const distintos = [...new Set(ids)];
  const salida = new Map<string, Persona>();
  if (!distintos.length) return salida;
  const perfiles = await porLotes<{ usuario_id: string; nombre: string }>(distintos, (lote) =>
    servicio.from('perfiles').select('usuario_id, nombre').in('usuario_id', lote),
  );
  const nombres = new Map(perfiles.map((p) => [p.usuario_id, p.nombre]));
  const poner = (u: { id: string; email?: string; last_sign_in_at?: string }) =>
    salida.set(u.id, { nombre: nombres.get(u.id) ?? null, correo: u.email ?? '', ultimaEntrada: u.last_sign_in_at ?? null });
  if (distintos.length > 30) {
    const buscados = new Set(distintos);
    for (let page = 1; ; page++) {
      const { data, error } = await servicio.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const u of data.users) if (buscados.has(u.id)) poner(u);
      if (data.users.length < 1000) break;
    }
  } else {
    await Promise.all(
      distintos.map(async (id) => {
        const { data } = await servicio.auth.admin.getUserById(id);
        if (data?.user) poner(data.user);
      }),
    );
  }
  return salida;
}

/** Las parroquias de D1, ordenadas por nombre. Lee con el servicio: quien llama ya comprobó que es admin. */
export async function listarParroquias(servicio: SupabaseClient, ahora: Date = new Date()): Promise<FilaParroquia[]> {
  const lista = await todasLasFilas<{ id: string; slug: string; nombre: string; desactivada_en: string | null }>((d, h) =>
    servicio.from('parroquias').select('id, slug, nombre, desactivada_en').order('id').range(d, h),
  );
  if (!lista.length) return [];

  const [versiones, miembros, invitaciones] = await Promise.all([
    // Solo el número y el lugar (alias con flecha JSON de PostgREST, verificado contra el Supabase local).
    todasLasFilas<{ parroquia_id: string; numero: number; lugar: string | null }>((d, h) =>
      servicio.from('versiones').select('parroquia_id, numero, lugar:config->>lugar').order('parroquia_id').order('numero').range(d, h),
    ),
    todasLasFilas<{ parroquia_id: string; usuario_id: string }>((d, h) =>
      servicio.from('miembros').select('parroquia_id, usuario_id').order('parroquia_id').order('usuario_id').range(d, h),
    ),
    todasLasFilas<{ parroquia_id: string }>((d, h) =>
      servicio
        .from('invitaciones')
        .select('parroquia_id')
        .eq('rol', 'coordinador')
        .is('usada_en', null)
        .is('anulada_en', null)
        .gt('vence_en', ahora.toISOString())
        .order('id')
        .range(d, h),
    ),
  ]);

  const ultima = new Map<string, { numero: number; lugar: string | null }>();
  for (const v of versiones) {
    const previa = ultima.get(v.parroquia_id);
    if (!previa || v.numero > previa.numero) ultima.set(v.parroquia_id, { numero: v.numero, lugar: v.lugar });
  }
  // El borrador solo hace falta para las que no publicaron (su estado y su lugar).
  const sinPublicar = lista.filter((p) => !ultima.has(p.id)).map((p) => p.id);
  const borradores = await porLotes<{ parroquia_id: string; config: unknown }>(sinPublicar, (lote) =>
    servicio.from('borradores').select('parroquia_id, config').in('parroquia_id', lote),
  );
  const borradorDe = new Map(borradores.map((b) => [b.parroquia_id, b.config]));
  const personas = await personasPorId(
    servicio,
    miembros.map((m) => m.usuario_id),
  );
  const coordinadoresDe = new Map<string, string[]>();
  for (const m of miembros) {
    const persona = personas.get(m.usuario_id);
    if (!persona) continue;
    const lista = coordinadoresDe.get(m.parroquia_id) ?? [];
    lista.push(nombreVisible(persona.nombre, persona.correo));
    coordinadoresDe.set(m.parroquia_id, lista);
  }
  const pendientes = new Set(invitaciones.map((i) => i.parroquia_id));

  return lista
    .map((p): FilaParroquia => {
      const version = ultima.get(p.id) ?? null;
      const borrador = borradorDe.get(p.id);
      const lugar = version ? textoDe(version.lugar) : esObjeto(borrador) ? textoDe(borrador.lugar) : null;
      return {
        id: p.id,
        slug: p.slug,
        nombre: p.nombre,
        lugar,
        estado: estadoParroquia({
          desactivadaEn: p.desactivada_en,
          version: version?.numero ?? null,
          clavesBorrador: esObjeto(borrador) ? Object.keys(borrador) : [],
        }),
        coordinadores: (coordinadoresDe.get(p.id) ?? []).sort(compararEs),
        invitacionPendiente: pendientes.has(p.id),
      };
    })
    .sort((a, b) => compararEs(a.nombre, b.nombre));
}
