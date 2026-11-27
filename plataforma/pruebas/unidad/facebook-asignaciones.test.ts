import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardarAsignacion, leerAsignacion, leerEstadosFacebook } from '../../lib/facebook/asignaciones';
import { cifrar } from '../../lib/facebook/cifrado';
import type { GraphFacebook, ResultadoGraph } from '../../lib/facebook/graph';
import { MENSAJE_SIN_PERMISO } from '../../lib/borrador';
import { MENSAJE_SOLO_ADMIN } from '../../lib/admin';
import { sinChipBorrador } from '../../lib/editor/secciones';
import { celdaFacebook } from '../../lib/facebook/columna';
import { graphDeEntorno } from '../../lib/facebook/graph-entorno';

afterEach(() => {
  vi.restoreAllMocks();
  fallas.clear();
});

// ---- Supabase en memoria (solo lo que usa la lib) ----
type Fila = Record<string, unknown>;
type Tablas = Record<string, Fila[]>;
const PK: Record<string, string[]> = {
  facebook_conexion: ['parroquia_id'],
  facebook_paginas: ['parroquia_id', 'page_id'],
  facebook_parroquia: ['parroquia_id'],
  facebook_parroquia_extra: ['parroquia_id', 'page_id'],
};
// facebook_parroquia.pagina_principal es unique en la base: el fake lo hace cumplir (error 23505).
const UNICAS: Record<string, string[]> = { facebook_parroquia: ['pagina_principal'] };

const fallas = new Set<string>();

class Consulta implements PromiseLike<{ data: unknown; error: unknown }> {
  private op: 'select' | 'upsert' | 'update' | 'delete' | 'insert' = 'select';
  private filtros: Array<(f: Fila) => boolean> = [];
  private carga: Fila | Fila[] | null = null;
  private onConflict: string[] | null = null;
  private error: unknown = null;
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
      filas.push(...([] as Fila[]).concat(this.carga as Fila | Fila[]).map((f) => ({ ...f })));
      return [];
    }
    if (this.op === 'upsert') {
      const claves = this.onConflict ?? PK[this.tabla] ?? [];
      for (const n of ([] as Fila[]).concat(this.carga as Fila | Fila[])) {
        const i = filas.findIndex((f) => claves.every((k) => f[k] === n[k]));
        for (const u of UNICAS[this.tabla] ?? []) {
          if (filas.some((f, j) => j !== i && f[u] === n[u])) {
            this.error = { code: '23505', message: 'duplicate key' };
            return [];
          }
        }
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
    ok?: ((v: { data: unknown; error: unknown }) => A | PromiseLike<A>) | null,
    ko?: ((e: unknown) => B | PromiseLike<B>) | null,
  ) {
    if (fallas.has(`${this.tabla}:${this.op}`)) return Promise.resolve({ data: null, error: { message: 'x' } }).then(ok, ko);
    const data = this.correr();
    return Promise.resolve({ data: this.error ? null : data, error: this.error }).then(ok, ko);
  }
}

function cliente(tablas: Tablas, usuario: { id: string } | null, esAdmin = false): SupabaseClient {
  return {
    auth: { getUser: async () => ({ data: { user: usuario } }) },
    rpc: async () => ({ data: esAdmin }),
    from: (t: string) => new Consulta(tablas, t),
  } as unknown as SupabaseClient;
}

const A = 'id-parroquia-a';
const B = 'id-parroquia-b';
const LLAVE = Buffer.alloc(32, 9);
const tokenDe = (parroquia: string, pagina: string) => `TOK-${parroquia}-${pagina}`;

