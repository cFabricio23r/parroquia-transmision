// Administración sin dependencias de Next: recibe los clientes y el envío de correo,
// así se prueba contra el Supabase local. Los envoltorios 'use server' están en
// app/editor/admin/acciones.ts.
import type { SupabaseClient } from '@supabase/supabase-js';
import { correoInvitacion, type Mensaje } from './correo';
import { validarNombre } from './perfiles';
import { MENSAJE_CLAVES_DISTINTAS, MENSAJE_CLAVE_CORTA, MINIMO_CLAVE } from './sesion';
import { revisarSlug } from './slug';
import { DIAS_INVITACION, hashDe, nuevoToken } from './tokens';

export const MENSAJE_SOLO_ADMIN = 'Solo un administrador puede hacer esto';
export const MENSAJE_INVITACION_INVALIDA = 'Esta invitación ya no sirve. Pide una nueva al administrador';
const MENSAJE_FALLO = 'No se pudo completar. Intenta de nuevo';
export const MENSAJE_PARROQUIA_DESACTIVADA = 'Esa parroquia está desactivada. Reactívala antes de invitar.';
export const MENSAJE_INVITACION_DESACTIVADA =
  'Esta parroquia está desactivada por ahora. Pídele a la Pastoral de Comunicaciones que la reactive.';

/** Campo del formulario al que se refiere el error; sin `campo`, el error va solo en el resumen. */
export type Campo = 'nombre' | 'slug' | 'correo' | 'clave' | 'lugar';
export interface Resultado {
  error?: string;
  campo?: Campo;
}

export interface DepsAdmin {
  servicio: SupabaseClient; // service_role: salta RLS (el registro solo lo escribe él)
  sesion: SupabaseClient; // la sesión de quien actúa
  enviar: (m: Mensaje) => Promise<void>;
  sitioUrl: string;
  slugsDelRepo: string[];
  /** `VERCEL_DEPLOY_HOOK_URL`, para desactivar y reactivar. Es un secreto: nunca se registra. */
  hookUrl?: string;
}

const normalizar = (correo: string) => correo.trim().toLowerCase();
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fallo(donde: string, e: unknown): { error: string } {
  console.error(`[${donde}]`, e instanceof Error ? e.message : (e as { message?: string })?.message ?? e);
  return { error: MENSAJE_FALLO };
}

/** Id del usuario de la sesión si es administrador (está en `administradores` o es_admin() es cierto); si no, null. */
export async function exigirAdmin(sesion: SupabaseClient): Promise<string | null> {
  const { data } = await sesion.auth.getUser();
  const id = data.user?.id;
  if (!id) return null;
  const { data: esAdmin } = await sesion.rpc('es_admin');
  if (esAdmin === true) return id;
  const { data: fila } = await sesion.from('administradores').select('usuario_id').eq('usuario_id', id).maybeSingle();
  return fila ? id : null;
}

export async function registrar(
  servicio: SupabaseClient,
  fila: { parroquia_id: string | null; usuario_id: string | null; accion: string; detalle: Record<string, unknown> },
): Promise<void> {
  const { error } = await servicio.from('registro').insert(fila);
  if (error) throw error;
}

export const MAX_LUGAR = 200;

/** Crea la parroquia y su borrador `{ nombre, lugar }`. El lugar es obligatorio (vicaria lo exige para publicar). Solo administradores. */
export async function crearParroquia(
  deps: DepsAdmin,
  slugCrudo: string,
  nombreCrudo: string,
  lugarCrudo: string,
): Promise<Resultado & { slug?: string }> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  const slug = slugCrudo.trim().toLowerCase();
  const nombre = nombreCrudo.trim();
  const errorSlug = revisarSlug(slug, deps.slugsDelRepo);
  if (errorSlug) return { error: errorSlug, campo: 'slug' };
  if (!nombre) return { error: 'Escribe el nombre de la parroquia.', campo: 'nombre' };
  const lugar = lugarCrudo.trim();
  if (!lugar) return { error: 'Escribe el lugar.', campo: 'lugar' };
  if (lugar.length > MAX_LUGAR) return { error: `El lugar puede tener hasta ${MAX_LUGAR} caracteres.`, campo: 'lugar' };
  try {
    const { data, error } = await deps.servicio
      .from('parroquias')
      .insert({ slug, nombre, creada_por: quien })
      .select('id')
      .single();
    if (error?.code === '23505') return { error: 'Esa dirección ya está en uso o está reservada. Elige otra.', campo: 'slug' };
    if (error || !data) throw error ?? new Error('sin fila');
    const { error: errorBorrador } = await deps.servicio
      .from('borradores')
      .insert({ parroquia_id: data.id, config: { nombre, lugar }, actualizado_por: quien });
    if (errorBorrador) {
      await deps.servicio.from('parroquias').delete().eq('id', data.id); // sin borrador no queda parroquia a medias
      throw errorBorrador;
    }
    await registrar(deps.servicio, { parroquia_id: data.id, usuario_id: quien, accion: 'crear_parroquia', detalle: { slug, nombre } });
    return { slug };
  } catch (e) {
    return fallo('crearParroquia', e);
  }
}

