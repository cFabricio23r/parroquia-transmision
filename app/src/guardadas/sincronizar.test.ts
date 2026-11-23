/**
 * @jest-environment node
 */
// La tarea 'guardadas' de la app (Tarea 6): sube lo que el panel dejó pendiente, baja la lista de la
// nube y se la devuelve al panel. Mismas reglas que vicaria/guardadas-sync.js.
import type { ContextoSincronizar } from '../sincronizar/sincronizar';
import { crearLimpiezas, crearSincronizador } from '../sincronizar/sincronizar';
import type { ErrorSupabase, Resultado, SesionSupabase } from '../supabase/cliente';
import { GUARDADAS, type FilaGuardada, type Guardada, type PendienteGuardada } from './nucleo';
import { crearCanalGuardadas, type CanalGuardadas } from './puente';
import { crearTareaGuardadas, registrarGuardadas } from './sincronizar';

const SLUG = 'ciudad-arce';
const CL = 'pev_ciudad-arce_guardadas_v1';
const CP = 'pev_ciudad-arce_guardadas_pendientes_v1';
const PARROQUIA = { id: 'p1', slug: SLUG, nombre: 'Ciudad Arce' };
const AHORA = Date.UTC(2026, 10, 23, 12, 0);
const SESION: SesionSupabase = { accessToken: 'T', refreshToken: 'R', expiraEn: 2_000_000_000, usuarioId: 'u', correo: 'a@x' };

function guardada(id: string, nombre: string, actualizadoEn: number): Guardada {
  return { id, nombre, tipo: 'dominical', guardadaEn: actualizadoEn, usadaEn: actualizadoEn, actualizadoEn, datos: { celebrante: id } };
}
const fila = (g: Guardada, extra: Partial<FilaGuardada> = {}): FilaGuardada => ({ ...GUARDADAS.aFila(g, 'panel', 'p1'), ...extra });
const error = <T,>(e: ErrorSupabase): Resultado<T> => ({ ok: false, error: e });

type Llamada = { op: 'seleccionar' | 'upsert' | 'rpc'; tabla: string; arg: unknown; conflicto?: string };

/** Un panel falso: su localStorage, que la app ve por el canal y escribe con los scripts. */
function panelFalso(canal: CanalGuardadas, inicial: { lista: Guardada[]; pendientes: PendienteGuardada[] }) {
  const almacen: Record<string, string> = { [CL]: JSON.stringify(inicial.lista), [CP]: JSON.stringify(inicial.pendientes) };
  const scripts: string[] = [];
  canal.conectar(SLUG, (s) => scripts.push(s));
  const avisar = () =>
    canal.recibir(SLUG, { tipo: 'guardadas', lista: JSON.parse(almacen[CL]), pendientes: JSON.parse(almacen[CP]) });
  avisar();
  const correr = () => {
    for (const s of scripts.splice(0)) {
      const ventana = {
        localStorage: {
          getItem: (k: string) => (k in almacen ? almacen[k] : null),
          setItem: (k: string, v: string) => {
            almacen[k] = v;
          },
        },
      };
      new Function('window', 'GUARDADAS', s)(ventana, GUARDADAS);
    }
  };
  return {
    almacen,
    scripts,
    avisar,
    correr,
    lista: () => JSON.parse(almacen[CL]) as Guardada[],
    pendientes: () => JSON.parse(almacen[CP]) as PendienteGuardada[],
  };
}

