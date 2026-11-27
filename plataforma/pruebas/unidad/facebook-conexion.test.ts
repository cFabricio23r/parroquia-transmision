import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  comprobarEstado,
  desconectar,
  esNoInvitada,
  guardarConexion,
  leerConexion,
  marcarReconectar,
  nuevoEstado,
  PERMISOS_FACEBOOK,
  procesarVuelta,
  SENALES_NO_INVITADA,
  urlDialogo,
  urlVolver,
} from '../../lib/facebook/conexion';
import type { GraphFacebook, PaginaGraph, ResultadoGraph } from '../../lib/facebook/graph';
import { MENSAJE_SIN_PERMISO } from '../../lib/borrador';

afterEach(() => vi.restoreAllMocks());

// ---- Supabase en memoria (solo lo que usa la lib) ----
type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;
const PK: Record<string, string[]> = {
  facebook_conexion: ['parroquia_id'],
  facebook_paginas: ['parroquia_id', 'page_id'],
};

class Consulta implements PromiseLike<{ data: unknown; error: null }> {
  private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private filtros: Array<(f: Fila) => boolean> = [];
  private carga: Fila | Fila[] | null = null;
  private onConflict: string[] | null = null;
  constructor(
    private tablas: Tablas,
    private tabla: string,
  ) {}
  select() {
    return this;
  }
  insert(c: Fila | Fila[]) {
    this.op = 'insert';
    this.carga = c;
    return this;
  }
  upsert(c: Fila | Fila[], o?: { onConflict?: string }) {
    this.op = 'upsert';
    this.carga = c;
    this.onConflict = o?.onConflict ? o.onConflict.split(',').map((s) => s.trim()) : null;
    return this;
  }
  update(c: Fila) {
    this.op = 'update';
    this.carga = c;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filtros.push((f) => f[c] !== v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filtros.push((f) => vs.includes(f[c]));
    return this;
  }
  private correr(): Fila[] {
    const filas = (this.tablas[this.tabla] ??= []);
    const cumple = (f: Fila) => this.filtros.every((p) => p(f));
    if (this.op === 'select') return filas.filter(cumple).map((f) => ({ ...f }));
    if (this.op === 'insert') {
      const nuevas = ([] as Fila[]).concat(this.carga as Fila | Fila[]).map((f) => ({ ...f }));
      filas.push(...nuevas);
      return nuevas;
    }
    if (this.op === 'upsert') {
      const claves = this.onConflict ?? PK[this.tabla] ?? [];
      for (const n of ([] as Fila[]).concat(this.carga as Fila | Fila[])) {
        const i = filas.findIndex((f) => claves.every((k) => f[k] === n[k]));
        if (i >= 0) filas[i] = { ...filas[i], ...n };
        else filas.push({ ...n });
      }
      return [];
    }
    if (this.op === 'update') {
      for (const f of filas.filter(cumple)) Object.assign(f, this.carga);
      return [];
    }
    this.tablas[this.tabla] = filas.filter((f) => !cumple(f));
    return [];
  }
  maybeSingle() {
    const r = this.correr();
    return Promise.resolve({ data: r[0] ?? null, error: null });
  }
  single() {
    return this.maybeSingle();
  }
  then<A, B>(
    ok?: ((v: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ) {
    return Promise.resolve({ data: this.correr(), error: null }).then(ok, ko);
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
const TOKEN_USUARIO = 'TOK-USUARIO-LARGO-SECRETO';
const TOKEN_PAGINA = 'TOK-PAGINA-SECRETO';

function mundo(visibles: string[] = [A]) {
  const tablas: Tablas = {
    parroquias: [
      { id: A, slug: 'sa', nombre: 'Parroquia A' },
      { id: B, slug: 'sb', nombre: 'Parroquia B' },
    ].filter((p) => visibles.includes(p.id)),
    facebook_conexion: [],
    facebook_paginas: [],
    facebook_parroquia: [],
    facebook_parroquia_extra: [],
    registro: [],
  };
  return tablas;
}

function graphFalso(opciones: { paginas?: PaginaGraph[]; falla?: 'codigo' | 'alargar' | 'yo' | 'paginas' } = {}) {
  const paginas = opciones.paginas ?? [
    { id: 'p1', nombre: 'Página Uno', token: TOKEN_PAGINA, seguidores: 120 },
    { id: 'p2', nombre: 'Página Dos', token: TOKEN_PAGINA + '2', seguidores: null },
  ];
  const mal: ResultadoGraph<never> = { ok: false, error: { tipo: 'otro' } };
  const llamadas: string[] = [];
  const g = {
    cambiarCodigo: async (codigo: string, redirect: string) => {
      llamadas.push(`codigo:${codigo}:${redirect}`);
      return opciones.falla === 'codigo' ? mal : { ok: true as const, valor: 'TOK-CORTO' };
    },
    alargar: async () => (opciones.falla === 'alargar' ? mal : { ok: true as const, valor: TOKEN_USUARIO }),
    yo: async () => (opciones.falla === 'yo' ? mal : { ok: true as const, valor: { id: 'u1', nombre: 'Ana Coordinadora' } }),
    paginas: async () => (opciones.falla === 'paginas' ? mal : { ok: true as const, valor: paginas }),
  } as unknown as GraphFacebook;
  return { g, llamadas };
}

function deps(tablas: Tablas, g: GraphFacebook, usuario: { id: string } | null = { id: 'u-coord' }) {
  const sesion = cliente(tablas, usuario);
  return { sesion, servicio: cliente(tablas, null), graph: g, llave: LLAVE };
}

const REDIRECT = 'https://plataforma.example/editor/facebook/volver';

describe('acceso', () => {
  it('un coordinador de otra parroquia recibe 403 y no se llama a Facebook', async () => {
    const t = mundo([A]); // no ve la B
    const { g, llamadas } = graphFalso();
    const r = await guardarConexion(deps(t, g), 'sb', 'COD', REDIRECT);
    expect(r.estado).toBe(403);
    expect((r.cuerpo as { error: string }).error).toBe(MENSAJE_SIN_PERMISO);
    expect(llamadas).toEqual([]);
    expect(t.facebook_conexion).toEqual([]);
    const l = await leerConexion(deps(t, g), 'sb');
    expect(l.estado).toBe(403);
    const x = await desconectar(deps(t, g), 'sb');
    expect(x.estado).toBe(403);
  });
  it('sin sesión es 401', async () => {
    const r = await guardarConexion(deps(mundo(), graphFalso().g, null), 'sa', 'COD', REDIRECT);
    expect(r.estado).toBe(401);
  });
  it('un admin (ve todas las parroquias) puede conectar la B', async () => {
    const t = mundo([A, B]);
    const r = await guardarConexion(deps(t, graphFalso().g, { id: 'u-admin' }), 'sb', 'COD', REDIRECT);
    expect(r.estado).toBe(200);
    expect(t.facebook_conexion.map((f) => f.parroquia_id)).toEqual([B]);
  });
});

describe('guardarConexion', () => {
  it('guarda la conexión y las páginas de esa parroquia, con los tokens cifrados', async () => {
    const t = mundo();
    const { g, llamadas } = graphFalso();
    const r = await guardarConexion(deps(t, g), 'sa', 'COD-SECRETO', REDIRECT);
    expect(r.estado).toBe(200);
    expect(llamadas).toEqual([`codigo:COD-SECRETO:${REDIRECT}`]);
    expect(t.facebook_conexion).toHaveLength(1);
    const c = t.facebook_conexion[0];
    expect(c).toMatchObject({ parroquia_id: A, nombre_facebook: 'Ana Coordinadora', estado: 'conectado', conectado_por: 'u-coord' });
    expect(String(c.token_usuario).startsWith('v1.')).toBe(true);
    expect(JSON.stringify(c)).not.toContain(TOKEN_USUARIO);
    expect(t.facebook_paginas).toHaveLength(2);
    for (const p of t.facebook_paginas) {
      expect(String(p.token).startsWith('v1.')).toBe(true);
      expect(JSON.stringify(p)).not.toContain('TOK-PAGINA');
    }
  });

  it('si Facebook falla en cualquier paso no se escribe nada', async () => {
    for (const falla of ['codigo', 'alargar', 'yo', 'paginas'] as const) {
      const t = mundo();
      const r = await guardarConexion(deps(t, graphFalso({ falla }).g), 'sa', 'COD', REDIRECT);
      expect(r.estado).not.toBe(200);
      expect(t.facebook_conexion).toEqual([]);
      expect(t.facebook_paginas).toEqual([]);
      expect(t.registro).toEqual([]);
    }
  });

  it('conectar la A no cambia ni borra nada de la B, aunque vean la misma página', async () => {
    const t = mundo([A, B]);
    t.facebook_conexion.push({ parroquia_id: B, nombre_facebook: 'Otro', token_usuario: 'v1.b', estado: 'reconectar', conectado_por: null, conectado_en: 'x' });
    t.facebook_paginas.push({ parroquia_id: B, page_id: 'p1', nombre: 'Vieja', seguidores: 5, token: 'v1.tb' });
    t.facebook_parroquia.push({ parroquia_id: B, pagina_principal: 'p1' });
    const antes = JSON.stringify([t.facebook_conexion[0], t.facebook_paginas[0], t.facebook_parroquia]);
    const r = await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD', REDIRECT);
    expect(r.estado).toBe(200);
    expect(JSON.stringify([t.facebook_conexion.find((f) => f.parroquia_id === B), t.facebook_paginas.find((f) => f.parroquia_id === B), t.facebook_parroquia])).toBe(antes);
    expect(t.facebook_paginas.filter((p) => p.parroquia_id === A)).toHaveLength(2);
  });

  it('al volver a conectar reemplaza sus páginas, no toca las elegidas, y conectado queda en pie', async () => {
    const t = mundo();
    t.facebook_conexion.push({ parroquia_id: A, nombre_facebook: 'Viejo', token_usuario: 'v1.x', estado: 'reconectar', conectado_por: null, conectado_en: 'x' });
    t.facebook_paginas.push({ parroquia_id: A, page_id: 'pvieja', nombre: 'Ya no', seguidores: 1, token: 'v1.t' });
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'pvieja' });
    t.facebook_parroquia_extra.push({ parroquia_id: A, page_id: 'pvieja', por_defecto: false, crosspost: 'listo' });
    const r = await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD', REDIRECT);
    expect(r.estado).toBe(200);
    expect(t.facebook_conexion).toHaveLength(1);
    expect(t.facebook_conexion[0]).toMatchObject({ nombre_facebook: 'Ana Coordinadora', estado: 'conectado' });
    expect(t.facebook_paginas.map((p) => p.page_id).sort()).toEqual(['p1', 'p2']);
    expect(t.facebook_parroquia).toEqual([{ parroquia_id: A, pagina_principal: 'pvieja' }]);
    expect(t.facebook_parroquia_extra).toHaveLength(1);
  });

  it('registra conectar_facebook sin tokens ni código', async () => {
    const t = mundo();
    await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD-SECRETO', REDIRECT);
    expect(t.registro).toHaveLength(1);
    expect(t.registro[0]).toMatchObject({ parroquia_id: A, usuario_id: 'u-coord', accion: 'conectar_facebook' });
    const s = JSON.stringify(t.registro);
    for (const secreto of [TOKEN_USUARIO, 'TOK-PAGINA', 'TOK-CORTO', 'COD-SECRETO', 'v1.']) expect(s).not.toContain(secreto);
  });

  it('no escribe tokens ni códigos en la consola', async () => {
    const espiar = [vi.spyOn(console, 'error'), vi.spyOn(console, 'log'), vi.spyOn(console, 'warn')];
    await guardarConexion(deps(mundo(), graphFalso({ falla: 'alargar' }).g), 'sa', 'COD-SECRETO', REDIRECT);
    await guardarConexion(deps(mundo(), graphFalso().g), 'sa', 'COD-SECRETO', REDIRECT);
    const todo = JSON.stringify(espiar.flatMap((e) => e.mock.calls));
    for (const secreto of [TOKEN_USUARIO, 'TOK-PAGINA', 'TOK-CORTO', 'COD-SECRETO']) expect(todo).not.toContain(secreto);
  });
});

function recorrerClaves(v: unknown, claves: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => recorrerClaves(x, claves));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      claves.push(k);
      recorrerClaves(x, claves);
    }
  }
  return claves;
}

