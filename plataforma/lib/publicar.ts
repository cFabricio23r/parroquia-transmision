// Publicar una versión y volver a una anterior. Sin dependencias de Next: recibe el cliente con la
// sesión de quien actúa (permisos por RLS) y el cliente de servicio (único que escribe en `publicado`
// y que puede llamar a `reservar_version`). Los envoltorios están en app/editor/api/[slug]/.
//
// Reglas que esto cumple (ver el plan de la etapa 2a):
//  - Primero se comprueba el permiso con la sesión; nada se hace con el cliente de servicio antes.
//  - Nunca se hace UPDATE de `borradores`: el disparador le cambiaría `actualizado_en` y el editor
//    abierto recibiría un 409 falso.
//  - `config.json` se sube al final, solo si las copias y el insert salieron bien. Si algo falla
//    después de reservar el número, ese número queda sin usar (los huecos se aceptan).
//  - Dos publicaciones a la vez: gana la última escritura de config.json (sin bloqueo).
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  comprobarAcceso,
  conError,
  fallo,
  TIPOS,
  type Acceso,
  type ConError,
  type Respuesta,
} from './borrador';
import { validarBorrador, validarConfig } from './validar';

export type EstadoHook = 'ok' | 'fallo' | 'sin-configurar';
export interface Publicado {
  numero: number;
  hook: EstadoHook;
}
type Errores = { errores: string[] };

export interface DepsPublicar {
  sesion: SupabaseClient; // la sesión de quien actúa
  servicio: SupabaseClient; // service_role
  /** `VERCEL_DEPLOY_HOOK_URL`. Es un secreto: nunca se escribe en el registro ni en la consola. */
  hookUrl?: string;
  ahora?: () => Date;
}

const MENSAJE_FALLO = 'No se pudo publicar. Intenta de nuevo; si sigue igual, avisa al administrador';
const MAX_INT4 = 2_147_483_647;

/**
 * Los nombres que deja la subida (`<campo>-<8 hex>.<ext>`, ver lib/borrador.ts y lib/imagenes.ts).
 * Las extensiones son las que produce `revisarImagen`: png, jpg, webp y svg.
 */
const RE_MEDIO = /^medios\/[a-z0-9-]+-[0-9a-f]{8}\.(png|jpg|webp|svg)$/;

const esMedio = (clave: string, v: unknown): v is string => clave === 'src' && typeof v === 'string' && v.startsWith('medios/');

/** Un error por cada `src: 'medios/…'` del borrador que no tiene el nombre de una imagen subida. */
export function erroresDeMedios(borrador: unknown): string[] {
  const errores = new Set<string>();
  const recorrer = (valor: unknown) => {
    if (Array.isArray(valor)) valor.forEach(recorrer);
    else if (valor !== null && typeof valor === 'object') {
      for (const [clave, v] of Object.entries(valor)) {
        if (esMedio(clave, v)) {
          if (!RE_MEDIO.test(v)) errores.add(`La imagen «${v}» no se puede publicar: vuelve a subirla desde el formulario.`);
        } else recorrer(v);
      }
    }
  };
  recorrer(borrador);
  return [...errores];
}

/**
 * Convierte el borrador en la configuración que se publica. Cada `src` `medios/x` pasa a
 * `medios/v<numero>-x`; `copias` dice qué copiar: `desde` es el archivo dentro de la carpeta de la
 * parroquia en `borradores` (`<id>/<desde>`) y `hacia` la ruta en `publicado`. Una imagen usada en dos
 * campos se copia una sola vez. Los `src` que no empiezan con `medios/` no se tocan. Supone que
 * `erroresDeMedios` ya dio vacío: un nombre inesperado es un error de programación y lanza.
 */