function clienteFalso(o: {
  upsert?: (i: number, filas: readonly object[]) => Resultado<unknown[]> | Promise<Resultado<unknown[]>>;
  nube?: () => Resultado<FilaGuardada[]>;
  rpc?: () => Resultado<unknown>;
} = {}) {
  const llamadas: Llamada[] = [];
  let n = 0;
  const cliente = {
    entrar: jest.fn(),
    renovar: jest.fn(),
    seleccionar: jest.fn(async (_s: unknown, tabla: string, consulta: Record<string, string>) => {
      llamadas.push({ op: 'seleccionar', tabla, arg: consulta });
      return o.nube ? o.nube() : { ok: true as const, valor: [] };
    }),
    upsert: jest.fn(async (_s: unknown, tabla: string, filas: readonly object[], conflicto: string) => {
      llamadas.push({ op: 'upsert', tabla, arg: filas, conflicto });
      return o.upsert ? o.upsert(n++, filas) : { ok: true as const, valor: [] };
    }),
    rpc: jest.fn(async (_s: unknown, funcion: string, args: object) => {
      llamadas.push({ op: 'rpc', tabla: funcion, arg: args });
      return o.rpc ? o.rpc() : { ok: true as const, valor: null };
    }),
  };
  return { cliente, llamadas };
}

function contexto(
  cliente: ReturnType<typeof clienteFalso>['cliente'],
  o: { enVivo?: () => boolean; conSesion?: ContextoSincronizar['sesion']['conSesion'] } = {},
): ContextoSincronizar {
  return {
    momento: 'antes-de-iniciar',
    parroquia: PARROQUIA,
    sesion: {
      conSesion: o.conSesion ?? ((fn) => fn(SESION)),
    } as unknown as ContextoSincronizar['sesion'],
    cliente: cliente as unknown as ContextoSincronizar['cliente'],
    enVivo: o.enVivo ?? (() => false),
    sigueElegida: () => true,
  };
}

let espiaWarn: jest.SpyInstance;
beforeEach(() => {
  espiaWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const A = guardada('aaaa-111111', 'Misa', 100);
const B = guardada('bbbb-222222', 'Hora Santa', 200);

test('la tarea sube los pendientes y vacía los subidos', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  const { cliente, llamadas } = clienteFalso({ nube: () => ({ ok: true, valor: [fila(A, { actualizado_desde: 'app' })] }) });
  await crearTareaGuardadas({ canal, ahora: () => AHORA })(contexto(cliente));

  const subidas = llamadas.filter((l) => l.op === 'upsert');
  expect(subidas).toHaveLength(1);
  expect(subidas[0].tabla).toBe('guardadas');
  expect(subidas[0].conflicto).toBe('parroquia_id,id');
  expect(subidas[0].arg).toEqual([GUARDADAS.aFila(A, 'app', 'p1')]);
  const bajada = llamadas.filter((l) => l.op === 'seleccionar');
  expect(bajada).toHaveLength(1);
  expect(bajada[0].tabla).toBe('guardadas');
  const desde = new Date(AHORA - 30 * 86400000).toISOString();
  expect(bajada[0].arg).toEqual({ select: '*', parroquia_id: 'eq.p1', or: `(borrada_en.is.null,borrada_en.gte.${desde})` });

  panel.correr();
  expect(panel.pendientes()).toEqual([]);
  expect(panel.lista().map((g) => g.id)).toEqual([A.id]);
});

test('la tarea no corre en vivo', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  const { cliente, llamadas } = clienteFalso();
  await crearTareaGuardadas({ canal })(contexto(cliente, { enVivo: () => true }));
  expect(llamadas).toEqual([]);
  expect(panel.scripts).toEqual([]);
});

test('si sale al aire durante la subida, no baja ni toca el panel', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  let vivo = false;
  const { cliente, llamadas } = clienteFalso({
    upsert: () => {
      vivo = true;
      return { ok: true, valor: [] };
    },
  });
  await crearTareaGuardadas({ canal })(contexto(cliente, { enVivo: () => vivo }));
  expect(llamadas.filter((l) => l.op === 'seleccionar')).toHaveLength(0);
  expect(panel.scripts).toEqual([]);
});

