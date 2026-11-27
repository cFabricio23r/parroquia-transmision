// Conectar y desconectar el Facebook de una parroquia (Tarea 4). Sin dependencias de Next:
// recibe la sesión de quien actúa (RLS decide quién ve la parroquia), el cliente de servicio
// (las tablas facebook_* no tienen políticas) y el cliente de Graph. Los envoltorios están en
// app/editor/p/[slug]/app-y-transmision/facebook/conectar, app/editor/facebook/volver y
// app/editor/api/[slug]/app/facebook/conexion.
//
// Los tokens (de usuario y de página) nunca salen de aquí: se guardan cifrados (v1.…), no van en
// la vista, en `registro`, en la consola ni en ningún error. Tampoco el `code` de la vuelta.
// Toda consulta filtra por parroquia_id: una parroquia nunca toca la conexión de otra.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { comprobarAcceso, conError, falloSinDetalle, type ConError, type Respuesta } from '../borrador';
import { registrarSinFallar } from '../admin';
import { cifrar } from './cifrado';
import { versionGraph, type GraphFacebook } from './graph';

export interface DepsConexion {
  sesion: SupabaseClient;
  servicio: SupabaseClient;
  graph: GraphFacebook;
  /** Solo para pruebas; en producción la llave sale de FACEBOOK_CLAVE_CIFRADO. */
  llave?: Buffer;
}

export type VistaConexion = {
  estado: 'conectado' | 'reconectar' | 'sin-conectar';
  nombre: string | null;
  conectadoEn: string | null;
  paginas: { id: string; nombre: string; seguidores: number | null; uso: string | null }[];
};

export const PERMISOS_FACEBOOK = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'pages_read_user_content',
  'pages_manage_engagement',
  'publish_video',
] as const;

export const NOMBRE_COOKIE_ESTADO = 'fb_estado';
export const RUTA_COOKIE_ESTADO = '/editor/facebook';
export const SEGUNDOS_COOKIE_ESTADO = 600;
export const RUTA_VOLVER = '/editor/facebook/volver';

const MENSAJE_FACEBOOK = 'No se pudo conectar con Facebook. Intenta de nuevo';
const VISTA_VACIA: VistaConexion = { estado: 'sin-conectar', nombre: null, conectadoEn: null, paginas: [] };

export const urlVolver = (origen: string): string => `${origen}${RUTA_VOLVER}`;

// NO VERIFICADO (Tarea 0 Paso 1-2): dirección del diálogo y nombres de parámetros
// (client_id, redirect_uri, state, response_type, scope / config_id).
export function urlDialogo(
  estado: string,
  redirect: string,
  entorno: Record<string, string | undefined> = process.env,
): string {
  const params = new URLSearchParams({
    client_id: entorno.FACEBOOK_APP_ID ?? '',
    redirect_uri: redirect,
    state: estado,
    response_type: 'code',
  });
  if (entorno.FACEBOOK_CONFIG_ID) params.set('config_id', entorno.FACEBOOK_CONFIG_ID);
  else params.set('scope', PERMISOS_FACEBOOK.join(','));
  return `https://www.facebook.com/${versionGraph(entorno)}/dialog/oauth?${params.toString()}`;
}

// PENDIENTE TAREA 0 (Paso 2b): qué devuelve Facebook a una cuenta sin invitar
export const SENALES_NO_INVITADA: readonly { campo: string; valor: string }[] = [];

export function esNoInvitada(params: URLSearchParams, senales = SENALES_NO_INVITADA): boolean {
  return senales.some((s) => params.get(s.campo) === s.valor);
}

/** `estado` va a Facebook; `cookie` (estado + '.' + slug) va en la cookie httpOnly. base64url no lleva '.'. */
export function nuevoEstado(slug: string): { estado: string; cookie: string } {
  const estado = randomBytes(32).toString('base64url');
  return { estado, cookie: `${estado}.${slug}` };
}

/** El slug de la cookie si el state de la vuelta coincide (tiempo constante); si no, null. */
export function comprobarEstado(cookie: string | undefined, recibido: string | null): string | null {
  if (!cookie || !recibido) return null;
  const i = cookie.indexOf('.');
  if (i <= 0 || i === cookie.length - 1) return null;
  const guardado = Buffer.from(cookie.slice(0, i));
  const llegado = Buffer.from(recibido);
  if (guardado.length !== llegado.length || !timingSafeEqual(guardado, llegado)) return null;
  return cookie.slice(i + 1);
}