describe('leerConexion', () => {
  it('sin conexión: sin-conectar', async () => {
    const r = await leerConexion(deps(mundo(), graphFalso().g), 'sa');
    expect(r).toEqual({ estado: 200, cuerpo: { estado: 'sin-conectar', nombre: null, conectadoEn: null, paginas: [] } });
  });

  it('la vista nunca tiene una propiedad ni un valor con token', async () => {
    const t = mundo();
    await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD', REDIRECT);
    const r = await leerConexion(deps(t, graphFalso().g), 'sa');
    expect(r.estado).toBe(200);
    const claves = recorrerClaves(r.cuerpo);
    expect(claves.filter((k) => /token|secret|clave/i.test(k))).toEqual([]);
    const texto = JSON.stringify(r.cuerpo);
    for (const secreto of [TOKEN_USUARIO, 'TOK-PAGINA', 'v1.']) expect(texto).not.toContain(secreto);
    expect(r.cuerpo).toMatchObject({ estado: 'conectado', nombre: 'Ana Coordinadora' });
  });

  it('uso: Principal, Extra, Principal de otra parroquia y null; nunca nombra a la otra', async () => {
    const t = mundo([A, B]);
    const { g } = graphFalso({
      paginas: ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, nombre: `Pág ${id}`, token: 't', seguidores: 1 })),
    });
    await guardarConexion(deps(t, g), 'sa', 'COD', REDIRECT);
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p1' }, { parroquia_id: B, pagina_principal: 'p3' });
    t.facebook_parroquia_extra.push({ parroquia_id: A, page_id: 'p2', por_defecto: false, crosspost: 'falta' });
    const r = await leerConexion(deps(t, g), 'sa');
    const usos = Object.fromEntries((r.cuerpo as { paginas: { id: string; uso: string | null }[] }).paginas.map((p) => [p.id, p.uso]));
    expect(usos).toEqual({ p1: 'Principal', p2: 'Extra', p3: 'Principal de otra parroquia', p4: null });
    expect(JSON.stringify(r.cuerpo)).not.toContain('Parroquia B');
    expect(JSON.stringify(r.cuerpo)).not.toContain(B);
  });

  it('reconectar se refleja en estado', async () => {
    const t = mundo();
    await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD', REDIRECT);
    await marcarReconectar(cliente(t, null), A);
    const r = await leerConexion(deps(t, graphFalso().g), 'sa');
    expect((r.cuerpo as { estado: string }).estado).toBe('reconectar');
  });
});

