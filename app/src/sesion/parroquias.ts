/**
 * Lo que la app lee de Supabase con la sesión: la lista de parroquias y la cuenta.
 *
 * RLS deja al coordinador solo las suyas activas y al admin todas; el filtro de `visible`
 * y de `desactivada_en` va en la consulta, porque el admin ve las desactivadas (Decisión 8).
 */
import type { ClienteSupabase, Resultado } from '../supabase/cliente';
import { comoParroquia } from './almacen';
import type { SesionApp } from './sesion';
import type { Cuenta, ParroquiaApp } from './tipos';

export const CONSULTA_PARROQUIAS: Readonly<Record<string, string>> = Object.freeze({
  select: 'id,slug,nombre',
  visible: 'eq.true',
  desactivada_en: 'is.null',
  order: 'nombre.asc',
});

export function leerParroquias(sesion: SesionApp, cliente: ClienteSupabase): Promise<Resultado<ParroquiaApp[]>> {
  return sesion.conSesion(async (s) => {
    const r = await cliente.seleccionar<unknown>(s, 'parroquias', CONSULTA_PARROQUIAS);
    if (!r.ok) return r;
    return { ok: true, valor: r.valor.map(comoParroquia).filter((p): p is ParroquiaApp => p !== null) };
  });
}

export function leerCuenta(sesion: SesionApp, cliente: ClienteSupabase): Promise<Resultado<Cuenta>> {
  return sesion.conSesion(async (s) => {
    const filtro = 'eq.' + s.usuarioId;
    const perfil = await cliente.seleccionar<{ nombre?: unknown }>(s, 'perfiles', { select: 'nombre', usuario_id: filtro });
    if (!perfil.ok) return perfil;
    const admin = await cliente.seleccionar<unknown>(s, 'administradores', { select: 'usuario_id', usuario_id: filtro });
    if (!admin.ok) return admin;
    const crudo = perfil.valor[0]?.nombre;
    const nombre = typeof crudo === 'string' && crudo.trim() !== '' ? crudo.trim() : null;
    return { ok: true, valor: { usuarioId: s.usuarioId, correo: s.correo, nombre, esAdmin: admin.valor.length > 0 } };
  });
}

export function revisarAcceso(
  lista: readonly ParroquiaApp[],
  elegida: ParroquiaApp,
): { tipo: 'ok'; parroquia: ParroquiaApp } | { tipo: 'sin-acceso' } {
  const encontrada = lista.find((p) => p.id === elegida.id);
  return encontrada ? { tipo: 'ok', parroquia: encontrada } : { tipo: 'sin-acceso' };
}
