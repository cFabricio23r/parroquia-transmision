// La descarga de los ajustes y la clave de la parroquia. Las claves son falsas, solo para pruebas.
import { crearAlmacenAjustes, type AlmacenAjustes } from './almacen';
import {
  alCambiarAjustes,
  avisarCambioDeAjustes,
  CONSULTA_AJUSTES,
  CONSULTA_CLAVE,
  crearTareaAjustes,
  normalizarFilaAjustes,
  normalizarFilaClave,
  registrarAjustes,
} from './descarga';
import { crearLimpiezas, crearSincronizador, type ContextoSincronizar } from '../sincronizar/sincronizar';
import type { ParroquiaApp } from '../sesion/tipos';

const PARROQUIA: ParroquiaApp = { id: 'p-1', slug: 'ciudad-arce', nombre: 'X' };
const FILA_AJUSTES = { servidor: 'rtmps://p/', calidad_defecto: '1080p', estilo_final: 'claro', actualizado_en: '2026-11-14T10:00:00Z' };
const FILA_CLAVE = { clave: 'FB-CLAVE-FALSA-1111', guardada_en: '2026-11-14T10:00:00Z' };
const P = { servidor: 'rtmps://p/', calidad: '1080p', estiloFinal: 'claro', actualizadoEn: '2026-11-14T10:00:00Z' };
const K = { clave: 'FB-CLAVE-FALSA-1111', guardadaEn: '2026-11-14T10:00:00Z' };

const espias: jest.SpyInstance[] = [];
beforeEach(() => {
  espias.length = 0;
  for (const m of ['log', 'warn', 'error'] as const) espias.push(jest.spyOn(console, m).mockImplementation(() => undefined));
});
afterEach(() => {
  for (const e of espias) {
    for (const llamada of e.mock.calls) expect(JSON.stringify(llamada)).not.toContain('FB-CLAVE');
    e.mockRestore();
  }
});

function almacenMemoria(): { a: AlmacenAjustes; mapa: Record<string, string> } {
  const mapa: Record<string, string> = {};
  const a = crearAlmacenAjustes({
    getItemAsync: async (k) => (k in mapa ? mapa[k] : null),
    setItemAsync: async (k, v) => {
      mapa[k] = v;
    },
    deleteItemAsync: async (k) => {
      delete mapa[k];
    },
  });
  return { a, mapa };
}

type Filas = { ajustes_app: unknown[] | { error: string }; claves_transmision: unknown[] | { error: string } };

function armar(filas: Filas, o: { alPedir?: () => void } = {}) {
  const estado = { enVivo: false, sigueElegida: true };
  const pedidos: Array<[string, Record<string, string>]> = [];
  const cliente = {
    seleccionar: jest.fn(async (_s: unknown, tabla: string, consulta: Record<string, string>) => {
      pedidos.push([tabla, { ...consulta }]);
      o.alPedir?.();
      const f = filas[tabla as keyof Filas];
      if (!Array.isArray(f)) return { ok: false, error: { tipo: f.error } };
      return { ok: true, valor: f };
    }),
  };
  const sesion = { conSesion: (fn: (s: unknown) => Promise<unknown>) => fn({ token: 'falso' }) };
  const contexto: ContextoSincronizar = {
    momento: 'abrir',
    parroquia: PARROQUIA,
    sesion: sesion as unknown as ContextoSincronizar['sesion'],
    cliente: cliente as unknown as ContextoSincronizar['cliente'],
    enVivo: () => estado.enVivo,
    sigueElegida: () => estado.sigueElegida,
  };
  const { a, mapa } = almacenMemoria();
  const avisos: string[] = [];
  const tarea = crearTareaAjustes({ almacen: a, avisar: (s) => avisos.push(s) });
  return { estado, pedidos, cliente, contexto, a, mapa, avisos, tarea };
}

describe('normalizar', () => {
  it('filas buenas', () => {
    expect(normalizarFilaAjustes(FILA_AJUSTES)).toEqual(P);
    expect(normalizarFilaClave(FILA_CLAVE)).toEqual(K);
  });
  it('un servidor que no es rtmps queda null; lo demás bien', () => {
    expect(normalizarFilaAjustes({ ...FILA_AJUSTES, servidor: 'http://x' })).toEqual({ ...P, servidor: null });
  });
  it('una calidad desconocida o una clave con espacios dan null', () => {
    expect(normalizarFilaAjustes({ ...FILA_AJUSTES, calidad_defecto: '4k' })).toBeNull();
    expect(normalizarFilaClave({ ...FILA_CLAVE, clave: 'FB CLAVE' })).toBeNull();
    expect(normalizarFilaAjustes(null)).toBeNull();
  });
});