describe('desconectar y marcarReconectar', () => {
  it('borra la conexión y las páginas de esa parroquia y deja sus elegidas y a la otra parroquia', async () => {
    const t = mundo([A, B]);
    await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD', REDIRECT);
    await guardarConexion(deps(t, graphFalso().g), 'sb', 'COD', REDIRECT);
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p1' });
    const r = await desconectar(deps(t, graphFalso().g), 'sa');
    expect(r.estado).toBe(200);
    expect(t.facebook_conexion.map((c) => c.parroquia_id)).toEqual([B]);
    expect(t.facebook_paginas.every((p) => p.parroquia_id === B)).toBe(true);
    expect(t.facebook_parroquia).toHaveLength(1);
    const reg = t.registro.find((x) => x.accion === 'desconectar_facebook');
    expect(reg).toMatchObject({ parroquia_id: A, usuario_id: 'u-coord' });
    expect(JSON.stringify(reg)).not.toContain('v1.');
  });

  it('marcarReconectar solo toca esa parroquia', async () => {
    const t = mundo([A, B]);
    await guardarConexion(deps(t, graphFalso().g), 'sa', 'COD', REDIRECT);
    await guardarConexion(deps(t, graphFalso().g), 'sb', 'COD', REDIRECT);
    await marcarReconectar(cliente(t, null), A);
    expect(t.facebook_conexion.map((c) => [c.parroquia_id, c.estado])).toEqual([
      [A, 'reconectar'],
      [B, 'conectado'],
    ]);
  });
});