test('23505 renombra a (copia) y reintenta una vez', async () => {
  const canal = crearCanalGuardadas();
  const otra = guardada('zzzz-999999', 'Misa', 50);   // otro aparato ya tiene «Misa»
  const panel = panelFalso(canal, { lista: [A, B], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  let nube: FilaGuardada[] = [fila(otra), fila(B, { nombre: 'Misa (copia)' })];
  const { cliente, llamadas } = clienteFalso({
    upsert: (i, filas) => {
      if (i === 0) return error({ tipo: 'servidor', estado: 409, codigo: '23505' });
      nube = nube.concat(filas as FilaGuardada[]);
      return { ok: true, valor: [] };
    },
    nube: () => ({ ok: true, valor: nube }),
  });
  await crearTareaGuardadas({ canal })(contexto(cliente));

  const subidas = llamadas.filter((l) => l.op === 'upsert');
  expect(subidas).toHaveLength(2);
  // «Misa» está en la nube y «Misa (copia)» también (la de B): queda «Misa (copia 2)».
  expect((subidas[1].arg as FilaGuardada[])[0].nombre).toBe('Misa (copia 2)');
  expect((subidas[1].arg as FilaGuardada[])[0].id).toBe(A.id);
  panel.correr();
  expect(panel.pendientes()).toEqual([]);
  expect(panel.lista().find((g) => g.id === A.id)!.nombre).toBe('Misa (copia 2)');
});

test('23505 dos veces: el pendiente queda rechazado, sin un tercer intento', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  const { cliente, llamadas } = clienteFalso({ upsert: () => error({ tipo: 'servidor', estado: 409, codigo: '23505' }) });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(2);
  panel.correr();
  expect(panel.pendientes()).toEqual([{ op: 'guardar', id: A.id, cuando: 100, rechazado: true }]);
  expect(panel.lista().map((g) => g.id)).toEqual([A.id]);   // sigue a la vista
});

test('un 4xx deja el pendiente rechazado y se sigue con el próximo', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, {
    lista: [A, B],
    pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }, { op: 'guardar', id: B.id, cuando: 200 }],
  });
  const { cliente, llamadas } = clienteFalso({
    upsert: (i) => (i === 0 ? error({ tipo: 'servidor', estado: 400, codigo: 'P0001' }) : { ok: true, valor: [] }),
    nube: () => ({ ok: true, valor: [fila(B)] }),
  });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(2);
  panel.correr();
  expect(panel.pendientes()).toEqual([{ op: 'guardar', id: A.id, cuando: 100, rechazado: true }]);
  expect(panel.lista().map((g) => g.id).sort()).toEqual([A.id, B.id]);

  // Lo rechazado nunca se reintenta.
  panel.avisar();
  await crearTareaGuardadas({ canal })(contexto(cliente));
  expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(2);
});

describe('auth y 429 cortan: la cola queda y nada se rechaza', () => {
  const casos: Array<[string, Partial<Parameters<typeof clienteFalso>[0]>, ContextoSincronizar['sesion']['conSesion'] | undefined]> = [
    ['la renovación falla con un 403 de Auth', {}, (async () => error({ tipo: 'servidor', estado: 403 })) as never],
    ['la renovación da 429', {}, (async () => error({ tipo: 'muchos-intentos' })) as never],
    ['la sesión ya no vale', {}, (async () => error({ tipo: 'sesion-invalida' })) as never],
    ['PostgREST da 429', { upsert: () => error({ tipo: 'servidor', estado: 429 }) }, undefined],
    ['sin conexión', { upsert: () => error({ tipo: 'sin-conexion' }) }, undefined],
  ];
  test.each(casos)('%s', async (_n, o, conSesion) => {
    const canal = crearCanalGuardadas();
    const pendientes: PendienteGuardada[] = [{ op: 'guardar', id: A.id, cuando: 100 }, { op: 'guardar', id: B.id, cuando: 200 }];
    const panel = panelFalso(canal, { lista: [A, B], pendientes });
    const { cliente, llamadas } = clienteFalso(o);
    await crearTareaGuardadas({ canal })(contexto(cliente, { conSesion }));
    expect(llamadas.filter((l) => l.op === 'upsert').length).toBeLessThanOrEqual(1);
    expect(llamadas.filter((l) => l.op === 'seleccionar')).toHaveLength(0);
    panel.correr();
    expect(panel.pendientes()).toEqual(pendientes);
  });

  test('un corte después de una subida buena saca solo la subida', async () => {
    const canal = crearCanalGuardadas();
    const panel = panelFalso(canal, {
      lista: [A, B],
      pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }, { op: 'guardar', id: B.id, cuando: 200 }],
    });
    const { cliente } = clienteFalso({ upsert: (i) => (i === 0 ? { ok: true, valor: [] } : error({ tipo: 'servidor', estado: 429 })) });
    await crearTareaGuardadas({ canal })(contexto(cliente));
    panel.correr();
    expect(panel.pendientes()).toEqual([{ op: 'guardar', id: B.id, cuando: 200 }]);
    expect(panel.lista().map((g) => g.id)).toEqual([A.id, B.id]);   // sin nube, la lista no se toca
  });
});

