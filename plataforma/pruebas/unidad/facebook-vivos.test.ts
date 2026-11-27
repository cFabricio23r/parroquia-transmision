import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAJE_SIN_PERMISO, MENSAJE_SIN_SESION } from '../../lib/borrador';
import { cifrar } from '../../lib/facebook/cifrado';
import type { ErrorGraph, GraphFacebook, ResultadoGraph } from '../../lib/facebook/graph';
import { MAX_TITULO, crearVivo, estadoVivo, leerDestinos, terminarVivo, type DepsVivos } from '../../lib/facebook/vivos';

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Supabase en memoria (solo lo que usa la lib) ----
type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;

let contador = 0;

class Consulta implements PromiseLike<{ data: unknown; error: unknown }> {
  private op: 'select' | 'insert' | 'update' = 'select';
  private filtros: Array<(f: Fila) => boolean> = [];
  private carga: Fila = {};
  private error: unknown = null;
  constructor(
    private tablas: Tablas,
    private tabla: string,
  ) {}
  select() {
    return this;
  }
  insert(c: Fila) {
    this.op = 'insert';
    this.carga = c;
    return this;
  }
  update(c: Fila) {
    this.op = 'update';
    this.carga = c;
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] === v);
    return this;
  }
  is(c: string, v: null) {
    this.filtros.push((f) => (f[c] ?? null) === v);
    return this;
  }
  gte(c: string, v: string) {
    this.filtros.push((f) => String(f[c]) >= v);
    return this;
  }
  private correr(): Fila[] {
    const filas = (this.tablas[this.tabla] ??= []);
    const cumple = (f: Fila) => this.filtros.every((p) => p(f));
    if (this.op === 'insert') {
      const nueva: Fila = { id: `id-${++contador}`, empezado_en: new Date().toISOString(), terminado_en: null, extras: [], ...this.carga };
      // El índice único parcial de facebook_vivos: un solo vivo sin terminar por parroquia.
      if (this.tabla === 'facebook_vivos' && filas.some((f) => f.parroquia_id === nueva.parroquia_id && f.terminado_en === null)) {
        this.error = { code: '23505', message: 'duplicate key' };
        return [];
      }
      filas.push(nueva);
      return [{ ...nueva }];
    }
    if (this.op === 'update') {
      for (const f of filas.filter(cumple)) Object.assign(f, this.carga);
      return [];
    }
    return filas.filter(cumple).map((f) => ({ ...f }));
  }
  maybeSingle() {
    const r = this.correr();
    return Promise.resolve({ data: r[0] ?? null, error: this.error });
  }
  single() {
    return this.maybeSingle();
  }
  then<A, B>(
    ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ) {
    const data = this.correr();
    return Promise.resolve({ data: this.error ? null : data, error: this.error }).then(ok, ko);
  }
}

function cliente(tablas: Tablas, usuario: { id: string } | null): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    from: (t: string) => new Consulta(tablas, t),
  } as unknown as SupabaseClient;
}

const A = 'id-parroquia-a';
const B = 'id-parroquia-b';
const LLAVE = Buffer.alloc(32, 7);
const TOKEN_PAGINA = 'TOKEN-PAGINA-PRINCIPAL';
const SERVIDOR = 'rtmps://live-api-s.facebook.com:443/rtmp/';
const CLAVE = 'FB-1234-0-ClaveSecretaDelStream';
const urlDe = (clave = CLAVE) => `${SERVIDOR}${clave}`;
const hace = (ms: number) => new Date(Date.now() - ms).toISOString();