export function prepararPublicacion(
  borrador: object,
  slug: string,
  numero: number,
  ahora: Date,
): { config: object; copias: { desde: string; hacia: string }[] } {
  const copias = new Map<string, string>();
  const renombrar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(renombrar);
    if (valor === null || typeof valor !== 'object') return valor;
    const salida: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(valor)) {
      if (esMedio(clave, v)) {
        if (!RE_MEDIO.test(v)) throw new Error(`src inesperado: ${v}`);
        const archivo = v.slice('medios/'.length);
        copias.set(archivo, `${slug}/medios/v${numero}-${archivo}`);
        salida[clave] = `medios/v${numero}-${archivo}`;
      } else salida[clave] = renombrar(v);
    }
    return salida;
  };
  const limpio = renombrar(borrador) as Record<string, unknown>;
  return {
    config: { ...limpio, esquema: 1, version: numero, publicado: ahora.toISOString(), slug },
    copias: [...copias].map(([desde, hacia]) => ({ desde, hacia })),
  };
}

/** Avisa a Vercel que reconstruya. Un fallo no deshace la publicación. No registra la URL (es secreta). */
async function avisarHook(url: string | undefined): Promise<EstadoHook> {
  if (!url) return 'sin-configurar';
  try {
    const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(10_000) });
    void r.body?.cancel();
    if (r.ok) return 'ok';
    console.error(`[publicar] el aviso a Vercel respondió ${r.status}`);
  } catch (e) {
    // Solo el tipo de error: el mensaje de un fallo de red puede traer la dirección.
    console.error('[publicar] no se pudo avisar a Vercel:', e instanceof Error ? e.name : 'error');
  }
  return 'fallo';
}

async function registrar(
  servicio: SupabaseClient,
  fila: { parroquia_id: string; usuario_id: string; accion: string; detalle: Record<string, unknown> },
): Promise<void> {
  // La publicación ya está hecha: si el registro falla se avisa en la consola, no se responde error.
  const { error } = await servicio.from('registro').insert(fila);
  if (error) console.error('[publicar] no se pudo escribir en el registro:', error.message);
}

/**
 * Del número ya reservado a la publicación: copiar imágenes → insertar la versión → subir config.json
 * → registro → hook. Si algo falla antes del registro se deshace lo que este llamado dejó (copias y
 * fila de la versión) y config.json no se toca, o queda como estaba si ni se llegó a subir.
 */
async function emitir(
  deps: DepsPublicar,
  acceso: Extract<Acceso, { ok: true }>,
  slug: string,
  numero: number,
  config: object,
  copias: { desde: string; hacia: string }[],
  origen: number | null,
  accion: 'publicar' | 'restaurar',
  detalle: Record<string, unknown>,
): Promise<Respuesta<Publicado | ConError>> {
  const { servicio } = deps;
  const subidas: string[] = [];
  let versionInsertada = false;
  let subiendoConfig = false;
  try {
    for (const c of copias) {
      const { data: blob, error: errorBajar } = await servicio.storage.from('borradores').download(`${acceso.parroquiaId}/${c.desde}`);
      if (errorBajar || !blob) throw errorBajar ?? new Error(`no está ${c.desde} en borradores`);
      const extension = c.desde.slice(c.desde.lastIndexOf('.') + 1);
      // upsert false: si el destino existe, un número reservado se reusó y eso es un error, no algo que pisar.
      const { error: errorSubir } = await servicio.storage
        .from('publicado')
        .upload(c.hacia, Buffer.from(await blob.arrayBuffer()), { contentType: TIPOS[extension], upsert: false });
      if (errorSubir) throw errorSubir;
      subidas.push(c.hacia);
    }
    const { error: errorInsertar } = await servicio.from('versiones').insert({
      parroquia_id: acceso.parroquiaId,
      numero,
      config,
      publicada_por: acceso.usuarioId,
      origen_numero: origen,
    });
    if (errorInsertar) throw errorInsertar;
    versionInsertada = true;
    // Desde aquí un error es ambiguo (puede llegar después de que el objeto se escribió): no se limpia nada.
    subiendoConfig = true;
    const { error: errorConfig } = await servicio.storage
      .from('publicado')
      .upload(`${slug}/config.json`, Buffer.from(JSON.stringify(config, null, 2)), {
        contentType: 'application/json',
        upsert: true,
        cacheControl: '0',
      });
    if (errorConfig) throw errorConfig;
  } catch (e) {
    // Limpieza solo si falló antes de tocar config.json (una copia o el insert). Si falló la subida de
    // config.json se conservan copias y versión: puede haberse escrito igual y apuntar a esas imágenes;
    // lo huérfano no hace daño. Si la limpieza falla no hay más que hacer (el número ya es un hueco).
    if (!subiendoConfig) {
      if (subidas.length) {
        const { error } = await servicio.storage.from('publicado').remove(subidas);
        if (error) console.error('[publicar] no se pudieron quitar las copias:', error.message);
      }
      if (versionInsertada) {
        const { error } = await servicio.from('versiones').delete().eq('parroquia_id', acceso.parroquiaId).eq('numero', numero);
        if (error) console.error('[publicar] no se pudo quitar la versión:', error.message);
      }
    }
    const r = fallo(accion, e);
    return { estado: r.estado, cuerpo: { error: MENSAJE_FALLO } };
  }
  await registrar(servicio, { parroquia_id: acceso.parroquiaId, usuario_id: acceso.usuarioId, accion, detalle });
  return { estado: 200, cuerpo: { numero, hook: await avisarHook(deps.hookUrl) } };
}