/** La A ve p1..p5 (p1 con 50 seguidores); la B ve p1 y p9. Tokens cifrados como los guarda la Tarea 4. */
function mundo(visibles: string[] = [A]) {
  const pag = (parroquia: string, id: string, seguidores: number | null = 500) => ({
    parroquia_id: parroquia,
    page_id: id,
    nombre: `Nombre ${id}`,
    seguidores,
    token: cifrar(tokenDe(parroquia, id), LLAVE),
  });
  const tablas: Tablas = {
    parroquias: [
      { id: A, slug: 'sa', nombre: 'Parroquia A' },
      { id: B, slug: 'sb', nombre: 'Parroquia B' },
    ].filter((p) => visibles.includes(p.id)),
    facebook_conexion: [
      { parroquia_id: A, nombre_facebook: 'Cuenta A', token_usuario: 'v1.u', estado: 'conectado', conectado_en: 'x' },
      { parroquia_id: B, nombre_facebook: 'Cuenta B', token_usuario: 'v1.u', estado: 'conectado', conectado_en: 'x' },
    ],
    facebook_paginas: [pag(A, 'p1', 50), pag(A, 'p2'), pag(A, 'p3'), pag(A, 'p4'), pag(A, 'p5'), pag(B, 'p1', 50), pag(B, 'p9')],
    facebook_parroquia: [],
    facebook_parroquia_extra: [],
    registro: [],
    administradores: [],
  };
  return tablas;
}

type Llamada = string;
function graphFalso(
  opciones: {
    handshake?: (o: { id: string; token: string }, d: { id: string; token: string }) => ResultadoGraph<void> | 'lanza';
    permite?: (destinoId: string) => ResultadoGraph<boolean> | 'lanza';
  } = {},
) {
  const llamadas: Llamada[] = [];
  const tokens: string[] = [];
  const g = {
    handshake: async (o: { id: string; token: string }, d: { id: string; token: string }) => {
      llamadas.push(`handshake:${o.id}>${d.id}`);
      tokens.push(o.token, d.token);
      const r = opciones.handshake?.(o, d) ?? { ok: true as const, valor: undefined };
      if (r === 'lanza') throw new Error('boom');
      return r;
    },
    permiteLive: async (o: { id: string; token: string }, destinoId: string) => {
      llamadas.push(`permite:${o.id}>${destinoId}`);
      tokens.push(o.token);
      const r = opciones.permite?.(destinoId) ?? { ok: true as const, valor: true };
      if (r === 'lanza') throw new Error('boom');
      return r;
    },
  } as unknown as GraphFacebook;
  return { g, llamadas, tokens };
}

function deps(tablas: Tablas, g: GraphFacebook, usuario: { id: string } | null = { id: 'u-coord' }) {
  return { sesion: cliente(tablas, usuario), servicio: cliente(tablas, null), graph: g, llave: LLAVE };
}

const MENSAJE_OTRA = 'Esa página ya es la principal de otra parroquia.';
const extra = (pageId: string, porDefecto = false) => ({ pageId, porDefecto });

describe('guardarAsignacion · acceso', () => {
  it('un coordinador de otra parroquia recibe 403, sin llamar a Facebook y sin escribir', async () => {
    const t = mundo([A]); // no ve la B
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sb', { principal: 'p9', extras: [extra('p1')] });
    expect(r.estado).toBe(403);
    expect((r.cuerpo as { error: string }).error).toBe(MENSAJE_SIN_PERMISO);
    expect(llamadas).toEqual([]);
    expect(t.facebook_parroquia).toEqual([]);
    expect(t.facebook_parroquia_extra).toEqual([]);
  });
  it('sin sesión es 401', async () => {
    const r = await guardarAsignacion(deps(mundo(), graphFalso().g, null), 'sa', { principal: 'p1', extras: [] });
    expect(r.estado).toBe(401);
  });
});

