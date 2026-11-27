// Los vivos de Facebook que usa la app (Tarea 7): destinos, crear, estado y terminar. Sin dependencias de
// Next: recibe la sesión de quien actúa (RLS decide quién ve la parroquia), el cliente de servicio (las
// tablas facebook_* no tienen políticas) y el cliente de Graph. Los envoltorios están en
// app/editor/api/[slug]/app/facebook y app/editor/api/[slug]/app/vivo.
//
// El token de Facebook (de usuario o de página) nunca sale de aquí: ni en la respuesta, ni en `registro`,
// ni en la consola. La `clave` de transmisión solo va en la respuesta de `crearVivo` (la ruta pone
// Cache-Control: no-store) y nunca se registra. Toda consulta filtra por parroquia_id.
//
// El token de PÁGINA es el que lee y termina un vivo (con el de usuario Facebook responde 100/33).
import type { SupabaseClient } from '@supabase/supabase-js';
import { registrarSinFallar } from '../admin';
import { MENSAJE_FORMA, comprobarAcceso, conError, falloSinDetalle, type ConError, type Respuesta } from '../borrador';
import { NOMBRE_PAGINA_PERDIDA } from './asignaciones';
import { descifrar } from './cifrado';
import { marcarReconectar } from './conexion';
import { partirUrlStream, type ErrorGraph, type GraphFacebook } from './graph';

export interface DepsVivos {
  sesion: SupabaseClient;
  servicio: SupabaseClient;
  graph: GraphFacebook;
  /** Solo para pruebas; en producción la llave sale de FACEBOOK_CLAVE_CIFRADO. */
  llave?: Buffer;
}

export type Destinos = {
  conectado: boolean;
  principal: { id: string; nombre: string } | null;
  extras: { id: string; nombre: string; porDefecto: boolean }[];
};
export type VivoCreado = {
  id: string;
  servidor: string;
  clave: string;
  principal: { id: string; nombre: string };
  extras: { id: string; nombre: string }[];
  reusado: boolean;
};
export type EstadoVivo = {
  estado: 'activo' | 'terminado';
  extras: { id: string; nombre: string; salio: boolean }[];
};
export type CodigoVivo = 'sin-facebook' | 'reconectar' | 'requisitos' | 'facebook' | 'muchos';
export type ErrorVivo = { error: string; codigo: CodigoVivo };

export const MAX_TITULO = 255;
/** Cuántos vivos puede crear una parroquia en una hora: «más de 6» recibe 429. */
export const MAX_VIVOS_POR_HORA = 6;

export const MENSAJE_SIN_FACEBOOK = 'Esta parroquia no tiene Facebook conectado.';
export const MENSAJE_RECONECTAR = 'Hay que volver a conectar Facebook.';
export const MENSAJE_REQUISITOS = 'Esta página de Facebook todavía no puede transmitir en vivo.';
export const MENSAJE_FACEBOOK = 'No se pudo conectar con Facebook. Intenta de nuevo';
export const MENSAJE_MUCHOS = 'Se iniciaron demasiadas transmisiones en la última hora. Espera un poco e intenta de nuevo.';
export const MENSAJE_EXTRAS_NO_VALIDAS = 'Hay páginas que no se pueden usar para esta transmisión.';
export const MENSAJE_TITULO = `El título debe tener entre 1 y ${MAX_TITULO} caracteres.`;
export const MENSAJE_VIVO_NO_EXISTE = 'No se encontró esa transmisión.';

const UNICA_VIOLADA = '23505';

const conCodigo = (estado: number, codigo: CodigoVivo, error: string): Respuesta<ErrorVivo> => ({
  estado,
  cuerpo: { error, codigo },
});
const errorFacebook = () => conCodigo(502, 'facebook', MENSAJE_FACEBOOK);

type FilaVivo = { id: string; vivo_id: string; page_id: string; extras: string[]; terminado_en: string | null };
const COLUMNAS_VIVO = 'id, vivo_id, page_id, extras, terminado_en';

/** Lo que Facebook rechazó, traducido: token → la conexión de ESTA parroquia queda «reconectar». */
async function deGraph(d: DepsVivos, parroquiaId: string, e: ErrorGraph): Promise<Respuesta<ErrorVivo>> {
  if (e.tipo === 'token') {
    await marcarReconectar(d.servicio, parroquiaId);
    return conCodigo(503, 'reconectar', MENSAJE_RECONECTAR);
  }
  if (e.tipo === 'requisitos') return conCodigo(422, 'requisitos', MENSAJE_REQUISITOS);
  return errorFacebook();
}