async function reservar(servicio: SupabaseClient, parroquiaId: string): Promise<number> {
  const { data, error } = await servicio.rpc('reservar_version', { p: parroquiaId });
  if (error || typeof data !== 'number') throw error ?? new Error('reservar_version no devolvió un número');
  return data;
}

/** Publica el borrador guardado como la versión siguiente. Miembros de la parroquia y administradores. */
export async function publicar(deps: DepsPublicar, slug: string): Promise<Respuesta<Publicado | Errores | ConError>> {
  try {
    const acceso = await comprobarAcceso(deps.sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const { data: borrador, error: errorLectura } = await deps.sesion
      .from('borradores')
      .select('config')
      .eq('parroquia_id', acceso.parroquiaId)
      .maybeSingle();
    if (errorLectura) throw errorLectura;
    if (!borrador) return conError(404, 'Esta parroquia todavía no tiene borrador.');

    const errores = [...validarBorrador(borrador.config, slug).errores, ...erroresDeMedios(borrador.config)];
    if (errores.length) return { estado: 422, cuerpo: { errores } };

    const numero = await reservar(deps.servicio, acceso.parroquiaId);
    const { config, copias } = prepararPublicacion(borrador.config as object, slug, numero, (deps.ahora ?? (() => new Date()))());
    return await emitir(deps, acceso, slug, numero, config, copias, null, 'publicar', { numero });
  } catch (e) {
    return fallo('publicar', e);
  }
}

/**
 * Publica de nuevo una versión anterior como versión nueva: cambia solo `version` y `publicado`, no
 * copia imágenes (las `v<k>-` siguen en `publicado`) y no toca el borrador.
 */
export async function restaurar(
  deps: DepsPublicar,
  slug: string,
  numero: unknown,
): Promise<Respuesta<Publicado | Errores | ConError>> {
  try {
    const acceso = await comprobarAcceso(deps.sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 1 || numero > MAX_INT4) {
      return conError(400, 'La versión que pides no es válida.');
    }
    const { data: version, error: errorLectura } = await deps.sesion
      .from('versiones')
      .select('config')
      .eq('parroquia_id', acceso.parroquiaId)
      .eq('numero', numero)
      .maybeSingle();
    if (errorLectura) throw errorLectura;
    if (!version) return conError(404, `La versión ${numero} no existe.`);

    const errores = validarConfig(version.config, slug).errores;
    if (errores.length) return { estado: 422, cuerpo: { errores } };

    const nuevo = await reservar(deps.servicio, acceso.parroquiaId);
    const ahora = (deps.ahora ?? (() => new Date()))();
    const config = { ...(version.config as object), version: nuevo, publicado: ahora.toISOString() };
    return await emitir(deps, acceso, slug, nuevo, config, [], numero, 'restaurar', { numero, nuevo });
  } catch (e) {
    return fallo('restaurar', e);
  }
}