/** La A: conectada, principal `pp` y extras e1 (listo), e2 (listo), e3 (falta). La B tiene su propia principal. */
function mundo(): Tablas {
  const pag = (parroquia: string, id: string, token: string) => ({
    parroquia_id: parroquia,
    page_id: id,
    nombre: `Nombre ${id}`,
    token: cifrar(token, LLAVE),
  });
  return {
    parroquias: [
      { id: A, slug: 'sa' },
      { id: B, slug: 'sb' },
    ],
    facebook_conexion: [
      { parroquia_id: A, nombre_facebook: 'Cuenta A', token_usuario: cifrar('TOKEN-USUARIO-A', LLAVE), estado: 'conectado' },
      { parroquia_id: B, nombre_facebook: 'Cuenta B', token_usuario: cifrar('TOKEN-USUARIO-B', LLAVE), estado: 'conectado' },
    ],
    facebook_paginas: [
      pag(A, 'pp', TOKEN_PAGINA),
      pag(A, 'e1', 'T-E1'),
      pag(A, 'e2', 'T-E2'),
      pag(A, 'e3', 'T-E3'),
      pag(B, 'pb', 'T-PB'),
      pag(B, 'x1', 'T-X1'),
    ],
    facebook_parroquia: [
      { parroquia_id: A, pagina_principal: 'pp' },
      { parroquia_id: B, pagina_principal: 'pb' },
    ],
    facebook_parroquia_extra: [
      { parroquia_id: A, page_id: 'e1', por_defecto: true, crosspost: 'listo' },
      { parroquia_id: A, page_id: 'e2', por_defecto: false, crosspost: 'listo' },
      { parroquia_id: A, page_id: 'e3', por_defecto: false, crosspost: 'falta' },
      { parroquia_id: B, page_id: 'x1', por_defecto: false, crosspost: 'listo' },
    ],
    facebook_vivos: [],
    registro: [],
  };
}

const ok = <T,>(valor: T): ResultadoGraph<T> => ({ ok: true, valor });
const falla = (tipo: ErrorGraph['tipo'], codigo?: number): ResultadoGraph<never> => ({ ok: false, error: { tipo, codigo } });

/** Un Graph falso: guarda qué se llamó y con qué token, y cada método se puede reemplazar. */
function graphFalso(sobre: Partial<GraphFacebook> = {}) {
  const llamadas: string[] = [];
  const tokens: string[] = [];
  const anota = <T,>(nombre: string, token: string, valor: T) => {
    llamadas.push(nombre);
    tokens.push(token);
    return valor;
  };
  const g = {
    crearVivo: async (_pagina: string, token: string) => anota('crearVivo', token, ok({ vivoId: `fb-${++contador}`, url: urlDe() })),
    activarCrosspost: async (_v: string, token: string) => anota('activarCrosspost', token, ok(undefined)),
    crosspostHechos: async (_v: string, token: string) => anota('crosspostHechos', token, ok<string[]>([])),
    estadoVivo: async (_v: string, token: string) => anota('estadoVivo', token, ok<'activo' | 'terminado'>('activo')),
    urlDeVivo: async (_v: string, token: string) => anota('urlDeVivo', token, ok(urlDe())),
    terminarVivo: async (_v: string, token: string) => anota('terminarVivo', token, ok(undefined)),
    ...sobre,
  } as unknown as GraphFacebook;
  return { g, llamadas, tokens };
}

function deps(tablas: Tablas, g: GraphFacebook, usuario: { id: string } | null = { id: 'u-coord' }, visibles: string[] = [A]): DepsVivos {
  const vistas: Tablas = { ...tablas, parroquias: tablas.parroquias.filter((p) => visibles.includes(p.id as string)) };
  return { sesion: cliente(vistas, usuario), servicio: cliente(tablas, null), graph: g, llave: LLAVE };
}

const entrada = (extras: string[] = ['e1'], titulo = 'Misa de domingo') => ({ extras, titulo });
const vivoActivo = (extra: Fila = {}): Fila => ({
  id: 'vivo-fila-1',
  parroquia_id: A,
  vivo_id: 'fb-existente',
  page_id: 'pp',
  extras: ['e1'],
  empezado_en: hace(60_000),
  terminado_en: null,
  ...extra,
});

