/**
 * @jest-environment node
 */
// La tarea 'semana' (Tarea 12 del plan 3b): Decisión 10 y Review Focus 4.
import type { ContextoSincronizar, Momento } from '../sincronizar/sincronizar';
import type { ErrorSupabase, Resultado } from '../supabase/cliente';
import { crearAlmacenSemana, type CacheSemana, type NativoDatos, type Pendiente } from './almacen';
import { crearTareaSemana, registrarSemana } from './sincronizar';

const PARROQUIA = { id: 'p1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const ORIGEN = 'https://p.app';
const AHORA = new Date(2026, 10, 19, 10, 0);

function almacenEnMemoria() {
  const archivos = new Map<string, string>();
  const nativo: NativoDatos = {
    leerDatosApp: async (n) => archivos.get(n) ?? null,
    guardarDatosApp: async (n, t) => {
      archivos.set(n, t);
    },
    borrarDatosApp: async (p) => {
      for (const k of [...archivos.keys()]) if (p.endsWith('-') ? k.startsWith(p) : k === p) archivos.delete(k);
    },
  };
  return crearAlmacenSemana(nativo);
}

function pendiente(clave: string, extra: Partial<Pendiente> = {}): Pendiente {
  return {
    clave, fecha: '2026-11-19', hora: '18:00', tipo: 'dominical', origen: 'fija', fijaId: 'f1', serieId: null,
    datos: { celebrante: 'P. Ana' }, editadoEn: '2026-11-19T16:00:00.000Z', rechazado: false, ...extra,
  };
}

type Llamada = { op: string; tabla: string; arg: unknown; conflicto?: string };

function clienteFalso(o: {
  upsert?: (i: number) => Resultado<unknown[]>;
  seleccionar?: (tabla: string) => Resultado<unknown[]>;
} = {}) {
  const llamadas: Llamada[] = [];
  let n = 0;
  const cliente = {
    entrar: jest.fn(),
    renovar: jest.fn(),
    seleccionar: jest.fn(async (_s: unknown, tabla: string, consulta: Record<string, string>) => {
      llamadas.push({ op: 'seleccionar', tabla, arg: consulta });
      return o.seleccionar ? o.seleccionar(tabla) : { ok: true as const, valor: [] };
    }),
    upsert: jest.fn(async (_s: unknown, tabla: string, filas: readonly object[], conflicto: string) => {
      llamadas.push({ op: 'upsert', tabla, arg: filas, conflicto });
      return o.upsert ? o.upsert(n++) : { ok: true as const, valor: [] };
    }),
  };
  return { cliente, llamadas };
}

const error = (e: ErrorSupabase): Resultado<unknown[]> => ({ ok: false, error: e });

const CONFIG = JSON.stringify({ esquema: 1, slug: 'ciudad-arce', version: 3, tipos: { comunes: { dominical: true } } });

function fetchFalso(texto = CONFIG, estado = 200) {
  return jest.fn(async (_url: string, _init?: RequestInit) => ({
    status: estado,
    ok: estado === 200,
    text: async () => texto,
  })) as unknown as jest.Mock & typeof fetch;
}

function contexto(cliente: unknown, enVivo: () => boolean = () => false): ContextoSincronizar {
  return {
    momento: 'abrir',
    parroquia: PARROQUIA,
    sesion: {
      conSesion: (fn: (s: unknown) => Promise<unknown>) => fn({ accessToken: 'TOKEN-ACCESO-FALSO-1111' }),
    } as unknown as ContextoSincronizar['sesion'],
    cliente: cliente as ContextoSincronizar['cliente'],
    enVivo,
    sigueElegida: () => true,
  };
}

describe('la subida de pendientes', () => {
  it('sube uno por uno con la fila exacta y los quita', async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
    await almacen.guardarPendiente('ciudad-arce', pendiente('serie:s1:2026-11-20', {
      origen: 'serie', fijaId: null, serieId: 's1', fecha: '2026-11-20', datos: { dia: 2 },
    }));
    const { cliente, llamadas } = clienteFalso();
    await crearTareaSemana({ origen: ORIGEN, fetch: fetchFalso(), almacen, ahora: () => AHORA })(contexto(cliente));
    const subidas = llamadas.filter((l) => l.op === 'upsert');
    expect(subidas).toHaveLength(2);
    expect(subidas[0]).toMatchObject({ tabla: 'transmisiones', conflicto: 'parroquia_id,clave' });
    expect(subidas[0].arg).toEqual([{
      parroquia_id: 'p1', clave: 'fija:f1:2026-11-19', fecha: '2026-11-19', hora: '18:00', tipo: 'dominical',
      origen: 'fija', fija_id: 'f1', datos: { celebrante: 'P. Ana' }, editada: true, saltada: false,
      actualizado_desde: 'app', actualizado_en: '2026-11-19T16:00:00.000Z',
    }]);
    expect((subidas[1].arg as object[])[0]).toMatchObject({ origen: 'serie', serie_id: 's1' });
    expect((subidas[1].arg as object[])[0]).not.toHaveProperty('fija_id');
    await expect(almacen.leerPendientes('ciudad-arce')).resolves.toEqual([]);
  });

  it('un 400 queda rechazado, el siguiente se sube igual y no se reintenta', async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-26', { fecha: '2026-11-26' }));
    const { cliente, llamadas } = clienteFalso({
      upsert: (i) => (i === 0 ? error({ tipo: 'servidor', estado: 400 }) : { ok: true, valor: [] }),
    });
    const tarea = crearTareaSemana({ origen: ORIGEN, fetch: fetchFalso(), almacen, ahora: () => AHORA });
    await tarea(contexto(cliente));
    expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(2);
    const quedan = await almacen.leerPendientes('ciudad-arce');
    expect(quedan).toHaveLength(1);
    expect(quedan[0]).toMatchObject({ clave: 'fija:f1:2026-11-19', rechazado: true });
    await tarea(contexto(cliente));
    expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(2);
  });

  it.each([['sin-conexion'], ['permiso']] as const)('con %s corta y deja todo sin marcar', async (tipo) => {
    const almacen = almacenEnMemoria();
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-26', { fecha: '2026-11-26' }));
    const { cliente, llamadas } = clienteFalso({ upsert: () => error({ tipo }) });
    await crearTareaSemana({ origen: ORIGEN, fetch: fetchFalso(), almacen, ahora: () => AHORA })(contexto(cliente))
      .catch(() => undefined);
    expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(1);
    const quedan = await almacen.leerPendientes('ciudad-arce');
    expect(quedan).toHaveLength(2);
    expect(quedan.every((p) => !p.rechazado)).toBe(true);
  });
});

