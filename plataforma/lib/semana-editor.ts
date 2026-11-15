// Leer y escribir las transmisiones de la semana desde el editor (etapa 3b). Sin dependencias de
// Next: recibe el cliente con la sesión de quien actúa, así se prueba contra el Supabase local.
// Quién puede qué lo decide la base (RLS). El registro lo escribe el disparador semana_registrar().
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { comprobarAcceso, conError, fallo, MENSAJE_FORMA, type ConError, type Respuesta } from './borrador';
import { RE_UUID } from './admin';
import { SEMANA, type FilaFija, type FilaSerie, type FilaTransmision, type Origen } from './semana';

export const MENSAJE_NO_EXISTE_TRANSMISION = 'Esa transmisión ya no existe.';

type Datos = Record<string, unknown>;
type Dia = { clave: string; origen: Origen; fija_id: string | null; serie_id: string | null; fecha: string | null; id: string | null };

export type OperacionSemana =
  | { op: 'crear-fija'; dia_semana: number; hora: string; tipo: string; datos: Datos }
  | { op: 'cambiar-fija'; id: string; dia_semana: number; hora: string; tipo: string; datos: Datos; activa: boolean }
  | { op: 'borrar-fija'; id: string }
  | { op: 'crear-serie'; nombre: string; tipo: string; inicio: string; dias: number; hora: string; datos: Datos }
  | { op: 'cambiar-serie'; id: string; nombre: string; tipo: string; inicio: string; dias: number; hora: string; datos: Datos }
  | { op: 'borrar-serie'; id: string }
  | { op: 'crear-unica'; fecha: string; hora: string; tipo: string; datos: Datos }
  | { op: 'borrar-unica'; id: string }
  | ({ op: 'editar-dia'; hora: string; tipo: string; datos: Datos } & Dia)
  | ({ op: 'saltar-dia'; hora: string; tipo: string; datos: Datos } & Dia)
  | ({ op: 'restaurar-dia' } & Dia);

export interface DatosSemana {
  fijas: FilaFija[];
  series: FilaSerie[];
  transmisiones: FilaTransmision[];
}