describe('guardarAsignacion · validación', () => {
  it('una principal que no está en las páginas de esa parroquia da 422, aunque esté en las de otra', async () => {
    const t = mundo([A, B]);
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p9', extras: [] }); // p9 es de la B
    expect(r.estado).toBe(422);
    expect(llamadas).toEqual([]);
    expect(t.facebook_parroquia).toEqual([]);
  });
  it('una extra que no está en las páginas de esa parroquia da 422 y no se crea nada', async () => {
    const t = mundo([A, B]);
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p2', extras: [extra('p3'), extra('p9')] });
    expect(r.estado).toBe(422);
    expect(llamadas).toEqual([]);
    expect(t.facebook_parroquia).toEqual([]);
    expect(t.facebook_parroquia_extra).toEqual([]);
  });
  it('una extra igual a la principal da 422', async () => {
    const t = mundo();
    const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: [extra('p2')] });
    expect(r.estado).toBe(422);
    expect(t.facebook_parroquia).toEqual([]);
  });
  it('más de 20 extras da 422', async () => {
    const t = mundo();
    for (let i = 0; i < 25; i++) t.facebook_paginas.push({ parroquia_id: A, page_id: `x${i}`, nombre: `X${i}`, seguidores: 1, token: cifrar('t', LLAVE) });
    const veintiuna = Array.from({ length: 21 }, (_, i) => extra(`x${i}`));
    const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: veintiuna });
    expect(r.estado).toBe(422);
    expect(t.facebook_parroquia).toEqual([]);
    const veinte = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: veintiuna.slice(0, 20) });
    expect(veinte.estado).toBe(200);
  });
  it('una forma inválida da 422', async () => {
    const t = mundo();
    for (const mala of [
      null,
      'texto',
      {},
      { principal: '', extras: [] },
      { principal: 5, extras: [] },
      { principal: 'p2' },
      { principal: 'p2', extras: 'p3' },
      { principal: 'p2', extras: [{ pageId: 'p3' }] },
      { principal: 'p2', extras: [{ pageId: 'p3', porDefecto: 'si' }] },
      { principal: 'p2', extras: [extra('p3'), extra('p3')] },
    ]) {
      const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', mala);
      expect(r.estado, JSON.stringify(mala)).toBe(422);
    }
    expect(t.facebook_parroquia).toEqual([]);
  });
  it('si no hay conexión (sin páginas) la principal no se puede elegir: 422', async () => {
    const t = mundo();
    t.facebook_paginas = [];
    const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: [] });
    expect(r.estado).toBe(422);
  });
});

describe('guardarAsignacion · principal de otra parroquia', () => {
  it('una principal que ya es la principal de otra parroquia da 422 con el texto exacto, sin nombrarla', async () => {
    const t = mundo([A, B]);
    t.facebook_parroquia.push({ parroquia_id: B, pagina_principal: 'p1' });
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p1', extras: [extra('p2')] });
    expect(r.estado).toBe(422);
    expect((r.cuerpo as { error: string }).error).toBe(MENSAJE_OTRA);
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/Parroquia B|sb|id-parroquia-b/);
    expect(llamadas).toEqual([]);
    expect(t.facebook_parroquia).toEqual([{ parroquia_id: B, pagina_principal: 'p1' }]);
    expect(t.facebook_parroquia_extra).toEqual([]);
  });
  it('si la base rechaza la principal por única (otra parroquia ganó la carrera), también es 422 con ese texto', async () => {
    const t = mundo([A, B]);
    // La lectura previa no la ve (carrera): la fila de la B aparece recién al escribir.
    const original = Consulta.prototype.neq;
    let primera = true;
    vi.spyOn(Consulta.prototype, 'neq').mockImplementation(function (this: Consulta, c: string, v: unknown) {
      if (primera) {
        primera = false;
        t.facebook_parroquia.push({ parroquia_id: B, pagina_principal: 'p2' });
        return this.eq('parroquia_id', '__nadie__');
      }
      return original.call(this, c, v);
    });
    const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: [] });
    expect(r.estado).toBe(422);
    expect((r.cuerpo as { error: string }).error).toBe(MENSAJE_OTRA);
  });
  it('la misma página puede ser extra de las dos parroquias, y cada una hace su handshake con su token', async () => {
    const t = mundo([A, B]);
    t.facebook_parroquia.push({ parroquia_id: B, pagina_principal: 'p9' });
    const a = graphFalso();
    const ra = await guardarAsignacion(deps(t, a.g), 'sa', { principal: 'p2', extras: [extra('p1')] });
    expect(ra.estado).toBe(200);
    const b = graphFalso();
    const rb = await guardarAsignacion(deps(t, b.g), 'sb', { principal: 'p9', extras: [extra('p1')] });
    expect(rb.estado).toBe(200);
    expect(a.llamadas).toEqual(['handshake:p2>p1', 'permite:p2>p1']);
    expect(b.llamadas).toEqual(['handshake:p9>p1', 'permite:p9>p1']);
    expect(a.tokens).toContain(tokenDe(A, 'p2'));
    expect(a.tokens).toContain(tokenDe(A, 'p1'));
    expect(a.tokens.join()).not.toContain(`TOK-${B}`);
    expect(b.tokens.join()).not.toContain(`TOK-${A}`);
    expect(t.facebook_parroquia_extra.map((e) => `${e.parroquia_id}:${e.page_id}`).sort()).toEqual([`${A}:p1`, `${B}:p1`]);
  });
});