describe('la tarea «ajustes-app»', () => {
  it('pide las dos tablas de la parroquia', async () => {
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: [FILA_CLAVE] });
    await t.tarea(t.contexto);
    expect(t.pedidos).toEqual([
      ['ajustes_app', CONSULTA_AJUSTES('p-1')],
      ['claves_transmision', CONSULTA_CLAVE('p-1')],
    ]);
    expect(CONSULTA_AJUSTES('p-1')).toEqual({ select: 'servidor,calidad_defecto,estilo_final,actualizado_en', parroquia_id: 'eq.p-1' });
    expect(CONSULTA_CLAVE('p-1')).toEqual({ select: 'clave,guardada_en', parroquia_id: 'eq.p-1' });
  });
  it('guarda lo bajado y avisa una vez', async () => {
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: [FILA_CLAVE] });
    await t.tarea(t.contexto);
    const g = await t.a.leer('ciudad-arce');
    expect(g.parroquia).toEqual(P);
    expect(g.clave).toEqual(K);
    expect(t.avisos).toEqual(['ciudad-arce']);
    await t.tarea(t.contexto);
    expect(t.avisos).toEqual(['ciudad-arce']);
  });
  it('sin filas borra lo bajado y avisa si había algo', async () => {
    const t = armar({ ajustes_app: [], claves_transmision: [] });
    await t.a.guardarDeParroquia('ciudad-arce', P as never, K);
    await t.tarea(t.contexto);
    const g = await t.a.leer('ciudad-arce');
    expect([g.parroquia, g.clave]).toEqual([null, null]);
    expect(t.avisos).toEqual(['ciudad-arce']);
  });
  it('una fila inválida deja lo que estaba', async () => {
    const t = armar({ ajustes_app: [{ ...FILA_AJUSTES, calidad_defecto: '4k' }], claves_transmision: [{ ...FILA_CLAVE, clave: 'FB CLAVE' }] });
    await t.a.guardarDeParroquia('ciudad-arce', P as never, K);
    await t.tarea(t.contexto);
    const g = await t.a.leer('ciudad-arce');
    expect(g.parroquia).toEqual(P);
    expect(g.clave).toEqual(K);
    expect(t.avisos).toEqual([]);
  });
  it('una lectura que falla lanza sin datos y no escribe nada', async () => {
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: { error: 'sin-conexion' } });
    let error: unknown;
    await t.tarea(t.contexto).catch((e) => (error = e));
    expect(error).toEqual(new Error('ajustes-app: lectura'));
    expect(String((error as Error).message)).not.toContain('FB-CLAVE');
    expect(Object.keys(t.mapa)).toEqual([]);
  });
});

describe('descarga tardía (Review Focus 1)', () => {
  it('sale al aire mientras se pide: no escribe ni avisa', async () => {
    const ref: { e?: { enVivo: boolean } } = {};
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: [FILA_CLAVE] }, { alPedir: () => ref.e && (ref.e.enVivo = true) });
    ref.e = t.estado;
    await t.tarea(t.contexto);
    expect(Object.keys(t.mapa)).toEqual([]);
    expect(t.avisos).toEqual([]);
  });
  it('deja de ser la elegida mientras se pide: lo mismo', async () => {
    const ref: { e?: { sigueElegida: boolean } } = {};
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: [FILA_CLAVE] }, { alPedir: () => ref.e && (ref.e.sigueElegida = false) });
    ref.e = t.estado;
    await t.tarea(t.contexto);
    expect(Object.keys(t.mapa)).toEqual([]);
    expect(t.avisos).toEqual([]);
  });
  it('sale al aire entre leer el almacén y escribir: no escribe', async () => {
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: [FILA_CLAVE] });
    const leer = t.a.leer.bind(t.a);
    t.a.leer = async (s) => {
      const g = await leer(s);
      t.estado.enVivo = true;
      return g;
    };
    await t.tarea(t.contexto);
    expect(Object.keys(t.mapa)).toEqual([]);
    expect(t.avisos).toEqual([]);
  });
  it('en vivo desde el principio: no pide nada', async () => {
    const t = armar({ ajustes_app: [FILA_AJUSTES], claves_transmision: [FILA_CLAVE] });
    t.estado.enVivo = true;
    await t.tarea(t.contexto);
    expect(t.cliente.seleccionar).not.toHaveBeenCalled();
  });
});

describe('registrar', () => {
  it('limpieza por parroquia y de todo', async () => {
    const s = crearSincronizador();
    const l = crearLimpiezas();
    const almacen = {
      borrarParroquia: jest.fn(async () => undefined),
      borrarTodo: jest.fn(async () => undefined),
    } as unknown as AlmacenAjustes;
    registrarAjustes(s, l, { almacen, avisar: () => undefined });
    await l.limpiar({ tipo: 'parroquia', parroquia: PARROQUIA });
    expect(almacen.borrarParroquia).toHaveBeenCalledWith('ciudad-arce');
    await l.limpiar({ tipo: 'todo' });
    expect(almacen.borrarTodo).toHaveBeenCalledTimes(1);
  });
  it('queda tercera, después de acceso y paginas', async () => {
    const s = crearSincronizador();
    s.registrarTarea('acceso', ['abrir'], async () => undefined);
    s.registrarTarea('paginas', ['abrir', 'antes-de-iniciar'], async () => undefined);
    const t = armar({ ajustes_app: [], claves_transmision: [] });
    registrarAjustes(s, crearLimpiezas(), { almacen: t.a, avisar: () => undefined });
    const { momento: _m, ...base } = t.contexto;
    expect(Object.keys(await s.sincronizar('abrir', base))).toEqual(['acceso', 'paginas', 'ajustes-app']);
    expect(Object.keys(await s.sincronizar('antes-de-iniciar', base))).toEqual(['paginas', 'ajustes-app']);
  });
  it('alCambiarAjustes avisa y se puede dejar de escuchar', () => {
    const vistos: string[] = [];
    const dejar = alCambiarAjustes((s) => vistos.push(s));
    avisarCambioDeAjustes('ciudad-arce');
    dejar();
    avisarCambioDeAjustes('ciudad-arce');
    expect(vistos).toEqual(['ciudad-arce']);
  });
});
