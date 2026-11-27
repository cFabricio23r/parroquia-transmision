// «¿Dónde sale la misa?» (Tarea 5): la página principal de cada parroquia y las extras a las que se
// replica la transmisión. Sin dependencias de Next: recibe la sesión de quien actúa (RLS decide quién ve
// la parroquia), el cliente de servicio (las tablas facebook_* no tienen políticas) y el cliente de Graph.
// Los envoltorios están en app/editor/api/[slug]/app/facebook/paginas y en la página
// app/editor/p/[slug]/app-y-transmision/facebook.
//
// Los tokens de página se leen y se descifran SOLO en `guardarAsignacion`, para el handshake, y no salen
// de ahí: ni en la respuesta, ni en `registro`, ni en la consola. `leerEstadosFacebook` no lee tokens
// ni devuelve `page_id`. Toda consulta filtra por parroquia_id: una parroquia nunca toca lo de otra.
import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAJE_SOLO_ADMIN, exigirAdmin, registrarSinFallar } from '../admin';
import { MENSAJE_FORMA, comprobarAcceso, conError, falloSinDetalle, type ConError, type Respuesta } from '../borrador';
import { descifrar } from './cifrado';
import type { GraphFacebook } from './graph';

export interface DepsAsignacion {
  sesion: SupabaseClient;
  servicio: SupabaseClient;
  graph: GraphFacebook;
  /** Solo para pruebas; en producción la llave sale de FACEBOOK_CLAVE_CIFRADO. */
  llave?: Buffer;
  /** Solo para pruebas: el plazo total de las comprobaciones con Facebook. */
  plazoMs?: number;
}

/** `principal` es el page_id de la página principal (o null); cada extra lleva su `pageId`. */
export type VistaAsignacion = {
  principal: string | null;
  extras: { pageId: string; nombre: string; porDefecto: boolean; crosspost: 'listo' | 'falta' }[];
};

export type EstadoFacebook = {
  estado: 'conectado' | 'reconectar' | 'sin-conectar';
  /** Nombre de la página principal (nunca su page_id), o null. */
  principal: string | null;
  /** Cuántas páginas extra tiene elegidas («Parroquia Ciudad Arce + 2»). */
  extras: number;
};

export const MAX_EXTRAS = 20;
export const MENSAJE_PRINCIPAL_DE_OTRA = 'Esa página ya es la principal de otra parroquia.';
export const MENSAJE_PAGINA_NO_VISTA = 'Esa página no está entre las que ve la cuenta conectada. Vuelve a conectar o elige otra.';
export const MENSAJE_EXTRA_ES_PRINCIPAL = 'La página principal no puede ser también una de las extras.';
export const MENSAJE_MUCHAS_EXTRAS = `Puedes elegir hasta ${MAX_EXTRAS} páginas extra.`;
export const NOMBRE_PAGINA_PERDIDA = 'Página que esta cuenta ya no ve';

const UNICA_VIOLADA = '23505';

type Entrada = { principal: string; extras: { pageId: string; porDefecto: boolean }[] };

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;

/** La entrada bien formada, o el mensaje del 422. */
function validar(entrada: unknown): Entrada | string {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return MENSAJE_FORMA;
  const { principal, extras } = entrada as { principal?: unknown; extras?: unknown };
  if (!esTexto(principal) || !Array.isArray(extras)) return MENSAJE_FORMA;
  if (extras.length > MAX_EXTRAS) return MENSAJE_MUCHAS_EXTRAS;
  const vistas = new Set<string>();
  const lista: Entrada['extras'] = [];
  for (const e of extras) {
    if (typeof e !== 'object' || e === null) return MENSAJE_FORMA;
    const { pageId, porDefecto } = e as { pageId?: unknown; porDefecto?: unknown };
    if (!esTexto(pageId) || typeof porDefecto !== 'boolean' || vistas.has(pageId)) return MENSAJE_FORMA;
    vistas.add(pageId);
    lista.push({ pageId, porDefecto });
  }
  return { principal, extras: lista };
}

async function leerVista(servicio: SupabaseClient, parroquiaId: string): Promise<VistaAsignacion | null> {
  const p = await servicio.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', parroquiaId).maybeSingle();
  const e = await servicio.from('facebook_parroquia_extra').select('page_id, por_defecto, crosspost').eq('parroquia_id', parroquiaId);
  const n = await servicio.from('facebook_paginas').select('page_id, nombre').eq('parroquia_id', parroquiaId);
  if (p.error || e.error || n.error) return null;
  const nombres = new Map((n.data ?? []).map((x) => [x.page_id as string, x.nombre as string]));
  const extras = (e.data ?? []).map((x) => ({
    pageId: x.page_id as string,
    nombre: nombres.get(x.page_id as string) ?? NOMBRE_PAGINA_PERDIDA,
    porDefecto: x.por_defecto === true,
    crosspost: (x.crosspost === 'listo' ? 'listo' : 'falta') as 'listo' | 'falta',
  }));
  extras.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || a.pageId.localeCompare(b.pageId));
  return { principal: (p.data?.pagina_principal as string | undefined) ?? null, extras };
}