describe('leerDestinos', () => {
  it('lista la principal y solo las extras con crosspost listo', async () => {
    const t = mundo();
    const r = await leerDestinos(deps(t, graphFalso().g), 'sa');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({
      conectado: true,
      principal: { id: 'pp', nombre: 'Nombre pp' },
      extras: [
        { id: 'e1', nombre: 'Nombre e1', porDefecto: true },
        { id: 'e2', nombre: 'Nombre e2', porDefecto: false },
      ],
    });
  });

  it('sin conexión, o con la conexión en «reconectar», dice conectado:false y no lista nada', async () => {
    const t = mundo();
    t.facebook_conexion[0].estado = 'reconectar';
    expect((await leerDestinos(deps(t, graphFalso().g), 'sa')).cuerpo).toEqual({ conectado: false, principal: null, extras: [] });
    t.facebook_conexion = [];
    expect((await leerDestinos(deps(t, graphFalso().g), 'sa')).cuerpo).toEqual({ conectado: false, principal: null, extras: [] });
  });

  it('conectada pero sin principal: conectado:true y principal null', async () => {
    const t = mundo();
    t.facebook_parroquia = [];
    expect((await leerDestinos(deps(t, graphFalso().g), 'sa')).cuerpo).toMatchObject({ conectado: true, principal: null });
  });

  it('sin sesión 401; una parroquia que no es suya 403', async () => {
    const t = mundo();
    const sin = await leerDestinos(deps(t, graphFalso().g, null), 'sa');
    expect([sin.estado, sin.cuerpo]).toEqual([401, { error: MENSAJE_SIN_SESION }]);
    const otra = await leerDestinos(deps(t, graphFalso().g), 'sb');
    expect([otra.estado, otra.cuerpo]).toEqual([403, { error: MENSAJE_SIN_PERMISO }]);
  });
});

describe('crearVivo · reglas, en orden', () => {
  it('sin conexión «conectado» o sin principal: 404 sin-facebook y no se llama a Facebook', async () => {
    for (const cambio of [
      (t: Tablas) => (t.facebook_conexion = []),
      (t: Tablas) => (t.facebook_conexion[0].estado = 'reconectar'),
      (t: Tablas) => (t.facebook_parroquia = []),
    ]) {
      const t = mundo();
      cambio(t);
      const { g, llamadas } = graphFalso();
      const r = await crearVivo(deps(t, g), 'sa', entrada());
      expect(r.estado).toBe(404);
      expect(r.cuerpo).toMatchObject({ codigo: 'sin-facebook' });
      expect(llamadas).toEqual([]);
      expect(t.facebook_vivos).toEqual([]);
    }
  });

  it('el 404 va antes que el 422: sin Facebook ni siquiera se mira la entrada', async () => {
    const t = mundo();
    t.facebook_conexion = [];
    const r = await crearVivo(deps(t, graphFalso().g), 'sa', { extras: 'no', titulo: '' });
    expect(r.estado).toBe(404);
  });

  it('extras fuera de lo asignado con «listo»: 422 y no se crea nada (falta, de otra parroquia, la principal, inventada)', async () => {
    for (const extras of [['e3'], ['x1'], ['pp'], ['no-existe'], ['e1', 'x1']]) {
      const t = mundo();
      const { g, llamadas } = graphFalso();
      const r = await crearVivo(deps(t, g), 'sa', entrada(extras));
      expect(r.estado).toBe(422);
      expect(llamadas).toEqual([]);
      expect(t.facebook_vivos).toEqual([]);
    }
  });

  it('título vacío, solo espacios, de más de 255 caracteres, ausente o entrada mal formada: 422', async () => {
    for (const cuerpo of [
      entrada(['e1'], ''),
      entrada(['e1'], '   '),
      entrada(['e1'], 'x'.repeat(MAX_TITULO + 1)),
      { extras: ['e1'] },
      { extras: 'e1', titulo: 'Misa' },
      { extras: [1], titulo: 'Misa' },
      null,
      [],
    ]) {
      const t = mundo();
      const { g, llamadas } = graphFalso();
      const r = await crearVivo(deps(t, g), 'sa', cuerpo);
      expect(r.estado, JSON.stringify(cuerpo)).toBe(422);
      expect(llamadas).toEqual([]);
    }
  });

  it('un título de exactamente 255 caracteres es válido', async () => {
    const t = mundo();
    const r = await crearVivo(deps(t, graphFalso().g), 'sa', entrada(['e1'], 'x'.repeat(MAX_TITULO)));
    expect(r.estado).toBe(200);
  });

  it('más de 6 vivos creados en la última hora: 429 muchos; 6, o más de una hora atrás, no cuentan', async () => {
    const llenar = (t: Tablas, n: number, hace_ms: number) => {
      for (let i = 0; i < n; i++) t.facebook_vivos.push({ id: `v${i}`, parroquia_id: A, vivo_id: `f${i}`, page_id: 'pp', extras: [], empezado_en: hace(hace_ms), terminado_en: hace(hace_ms - 1000) });
    };
    const siete = mundo();
    llenar(siete, 7, 600_000);
    const { g, llamadas } = graphFalso();
    const r = await crearVivo(deps(siete, g), 'sa', entrada());
    expect(r.estado).toBe(429);
    expect(r.cuerpo).toMatchObject({ codigo: 'muchos' });
    expect(llamadas).toEqual([]);

    const seis = mundo();
    llenar(seis, 6, 600_000);
    expect((await crearVivo(deps(seis, graphFalso().g), 'sa', entrada())).estado).toBe(200);

    const viejos = mundo();
    llenar(viejos, 9, 2 * 3_600_000);
    expect((await crearVivo(deps(viejos, graphFalso().g), 'sa', entrada())).estado).toBe(200);

    const deOtra = mundo();
    for (let i = 0; i < 9; i++) deOtra.facebook_vivos.push({ id: `o${i}`, parroquia_id: B, vivo_id: `o${i}`, page_id: 'pb', extras: [], empezado_en: hace(1000), terminado_en: hace(500) });
    expect((await crearVivo(deps(deOtra, graphFalso().g), 'sa', entrada())).estado).toBe(200);
  });

  it('sin sesión 401 y de otra parroquia 403, sin llamar a Facebook', async () => {
    const t = mundo();
    const { g, llamadas } = graphFalso();
    expect((await crearVivo(deps(t, g, null), 'sa', entrada())).estado).toBe(401);
    expect((await crearVivo(deps(t, g), 'sb', entrada())).estado).toBe(403);
    expect(llamadas).toEqual([]);
    expect(t.facebook_vivos).toEqual([]);
  });
});