describe('la bajada', () => {
  it('pide las fijas, las series, los días y el config, y guarda la cache', async () => {
    const almacen = almacenEnMemoria();
    const { cliente, llamadas } = clienteFalso();
    const f = fetchFalso();
    await crearTareaSemana({ origen: ORIGEN, fetch: f, almacen, ahora: () => AHORA })(contexto(cliente));
    const sel = llamadas.filter((l) => l.op === 'seleccionar');
    expect(sel.map((l) => l.tabla)).toEqual(['transmisiones_fijas', 'series', 'transmisiones']);
    expect(sel[0].arg).toEqual({ select: 'id,dia_semana,hora,tipo,datos,activa', parroquia_id: 'eq.p1', activa: 'eq.true' });
    expect(sel[1].arg).toEqual({
      select: 'id,nombre,tipo,inicio,dias,hora,datos',
      parroquia_id: 'eq.p1',
      and: '(inicio.gte.2026-09-18,inicio.lte.2026-11-29)',
    });
    expect(sel[2].arg).toEqual({
      select: 'id,clave,fecha,hora,tipo,datos,origen,fija_id,serie_id,saltada,editada,actualizado_en,actualizado_desde',
      parroquia_id: 'eq.p1',
      and: '(fecha.gte.2026-11-16,fecha.lte.2026-11-29)',
      order: 'fecha.asc,hora.asc',
    });
    expect(f).toHaveBeenCalledWith('https://p.app/ciudad-arce/config.json', expect.objectContaining({ cache: 'no-store' }));
    const c = (await almacen.leerCache('ciudad-arce')) as CacheSemana;
    expect(c).toMatchObject({
      version: 1, parroquiaId: 'p1', desde: '2026-11-16', hasta: '2026-11-29', tipos: { comunes: { dominical: true } },
    });
    expect(typeof c.bajadaEn).toBe('string');
  });

  it('con un config roto o de otro slug guarda los tipos de la cache anterior', async () => {
    for (const malo of ['{roto', JSON.stringify({ esquema: 1, slug: 'otra', version: 1, tipos: {} })]) {
      const almacen = almacenEnMemoria();
      await almacen.guardarCache('ciudad-arce', {
        version: 1, parroquiaId: 'p1', desde: '2026-11-09', hasta: '2026-11-22', bajadaEn: 'x',
        fijas: [], series: [], transmisiones: [], tipos: { propios: [] },
      });
      const { cliente } = clienteFalso();
      await crearTareaSemana({ origen: ORIGEN, fetch: fetchFalso(malo), almacen, ahora: () => AHORA })(contexto(cliente));
      const c = (await almacen.leerCache('ciudad-arce')) as CacheSemana;
      expect(c.desde).toBe('2026-11-16');
      expect(c.tipos).toEqual({ propios: [] });
    }
  });

  it('sin conexión deja la cache anterior y lanza', async () => {
    const almacen = almacenEnMemoria();
    const vieja: CacheSemana = {
      version: 1, parroquiaId: 'p1', desde: '2026-11-09', hasta: '2026-11-22', bajadaEn: 'x',
      fijas: [], series: [], transmisiones: [], tipos: null,
    };
    await almacen.guardarCache('ciudad-arce', vieja);
    const { cliente } = clienteFalso({ seleccionar: () => error({ tipo: 'sin-conexion' }) });
    await expect(
      crearTareaSemana({ origen: ORIGEN, fetch: fetchFalso(), almacen, ahora: () => AHORA })(contexto(cliente)),
    ).rejects.toThrow();
    await expect(almacen.leerCache('ciudad-arce')).resolves.toEqual(vieja);
  });

  it('si sale al aire entre la subida y la bajada, no baja nada', async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
    let vivo = false;
    const { cliente, llamadas } = clienteFalso({
      upsert: () => {
        vivo = true;
        return { ok: true, valor: [] };
      },
    });
    const f = fetchFalso();
    await crearTareaSemana({ origen: ORIGEN, fetch: f, almacen, ahora: () => AHORA })(contexto(cliente, () => vivo));
    expect(llamadas.filter((l) => l.op === 'seleccionar')).toHaveLength(0);
    expect(f).not.toHaveBeenCalled();
  });

  it('quita los pendientes que la web ganó', async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardarPendiente('ciudad-arce', pendiente('fija:f1:2026-11-19'));
    const { cliente } = clienteFalso({
      upsert: () => error({ tipo: 'sin-conexion' }),
      seleccionar: (tabla) => {
        if (tabla === 'transmisiones_fijas') {
          return { ok: true, valor: [{ id: 'f1', dia_semana: 4, hora: '18:00', tipo: 'dominical', datos: {}, activa: true }] };
        }
        if (tabla === 'transmisiones') {
          return {
            ok: true,
            valor: [{
              id: 't1', clave: 'fija:f1:2026-11-19', fecha: '2026-11-19', hora: '18:00', tipo: 'dominical',
              datos: { celebrante: 'P. Web' }, origen: 'fija', fija_id: 'f1', serie_id: null, saltada: false,
              editada: true, actualizado_en: '2026-11-19T17:00:00.000Z', actualizado_desde: 'web',
            }],
          };
        }
        return { ok: true, valor: [] };
      },
    });
    await crearTareaSemana({ origen: ORIGEN, fetch: fetchFalso(), almacen, ahora: () => AHORA })(contexto(cliente));
    await expect(almacen.leerPendientes('ciudad-arce')).resolves.toEqual([]);
  });
});