type FilaPagina = { page_id: string; nombre: string; seguidores: number | null };

async function leerVista(servicio: SupabaseClient, parroquiaId: string): Promise<VistaConexion | null> {
  const c = await servicio
    .from('facebook_conexion')
    .select('nombre_facebook, estado, conectado_en')
    .eq('parroquia_id', parroquiaId)
    .maybeSingle();
  if (c.error) return null;
  if (!c.data) return VISTA_VACIA;
  const p = await servicio.from('facebook_paginas').select('page_id, nombre, seguidores').eq('parroquia_id', parroquiaId);
  if (p.error) return null;
  const paginas = (p.data ?? []) as FilaPagina[];
  const ids = paginas.map((x) => x.page_id);

  const principal = await servicio.from('facebook_parroquia').select('pagina_principal').eq('parroquia_id', parroquiaId).maybeSingle();
  const extras = await servicio.from('facebook_parroquia_extra').select('page_id').eq('parroquia_id', parroquiaId);
  if (principal.error || extras.error) return null;
  let deOtra: Set<string> = new Set();
  if (ids.length) {
    const o = await servicio.from('facebook_parroquia').select('pagina_principal').neq('parroquia_id', parroquiaId).in('pagina_principal', ids);
    if (o.error) return null;
    deOtra = new Set((o.data ?? []).map((x) => x.pagina_principal as string));
  }
  const propia = principal.data?.pagina_principal as string | undefined;
  const deExtra = new Set((extras.data ?? []).map((x) => x.page_id as string));
  const uso = (id: string): string | null =>
    id === propia ? 'Principal' : deExtra.has(id) ? 'Extra' : deOtra.has(id) ? 'Principal de otra parroquia' : null;

  return {
    estado: c.data.estado === 'reconectar' ? 'reconectar' : 'conectado',
    nombre: c.data.nombre_facebook as string,
    conectadoEn: c.data.conectado_en as string,
    paginas: paginas.map((x) => ({ id: x.page_id, nombre: x.nombre, seguidores: x.seguidores, uso: uso(x.page_id) })),
  };
}

export async function leerConexion(d: DepsConexion, slug: string): Promise<Respuesta<VistaConexion | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const vista = await leerVista(d.servicio, acceso.parroquiaId);
  if (!vista) return falloSinDetalle('leerConexion');
  return { estado: 200, cuerpo: vista };
}

export async function guardarConexion(
  d: DepsConexion,
  slug: string,
  codigo: string,
  redirect: string,
): Promise<Respuesta<VistaConexion | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  const parroquiaId = acceso.parroquiaId;

  const corto = await d.graph.cambiarCodigo(codigo, redirect);
  if (!corto.ok) return conError(502, MENSAJE_FACEBOOK);
  const largo = await d.graph.alargar(corto.valor);
  if (!largo.ok) return conError(502, MENSAJE_FACEBOOK);
  const yo = await d.graph.yo(largo.valor);
  if (!yo.ok) return conError(502, MENSAJE_FACEBOOK);
  const paginas = await d.graph.paginas(largo.valor);
  if (!paginas.ok) return conError(502, MENSAJE_FACEBOOK);

  let tokenUsuario: string;
  let filas: Array<Record<string, unknown>>;
  try {
    tokenUsuario = cifrar(largo.valor, d.llave);
    filas = paginas.valor.map((p) => ({
      parroquia_id: parroquiaId,
      page_id: p.id,
      nombre: p.nombre,
      seguidores: p.seguidores,
      token: cifrar(p.token, d.llave),
      vista_en: new Date().toISOString(),
    }));
  } catch {
    return falloSinDetalle('guardarConexion');
  }

  const conexion = await d.servicio.from('facebook_conexion').upsert(
    {
      parroquia_id: parroquiaId,
      nombre_facebook: yo.valor.nombre,
      token_usuario: tokenUsuario,
      estado: 'conectado',
      conectado_por: acceso.usuarioId,
      conectado_en: new Date().toISOString(),
    },
    { onConflict: 'parroquia_id' },
  );
  if (conexion.error) return falloSinDetalle('guardarConexion');

  // Reemplaza SUS páginas (solo las de esta parroquia): primero escribe las que ve ahora, después
  // quita las que ya no ve. Las páginas elegidas (facebook_parroquia / _extra) no se tocan.
  if (filas.length) {
    const r = await d.servicio.from('facebook_paginas').upsert(filas, { onConflict: 'parroquia_id,page_id' });
    if (r.error) return falloSinDetalle('guardarConexion');
  }
  const previas = await d.servicio.from('facebook_paginas').select('page_id').eq('parroquia_id', parroquiaId);
  if (previas.error) return falloSinDetalle('guardarConexion');
  const vistas = new Set(paginas.valor.map((p) => p.id));
  const viejas = (previas.data ?? []).map((x) => x.page_id as string).filter((id) => !vistas.has(id));
  if (viejas.length) {
    const r = await d.servicio.from('facebook_paginas').delete().eq('parroquia_id', parroquiaId).in('page_id', viejas);
    if (r.error) return falloSinDetalle('guardarConexion');
  }

  await registrarSinFallar(
    d.servicio,
    { parroquia_id: parroquiaId, usuario_id: acceso.usuarioId, accion: 'conectar_facebook', detalle: { slug, paginas: filas.length } },
    'guardarConexion',
  );
  const vista = await leerVista(d.servicio, parroquiaId);
  if (!vista) return falloSinDetalle('guardarConexion');
  return { estado: 200, cuerpo: vista };
}