describe('crearVivo · crear', () => {
  it('crea el vivo con el token de la PÁGINA, guarda la fila y responde servidor, clave, principal y extras', async () => {
    const t = mundo();
    const { g, llamadas, tokens } = graphFalso();
    const r = await crearVivo(deps(t, g), 'sa', entrada(['e1', 'e2']));
    expect(r.estado).toBe(200);
    expect(t.facebook_vivos).toHaveLength(1);
    expect(t.facebook_vivos[0]).toMatchObject({ parroquia_id: A, page_id: 'pp', extras: ['e1', 'e2'], creado_por: 'u-coord', terminado_en: null });
    expect(r.cuerpo).toEqual({
      id: t.facebook_vivos[0].id,
      servidor: SERVIDOR,
      clave: CLAVE,
      principal: { id: 'pp', nombre: 'Nombre pp' },
      extras: [
        { id: 'e1', nombre: 'Nombre e1' },
        { id: 'e2', nombre: 'Nombre e2' },
      ],
      reusado: false,
    });
    expect(llamadas).toEqual(['crearVivo', 'activarCrosspost']);
    expect(tokens.every((x) => x === TOKEN_PAGINA)).toBe(true);
  });

  it('activarCrosspost no demora la respuesta: va en `despues`, con el vivo y el token de la principal', async () => {
    const t = mundo();
    const tareas: Array<() => Promise<unknown>> = [];
    const pedidos: Array<{ vivo: string; token: string; extras: string[] }> = [];
    const { g, llamadas } = graphFalso({
      activarCrosspost: async (vivo: string, token: string, extras: string[]) => {
        pedidos.push({ vivo, token, extras });
        return ok(undefined);
      },
    });
    const r = await crearVivo({ ...deps(t, g), despues: (tarea) => void tareas.push(tarea) }, 'sa', entrada(['e1', 'e2']));
    expect(r.estado).toBe(200);
    expect(llamadas).toEqual(['crearVivo']);
    expect(pedidos).toEqual([]);
    expect(tareas).toHaveLength(1);
    await tareas[0]();
    expect(pedidos).toEqual([{ vivo: t.facebook_vivos[0].vivo_id, token: TOKEN_PAGINA, extras: ['e1', 'e2'] }]);
  });

  it('la tarea de crosspost nunca lanza, aunque activarCrosspost falle o lance', async () => {
    for (const activar of [async () => falla('red'), async () => { throw new Error('boom'); }]) {
      const t = mundo();
      const tareas: Array<() => Promise<unknown>> = [];
      const { g } = graphFalso({ activarCrosspost: activar as never });
      const r = await crearVivo({ ...deps(t, g), despues: (tarea) => void tareas.push(tarea) }, 'sa', entrada(['e1']));
      expect(r.estado).toBe(200);
      await expect(tareas[0]()).resolves.toBeUndefined();
    }
  });

  it('sin extras no hay tarea de crosspost', async () => {
    const t = mundo();
    const tareas: Array<() => Promise<unknown>> = [];
    await crearVivo({ ...deps(t, graphFalso().g), despues: (tarea) => void tareas.push(tarea) }, 'sa', entrada([]));
    expect(tareas).toEqual([]);
  });

  it('sin extras no se llama a activarCrosspost', async () => {
    const t = mundo();
    const { g, llamadas } = graphFalso();
    expect((await crearVivo(deps(t, g), 'sa', entrada([]))).estado).toBe(200);
    expect(llamadas).toEqual(['crearVivo']);
  });

  it('el título que va a Facebook es el recortado', async () => {
    const t = mundo();
    const titulos: string[] = [];
    const { g } = graphFalso({
      crearVivo: async (_p, _t, titulo) => {
        titulos.push(titulo);
        return ok({ vivoId: 'fb-x', url: urlDe() });
      },
    });
    await crearVivo(deps(t, g), 'sa', entrada(['e1'], '  Misa de 8  '));
    expect(titulos).toEqual(['Misa de 8']);
  });

  it('registra iniciar_vivo_facebook con slug, página y extras; la clave y los tokens no aparecen en `registro`', async () => {
    const t = mundo();
    const r = await crearVivo(deps(t, graphFalso().g), 'sa', entrada(['e1']));
    expect(r.estado).toBe(200);
    expect(t.registro).toHaveLength(1);
    expect(t.registro[0]).toMatchObject({ parroquia_id: A, usuario_id: 'u-coord', accion: 'iniciar_vivo_facebook', detalle: { slug: 'sa', pagina: 'pp', extras: ['e1'] } });
    const texto = JSON.stringify(t.registro);
    expect(texto).not.toContain(CLAVE);
    expect(texto).not.toContain(TOKEN_PAGINA);
    expect(texto).not.toContain('TOKEN-USUARIO');
  });

  it('la clave y los tokens no salen en la consola, ni en un fallo', async () => {
    const consola = [vi.spyOn(console, 'error'), vi.spyOn(console, 'log'), vi.spyOn(console, 'warn')];
    const t = mundo();
    await crearVivo(deps(t, graphFalso().g), 'sa', entrada());
    const { g } = graphFalso({ estadoVivo: async () => ({ ok: false, error: { tipo: 'otro' } }) });
    await crearVivo(deps(t, g), 'sa', entrada()); // ya hay uno activo: falla al preguntar
    t.facebook_paginas[0].token = 'basura'; // el token no se descifra: falla sin detalle
    t.facebook_vivos = [];
    await crearVivo(deps(t, graphFalso().g), 'sa', entrada());
    const todo = JSON.stringify(consola.flatMap((s) => s.mock.calls));
    expect(todo).not.toContain(CLAVE);
    expect(todo).not.toContain(TOKEN_PAGINA);
    expect(todo).not.toContain('basura');
  });

  it('si activarCrosspost falla, el vivo sigue y las extras salen salio:false en estadoVivo', async () => {
    const t = mundo();
    const { g } = graphFalso({ activarCrosspost: async () => falla('otro') });
    const r = await crearVivo(deps(t, g), 'sa', entrada(['e1', 'e2']));
    expect(r.estado).toBe(200);
    const e = await estadoVivo(deps(t, g), 'sa', (r.cuerpo as { id: string }).id);
    expect(e.cuerpo).toEqual({
      estado: 'activo',
      extras: [
        { id: 'e1', nombre: 'Nombre e1', salio: false },
        { id: 'e2', nombre: 'Nombre e2', salio: false },
      ],
    });
  });

  it('una url de stream que no es rtmps:// con /rtmp/: 502 facebook, no se guarda y se cierra el vivo creado', async () => {
    const t = mundo();
    const { g, llamadas } = graphFalso({ crearVivo: async () => ok({ vivoId: 'fb-raro', url: 'http://no-es-rtmps/algo' }) });
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(502);
    expect(t.facebook_vivos).toEqual([]);
    expect(llamadas).toContain('terminarVivo');
  });

  it('no se puede crear con el token de página que falta (la cuenta ya no ve la página): 502 facebook', async () => {
    const t = mundo();
    t.facebook_paginas = t.facebook_paginas.filter((p) => p.page_id !== 'pp');
    const { g, llamadas } = graphFalso();
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(502);
    expect(r.cuerpo).toMatchObject({ codigo: 'facebook' });
    expect(llamadas).toEqual([]);
  });
});