/** Invita a un coordinador. Anula las pendientes del mismo correo y parroquia. Solo administradores. */
export async function invitar(deps: DepsAdmin, correoCrudo: string, parroquiaId: string): Promise<Resultado> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  const correo = normalizar(correoCrudo);
  if (!RE_CORREO.test(correo)) return { error: 'Escribe un correo válido.', campo: 'correo' };
  if (!RE_UUID.test(parroquiaId)) return { error: 'Esa parroquia no existe.' };
  try {
    const { data: parroquia } = await deps.servicio
      .from('parroquias')
      .select('nombre, desactivada_en')
      .eq('id', parroquiaId)
      .maybeSingle();
    if (!parroquia) return { error: 'Esa parroquia no existe.' };
    if (parroquia.desactivada_en) return { error: MENSAJE_PARROQUIA_DESACTIVADA };

    const ahora = new Date().toISOString();
    const { error: errorAnular } = await deps.servicio
      .from('invitaciones')
      .update({ anulada_en: ahora })
      .eq('correo', correo)
      .eq('parroquia_id', parroquiaId)
      .is('usada_en', null)
      .is('anulada_en', null);
    if (errorAnular) throw errorAnular;

    const { token, hash } = nuevoToken();
    const vence = new Date(Date.now() + DIAS_INVITACION * 86_400_000).toISOString();
    const { data: inv, error: errorInsert } = await deps.servicio
      .from('invitaciones')
      .insert({ correo, rol: 'coordinador', parroquia_id: parroquiaId, token_hash: hash, vence_en: vence, creada_por: quien })
      .select('id')
      .single();
    if (errorInsert || !inv) throw errorInsert ?? new Error('sin fila');

    const enlace = `${deps.sitioUrl}/editor/invitacion?token=${token}`;
    try {
      await deps.enviar({ para: correo, ...correoInvitacion({ enlace, parroquia: parroquia.nombre, rol: 'coordinador' }) });
    } catch (e) {
      await deps.servicio.from('invitaciones').update({ anulada_en: new Date().toISOString() }).eq('id', inv.id);
      return fallo('invitar:correo', e);
    }
    await registrar(deps.servicio, { parroquia_id: parroquiaId, usuario_id: quien, accion: 'invitar', detalle: { correo } });
    return {};
  } catch (e) {
    return fallo('invitar', e);
  }
}

/** Quita a un coordinador de una parroquia. Solo administradores. */
export async function quitarAcceso(deps: DepsAdmin, parroquiaId: string, usuarioId: string): Promise<Resultado> {
  const quien = await exigirAdmin(deps.sesion);
  if (!quien) return { error: MENSAJE_SOLO_ADMIN };
  if (!RE_UUID.test(parroquiaId) || !RE_UUID.test(usuarioId)) return { error: MENSAJE_FALLO };
  try {
    const { error } = await deps.servicio.from('miembros').delete().eq('parroquia_id', parroquiaId).eq('usuario_id', usuarioId);
    if (error) throw error;
    await registrar(deps.servicio, { parroquia_id: parroquiaId, usuario_id: quien, accion: 'quitar_acceso', detalle: { usuario_id: usuarioId } });
    return {};
  } catch (e) {
    return fallo('quitarAcceso', e);
  }
}

type Rol = 'coordinador' | 'administrador';
interface FilaInvitacion {
  id: string;
  correo: string;
  rol: Rol;
  parroquia_id: string | null;
  vence_en: string;
  usada_en: string | null;
  anulada_en: string | null;
}

/**
 * Estado de una invitación (Decisión 8 del plan 2). Usada o anulada gana aunque además esté vencida:
 * a quien ya entró no se le pide que pida otra. Vence justo al llegar `vence_en`.
 */