const RE_HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const RE_TIPO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_CLAVE = /^(fija|serie):([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i;
const RE_UNICA = /^unica:([0-9a-f-]{36})$/i;

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const esEntero = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const esHora = (v: unknown): v is string => typeof v === 'string' && RE_HORA.test(v);
const esTipo = (v: unknown): v is string => typeof v === 'string' && v.length >= 2 && v.length <= 40 && RE_TIPO.test(v);
const esId = (v: unknown): v is string => typeof v === 'string' && RE_UUID.test(v);

function leerDia(clave: unknown): Dia | null {
  if (typeof clave !== 'string') return null;
  const u = RE_UNICA.exec(clave);
  if (u) return RE_UUID.test(u[1]) ? { clave, origen: 'unica', fija_id: null, serie_id: null, fecha: null, id: u[1] } : null;
  const m = RE_CLAVE.exec(clave);
  if (!m || !RE_UUID.test(m[2]) || !SEMANA.esFecha(m[3])) return null;
  const origen = m[1] as 'fija' | 'serie';
  return { clave, origen, fija_id: origen === 'fija' ? m[2] : null, serie_id: origen === 'serie' ? m[2] : null, fecha: m[3], id: null };
}

/** Lee y revisa una operación del editor. Los `datos` salen limpios (SEMANA.limpiarDatos). */
export function leerOperacion(cuerpo: unknown): OperacionSemana | { error: string } {
  const malo = { error: MENSAJE_FORMA };
  if (!esObjeto(cuerpo)) return malo;
  const c = cuerpo;
  const datos = SEMANA.limpiarDatos(c.datos);
  const nombre = typeof c.nombre === 'string' ? c.nombre.trim() : '';
  const base = () => esHora(c.hora) && esTipo(c.tipo);
  const fija = () => base() && esEntero(c.dia_semana, 1, 7);
  const serie = () => base() && nombre.length >= 1 && nombre.length <= 80 && SEMANA.esFecha(c.inicio) && esEntero(c.dias, 1, 60);
  switch (c.op) {
    case 'crear-fija':
      return fija() ? { op: c.op, dia_semana: c.dia_semana as number, hora: c.hora as string, tipo: c.tipo as string, datos } : malo;
    case 'cambiar-fija':
      return fija() && esId(c.id) && typeof c.activa === 'boolean'
        ? { op: c.op, id: c.id, dia_semana: c.dia_semana as number, hora: c.hora as string, tipo: c.tipo as string, datos, activa: c.activa }
        : malo;
    case 'crear-serie':
      return serie()
        ? { op: c.op, nombre, tipo: c.tipo as string, inicio: c.inicio as string, dias: c.dias as number, hora: c.hora as string, datos }
        : malo;
    case 'cambiar-serie':
      return serie() && esId(c.id)
        ? { op: c.op, id: c.id, nombre, tipo: c.tipo as string, inicio: c.inicio as string, dias: c.dias as number, hora: c.hora as string, datos }
        : malo;
    case 'crear-unica':
      return base() && SEMANA.esFecha(c.fecha) ? { op: c.op, fecha: c.fecha as string, hora: c.hora as string, tipo: c.tipo as string, datos } : malo;
    case 'borrar-fija':
    case 'borrar-serie':
    case 'borrar-unica':
      return esId(c.id) ? { op: c.op, id: c.id } : malo;
    case 'editar-dia':
    case 'saltar-dia': {
      const dia = leerDia(c.clave);
      if (!dia || !base() || (c.op === 'saltar-dia' && dia.origen === 'unica')) return malo;
      return { op: c.op, ...dia, hora: c.hora as string, tipo: c.tipo as string, datos };
    }
    case 'restaurar-dia': {
      const dia = leerDia(c.clave);
      return dia && dia.origen !== 'unica' ? { op: c.op, ...dia } : malo;
    }
    default:
      return malo;
  }
}

const COLUMNAS_FIJA = 'id, dia_semana, hora, tipo, datos, activa';
const COLUMNAS_SERIE = 'id, nombre, tipo, inicio, dias, hora, datos';
const COLUMNAS_TRANSMISION =
  'id, clave, fecha, hora, tipo, datos, origen, fija_id, serie_id, saltada, editada, actualizado_en, actualizado_desde';

/** Las fijas y las series de la parroquia, y los días guardados de la semana que empieza en `lunes`. */
export async function leerSemana(
  sesion: SupabaseClient,
  slug: string,
  lunes: unknown,
): Promise<Respuesta<DatosSemana | ConError>> {
  try {
    const acceso = await comprobarAcceso(sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    if (!SEMANA.esFecha(lunes) || SEMANA.lunesDe(lunes as string) !== lunes) return conError(400, MENSAJE_FORMA);
    const id = acceso.parroquiaId;
    const [f, s, t] = await Promise.all([
      sesion.from('transmisiones_fijas').select(COLUMNAS_FIJA).eq('parroquia_id', id).order('creada_en'),
      sesion.from('series').select(COLUMNAS_SERIE).eq('parroquia_id', id).order('creada_en'),
      sesion
        .from('transmisiones')
        .select(COLUMNAS_TRANSMISION)
        .eq('parroquia_id', id)
        .gte('fecha', lunes as string)
        .lte('fecha', SEMANA.sumarDias(lunes as string, 6)),
    ]);
    for (const r of [f, s, t]) if (r.error) throw r.error;
    return {
      estado: 200,
      cuerpo: {
        fijas: (f.data ?? []) as unknown as FilaFija[],
        series: (s.data ?? []) as unknown as FilaSerie[],
        transmisiones: (t.data ?? []) as unknown as FilaTransmision[],
      },
    };
  } catch (e) {
    return fallo('semana', e);
  }
}

type ErrorBase = { code?: string } | null;
class NoExiste extends Error {}

/** Lanza si la base rechazó; un error de forma (check, disparador) es un 400, una FK rota un 404. */
function revisar(error: ErrorBase) {
  if (!error) return;
  if (error.code === '23503') throw new NoExiste();
  throw error;
}
function alMenosUna(filas: unknown[] | null) {
  if (!filas || filas.length === 0) throw new NoExiste();
}

/** Aplica una operación ya leída con `leerOperacion`, con la sesión de quien actúa. */
export async function aplicarOperacion(
  sesion: SupabaseClient,
  slug: string,
  op: OperacionSemana,
): Promise<Respuesta<{ ok: true } | ConError>> {
  try {
    const acceso = await comprobarAcceso(sesion, slug);
    if (!acceso.ok) return acceso.respuesta;
    const parroquia_id = acceso.parroquiaId;
    const ahora = new Date().toISOString();
    const deTabla = (tabla: string) => sesion.from(tabla);

    switch (op.op) {
      case 'crear-fija': {
        const { error } = await deTabla('transmisiones_fijas').insert({
          parroquia_id, dia_semana: op.dia_semana, hora: op.hora, tipo: op.tipo, datos: op.datos,
        });
        revisar(error);
        break;
      }
      case 'cambiar-fija': {
        const { data, error } = await deTabla('transmisiones_fijas')
          .update({ dia_semana: op.dia_semana, hora: op.hora, tipo: op.tipo, datos: op.datos, activa: op.activa, actualizado_en: ahora })
          .eq('parroquia_id', parroquia_id).eq('id', op.id).select('id');
        revisar(error);
        alMenosUna(data);
        break;
      }
      case 'crear-serie': {
        const { error } = await deTabla('series').insert({
          parroquia_id, nombre: op.nombre, tipo: op.tipo, inicio: op.inicio, dias: op.dias, hora: op.hora, datos: op.datos,
        });
        revisar(error);
        break;
      }
      case 'cambiar-serie': {
        const { data, error } = await deTabla('series')
          .update({ nombre: op.nombre, tipo: op.tipo, inicio: op.inicio, dias: op.dias, hora: op.hora, datos: op.datos, actualizado_en: ahora })
          .eq('parroquia_id', parroquia_id).eq('id', op.id).select('id');
        revisar(error);
        alMenosUna(data);
        break;
      }
      case 'borrar-fija':
      case 'borrar-serie': {
        const tabla = op.op === 'borrar-fija' ? 'transmisiones_fijas' : 'series';
        const { data, error } = await deTabla(tabla).delete().eq('parroquia_id', parroquia_id).eq('id', op.id).select('id');
        revisar(error);
        alMenosUna(data);
        break;
      }
      case 'crear-unica': {
        const id = randomUUID();
        const { error } = await deTabla('transmisiones').insert({
          id, parroquia_id, clave: SEMANA.claveUnica(id), fecha: op.fecha, hora: op.hora, tipo: op.tipo, datos: op.datos,
          origen: 'unica', actualizado_desde: 'web',
        });
        revisar(error);
        break;
      }
      case 'borrar-unica': {
        const { data, error } = await deTabla('transmisiones')
          .delete().eq('parroquia_id', parroquia_id).eq('id', op.id).eq('origen', 'unica').select('id');
        revisar(error);
        alMenosUna(data);
        break;
      }
      case 'editar-dia': {
        const cambios = { hora: op.hora, tipo: op.tipo, datos: op.datos, editada: true, actualizado_desde: 'web' };
        if (op.origen === 'unica') {
          const { data, error } = await deTabla('transmisiones').update(cambios).eq('parroquia_id', parroquia_id).eq('clave', op.clave).select('id');
          revisar(error);
          alMenosUna(data);
        } else {
          const { error } = await deTabla('transmisiones').upsert(
            { parroquia_id, clave: op.clave, fecha: op.fecha, origen: op.origen, fija_id: op.fija_id, serie_id: op.serie_id, ...cambios },
            { onConflict: 'parroquia_id,clave' },
          );
          revisar(error);
        }
        break;
      }
      case 'saltar-dia': {
        // Un upsert pisaría lo editado: primero se marca la fila que haya y, si no hay, se crea.
        const { data, error } = await deTabla('transmisiones')
          .update({ saltada: true, actualizado_desde: 'web' })
          .eq('parroquia_id', parroquia_id).eq('clave', op.clave).select('id');
        revisar(error);
        if (!data || data.length === 0) {
          const r = await deTabla('transmisiones').insert({
            parroquia_id, clave: op.clave, fecha: op.fecha, origen: op.origen, fija_id: op.fija_id, serie_id: op.serie_id,
            hora: op.hora, tipo: op.tipo, datos: op.datos, saltada: true, editada: false, actualizado_desde: 'web',
          });
          revisar(r.error);
        }
        break;
      }
      case 'restaurar-dia': {
        const { data, error } = await deTabla('transmisiones')
          .select('id, editada').eq('parroquia_id', parroquia_id).eq('clave', op.clave).maybeSingle();
        revisar(error);
        if (!data) throw new NoExiste();
        const r = data.editada
          ? await deTabla('transmisiones').update({ saltada: false, actualizado_desde: 'web' }).eq('id', data.id).eq('parroquia_id', parroquia_id)
          : await deTabla('transmisiones').delete().eq('id', data.id).eq('parroquia_id', parroquia_id);
        revisar(r.error);
        break;
      }
    }
    return { estado: 200, cuerpo: { ok: true } };
  } catch (e) {
    if (e instanceof NoExiste) return conError(404, MENSAJE_NO_EXISTE_TRANSMISION);
    const code = (e as { code?: string })?.code;
    if (code === '23514' || code === 'P0001' || code === '22P02' || code === '22007' || code === '22008') return conError(400, MENSAJE_FORMA);
    return fallo('semana', e);
  }
}