describe('crearVivo · errores de Graph', () => {
  it('token vencido (190): 503 reconectar y SOLO la conexión de esa parroquia queda «reconectar»', async () => {
    const t = mundo();
    const { g } = graphFalso({ crearVivo: async () => falla('token', 190) });
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(503);
    expect(r.cuerpo).toMatchObject({ codigo: 'reconectar' });
    expect(t.facebook_conexion.find((c) => c.parroquia_id === A)?.estado).toBe('reconectar');
    expect(t.facebook_conexion.find((c) => c.parroquia_id === B)?.estado).toBe('conectado');
    expect(t.facebook_vivos).toEqual([]);
  });

  it('requisitos: 422 requisitos', async () => {
    const t = mundo();
    const { g } = graphFalso({ crearVivo: async () => falla('requisitos', 200) });
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(422);
    expect(r.cuerpo).toMatchObject({ codigo: 'requisitos' });
    expect(t.facebook_conexion.find((c) => c.parroquia_id === A)?.estado).toBe('conectado');
  });

  it('otro error o red caída: 502 facebook, sin tocar la conexión', async () => {
    for (const tipo of ['otro', 'red'] as const) {
      const t = mundo();
      const { g } = graphFalso({ crearVivo: async () => falla(tipo) });
      const r = await crearVivo(deps(t, g), 'sa', entrada());
      expect(r.estado).toBe(502);
      expect(r.cuerpo).toMatchObject({ codigo: 'facebook' });
      expect(t.facebook_conexion.find((c) => c.parroquia_id === A)?.estado).toBe('conectado');
    }
  });
});