test('varios «usar» de una guardada van en un solo rpc, con el último', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, {
    lista: [A],
    pendientes: [{ op: 'usar', id: A.id, cuando: 1000 }, { op: 'usar', id: A.id, cuando: 3000 }, { op: 'usar', id: A.id, cuando: 2000 }],
  });
  const { cliente, llamadas } = clienteFalso({ nube: () => ({ ok: true, valor: [fila(A)] }) });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  const rpcs = llamadas.filter((l) => l.op === 'rpc');
  expect(rpcs).toEqual([
    { op: 'rpc', tabla: 'usar_guardada', arg: { p_parroquia: 'p1', p_id: A.id, p_cuando: new Date(3000).toISOString() } },
  ]);
  panel.correr();
  expect(panel.pendientes()).toEqual([]);
});

test('borrar sube la baja armada con la fila de la nube; lo que nunca subió solo sale de la cola', async () => {
  const canal = crearCanalGuardadas();
  const nunca = 'nnnn-000000';
  const panel = panelFalso(canal, {
    lista: [],
    pendientes: [{ op: 'borrar', id: A.id, cuando: 5000 }, { op: 'borrar', id: nunca, cuando: 6000 }, { op: 'usar', id: A.id, cuando: 4000 }],
  });
  const { cliente, llamadas } = clienteFalso({ nube: () => ({ ok: true, valor: [fila(A, { actualizado_por: 'u-9' } as never)] }) });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  const subidas = llamadas.filter((l) => l.op === 'upsert');
  expect(subidas).toHaveLength(1);
  const baja = (subidas[0].arg as Array<Record<string, unknown>>)[0];
  expect(baja.id).toBe(A.id);
  expect(baja.parroquia_id).toBe('p1');
  expect(baja.borrada_en).toBe(new Date(5000).toISOString());
  expect(baja.actualizado_en).toBe(new Date(5000).toISOString());
  expect(baja.actualizado_desde).toBe('app');
  expect(baja.nombre).toBe('Misa');
  expect('actualizado_por' in baja).toBe(false);
  expect(llamadas.filter((l) => l.op === 'rpc')).toHaveLength(0);   // usar de una borrada no importa
  panel.correr();
  expect(panel.pendientes()).toEqual([]);
});

test('carrera: lo que el panel guarda durante la sincronización no se pierde', async () => {
  const canal = crearCanalGuardadas();
  const panel = panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  const C = guardada('cccc-333333', 'Bautismos', 300);
  const A2 = { ...A, nombre: 'Misa de 8', actualizadoEn: 400 };
  const { cliente } = clienteFalso({
    upsert: () => {
      // Mientras la app sube A, en el panel se guarda C y se vuelve a editar A.
      panel.almacen[CL] = JSON.stringify([A2, C]);
      panel.almacen[CP] = JSON.stringify([
        { op: 'guardar', id: A.id, cuando: 400 },
        { op: 'guardar', id: C.id, cuando: 300 },
      ]);
      return { ok: true, valor: [] };
    },
    nube: () => ({ ok: true, valor: [fila(A)] }),
  });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  panel.correr();
  expect(panel.pendientes()).toEqual([
    { op: 'guardar', id: A.id, cuando: 400 },
    { op: 'guardar', id: C.id, cuando: 300 },
  ]);
  const lista = panel.lista();
  expect(lista.find((g) => g.id === A.id)).toEqual(A2);
  expect(lista.find((g) => g.id === C.id)).toEqual(C);
});