export async function leerAsignacion(
  d: Pick<DepsAsignacion, 'sesion' | 'servicio'>,
  slug: string,
): Promise<Respuesta<VistaAsignacion | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const vista = await leerVista(d.servicio, acceso.parroquiaId);
  if (!vista) return falloSinDetalle('leerAsignacion');
  return { estado: 200, cuerpo: vista };
}

/**
 * Comprueba que la principal deje compartir a una extra: handshake y después permiteLive. Nunca falla
 * hacia afuera: un error, un `false` o un token que no se descifra dejan la extra en «falta»
 * (guardar no depende de Facebook).
 */
async function comprobarCrosspost(
  d: DepsAsignacion,
  principal: { id: string; token: string } | null,
  destino: { id: string; token: string } | null,
): Promise<'listo' | 'falta'> {
  if (!principal || !destino) return 'falta';
  try {
    // NO VERIFICADO (Tarea 0 Paso 2): qué página es el «origen» en cada llamada; ver graph.ts.
    await d.graph.handshake(principal, destino);
    const r = await d.graph.permiteLive(principal, destino.id);
    return r.ok && r.valor === true ? 'listo' : 'falta';
  } catch {
    return 'falta';
  }
}

function conToken(fila: { page_id: string; token: string } | undefined, llave?: Buffer): { id: string; token: string } | null {
  if (!fila) return null;
  try {
    return { id: fila.page_id, token: descifrar(fila.token, llave) };
  } catch {
    return null;
  }
}

/** Plazo total para comprobar todas las extras nuevas. Lo que no termina a tiempo queda en «falta». */
export const PLAZO_COMPROBACION_MS = 8_000;

/** Las extras (page_id) que salieron «listo» antes del plazo. Nunca lanza ni espera más que el plazo. */
async function comprobarTodas(
  d: DepsAsignacion,
  origen: { id: string; token: string } | null,
  ids: string[],
  tokens: Map<string, string>,
): Promise<string[]> {
  const listas: string[] = [];
  const todas = Promise.all(
    ids.map(async (id) => {
      const destino = conToken({ page_id: id, token: tokens.get(id) as string }, d.llave);
      if ((await comprobarCrosspost(d, origen, destino)) === 'listo') listas.push(id);
    }),
  );
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<void>((ok) => {
    reloj = setTimeout(ok, d.plazoMs ?? PLAZO_COMPROBACION_MS);
  });
  try {
    await Promise.race([todas, plazo]);
  } finally {
    clearTimeout(reloj);
  }
  // Una comprobación que termine después del plazo ya no cuenta: se toma una copia de las que llegaron.
  return [...listas];
}