describe('crearVivo · ya hay un vivo activo', () => {
  it('sigue activo en Facebook: devuelve el mismo con reusado:true y arma servidor y clave de nuevo', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g, llamadas, tokens } = graphFalso({ urlDeVivo: async () => ok(urlDe('FB-OTRA-CLAVE')) });
    const r = await crearVivo(deps(t, g), 'sa', entrada(['e2']));
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({
      id: 'vivo-fila-1',
      servidor: SERVIDOR,
      clave: 'FB-OTRA-CLAVE',
      principal: { id: 'pp', nombre: 'Nombre pp' },
      extras: [{ id: 'e1', nombre: 'Nombre e1' }],
      reusado: true,
    });
    expect(llamadas).toEqual(['estadoVivo']); // urlDeVivo está reemplazado: la clave nueva en la respuesta lo prueba
    expect(tokens.every((x) => x === TOKEN_PAGINA)).toBe(true);
    expect(t.facebook_vivos).toHaveLength(1);
    expect(t.registro).toEqual([]);
  });

  it('terminó en Facebook: se marca terminado_en y se crea uno nuevo', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g, llamadas } = graphFalso({ estadoVivo: async () => ok<'activo' | 'terminado'>('terminado') });
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(200);
    expect((r.cuerpo as { reusado: boolean }).reusado).toBe(false);
    expect(t.facebook_vivos).toHaveLength(2);
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
    expect(t.facebook_vivos[1].terminado_en).toBeNull();
    expect(llamadas).toEqual(['crearVivo', 'activarCrosspost']);
  });

  it('estadoVivo falla (red): no bloquea y NO cierra el viejo (Ruling 14): se marca terminado y se crea uno nuevo', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g, llamadas } = graphFalso({ estadoVivo: async () => falla('red') });
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(200);
    expect((r.cuerpo as { reusado: boolean }).reusado).toBe(false);
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
    expect(t.facebook_vivos[1].terminado_en).toBeNull();
    expect(llamadas).toEqual(['crearVivo', 'activarCrosspost']);
    expect(llamadas).not.toContain('terminarVivo');
  });

  it('estadoVivo da «otro» (estado desconocido) o lanza: tampoco se llama a terminarVivo sobre el viejo', async () => {
    const lecturas = [async () => falla('otro'), async () => falla('token', 190), async () => { throw new Error('boom'); }];
    for (const lectura of lecturas) {
      const t = mundo();
      t.facebook_vivos.push(vivoActivo());
      const { g, llamadas } = graphFalso({ estadoVivo: lectura as never });
      await crearVivo(deps(t, g), 'sa', entrada());
      expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
      expect(llamadas).not.toContain('terminarVivo');
    }
  });

  it('ya no hay token de la página del viejo: se marca terminado y se crea uno nuevo (sin llamar a Facebook por el viejo)', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo({ page_id: 'pagina-que-ya-no-se-ve' }));
    const { g, llamadas } = graphFalso();
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(200);
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
    expect(llamadas).toEqual(['crearVivo', 'activarCrosspost']);
  });

  it('al preguntar por el activo el token venció: la fila vieja se marca terminada (sin end_live_video) y crear falla con 503 reconectar (esa parroquia queda «reconectar»)', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g } = graphFalso({ estadoVivo: async () => falla('token', 190), crearVivo: async () => falla('token', 190) });
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(503);
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
    expect(t.facebook_conexion.find((c) => c.parroquia_id === A)?.estado).toBe('reconectar');
    expect(t.facebook_conexion.find((c) => c.parroquia_id === B)?.estado).toBe('conectado');
  });

  it('el activo de OTRA parroquia no cuenta', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo({ id: 'de-b', parroquia_id: B, page_id: 'pb' }));
    const { g, llamadas } = graphFalso();
    const r = await crearVivo(deps(t, g), 'sa', entrada());
    expect(r.estado).toBe(200);
    expect(llamadas).toEqual(['crearVivo', 'activarCrosspost']);
  });

  it('choque del índice único (otro celular ganó): devuelve la fila ganadora, reusado:true, y cierra el vivo que sobró', async () => {
    const t = mundo();
    const { g, llamadas } = graphFalso({
      crearVivo: async () => {
        // Mientras este pedido esperaba a Facebook, el otro celular guardó su vivo.
        t.facebook_vivos.push(vivoActivo({ id: 'ganador', vivo_id: 'fb-ganador', extras: [] }));
        return ok({ vivoId: 'fb-perdedor', url: urlDe('FB-PERDEDOR') });
      },
      urlDeVivo: async () => ok(urlDe('FB-GANADOR')),
    });
    const r = await crearVivo(deps(t, g), 'sa', entrada(['e2']));
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toMatchObject({ id: 'ganador', clave: 'FB-GANADOR', reusado: true, extras: [] });
    expect(llamadas).toEqual(['terminarVivo']);
    expect(t.facebook_vivos).toHaveLength(1);
    expect(t.registro).toEqual([]);
  });
});