describe('guardarAsignacion · crosspost', () => {
  it('una extra nueva llama a handshake y luego a permiteLive; con true queda «listo»', async () => {
    const t = mundo();
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p2', extras: [extra('p3', true)] });
    expect(r.estado).toBe(200);
    expect(llamadas).toEqual(['handshake:p2>p3', 'permite:p2>p3']);
    expect(r.cuerpo).toEqual({ principal: 'p2', extras: [{ pageId: 'p3', nombre: 'Nombre p3', porDefecto: true, crosspost: 'listo' }] });
    expect(t.facebook_parroquia).toMatchObject([{ parroquia_id: A, pagina_principal: 'p2', actualizado_por: 'u-coord' }]);
    expect(t.facebook_parroquia_extra).toEqual([{ parroquia_id: A, page_id: 'p3', por_defecto: true, crosspost: 'listo' }]);
  });
  it('con permiteLive en false, con error, o si algo lanza, queda «falta»: guardar nunca da 500', async () => {
    const casos: Array<ReturnType<typeof graphFalso>> = [
      graphFalso({ permite: () => ({ ok: true, valor: false }) }),
      graphFalso({ permite: () => ({ ok: false, error: { tipo: 'otro' } }) }),
      graphFalso({ permite: () => ({ ok: false, error: { tipo: 'red' } }) }),
      graphFalso({ handshake: () => ({ ok: false, error: { tipo: 'token', codigo: 190 } }), permite: () => ({ ok: true, valor: false }) }),
      graphFalso({ handshake: () => 'lanza' }),
      graphFalso({ permite: () => 'lanza' }),
    ];
    for (const caso of casos) {
      const t = mundo();
      const r = await guardarAsignacion(deps(t, caso.g), 'sa', { principal: 'p2', extras: [extra('p3')] });
      expect(r.estado).toBe(200);
      expect((r.cuerpo as { extras: { crosspost: string }[] }).extras[0].crosspost).toBe('falta');
      expect(t.facebook_parroquia_extra[0]).toMatchObject({ page_id: 'p3', crosspost: 'falta' });
      expect(t.facebook_parroquia).toHaveLength(1);
    }
  });
  it('una extra que ya estaba «listo» no repite el handshake; una «falta» sí lo reintenta', async () => {
    const t = mundo();
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p2' });
    t.facebook_parroquia_extra.push(
      { parroquia_id: A, page_id: 'p3', por_defecto: false, crosspost: 'listo' },
      { parroquia_id: A, page_id: 'p4', por_defecto: false, crosspost: 'falta' },
    );
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p2', extras: [extra('p3', true), extra('p4'), extra('p5')] });
    expect(r.estado).toBe(200);
    expect([...llamadas].sort()).toEqual(['handshake:p2>p4', 'handshake:p2>p5', 'permite:p2>p4', 'permite:p2>p5']);
    expect(llamadas.indexOf('handshake:p2>p4')).toBeLessThan(llamadas.indexOf('permite:p2>p4'));
    expect(llamadas.indexOf('handshake:p2>p5')).toBeLessThan(llamadas.indexOf('permite:p2>p5'));
    const por = Object.fromEntries(t.facebook_parroquia_extra.map((e) => [e.page_id, e]));
    expect(por.p3).toMatchObject({ por_defecto: true, crosspost: 'listo' });
    expect(por.p4).toMatchObject({ crosspost: 'listo' });
    expect(por.p5).toMatchObject({ crosspost: 'listo' });
  });
  it('si cambia la principal, las extras se vuelven a comprobar (el permiso era de la otra)', async () => {
    const t = mundo();
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p2' });
    t.facebook_parroquia_extra.push({ parroquia_id: A, page_id: 'p3', por_defecto: false, crosspost: 'listo' });
    const { g, llamadas } = graphFalso({ permite: () => ({ ok: true, valor: false }) });
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p4', extras: [extra('p3')] });
    expect(r.estado).toBe(200);
    expect(llamadas).toEqual(['handshake:p4>p3', 'permite:p4>p3']);
    expect(t.facebook_parroquia[0]).toMatchObject({ pagina_principal: 'p4' });
    expect(t.facebook_parroquia_extra[0]).toMatchObject({ crosspost: 'falta' });
  });
  it('quita las extras que ya no vienen y no toca las de la otra parroquia', async () => {
    const t = mundo([A, B]);
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p2' });
    t.facebook_parroquia_extra.push(
      { parroquia_id: A, page_id: 'p3', por_defecto: false, crosspost: 'listo' },
      { parroquia_id: A, page_id: 'p4', por_defecto: false, crosspost: 'listo' },
      { parroquia_id: B, page_id: 'p1', por_defecto: true, crosspost: 'falta' },
    );
    const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: [extra('p3')] });
    expect(r.estado).toBe(200);
    expect(t.facebook_parroquia_extra.map((e) => `${e.parroquia_id}:${e.page_id}`).sort()).toEqual([`${A}:p3`, `${B}:p1`]);
    expect(t.facebook_parroquia_extra.find((e) => e.parroquia_id === B)).toMatchObject({ por_defecto: true, crosspost: 'falta' });
  });
});

