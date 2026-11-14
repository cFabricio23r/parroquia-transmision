// Administración de parroquias (D1): desactivar, reactivar, el listado con su estado y las ayudas
// puras del diálogo «Nueva parroquia». Sin dependencias de Next; recibe los clientes inyectados como
// lib/admin.ts. Los envoltorios 'use server' están en app/editor/admin/acciones.ts.
import { exigirAdmin, fallo, MENSAJE_SOLO_ADMIN, RE_UUID, registrar, type DepsAdmin, type Resultado } from './admin';
import { avisarDespliegue, type EstadoHook } from './despliegue';

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