export function estadoInvitacion(
  fila: { usada_en: string | null; anulada_en: string | null; vence_en: string } | null,
  ahora: number,
): 'vigente' | 'vencida' | 'no-sirve' {
  if (!fila || fila.usada_en || fila.anulada_en) return 'no-sirve';
  const vence = new Date(fila.vence_en).getTime();
  if (Number.isNaN(vence) || vence <= ahora) return 'vencida';
  return 'vigente';
}

async function leerInvitacion(servicio: SupabaseClient, token: string): Promise<FilaInvitacion | null> {
  if (!token) return null;
  const { data } = await servicio
    .from('invitaciones')
    .select('id, correo, rol, parroquia_id, vence_en, usada_en, anulada_en')
    .eq('token_hash', hashDe(token))
    .maybeSingle();
  return (data as FilaInvitacion | null) ?? null;
}

/** La invitación si está vigente; si no, null. */
async function buscarInvitacion(servicio: SupabaseClient, token: string): Promise<FilaInvitacion | null> {
  const fila = await leerInvitacion(servicio, token);
  return estadoInvitacion(fila, Date.now()) === 'vigente' ? fila : null;
}

async function usuarioPorCorreo(servicio: SupabaseClient, correo: string): Promise<string | null> {
  const { data, error } = await servicio.rpc('usuario_id_por_correo', { p_correo: correo });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export const MENSAJE_ENTRAR_MANUAL =
  'Tu cuenta quedó creada y la invitación aceptada, pero no pudimos iniciar tu sesión. Entra con tu correo y tu contraseña en /editor/entrar';
const mensajeSinSesion = (correo: string) =>
  `Ya tienes una cuenta con ${correo}. Entra con ese correo en /editor/entrar y luego abre otra vez el enlace de la invitación`;
const mensajeOtraSesion = (correo: string) => `Esta invitación es para ${correo}. Sal de tu cuenta y entra con esa`;

export interface Invitacion {
  correo: string;
  rol: Rol;
  parroquia: string | null;
  /** Qué debe hacer quien la abre: crear la cuenta, aceptar con la sesión, o entrar primero. */
  paso: 'crear' | 'aceptar' | 'entrar' | 'otra-sesion';
}

export type ConsultaInvitacion =
  | { estado: 'no-sirve' }
  | { estado: 'vencida' }
  | ({ estado: 'vigente'; venceEn: string } & Invitacion);

/** Lo que muestra la página de la invitación: si no sirve, si venció, o qué paso le toca a quien la abre. */
export async function consultarInvitacion(
  deps: Pick<DepsAdmin, 'servicio' | 'sesion'>,
  token: string,
): Promise<ConsultaInvitacion> {
  const inv = await leerInvitacion(deps.servicio, token);
  const estado = estadoInvitacion(inv, Date.now());
  if (estado === 'vencida') return { estado: 'vencida' };
  if (estado !== 'vigente' || !inv) return { estado: 'no-sirve' };
  let parroquia: string | null = null;
  if (inv.parroquia_id) {
    const { data } = await deps.servicio.from('parroquias').select('nombre').eq('id', inv.parroquia_id).maybeSingle();
    parroquia = data?.nombre ?? null;
  }
  const base = { estado: 'vigente' as const, venceEn: inv.vence_en, correo: inv.correo, rol: inv.rol, parroquia };
  if (!(await usuarioPorCorreo(deps.servicio, inv.correo))) return { ...base, paso: 'crear' };
  const { data } = await deps.sesion.auth.getUser();
  const actual = data.user?.email ? normalizar(data.user.email) : null;
  if (!actual) return { ...base, paso: 'entrar' };
  return { ...base, paso: actual === inv.correo ? 'aceptar' : 'otra-sesion' };
}

/**
 * Acepta una invitación. Correo sin cuenta: crea el usuario (con contraseña) y deja la sesión iniciada.
 * Correo con cuenta: exige la sesión con ese mismo correo. El token se gasta de forma atómica
 * (`usada_en` con condición) antes de asignar nada, así dos pedidos a la vez no lo usan dos veces.
 */
export async function aceptarInvitacion(
  deps: DepsAdmin,
  token: string,
  datos: { clave?: string; repetida?: string; nombre?: string },
): Promise<Resultado & { parroquiaSlug?: string; aviso?: string }> {
  try {
    // Una vencida también da MENSAJE_INVITACION_INVALIDA (carrera rara entre abrir y enviar): la página distingue.
    const inv = await buscarInvitacion(deps.servicio, token);
    if (!inv) return { error: MENSAJE_INVITACION_INVALIDA };
    // Una parroquia desactivada: se avisa antes de gastar el token, así sirve otra vez al reactivarla.
    if (inv.parroquia_id) {
      const { data: parroquia, error: errorParroquia } = await deps.servicio
        .from('parroquias')
        .select('desactivada_en')
        .eq('id', inv.parroquia_id)
        .maybeSingle();
      if (errorParroquia) throw errorParroquia;
      if (parroquia?.desactivada_en) return { error: MENSAJE_INVITACION_DESACTIVADA };
    }

    const existente = await usuarioPorCorreo(deps.servicio, inv.correo);

    const clave = datos.clave ?? '';
    let nombre: string | null = null;
    if (existente) {
      const { data } = await deps.sesion.auth.getUser();
      const actual = data.user?.email ? normalizar(data.user.email) : null;
      if (!actual) return { error: mensajeSinSesion(inv.correo) };
      if (actual !== inv.correo || data.user?.id !== existente) return { error: mensajeOtraSesion(inv.correo) };
    } else {
      if (clave.length < MINIMO_CLAVE) return { error: MENSAJE_CLAVE_CORTA, campo: 'clave' };
      if (clave !== (datos.repetida ?? '')) return { error: MENSAJE_CLAVES_DISTINTAS, campo: 'clave' };
      // El nombre se pide solo al crear la cuenta y se valida antes de gastar el token.
      const v = validarNombre(datos.nombre ?? '');
      if ('error' in v) return { error: v.error, campo: 'nombre' };
      nombre = v.nombre;
    }

    // Gasta el token: solo uno de dos pedidos simultáneos encuentra la fila todavía libre.
    const { data: gastada, error: errorGasto } = await deps.servicio
      .from('invitaciones')
      .update({ usada_en: new Date().toISOString() })
      .eq('id', inv.id)
      .is('usada_en', null)
      .is('anulada_en', null)
      .gt('vence_en', new Date().toISOString())
      .select('id');
    if (errorGasto) throw errorGasto;
    if (!gastada || gastada.length === 0) return { error: MENSAJE_INVITACION_INVALIDA };

    const devolver = async () => {
      await deps.servicio.from('invitaciones').update({ usada_en: null }).eq('id', inv.id);
    };
    try {
      let usuarioId = existente;
      if (!usuarioId) {
        const { data, error } = await deps.servicio.auth.admin.createUser({ email: inv.correo, password: clave, email_confirm: true });
        if (error || !data.user) throw error ?? new Error('sin usuario');
        usuarioId = data.user.id;
        // La cuenta y la asignación valen más que el nombre: si guardarlo falla, solo se registra
        // y se completa en Mi cuenta (Decisión 8 del plan 2).
        if (nombre) {
          const { error: errorPerfil } = await deps.servicio
            .from('perfiles')
            .upsert({ usuario_id: usuarioId, nombre, actualizado_en: new Date().toISOString() }, { onConflict: 'usuario_id' });
          if (errorPerfil) console.error('[aceptarInvitacion:perfil]', errorPerfil.message);
        }
      }
      if (inv.rol === 'administrador') {
        const { error } = await deps.servicio.from('administradores').upsert({ usuario_id: usuarioId }, { onConflict: 'usuario_id', ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await deps.servicio
          .from('miembros')
          .upsert({ parroquia_id: inv.parroquia_id, usuario_id: usuarioId, rol: 'coordinador' }, { onConflict: 'parroquia_id,usuario_id', ignoreDuplicates: true });
        if (error) throw error;
      }
      await registrar(deps.servicio, {
        parroquia_id: inv.parroquia_id,
        usuario_id: usuarioId,
        accion: 'aceptar_invitacion',
        detalle: { correo: inv.correo, rol: inv.rol },
      });
      let parroquiaSlug: string | undefined;
      if (inv.parroquia_id) {
        const { data } = await deps.servicio.from('parroquias').select('slug').eq('id', inv.parroquia_id).maybeSingle();
        parroquiaSlug = data?.slug;
      }
      // La asignación ya quedó hecha y el token gastado: si solo falla entrar, no se devuelve el token ni se muestra un error.
      let aviso: string | undefined;
      if (!existente) {
        const { error } = await deps.sesion.auth.signInWithPassword({ email: inv.correo, password: clave });
        if (error) aviso = MENSAJE_ENTRAR_MANUAL;
      }
      return { parroquiaSlug, aviso };
    } catch (e) {
      // El token se devuelve para poder reintentar; si la cuenta ya se creó, el reintento pedirá entrar con ese correo.
      await devolver();
      return fallo('aceptarInvitacion', e);
    }
  } catch (e) {
    return fallo('aceptarInvitacion', e);
  }
}