describe('guardarAsignacion · Facebook lento', () => {
  it('si Graph nunca responde, guarda igual dentro del plazo: la principal queda y las extras nuevas «falta»', async () => {
    const t = mundo();
    t.facebook_parroquia_extra.push({ parroquia_id: A, page_id: 'p3', por_defecto: false, crosspost: 'listo' });
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p2' });
    const colgado = { handshake: () => new Promise(() => {}), permiteLive: () => new Promise(() => {}) } as unknown as GraphFacebook;
    const inicio = Date.now();
    const r = await guardarAsignacion({ ...deps(t, colgado), plazoMs: 50 }, 'sa', { principal: 'p2', extras: [extra('p3'), extra('p4'), extra('p5', true)] });
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(r.estado).toBe(200);
    expect(t.facebook_parroquia[0]).toMatchObject({ pagina_principal: 'p2' });
    const por = Object.fromEntries(t.facebook_parroquia_extra.map((e) => [e.page_id, e.crosspost]));
    expect(por).toEqual({ p3: 'listo', p4: 'falta', p5: 'falta' });
  });
  it('lo que termina a tiempo queda «listo» y lo que no, «falta»', async () => {
    const t = mundo();
    const g = {
      handshake: async () => ({ ok: true, valor: undefined }),
      permiteLive: (_o: unknown, id: string) => (id === 'p3' ? Promise.resolve({ ok: true, valor: true }) : new Promise(() => {})),
    } as unknown as GraphFacebook;
    const r = await guardarAsignacion({ ...deps(t, g), plazoMs: 50 }, 'sa', { principal: 'p2', extras: [extra('p3'), extra('p4')] });
    expect(r.estado).toBe(200);
    expect(Object.fromEntries(t.facebook_parroquia_extra.map((e) => [e.page_id, e.crosspost]))).toEqual({ p3: 'listo', p4: 'falta' });
  });
});