export async function desconectar(d: DepsConexion, slug: string): Promise<Respuesta<VistaConexion | ConError>> {
  const acceso = await comprobarAcceso(d.sesion, slug);
  if (!acceso.ok) return acceso.respuesta;
  // Las páginas elegidas (facebook_parroquia / _extra) se dejan: al reconectar siguen ahí.
  const c = await d.servicio.from('facebook_conexion').delete().eq('parroquia_id', acceso.parroquiaId);
  if (c.error) return falloSinDetalle('desconectar');
  const p = await d.servicio.from('facebook_paginas').delete().eq('parroquia_id', acceso.parroquiaId);
  if (p.error) return falloSinDetalle('desconectar');
  await registrarSinFallar(
    d.servicio,
    { parroquia_id: acceso.parroquiaId, usuario_id: acceso.usuarioId, accion: 'desconectar_facebook', detalle: { slug } },
    'desconectar',
  );
  return { estado: 200, cuerpo: VISTA_VACIA };
}

/** La usa la Tarea 7 cuando Facebook rechaza el token (error 190). Solo toca esa parroquia. */
export async function marcarReconectar(servicio: SupabaseClient, parroquiaId: string): Promise<void> {
  try {
    const { error } = await servicio.from('facebook_conexion').update({ estado: 'reconectar' }).eq('parroquia_id', parroquiaId);
    if (error) console.error('[marcarReconectar] no se pudo marcar');
  } catch {
    console.error('[marcarReconectar] no se pudo marcar');
  }
}

export type SalidaVuelta = { estado: 400 } | { estado: 302; ubicacion: string };

/**
 * La vuelta de Facebook. El state de la URL tiene que coincidir con el de la cookie (si no, 400 y
 * nada pasa); la cookie dice qué parroquia se conecta. Cualquier otra falla redirige con ?error=…
 * y no guarda nada.
 */
export async function procesarVuelta(
  d: DepsConexion,
  entrada: { params: URLSearchParams; cookie: string | undefined; redirect: string },
  senales = SENALES_NO_INVITADA,
): Promise<SalidaVuelta> {
  const slug = comprobarEstado(entrada.cookie, entrada.params.get('state'));
  if (slug === null) return { estado: 400 };
  const base = `/editor/p/${encodeURIComponent(slug)}/app-y-transmision`;
  if (esNoInvitada(entrada.params, senales)) return { estado: 302, ubicacion: `${base}?error=no-invitada` };
  const codigo = entrada.params.get('code');
  if (entrada.params.has('error') || !codigo) return { estado: 302, ubicacion: `${base}?error=1` };
  const r = await guardarConexion(d, slug, codigo, entrada.redirect);
  if (r.estado !== 200) return { estado: 302, ubicacion: `${base}?error=1` };
  return { estado: 302, ubicacion: `${base}/facebook?listo=1` };
}