export async function guardarAsignacion(d: DepsAsignacion, slug: string, entrada: unknown): Promise<Respuesta<VistaAsignacion | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const parroquiaId = acceso.parroquiaId;

  const v = validar(entrada);
  if (typeof v === 'string') return conError(422, v);
  if (v.extras.some((e) => e.pageId === v.principal)) return conError(422, MENSAJE_EXTRA_ES_PRINCIPAL);

  // Solo las páginas de ESTA parroquia: el page_id de otra no sirve aunque exista.
  const paginas = await d.servicio.from('facebook_paginas').select('page_id, token').eq('parroquia_id', parroquiaId);
  if (paginas.error) return falloSinDetalle('guardarAsignacion');
  const tokens = new Map((paginas.data ?? []).map((x) => [x.page_id as string, x.token as string]));
  if (!tokens.has(v.principal) || v.extras.some((e) => !tokens.has(e.pageId))) return conError(422, MENSAJE_PAGINA_NO_VISTA);

  const deOtra = await d.servicio
    .from('facebook_parroquia')
    .select('parroquia_id')
    .neq('parroquia_id', parroquiaId)
    .eq('pagina_principal', v.principal);
  if (deOtra.error) return falloSinDetalle('guardarAsignacion');
  if ((deOtra.data ?? []).length > 0) return conError(422, MENSAJE_PRINCIPAL_DE_OTRA);

  const previaPrincipal = await d.servicio.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', parroquiaId).maybeSingle();
  const previasExtras = await d.servicio.from('facebook_parroquia_extra').select('page_id, crosspost').eq('parroquia_id', parroquiaId);
  if (previaPrincipal.error || previasExtras.error) return falloSinDetalle('guardarAsignacion');
  const mismaPrincipal = previaPrincipal.data?.pagina_principal === v.principal;
  const yaListas = new Set((previasExtras.data ?? []).filter((x) => x.crosspost === 'listo').map((x) => x.page_id as string));

  // Guardar no depende de Facebook: primero se escribe todo (las extras nuevas como «falta») y después
  // se comprueban, en paralelo y con un solo plazo, solo las extras nuevas o las que estaban en «falta».
  // Si cambió la principal, el permiso era de la anterior y se comprueba todo de nuevo.
  const estados = new Map<string, 'listo' | 'falta'>();
  const porComprobar: string[] = [];
  for (const e of v.extras) {
    if (mismaPrincipal && yaListas.has(e.pageId)) estados.set(e.pageId, 'listo');
    else {
      estados.set(e.pageId, 'falta');
      porComprobar.push(e.pageId);
    }
  }

  const principal = await d.servicio.from('facebook_parroquia').upsert(
    { parroquia_id: parroquiaId, pagina_principal: v.principal, actualizado_por: acceso.usuarioId, actualizado_en: new Date().toISOString() },
    { onConflict: 'parroquia_id' },
  );
  if (principal.error) {
    // La otra parroquia ganó la carrera: el índice único de la base es el que manda.
    if ((principal.error as { code?: string }).code === UNICA_VIOLADA) return conError(422, MENSAJE_PRINCIPAL_DE_OTRA);
    return falloSinDetalle('guardarAsignacion');
  }

  const quedan = new Set(v.extras.map((e) => e.pageId));
  const quitar = (previasExtras.data ?? []).map((x) => x.page_id as string).filter((id) => !quedan.has(id));
  if (quitar.length) {
    const r = await d.servicio.from('facebook_parroquia_extra').delete().eq('parroquia_id', parroquiaId).in('page_id', quitar);
    if (r.error) return falloSinDetalle('guardarAsignacion');
  }
  if (v.extras.length) {
    const r = await d.servicio.from('facebook_parroquia_extra').upsert(
      v.extras.map((e) => ({ parroquia_id: parroquiaId, page_id: e.pageId, por_defecto: e.porDefecto, crosspost: estados.get(e.pageId) ?? 'falta' })),
      { onConflict: 'parroquia_id,page_id' },
    );
    if (r.error) return falloSinDetalle('guardarAsignacion');
  }

  if (porComprobar.length) {
    const origen = conToken({ page_id: v.principal, token: tokens.get(v.principal) as string }, d.llave);
    const listas = await comprobarTodas(d, origen, porComprobar, tokens);
    if (listas.length) {
      const r = await d.servicio.from('facebook_parroquia_extra').upsert(
        v.extras
          .filter((e) => listas.includes(e.pageId))
          .map((e) => ({ parroquia_id: parroquiaId, page_id: e.pageId, por_defecto: e.porDefecto, crosspost: 'listo' })),
        { onConflict: 'parroquia_id,page_id' },
      );
      if (r.error) return falloSinDetalle('guardarAsignacion');
    }
  }

  await registrarSinFallar(
    d.servicio,
    { parroquia_id: parroquiaId, usuario_id: acceso.usuarioId, accion: 'elegir_paginas_facebook', detalle: { slug, extras: v.extras.length } },
    'guardarAsignacion',
  );
  const vista = await leerVista(d.servicio, parroquiaId);
  if (!vista) return falloSinDetalle('guardarAsignacion');
  return { estado: 200, cuerpo: vista };
}

/**
 * La columna «Facebook» de la tabla de Parroquias, por parroquia_id. Solo un administrador. Una parroquia
 * sin conexión no figura (la tabla la muestra «Sin conectar»). Sin tokens y sin page_id: solo el nombre
 * de la principal y cuántas extras hay.
 */
export async function leerEstadosFacebook(
  d: Pick<DepsAsignacion, 'sesion' | 'servicio'>,
): Promise<Respuesta<Record<string, EstadoFacebook> | ConError>> {
  if (!(await exigirAdmin(d.sesion))) return conError(403, MENSAJE_SOLO_ADMIN);
  const c = await d.servicio.from('facebook_conexion').select('parroquia_id, estado');
  const p = await d.servicio.from('facebook_parroquia').select('parroquia_id, pagina_principal');
  const e = await d.servicio.from('facebook_parroquia_extra').select('parroquia_id');
  const n = await d.servicio.from('facebook_paginas').select('parroquia_id, page_id, nombre');
  if (c.error || p.error || e.error || n.error) return falloSinDetalle('leerEstadosFacebook');

  const principales = new Map((p.data ?? []).map((x) => [x.parroquia_id as string, x.pagina_principal as string]));
  const nombres = new Map((n.data ?? []).map((x) => [`${x.parroquia_id}/${x.page_id}`, x.nombre as string]));
  const extras = new Map<string, number>();
  for (const x of e.data ?? []) extras.set(x.parroquia_id as string, (extras.get(x.parroquia_id as string) ?? 0) + 1);

  const salida: Record<string, EstadoFacebook> = {};
  for (const x of c.data ?? []) {
    const id = x.parroquia_id as string;
    const pagina = principales.get(id);
    salida[id] = {
      estado: x.estado === 'reconectar' ? 'reconectar' : 'conectado',
      principal: pagina ? (nombres.get(`${id}/${pagina}`) ?? null) : null,
      extras: extras.get(id) ?? 0,
    };
  }
  return { estado: 200, cuerpo: salida };
}