describe('guardarAsignacion · errores de base y secretos', () => {
  it('si la base falla da 500 sin detalle', async () => {
    const t = mundo();
    fallas.add('facebook_parroquia:upsert');
    const r = await guardarAsignacion(deps(t, graphFalso().g), 'sa', { principal: 'p2', extras: [] });
    expect(r.estado).toBe(500);
    expect(JSON.stringify(r.cuerpo)).not.toContain('x');
  });
  it('los tokens van solo a Graph: ni la respuesta, ni el registro, ni la consola los llevan', async () => {
    const t = mundo();
    const consola = [vi.spyOn(console, 'error'), vi.spyOn(console, 'log'), vi.spyOn(console, 'warn')];
    const { g, tokens } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p2', extras: [extra('p3')] });
    expect(r.estado).toBe(200);
    expect(tokens).toContain(tokenDe(A, 'p2'));
    const todo = JSON.stringify([r.cuerpo, t.registro, consola.map((c) => c.mock.calls)]);
    expect(todo).not.toContain('TOK-');
    expect(todo).not.toContain('v1.');
    expect(t.registro).toMatchObject([{ parroquia_id: A, usuario_id: 'u-coord', accion: 'elegir_paginas_facebook' }]);
    // lo único nuevo en las tablas de elección son ids y estados: nada de tokens
    expect(JSON.stringify([t.facebook_parroquia, t.facebook_parroquia_extra])).not.toMatch(/TOK-|v1\./);
  });
  it('si un token no se puede descifrar no hay 500: las extras quedan «falta»', async () => {
    const t = mundo();
    t.facebook_paginas.find((p) => p.parroquia_id === A && p.page_id === 'p3')!.token = 'basura';
    const { g, llamadas } = graphFalso();
    const r = await guardarAsignacion(deps(t, g), 'sa', { principal: 'p2', extras: [extra('p3'), extra('p4')] });
    expect(r.estado).toBe(200);
    const por = Object.fromEntries(t.facebook_parroquia_extra.map((e) => [e.page_id, e.crosspost]));
    expect(por).toEqual({ p3: 'falta', p4: 'listo' });
    expect(llamadas).toEqual(['handshake:p2>p4', 'permite:p2>p4']);
  });
});

describe('leerAsignacion', () => {
  it('devuelve la elección de esa parroquia con el nombre y el estado de cada extra, sin tokens', async () => {
    const t = mundo([A, B]);
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p2' }, { parroquia_id: B, pagina_principal: 'p9' });
    t.facebook_parroquia_extra.push(
      { parroquia_id: A, page_id: 'p3', por_defecto: true, crosspost: 'listo' },
      { parroquia_id: B, page_id: 'p1', por_defecto: false, crosspost: 'falta' },
    );
    const r = await leerAsignacion(deps(t, graphFalso().g), 'sa');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({ principal: 'p2', extras: [{ pageId: 'p3', nombre: 'Nombre p3', porDefecto: true, crosspost: 'listo' }] });
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/TOK-|v1\./);
  });
  it('sin elección: principal null y sin extras; 403 si la parroquia no es suya', async () => {
    const t = mundo([A]);
    expect((await leerAsignacion(deps(t, graphFalso().g), 'sa')).cuerpo).toEqual({ principal: null, extras: [] });
    expect((await leerAsignacion(deps(t, graphFalso().g), 'sb')).estado).toBe(403);
  });
});