describe('state de la cookie', () => {
  it('son 32 bytes aleatorios y la cookie lleva también el slug', () => {
    const a = nuevoEstado('sa');
    const b = nuevoEstado('sa');
    expect(Buffer.from(a.estado, 'base64url')).toHaveLength(32);
    expect(a.estado).not.toBe(b.estado);
    expect(a.cookie).toBe(`${a.estado}.sa`);
  });
  it('coincide solo si es el mismo; devuelve el slug', () => {
    const a = nuevoEstado('mi-slug');
    expect(comprobarEstado(a.cookie, a.estado)).toBe('mi-slug');
    expect(comprobarEstado(a.cookie, nuevoEstado('mi-slug').estado)).toBeNull();
    expect(comprobarEstado(a.cookie, null)).toBeNull();
    expect(comprobarEstado(undefined, a.estado)).toBeNull();
    expect(comprobarEstado('sin-punto', 'sin-punto')).toBeNull();
    expect(comprobarEstado(a.cookie, a.estado + 'x')).toBeNull();
  });
});

describe('urlDialogo', () => {
  const env = { FACEBOOK_APP_ID: '123', FACEBOOK_VERSION_GRAPH: 'v99.0' };
  it('usa scope con los permisos y la versión configurada', () => {
    const u = new URL(urlDialogo('EST', REDIRECT, env));
    expect(u.pathname.startsWith('/v99.0/')).toBe(true);
    expect(u.searchParams.get('client_id')).toBe('123');
    expect(u.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(u.searchParams.get('state')).toBe('EST');
    expect(u.searchParams.get('scope')).toBe(PERMISOS_FACEBOOK.join(','));
    expect(u.searchParams.get('config_id')).toBeNull();
  });
  it('con FACEBOOK_CONFIG_ID manda config_id en vez de scope', () => {
    const u = new URL(urlDialogo('EST', REDIRECT, { ...env, FACEBOOK_CONFIG_ID: 'cfg' }));
    expect(u.searchParams.get('config_id')).toBe('cfg');
    expect(u.searchParams.get('scope')).toBeNull();
  });
  it('lista los permisos de las restricciones globales', () => {
    expect([...PERMISOS_FACEBOOK]).toEqual([
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_read_user_content',
      'pages_manage_engagement',
      'publish_video',
    ]);
  });
  it('urlVolver apunta a la única dirección de vuelta', () => {
    expect(urlVolver('https://x.example')).toBe('https://x.example/editor/facebook/volver');
  });
});

describe('esNoInvitada', () => {
  it('con las señales vacías (Tarea 0 pendiente) nunca es true', () => {
    expect(SENALES_NO_INVITADA).toEqual([]);
    expect(esNoInvitada(new URLSearchParams('error=access_denied&error_code=1'))).toBe(false);
  });
  it('con señales inyectadas detecta el campo y el valor', () => {
    const senales = [{ campo: 'error_code', valor: '200' }];
    expect(esNoInvitada(new URLSearchParams('error=x&error_code=200'), senales)).toBe(true);
    expect(esNoInvitada(new URLSearchParams('error=x&error_code=1'), senales)).toBe(false);
    expect(esNoInvitada(new URLSearchParams('error=x'), senales)).toBe(false);
  });
  // PENDIENTE TAREA 0 (Paso 2b): qué devuelve Facebook a una cuenta sin invitar
  it.todo('la señal real de una cuenta sin invitar (Tarea 0, Paso 2b)');
});

describe('procesarVuelta', () => {
  const ok = nuevoEstado('sa');
  const params = (s: string) => new URLSearchParams(s);

  it('state que no coincide o sin cookie: 400 y no se guarda nada', async () => {
    const t = mundo();
    const d = deps(t, graphFalso().g);
    for (const cookie of [undefined, nuevoEstado('sa').cookie, 'basura']) {
      const r = await procesarVuelta(d, { params: params(`code=C&state=${ok.estado}`), cookie, redirect: REDIRECT });
      expect(r).toEqual({ estado: 400 });
    }
    const sinState = await procesarVuelta(d, { params: params('code=C'), cookie: ok.cookie, redirect: REDIRECT });
    expect(sinState).toEqual({ estado: 400 });
    expect(t.facebook_conexion).toEqual([]);
  });

  it('conecta la parroquia del slug de la cookie y redirige a elegir páginas', async () => {
    const t = mundo([A, B]);
    const e = nuevoEstado('sb');
    const r = await procesarVuelta(deps(t, graphFalso().g), { params: params(`code=C&state=${e.estado}`), cookie: e.cookie, redirect: REDIRECT });
    expect(r).toEqual({ estado: 302, ubicacion: '/editor/p/sb/app-y-transmision/facebook?listo=1' });
    expect(t.facebook_conexion.map((c) => c.parroquia_id)).toEqual([B]);
  });

  it('cuenta no invitada: ?error=no-invitada y nada guardado', async () => {
    const t = mundo();
    const r = await procesarVuelta(
      deps(t, graphFalso().g),
      { params: params(`error=x&error_code=200&state=${ok.estado}`), cookie: ok.cookie, redirect: REDIRECT },
      [{ campo: 'error_code', valor: '200' }],
    );
    expect(r).toEqual({ estado: 302, ubicacion: '/editor/p/sa/app-y-transmision?error=no-invitada' });
    expect(t.facebook_conexion).toEqual([]);
    expect(t.facebook_paginas).toEqual([]);
  });

  it('otro error de Facebook, sin código o intercambio fallido: ?error=1 y nada guardado', async () => {
    for (const q of [`error=access_denied&state=${ok.estado}`, `state=${ok.estado}`]) {
      const t = mundo();
      const r = await procesarVuelta(deps(t, graphFalso().g), { params: params(q), cookie: ok.cookie, redirect: REDIRECT });
      expect(r).toEqual({ estado: 302, ubicacion: '/editor/p/sa/app-y-transmision?error=1' });
      expect(t.facebook_conexion).toEqual([]);
    }
    const t = mundo();
    const r = await procesarVuelta(deps(t, graphFalso({ falla: 'codigo' }).g), { params: params(`code=C&state=${ok.estado}`), cookie: ok.cookie, redirect: REDIRECT });
    expect(r).toEqual({ estado: 302, ubicacion: '/editor/p/sa/app-y-transmision?error=1' });
    expect(t.facebook_conexion).toEqual([]);
  });

  it('con las señales vacías una cuenta sin invitar cae en ?error=1 (seguro)', async () => {
    const r = await procesarVuelta(deps(mundo(), graphFalso().g), {
      params: params(`error=x&error_code=200&state=${ok.estado}`),
      cookie: ok.cookie,
      redirect: REDIRECT,
    });
    expect(r).toEqual({ estado: 302, ubicacion: '/editor/p/sa/app-y-transmision?error=1' });
  });

  it('un coordinador sin permiso sobre el slug de la cookie: error=1 y nada guardado', async () => {
    const t = mundo([B]); // no ve la A
    const r = await procesarVuelta(deps(t, graphFalso().g), { params: params(`code=C&state=${ok.estado}`), cookie: ok.cookie, redirect: REDIRECT });
    expect(r).toEqual({ estado: 302, ubicacion: '/editor/p/sa/app-y-transmision?error=1' });
    expect(t.facebook_conexion).toEqual([]);
  });
});