/** El token de PÁGINA descifrado, o null si esa parroquia ya no ve la página. Lanza si la base o el descifrado fallan. */
async function tokenDePagina(d: DepsVivos, parroquiaId: string, pageId: string): Promise<string | null> {
  const r = await d.servicio.from('facebook_paginas').select('token').eq('parroquia_id', parroquiaId).eq('page_id', pageId).maybeSingle();
  if (r.error) throw new Error('lectura');
  return r.data ? descifrar(r.data.token as string, d.llave) : null;
}

async function nombresDe(servicio: SupabaseClient, parroquiaId: string): Promise<Map<string, string>> {
  const r = await servicio.from('facebook_paginas').select('page_id, nombre').eq('parroquia_id', parroquiaId);
  if (r.error) throw new Error('lectura');
  return new Map((r.data ?? []).map((x) => [x.page_id as string, x.nombre as string]));
}

export async function leerDestinos(d: Pick<DepsVivos, 'sesion' | 'servicio'>, slug: string): Promise<Respuesta<Destinos | ConError>> {
  try {
    const acceso = await comprobarAcceso(d.sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const s = d.servicio;
    const c = await s.from('facebook_conexion').select('estado').eq('parroquia_id', acceso.parroquiaId).maybeSingle();
    if (c.error) throw new Error('lectura');
    if (c.data?.estado !== 'conectado') return { estado: 200, cuerpo: { conectado: false, principal: null, extras: [] } };
    const p = await s.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', acceso.parroquiaId).maybeSingle();
    const e = await s
      .from('facebook_parroquia_extra')
      .select('page_id, por_defecto')
      .eq('parroquia_id', acceso.parroquiaId)
      .eq('crosspost', 'listo');
    if (p.error || e.error) throw new Error('lectura');
    const nombres = await nombresDe(s, acceso.parroquiaId);
    const nombre = (id: string) => nombres.get(id) ?? NOMBRE_PAGINA_PERDIDA;
    const principal = p.data?.pagina_principal as string | undefined;
    const extras = (e.data ?? []).map((x) => ({ id: x.page_id as string, nombre: nombre(x.page_id as string), porDefecto: x.por_defecto === true }));
    extras.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.id.localeCompare(b.id));
    return { estado: 200, cuerpo: { conectado: true, principal: principal ? { id: principal, nombre: nombre(principal) } : null, extras } };
  } catch {
    return falloSinDetalle('leerDestinos');
  }
}

/** La respuesta de un vivo que ya existe (el activo o el que ganó la carrera): arma servidor y clave de nuevo. */
async function responderConFila(
  d: DepsVivos,
  parroquiaId: string,
  fila: FilaVivo,
  token: string,
  reusado: boolean,
): Promise<Respuesta<VivoCreado | ErrorVivo>> {
  const u = await d.graph.urlDeVivo(fila.vivo_id, token);
  if (!u.ok) return deGraph(d, parroquiaId, u.error);
  const partes = partirUrlStream(u.valor);
  if (!partes) return errorFacebook();
  const nombres = await nombresDe(d.servicio, parroquiaId);
  const nombre = (id: string) => nombres.get(id) ?? NOMBRE_PAGINA_PERDIDA;
  return {
    estado: 200,
    cuerpo: {
      id: fila.id,
      servidor: partes.servidor,
      clave: partes.clave,
      principal: { id: fila.page_id, nombre: nombre(fila.page_id) },
      extras: fila.extras.map((id) => ({ id, nombre: nombre(id) })),
      reusado,
    },
  };
}

type Entrada = { extras: string[]; titulo: string };

/** La entrada bien formada, o el mensaje del 422 (las extras se comparan después con lo asignado). */
function validarEntrada(entrada: unknown): Entrada | string {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return MENSAJE_FORMA;
  const { extras, titulo } = entrada as { extras?: unknown; titulo?: unknown };
  if (!Array.isArray(extras) || extras.some((x) => typeof x !== 'string' || x === '')) return MENSAJE_FORMA;
  if (typeof titulo !== 'string') return MENSAJE_FORMA;
  const t = titulo.trim();
  if (t.length === 0 || t.length > MAX_TITULO) return MENSAJE_TITULO;
  return { extras: [...new Set(extras as string[])], titulo: t };
}