describe('estadoVivo', () => {
  async function conVivo(extras: string[], hechos: ResultadoGraph<string[]>) {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo({ extras }));
    const { g, llamadas, tokens } = graphFalso({ crosspostHechos: async () => hechos });
    return { t, g, llamadas, tokens };
  }

  it('marca salio según crosspostHechos', async () => {
    const { t, g, tokens } = await conVivo(['e1', 'e2'], ok(['e2']));
    const r = await estadoVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({
      estado: 'activo',
      extras: [
        { id: 'e1', nombre: 'Nombre e1', salio: false },
        { id: 'e2', nombre: 'Nombre e2', salio: true },
      ],
    });
    expect(tokens.every((x) => x === TOKEN_PAGINA)).toBe(true);
  });

  it('si crosspostHechos falla, ninguna sale, pero el estado se responde', async () => {
    const { t, g } = await conVivo(['e1'], falla('red'));
    const r = await estadoVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ estado: 'activo', extras: [{ id: 'e1', nombre: 'Nombre e1', salio: false }] });
  });

  it('si Facebook dice que terminó, lo marca terminado en la base', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g } = graphFalso({ estadoVivo: async () => ok<'activo' | 'terminado'>('terminado') });
    const r = await estadoVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect((r.cuerpo as { estado: string }).estado).toBe('terminado');
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
  });

  it('un vivo ya terminado se responde sin llamar a Facebook', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo({ terminado_en: hace(1000) }));
    const { g, llamadas } = graphFalso();
    const r = await estadoVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect((r.cuerpo as { estado: string }).estado).toBe('terminado');
    expect(llamadas).toEqual([]);
  });

  it('un vivo de otra parroquia o inventado: 404 (nunca se lee con otra parroquia)', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo({ id: 'de-b', parroquia_id: B, page_id: 'pb' }));
    const { g, llamadas } = graphFalso();
    expect((await estadoVivo(deps(t, g), 'sa', 'de-b')).estado).toBe(404);
    expect((await estadoVivo(deps(t, g), 'sa', 'inventado')).estado).toBe(404);
    expect(llamadas).toEqual([]);
  });

  it('token vencido: 503 reconectar y esa parroquia queda «reconectar»; otro error 502', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const r = await estadoVivo(deps(t, graphFalso({ estadoVivo: async () => falla('token', 190) }).g), 'sa', 'vivo-fila-1');
    expect(r.estado).toBe(503);
    expect(t.facebook_conexion.find((c) => c.parroquia_id === A)?.estado).toBe('reconectar');
    const r2 = await estadoVivo(deps(t, graphFalso({ estadoVivo: async () => falla('otro') }).g), 'sa', 'vivo-fila-1');
    expect(r2.estado).toBe(502);
  });

  it('sin sesión 401, otra parroquia 403', async () => {
    const t = mundo();
    expect((await estadoVivo(deps(t, graphFalso().g, null), 'sa', 'x')).estado).toBe(401);
    expect((await estadoVivo(deps(t, graphFalso().g), 'sb', 'x')).estado).toBe(403);
  });
});

