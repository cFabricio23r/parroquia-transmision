// La tarea 'semana' del sincronizador (plan 3b, Tarea 12): primero sube los cambios hechos en la
// app (uno por uno), después baja dos semanas y los tipos publicados. Nada corre en vivo: el
// sincronizador salta la tarea, y entre la subida y la bajada se vuelve a mirar.
import { validarConfigBajada } from '../copias/copias';
import { urlDePagina } from '../plataforma/direcciones';
import type { Limpiezas, Sincronizador, TareaSincronizar, ContextoSincronizar } from '../sincronizar/sincronizar';
import { leerJson, pedirConPlazo, PLAZO_POR_DEFECTO_MS, type Resultado } from '../supabase/cliente';
import type { AlmacenSemana, CacheSemana, Pendiente } from './almacen';
import { SEMANA } from './nucleo';
import { combinarConPendientes } from './pendientes';

export interface DepsSemana {
  /** El origen normalizado de la plataforma. */
  origen: string;
  fetch: typeof fetch;
  almacen: AlmacenSemana;
  ahora?: () => Date;
  plazoMs?: number;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** La fecha local del aparato, 'AAAA-MM-DD'. */
export function fechaLocal(d: Date): string {
  return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
}

function filaDe(parroquiaId: string, p: Pendiente): Record<string, unknown> {
  const fila: Record<string, unknown> = {
    parroquia_id: parroquiaId,
    clave: p.clave,
    fecha: p.fecha,
    hora: p.hora,
    tipo: p.tipo,
    origen: p.origen,
  };
  if (p.origen === 'fija') fila.fija_id = p.fijaId;
  if (p.origen === 'serie') fila.serie_id = p.serieId;
  if (p.origen === 'unica') fila.id = p.clave.slice('unica:'.length);
  fila.datos = SEMANA.limpiarDatos(p.datos);
  fila.editada = true;
  fila.saltada = false;
  fila.actualizado_desde = 'app';
  fila.actualizado_en = p.editadoEn;
  return fila;
}

async function subir(c: ContextoSincronizar, d: DepsSemana): Promise<void> {
  const slug = c.parroquia.slug;
  const pendientes = (await d.almacen.leerPendientes(slug)).filter((p) => !p.rechazado);
  for (const p of pendientes) {
    if (c.enVivo() || !c.sigueElegida()) return;
    const r = await c.sesion.conSesion((s) =>
      c.cliente.upsert<unknown>(s, 'transmisiones', [filaDe(c.parroquia.id, p)], 'parroquia_id,clave'),
    );
    if (r.ok) {
      await d.almacen.quitarPendiente(slug, p.clave);
      continue;
    }
    if (r.error.tipo === 'servidor' && r.error.estado >= 400 && r.error.estado < 500) {
      // La base lo rechaza siempre (un check): no se reintenta, y se sigue con el próximo.
      await d.almacen.marcarRechazado(slug, p.clave);
      continue;
    }
    // sin-conexion, permiso, sesion-invalida u otro: se corta y queda todo.
    console.warn('semana: subida cortada');
    return;
  }
}

function filas<T>(r: Resultado<T[]>): T[] {
  if (!r.ok) throw new Error('semana: bajada ' + r.error.tipo);
  return r.valor;
}

async function bajarTipos(d: DepsSemana, slug: string, anterior: unknown): Promise<unknown> {
  const r = await pedirConPlazo(
    d.fetch,
    urlDePagina(d.origen, slug, 'config.json'),
    { method: 'GET', cache: 'no-store' },
    d.plazoMs ?? PLAZO_POR_DEFECTO_MS,
  );
  if (r === null || r.estado !== 200 || !validarConfigBajada(r.texto, slug).ok) return anterior;
  const c = leerJson(r.texto) as Record<string, unknown>;
  return c.tipos ?? null;
}

async function bajar(c: ContextoSincronizar, d: DepsSemana): Promise<void> {
  const slug = c.parroquia.slug;
  const id = c.parroquia.id;
  const ahora = (d.ahora ?? (() => new Date()))();
  const desde = SEMANA.lunesDe(fechaLocal(ahora));
  const hasta = SEMANA.sumarDias(desde, 13);
  const desdeSeries = SEMANA.sumarDias(desde, -59);

  const fijas = filas(await c.sesion.conSesion((s) =>
    c.cliente.seleccionar<unknown>(s, 'transmisiones_fijas', {
      select: 'id,dia_semana,hora,tipo,datos,activa',
      parroquia_id: 'eq.' + id,
      activa: 'eq.true',
    })));
  const series = filas(await c.sesion.conSesion((s) =>
    c.cliente.seleccionar<unknown>(s, 'series', {
      select: 'id,nombre,tipo,inicio,dias,hora,datos',
      parroquia_id: 'eq.' + id,
      and: `(inicio.gte.${desdeSeries},inicio.lte.${hasta})`,
    })));
  const transmisiones = filas(await c.sesion.conSesion((s) =>
    c.cliente.seleccionar<unknown>(s, 'transmisiones', {
      select: 'id,clave,fecha,hora,tipo,datos,origen,fija_id,serie_id,saltada,editada,actualizado_en,actualizado_desde',
      parroquia_id: 'eq.' + id,
      and: `(fecha.gte.${desde},fecha.lte.${hasta})`,
      order: 'fecha.asc,hora.asc',
    })));

  const anterior = await d.almacen.leerCache(slug);
  const tipos = await bajarTipos(d, slug, anterior ? anterior.tipos : null);
  if (c.enVivo() || !c.sigueElegida()) return;

  const cache: CacheSemana = {
    version: 1,
    parroquiaId: id,
    desde,
    hasta,
    bajadaEn: new Date().toISOString(),
    fijas,
    series,
    transmisiones,
    tipos,
  };
  await d.almacen.guardarCache(slug, cache);

  // Los pendientes que la web ganó (guardó después) se descartan.
  const items = [desde, SEMANA.sumarDias(desde, 7)].flatMap((lunes) =>
    SEMANA.armarSemana({ lunes, fijas, series, transmisiones }),
  );
  const { perdidos } = combinarConPendientes(items, await d.almacen.leerPendientes(slug));
  for (const clave of perdidos) await d.almacen.quitarPendiente(slug, clave);
}

export function crearTareaSemana(d: DepsSemana): TareaSincronizar {
  return async (c) => {
    if (c.enVivo()) return;
    await subir(c, d);
    if (c.enVivo() || !c.sigueElegida()) return;
    await bajar(c, d);
  };
}

export function registrarSemana(s: Sincronizador, l: Limpiezas, d: DepsSemana): void {
  s.registrarTarea('semana', ['abrir', 'antes-de-iniciar', 'al-terminar'], crearTareaSemana(d));
  l.registrar('semana', (a) => (a.tipo === 'parroquia' ? d.almacen.borrar(a.parroquia.slug) : d.almacen.borrarTodo()));
}