test('sin mensaje del panel todavía, baja y le pasa la nube igual', async () => {
  const canal = crearCanalGuardadas();
  const scripts: string[] = [];
  canal.conectar(SLUG, (s) => scripts.push(s));
  const { cliente, llamadas } = clienteFalso({ nube: () => ({ ok: true, valor: [fila(B)] }) });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  expect(llamadas.map((l) => l.op)).toEqual(['seleccionar']);
  expect(scripts).toHaveLength(1);
});

test('dos corridas seguidas no suben dos veces lo mismo aunque el panel todavía no avisó', async () => {
  const canal = crearCanalGuardadas();
  panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  const { cliente, llamadas } = clienteFalso({ nube: () => ({ ok: true, valor: [fila(A)] }) });
  const tarea = crearTareaGuardadas({ canal });
  await Promise.all([tarea(contexto(cliente)), tarea(contexto(cliente))]);
  await tarea(contexto(cliente));
  expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(1);
});

describe('registrarGuardadas', () => {
  function armar(o: { enVivo?: () => boolean } = {}) {
    const canal = crearCanalGuardadas();
    const s = crearSincronizador();
    const l = crearLimpiezas();
    const { cliente, llamadas } = clienteFalso();
    const base = contexto(cliente, o);
    registrarGuardadas(s, l, { canal, contexto: () => base });
    return { canal, s, l, base, llamadas };
  }

  test('va en abrir, antes de iniciar y al terminar', async () => {
    const { s, base } = armar();
    const { momento: _m, ...resto } = base;
    for (const m of ['abrir', 'antes-de-iniciar', 'al-terminar'] as const) {
      expect(await s.sincronizar(m, resto)).toEqual({ guardadas: 'ok' });
    }
  });

  test('corre 2 s después de un mensaje con pendientes, y no en vivo', async () => {
    jest.useFakeTimers();
    let vivo = false;
    const { canal, llamadas } = armar({ enVivo: () => vivo });
    canal.recibir(SLUG, { tipo: 'guardadas', lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
    await jest.advanceTimersByTimeAsync(1900);
    expect(llamadas).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(200);
    expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(1);

    vivo = true;
    canal.recibir(SLUG, { tipo: 'guardadas', lista: [A, B], pendientes: [{ op: 'guardar', id: B.id, cuando: 200 }] });
    await jest.advanceTimersByTimeAsync(3000);
    expect(llamadas.filter((l) => l.op === 'upsert')).toHaveLength(1);
  });

  test('un mensaje sin pendientes (o solo rechazados) no dispara nada', async () => {
    jest.useFakeTimers();
    const { canal, llamadas } = armar();
    canal.recibir(SLUG, { tipo: 'guardadas', lista: [A], pendientes: [] });
    canal.recibir(SLUG, { tipo: 'guardadas', lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 1, rechazado: true }] });
    await jest.advanceTimersByTimeAsync(5000);
    expect(llamadas).toHaveLength(0);
  });

  test('la limpieza olvida el último mensaje', async () => {
    const { canal, l } = armar();
    canal.recibir(SLUG, { tipo: 'guardadas', lista: [], pendientes: [] });
    await l.limpiar({ tipo: 'parroquia', parroquia: PARROQUIA });
    expect(canal.ultimo(SLUG)).toBeNull();
  });
});

test('no escribe en la consola nada más que el aviso de corte', async () => {
  const canal = crearCanalGuardadas();
  panelFalso(canal, { lista: [A], pendientes: [{ op: 'guardar', id: A.id, cuando: 100 }] });
  const { cliente } = clienteFalso({ upsert: () => error({ tipo: 'sin-conexion' }) });
  await crearTareaGuardadas({ canal })(contexto(cliente));
  for (const [m] of espiaWarn.mock.calls) expect(String(m)).toBe('guardadas: sincronización cortada');
});