describe('terminarVivo', () => {
  it('terminarVivo dos veces da 200 las dos veces; Facebook se llama una sola vez y se registra una sola vez', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g, llamadas, tokens } = graphFalso();
    const a = await terminarVivo(deps(t, g), 'sa', 'vivo-fila-1');
    const b = await terminarVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect([a.estado, b.estado]).toEqual([200, 200]);
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
    expect(llamadas).toEqual(['terminarVivo']);
    expect(tokens).toEqual([TOKEN_PAGINA]);
    expect(t.registro).toHaveLength(1);
    expect(t.registro[0]).toMatchObject({ parroquia_id: A, accion: 'terminar_vivo_facebook', detalle: { slug: 'sa', pagina: 'pp', extras: ['e1'] } });
    expect(JSON.stringify(t.registro)).not.toContain(TOKEN_PAGINA);
  });

  it('Facebook falla: 502 y el vivo sigue activo para poder reintentar', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g } = graphFalso({ terminarVivo: async () => falla('otro') });
    const r = await terminarVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect(r.estado).toBe(502);
    expect(t.facebook_vivos[0].terminado_en).toBeNull();
    expect(t.registro).toEqual([]);
  });

  it('Facebook falla pero el vivo ya había terminado allá: 200 y queda terminado', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g } = graphFalso({ terminarVivo: async () => falla('otro'), estadoVivo: async () => ok<'activo' | 'terminado'>('terminado') });
    const r = await terminarVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect(r.estado).toBe(200);
    expect(t.facebook_vivos[0].terminado_en).not.toBeNull();
  });

  it('token vencido: 503 reconectar y esa parroquia queda «reconectar»', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo());
    const { g } = graphFalso({ terminarVivo: async () => falla('token', 190) });
    const r = await terminarVivo(deps(t, g), 'sa', 'vivo-fila-1');
    expect(r.estado).toBe(503);
    expect(t.facebook_conexion.find((c) => c.parroquia_id === A)?.estado).toBe('reconectar');
    expect(t.facebook_conexion.find((c) => c.parroquia_id === B)?.estado).toBe('conectado');
  });

  it('un vivo de otra parroquia o inventado: 404 y no se llama a Facebook', async () => {
    const t = mundo();
    t.facebook_vivos.push(vivoActivo({ id: 'de-b', parroquia_id: B, page_id: 'pb' }));
    const { g, llamadas } = graphFalso();
    expect((await terminarVivo(deps(t, g), 'sa', 'de-b')).estado).toBe(404);
    expect((await terminarVivo(deps(t, g), 'sa', 'inventado')).estado).toBe(404);
    expect(llamadas).toEqual([]);
    expect(t.facebook_vivos[0].terminado_en).toBeNull();
  });

  it('sin sesión 401, otra parroquia 403', async () => {
    const t = mundo();
    expect((await terminarVivo(deps(t, graphFalso().g, null), 'sa', 'x')).estado).toBe(401);
    expect((await terminarVivo(deps(t, graphFalso().g), 'sb', 'x')).estado).toBe(403);
  });
});