describe('leerEstadosFacebook (columna del administrador)', () => {
  function mundoAdmin() {
    const t = mundo([A, B]);
    t.facebook_conexion = [{ parroquia_id: A, nombre_facebook: 'Cuenta A', token_usuario: 'v1.SECRETO', estado: 'conectado', conectado_en: 'x' }];
    t.facebook_conexion.push({ parroquia_id: B, nombre_facebook: 'Cuenta B', token_usuario: 'v1.SECRETO', estado: 'reconectar', conectado_en: 'x' });
    t.facebook_parroquia.push({ parroquia_id: A, pagina_principal: 'p2' });
    t.facebook_parroquia_extra.push(
      { parroquia_id: A, page_id: 'p3', por_defecto: false, crosspost: 'listo' },
      { parroquia_id: A, page_id: 'p4', por_defecto: false, crosspost: 'falta' },
    );
    return t;
  }
  it('un usuario que no es admin recibe 403 y no se lee nada', async () => {
    const t = mundoAdmin();
    const r = await leerEstadosFacebook({ sesion: cliente(t, { id: 'u-coord' }, false), servicio: cliente(t, null) });
    expect(r.estado).toBe(403);
    expect((r.cuerpo as { error: string }).error).toBe(MENSAJE_SOLO_ADMIN);
    const sin = await leerEstadosFacebook({ sesion: cliente(t, null, true), servicio: cliente(t, null) });
    expect(sin.estado).toBe(403);
  });
  it('un admin ve el estado y la principal (por nombre) de cada parroquia, sin tokens ni page_id', async () => {
    const t = mundoAdmin();
    const r = await leerEstadosFacebook({ sesion: cliente(t, { id: 'u-admin' }, true), servicio: cliente(t, null) });
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toEqual({
      [A]: { estado: 'conectado', principal: 'Nombre p2', extras: 2 },
      [B]: { estado: 'reconectar', principal: null, extras: 0 },
    });
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/SECRETO|TOK-|v1\.|"p2"|"p3"/);
  });
  it('una parroquia sin conexión no figura (la tabla la muestra «Sin conectar»)', async () => {
    const t = mundoAdmin();
    t.facebook_conexion = [];
    const r = await leerEstadosFacebook({ sesion: cliente(t, { id: 'u-admin' }, true), servicio: cliente(t, null) });
    expect(r.cuerpo).toEqual({});
  });
  it('si la base falla da 500 sin detalle', async () => {
    const t = mundoAdmin();
    fallas.add('facebook_conexion:select');
    const r = await leerEstadosFacebook({ sesion: cliente(t, { id: 'u-admin' }, true), servicio: cliente(t, null) });
    expect(r.estado).toBe(500);
  });
});

describe('pantalla de páginas y columna del admin', () => {
  it('el encabezado no lleva el chip del borrador en «¿Dónde sale la misa?», pero sí en las demás secciones', () => {
    expect(sinChipBorrador('/editor/p/sa/app-y-transmision/facebook', 'sa')).toBe(true);
    expect(sinChipBorrador('/editor/p/sa/app-y-transmision/facebook/conectar', 'sa')).toBe(true);
    expect(sinChipBorrador('/editor/p/sa/app-y-transmision', 'sa')).toBe(true); // D13: tampoco en la sección (Tarea 6)
    expect(sinChipBorrador('/editor/p/sa/app-y-transmisionx', 'sa')).toBe(false);
    expect(sinChipBorrador('/editor/p/sa/identidad', 'sa')).toBe(false);
    expect(sinChipBorrador('/editor/p/sb/app-y-transmision/facebook', 'sa')).toBe(false);
  });
  it('la celda «Facebook» dice el estado con texto y la principal debajo', () => {
    expect(celdaFacebook(undefined)).toEqual({ texto: 'Sin conectar', tono: 'gris', detalle: null });
    expect(celdaFacebook({ estado: 'conectado', principal: 'Parroquia Ciudad Arce', extras: 2 })).toEqual({
      texto: 'Conectado',
      tono: 'verde',
      detalle: 'Parroquia Ciudad Arce + 2',
    });
    expect(celdaFacebook({ estado: 'conectado', principal: 'Parroquia Ciudad Arce', extras: 0 }).detalle).toBe('Parroquia Ciudad Arce');
    expect(celdaFacebook({ estado: 'reconectar', principal: 'X', extras: 1 })).toEqual({
      texto: 'Hay que volver a conectar',
      tono: 'ambar',
      detalle: 'Usa la clave de transmisión',
    });
  });
  it('el Graph falso solo se activa fuera de producción', async () => {
    const falso = graphDeEntorno({ FACEBOOK_GRAPH_FALSO: '1', NODE_ENV: 'development' });
    expect(await falso.permiteLive({ id: 'a', token: 't' }, 'x')).toEqual({ ok: true, valor: true });
    expect(await falso.permiteLive({ id: 'a', token: 't' }, 'x-falta')).toEqual({ ok: true, valor: false });
    // en producción sin FACEBOOK_VERSION_GRAPH no se arma el real: falla todo, y guardar sigue sin dar 500
    const prod = graphDeEntorno({ FACEBOOK_GRAPH_FALSO: '1', NODE_ENV: 'production' });
    expect((await prod.permiteLive({ id: 'a', token: 't' }, 'x')).ok).toBe(false);
  });
});