export async function crearVivo(d: DepsVivos, slug: string, entrada: unknown): Promise<Respuesta<VivoCreado | ErrorVivo | ConError>> {
  try {
    const acceso = await comprobarAcceso(d.sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const { parroquiaId, usuarioId } = acceso;
    const s = d.servicio;

    const c = await s.from('facebook_conexion').select('estado').eq('parroquia_id', parroquiaId).maybeSingle();
    const p = await s.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', parroquiaId).maybeSingle();
    if (c.error || p.error) throw new Error('lectura');
    const principal = p.data?.pagina_principal as string | undefined;
    if (c.data?.estado !== 'conectado' || !principal) return conCodigo(404, 'sin-facebook', MENSAJE_SIN_FACEBOOK);

    const v = validarEntrada(entrada);
    if (typeof v === 'string') return conError(422, v);
    const listas = await s.from('facebook_parroquia_extra').select('page_id').eq('parroquia_id', parroquiaId).eq('crosspost', 'listo');
    if (listas.error) throw new Error('lectura');
    const asignadas = new Set((listas.data ?? []).map((x) => x.page_id as string));
    if (v.extras.some((id) => !asignadas.has(id))) return conError(422, MENSAJE_EXTRAS_NO_VALIDAS);

    const desde = new Date(Date.now() - 3_600_000).toISOString();
    const recientes = await s.from('facebook_vivos').select('id').eq('parroquia_id', parroquiaId).gte('empezado_en', desde);
    if (recientes.error) throw new Error('lectura');
    if ((recientes.data ?? []).length > MAX_VIVOS_POR_HORA) return conCodigo(429, 'muchos', MENSAJE_MUCHOS);

    // ¿Ya hay un vivo activo (el índice único deja uno por parroquia)? Se le pregunta a Facebook.
    const activo = await s.from('facebook_vivos').select(COLUMNAS_VIVO).eq('parroquia_id', parroquiaId).is('terminado_en', null).maybeSingle();
    if (activo.error) throw new Error('lectura');
    if (activo.data) {
      const fila = activo.data as FilaVivo;
      const token = await tokenDePagina(d, parroquiaId, fila.page_id);
      if (token === null) return errorFacebook();
      const e = await d.graph.estadoVivo(fila.vivo_id, token);
      if (!e.ok) return deGraph(d, parroquiaId, e.error);
      if (e.valor === 'activo') return responderConFila(d, parroquiaId, fila, token, true);
      await marcarTerminado(d, parroquiaId, fila.id);
    }

    const token = await tokenDePagina(d, parroquiaId, principal);
    if (token === null) return errorFacebook();
    const nuevo = await d.graph.crearVivo(principal, token, v.titulo);
    if (!nuevo.ok) return deGraph(d, parroquiaId, nuevo.error);
    const partes = partirUrlStream(nuevo.valor.url);
    if (!partes) {
      await d.graph.terminarVivo(nuevo.valor.vivoId, token);
      return errorFacebook();
    }

    const fila = await s
      .from('facebook_vivos')
      .insert({ parroquia_id: parroquiaId, vivo_id: nuevo.valor.vivoId, page_id: principal, extras: v.extras, creado_por: usuarioId })
      .select('id')
      .single();
    if (fila.error || !fila.data) {
      if ((fila.error as { code?: string } | null)?.code !== UNICA_VIOLADA) throw new Error('escritura');
      // Otro celular de la misma parroquia llegó primero: su vivo es el bueno. El que acabamos de crear sobra.
      await d.graph.terminarVivo(nuevo.valor.vivoId, token);
      const ganador = await s.from('facebook_vivos').select(COLUMNAS_VIVO).eq('parroquia_id', parroquiaId).is('terminado_en', null).maybeSingle();
      if (ganador.error || !ganador.data) throw new Error('lectura');
      const g = ganador.data as FilaVivo;
      const tokenGanador = g.page_id === principal ? token : await tokenDePagina(d, parroquiaId, g.page_id);
      if (tokenGanador === null) return errorFacebook();
      return responderConFila(d, parroquiaId, g, tokenGanador, true);
    }

    // Replicar a las extras no corta el vivo: si falla, salen «salio: false» en estadoVivo.
    if (v.extras.length) await d.graph.activarCrosspost(nuevo.valor.vivoId, token, v.extras);

    await registrarSinFallar(
      s,
      { parroquia_id: parroquiaId, usuario_id: usuarioId, accion: 'iniciar_vivo_facebook', detalle: { slug, pagina: principal, extras: v.extras } },
      'crearVivo',
    );
    const nombres = await nombresDe(s, parroquiaId);
    const nombre = (id: string) => nombres.get(id) ?? NOMBRE_PAGINA_PERDIDA;
    return {
      estado: 200,
      cuerpo: {
        id: fila.data.id as string,
        servidor: partes.servidor,
        clave: partes.clave,
        principal: { id: principal, nombre: nombre(principal) },
        extras: v.extras.map((id) => ({ id, nombre: nombre(id) })),
        reusado: false,
      },
    };
  } catch {
    return falloSinDetalle('crearVivo');
  }
}

async function leerFila(d: DepsVivos, parroquiaId: string, id: string): Promise<FilaVivo | null> {
  const r = await d.servicio.from('facebook_vivos').select(COLUMNAS_VIVO).eq('parroquia_id', parroquiaId).eq('id', id).maybeSingle();
  // 22P02: el id de la URL no es un uuid, así que no es de nadie.
  if ((r.error as { code?: string } | null)?.code === '22P02') return null;
  if (r.error) throw new Error('lectura');
  return (r.data as FilaVivo | null) ?? null;
}

async function marcarTerminado(d: DepsVivos, parroquiaId: string, id: string): Promise<void> {
  const r = await d.servicio
    .from('facebook_vivos')
    .update({ terminado_en: new Date().toISOString() })
    .eq('id', id)
    .eq('parroquia_id', parroquiaId)
    .is('terminado_en', null);
  if (r.error) throw new Error('escritura');
}

export async function estadoVivo(d: DepsVivos, slug: string, id: string): Promise<Respuesta<EstadoVivo | ErrorVivo | ConError>> {
  try {
    const acceso = await comprobarAcceso(d.sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const { parroquiaId } = acceso;
    const fila = await leerFila(d, parroquiaId, id);
    if (!fila) return conError(404, MENSAJE_VIVO_NO_EXISTE);
    const nombres = await nombresDe(d.servicio, parroquiaId);
    const vista = (estado: 'activo' | 'terminado', salieron: Set<string>): Respuesta<EstadoVivo> => ({
      estado: 200,
      cuerpo: {
        estado,
        extras: fila.extras.map((x) => ({ id: x, nombre: nombres.get(x) ?? NOMBRE_PAGINA_PERDIDA, salio: salieron.has(x) })),
      },
    });
    if (fila.terminado_en !== null) return vista('terminado', new Set());

    const token = await tokenDePagina(d, parroquiaId, fila.page_id);
    if (token === null) return errorFacebook();
    const e = await d.graph.estadoVivo(fila.vivo_id, token);
    if (!e.ok) return deGraph(d, parroquiaId, e.error);
    if (e.valor === 'terminado') {
      await marcarTerminado(d, parroquiaId, fila.id);
      return vista('terminado', new Set());
    }
    // NO VERIFICADO (Tarea 0): se compara con el page_id de cada extra. Si crosspostHechos falla, ninguna sale.
    const hechos = await d.graph.crosspostHechos(fila.vivo_id, token);
    return vista('activo', new Set(hechos.ok ? hechos.valor : []));
  } catch {
    return falloSinDetalle('estadoVivo');
  }
}

/** Idempotente: terminar un vivo que ya terminó responde 200 sin volver a llamar a Facebook. */
export async function terminarVivo(d: DepsVivos, slug: string, id: string): Promise<Respuesta<{ terminado: true } | ErrorVivo | ConError>> {
  try {
    const acceso = await comprobarAcceso(d.sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const { parroquiaId, usuarioId } = acceso;
    const fila = await leerFila(d, parroquiaId, id);
    if (!fila) return conError(404, MENSAJE_VIVO_NO_EXISTE);
    if (fila.terminado_en !== null) return { estado: 200, cuerpo: { terminado: true } };

    const token = await tokenDePagina(d, parroquiaId, fila.page_id);
    if (token === null) return errorFacebook();
    const t = await d.graph.terminarVivo(fila.vivo_id, token);
    if (!t.ok) {
      // Quizá Facebook ya lo cerró solo: si es así, se da por terminado.
      const e = t.error.tipo === 'token' ? null : await d.graph.estadoVivo(fila.vivo_id, token);
      if (!e || !e.ok || e.valor !== 'terminado') return deGraph(d, parroquiaId, t.error);
    }
    await marcarTerminado(d, parroquiaId, fila.id);
    await registrarSinFallar(
      d.servicio,
      { parroquia_id: parroquiaId, usuario_id: usuarioId, accion: 'terminar_vivo_facebook', detalle: { slug, pagina: fila.page_id, extras: fila.extras } },
      'terminarVivo',
    );
    return { estado: 200, cuerpo: { terminado: true } };
  } catch {
    return falloSinDetalle('terminarVivo');
  }
}