test('registrarSemana: la tarea y la limpieza', async () => {
  const almacen = { borrar: jest.fn(async () => undefined), borrarTodo: jest.fn(async () => undefined) };
  const tareas: Array<{ nombre: string; momentos: readonly Momento[] }> = [];
  const limpiezas: Array<{ nombre: string; fn: (a: unknown) => Promise<void> }> = [];
  registrarSemana(
    {
      registrarTarea: (nombre, momentos) => {
        tareas.push({ nombre, momentos });
        return () => undefined;
      },
      sincronizar: jest.fn(),
    },
    {
      registrar: (nombre, fn) => {
        limpiezas.push({ nombre, fn: fn as (a: unknown) => Promise<void> });
        return () => undefined;
      },
      limpiar: jest.fn(),
    },
    { origen: ORIGEN, fetch: fetchFalso(), almacen: almacen as never },
  );
  expect(tareas).toEqual([{ nombre: 'semana', momentos: ['abrir', 'antes-de-iniciar', 'al-terminar'] }]);
  expect(limpiezas[0].nombre).toBe('semana');
  await limpiezas[0].fn({ tipo: 'parroquia', parroquia: PARROQUIA });
  expect(almacen.borrar).toHaveBeenCalledWith('ciudad-arce');
  await limpiezas[0].fn({ tipo: 'todo' });
  expect(almacen.borrarTodo).toHaveBeenCalled();
});
