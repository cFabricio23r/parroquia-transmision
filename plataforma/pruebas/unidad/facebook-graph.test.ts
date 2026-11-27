import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ESTADOS_VIVO_GRAPH,
  crearGraph,
  partirUrlStream,
  versionGraph,
} from '../../lib/facebook/graph';

// Versión obviamente falsa: la real se anota en la Tarea 0.
const V = 'v0.0';
const TOKEN = 'EAABsecretoDePaginaXYZ123';
const TOKEN_USUARIO = 'EAABsecretoDeUsuarioABC789';

type Llamada = { url: string; metodo: string; cuerpo: string | null };
type Respuesta = { status?: number; json: unknown } | Error;

function falso(respuestas: Respuesta[]) {
  const llamadas: Llamada[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      metodo: init?.method ?? 'GET',
      cuerpo: init?.body ? String(init.body) : null,
    });
    const r = respuestas[Math.min(i++, respuestas.length - 1)];
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.json } as Response;
  });
  return { fn: fn as unknown as typeof fetch, llamadas };
}

function graph(
  respuestas: Respuesta[],
  extra: { estados?: { activo: readonly string[]; terminado: readonly string[] } } = {},
) {
  const f = falso(respuestas);
  return {
    g: crearGraph({ appId: 'APP1', secreto: 'SECRETO1', fetch: f.fn, version: V, ...extra }),
    llamadas: f.llamadas,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('versionGraph', () => {
  it('lee FACEBOOK_VERSION_GRAPH', () => {
    expect(versionGraph({ FACEBOOK_VERSION_GRAPH: 'v0.0' })).toBe('v0.0');
  });
  it('lanza si falta o no tiene forma de versión', () => {
    expect(() => versionGraph({})).toThrow('Falta FACEBOOK_VERSION_GRAPH');
    expect(() => versionGraph({ FACEBOOK_VERSION_GRAPH: '' })).toThrow('Falta FACEBOOK_VERSION_GRAPH');
    expect(() => versionGraph({ FACEBOOK_VERSION_GRAPH: '21' })).toThrow('Falta FACEBOOK_VERSION_GRAPH');
  });
  it('crearGraph sin version la resuelve del entorno y lanza si falta', () => {
    const antes = process.env.FACEBOOK_VERSION_GRAPH;
    delete process.env.FACEBOOK_VERSION_GRAPH;
    try {
      expect(() => crearGraph({ appId: 'a', secreto: 's' })).toThrow('Falta FACEBOOK_VERSION_GRAPH');
    } finally {
      if (antes !== undefined) process.env.FACEBOOK_VERSION_GRAPH = antes;
    }
  });
});

describe('errores', () => {
  it('190 da tipo token', async () => {
    const { g } = graph([{ status: 400, json: { error: { code: 190, message: 'x' } } }]);
    const r = await g.yo(TOKEN);
    expect(r).toEqual({ ok: false, error: { tipo: 'token', codigo: 190 } });
  });
  it.each([1363144, 1363120])('200 con subcódigo %i da tipo requisitos', async (sub) => {
    const { g } = graph([{ status: 400, json: { error: { code: 200, error_subcode: sub } } }]);
    const r = await g.crearVivo('P1', TOKEN, 'Misa');
    expect(r).toEqual({ ok: false, error: { tipo: 'requisitos', codigo: 200, subcodigo: sub } });
  });
  it('otro código da tipo otro', async () => {
    const { g } = graph([{ status: 400, json: { error: { code: 100 } } }]);
    const r = await g.yo(TOKEN);
    expect(r).toEqual({ ok: false, error: { tipo: 'otro', codigo: 100 } });
  });
  it('un fetch que rechaza da tipo red', async () => {
    const { g } = graph([new Error(`fallo con ${TOKEN}`)]);
    const r = await g.yo(TOKEN);
    expect(r).toEqual({ ok: false, error: { tipo: 'red' } });
  });
  it('un fetch que nunca responde da tipo red al vencer el plazo, sin filtrar nada', async () => {
    const f = vi.fn(() => new Promise<Response>(() => {}));
    const g = crearGraph({ appId: 'a', secreto: 's', fetch: f as unknown as typeof fetch, version: V, plazoMs: 30 });
    const registro = [vi.spyOn(console, 'error'), vi.spyOn(console, 'log'), vi.spyOn(console, 'warn')];
    const inicio = Date.now();
    const r = await g.yo(TOKEN);
    expect(r).toEqual({ ok: false, error: { tipo: 'red' } });
    expect(Date.now() - inicio).toBeLessThan(1000);
    expect(JSON.stringify([r, registro.map((c) => c.mock.calls)])).not.toContain(TOKEN);
  });
  it('si el cuerpo nunca termina de llegar, también vence', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) }) as unknown as Response);
    const g = crearGraph({ appId: 'a', secreto: 's', fetch: f as unknown as typeof fetch, version: V, plazoMs: 30 });
    expect(await g.yo(TOKEN)).toEqual({ ok: false, error: { tipo: 'red' } });
  });
  it('cada llamada lleva una señal de aborto', async () => {
    const f = vi.fn(async (_u: unknown, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ id: '1', name: 'x' }) }) as unknown as Response);
    const g = crearGraph({ appId: 'a', secreto: 's', fetch: f as unknown as typeof fetch, version: V });
    await g.yo(TOKEN);
    expect(f.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
  it('una respuesta que no es JSON da tipo otro', async () => {
    const f = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('x');
          },
        }) as unknown as Response,
    );
    const g = crearGraph({ appId: 'a', secreto: 's', fetch: f as unknown as typeof fetch, version: V });
    expect(await g.yo(TOKEN)).toEqual({ ok: false, error: { tipo: 'otro' } });
  });
});

describe('cuentas', () => {
  it('cambiarCodigo pide el token corto (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([{ json: { access_token: 'corto' } }]);
    const r = await g.cambiarCodigo('COD', 'https://x.test/cb');
    expect(r).toEqual({ ok: true, valor: 'corto' });
    const u = new URL(llamadas[0].url);
    expect(u.origin + u.pathname).toBe(`https://graph.facebook.com/${V}/oauth/access_token`);
    expect(u.searchParams.get('code')).toBe('COD');
    expect(u.searchParams.get('redirect_uri')).toBe('https://x.test/cb');
    expect(u.searchParams.get('client_id')).toBe('APP1');
  });
  it('alargar usa fb_exchange_token (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([{ json: { access_token: 'largo' } }]);
    const r = await g.alargar('corto');
    expect(r).toEqual({ ok: true, valor: 'largo' });
    const u = new URL(llamadas[0].url);
    expect(u.searchParams.get('grant_type')).toBe('fb_exchange_token');
    expect(u.searchParams.get('fb_exchange_token')).toBe('corto');
  });
  it('yo devuelve id y nombre', async () => {
    const { g, llamadas } = graph([{ json: { id: '7', name: 'Ana' } }]);
    expect(await g.yo(TOKEN_USUARIO)).toEqual({ ok: true, valor: { id: '7', nombre: 'Ana' } });
    expect(new URL(llamadas[0].url).searchParams.get('access_token')).toBe(TOKEN_USUARIO);
  });
  it('paginas devuelve token y seguidores, null si falta (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([
      {
        json: {
          data: [
            { id: '1', name: 'A', access_token: 'tA', followers_count: 10 },
            { id: '2', name: 'B', access_token: 'tB' },
          ],
        },
      },
    ]);
    const r = await g.paginas(TOKEN_USUARIO);
    expect(r).toEqual({
      ok: true,
      valor: [
        { id: '1', nombre: 'A', token: 'tA', seguidores: 10 },
        { id: '2', nombre: 'B', token: 'tB', seguidores: null },
      ],
    });
    const u = new URL(llamadas[0].url);
    expect(u.pathname).toBe(`/${V}/me/accounts`);
    expect(u.searchParams.get('fields')).toContain('followers_count');
  });
});

describe('crearVivo', () => {
  it('hace POST a live_videos con status LIVE_NOW y title, token en el cuerpo', async () => {
    const { g, llamadas } = graph([
      {
        json: {
          id: 'V1',
          secure_stream_url: 'rtmps://live-api-s.facebook.com:443/rtmp/FB-1',
          stream_url: 'rtmp://malo/rtmp/X',
        },
      },
    ]);
    const r = await g.crearVivo('P1', TOKEN, 'Misa de 10');
    expect(r).toEqual({
      ok: true,
      valor: { vivoId: 'V1', url: 'rtmps://live-api-s.facebook.com:443/rtmp/FB-1' },
    });
    expect(llamadas[0].metodo).toBe('POST');
    expect(llamadas[0].url).toBe(`https://graph.facebook.com/${V}/P1/live_videos`);
    const c = new URLSearchParams(llamadas[0].cuerpo!);
    expect(c.get('status')).toBe('LIVE_NOW');
    expect(c.get('title')).toBe('Misa de 10');
    expect(c.get('access_token')).toBe(TOKEN);
    expect(c.has('privacy')).toBe(false);
    expect(llamadas[0].url).not.toContain(TOKEN);
  });
  it('sin secure_stream_url es error otro, aunque haya stream_url', async () => {
    const { g } = graph([{ json: { id: 'V1', stream_url: 'rtmp://x/rtmp/K' } }]);
    expect(await g.crearVivo('P1', TOKEN, 't')).toEqual({ ok: false, error: { tipo: 'otro' } });
  });
});

describe('partirUrlStream', () => {
  it('parte servidor y clave', () => {
    expect(partirUrlStream('rtmps://live-api-s.facebook.com:443/rtmp/FB-123-abc')).toEqual({
      servidor: 'rtmps://live-api-s.facebook.com:443/rtmp/',
      clave: 'FB-123-abc',
    });
  });
  it('null sin /rtmp/, sin rtmps:// o sin clave', () => {
    expect(partirUrlStream('rtmps://live-api-s.facebook.com:443/otro/FB-1')).toBeNull();
    expect(partirUrlStream('rtmp://live-api-s.facebook.com:443/rtmp/FB-1')).toBeNull();
    expect(partirUrlStream('rtmps://live-api-s.facebook.com:443/rtmp/')).toBeNull();
    expect(partirUrlStream('')).toBeNull();
  });
});

describe('vivo', () => {
  it('activarCrosspost manda crossposting_actions por página (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([{ json: { success: true } }]);
    const r = await g.activarCrosspost('V1', TOKEN, ['A', 'B']);
    expect(r).toEqual({ ok: true, valor: undefined });
    expect(llamadas[0].metodo).toBe('POST');
    expect(llamadas[0].url).toBe(`https://graph.facebook.com/${V}/V1`);
    const c = new URLSearchParams(llamadas[0].cuerpo!);
    expect(JSON.parse(c.get('crossposting_actions')!)).toEqual([
      { page_id: 'A', action: 'enable_crossposting_and_create_post' },
      { page_id: 'B', action: 'enable_crossposting_and_create_post' },
    ]);
    expect(c.get('access_token')).toBe(TOKEN);
  });
  it('crosspostHechos lista los ids de crossposted_broadcasts (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([
      { json: { crossposted_broadcasts: { data: [{ id: 'X1' }, { id: 'X2' }] } } },
    ]);
    expect(await g.crosspostHechos('V1', TOKEN)).toEqual({ ok: true, valor: ['X1', 'X2'] });
    expect(new URL(llamadas[0].url).searchParams.get('fields')).toBe('crossposted_broadcasts');
  });
  it('crosspostHechos sin el campo da lista vacía (supuesto, no verificado)', async () => {
    const { g } = graph([{ json: { id: 'V1' } }]);
    expect(await g.crosspostHechos('V1', TOKEN)).toEqual({ ok: true, valor: [] });
  });
  it('urlDeVivo pide secure_stream_url', async () => {
    const { g, llamadas } = graph([{ json: { secure_stream_url: 'rtmps://h/rtmp/K' } }]);
    expect(await g.urlDeVivo('V1', TOKEN)).toEqual({ ok: true, valor: 'rtmps://h/rtmp/K' });
    expect(new URL(llamadas[0].url).searchParams.get('fields')).toBe('secure_stream_url');
  });
  it('terminarVivo hace POST con end_live_video (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([{ json: { success: true } }]);
    expect(await g.terminarVivo('V1', TOKEN)).toEqual({ ok: true, valor: undefined });
    expect(llamadas[0].metodo).toBe('POST');
    expect(new URLSearchParams(llamadas[0].cuerpo!).get('end_live_video')).toBe('true');
  });
  it('handshake whitelistea en ambos sentidos con el token de cada lado (supuesto, no verificado)', async () => {
    const { g, llamadas } = graph([{ json: { success: true } }, { json: { success: true } }]);
    const r = await g.handshake({ id: 'O', token: 'tO' }, { id: 'D', token: 'tD' });
    expect(r).toEqual({ ok: true, valor: undefined });
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0].url).toBe(`https://graph.facebook.com/${V}/O/crosspost_whitelisted_pages`);
    expect(new URLSearchParams(llamadas[0].cuerpo!).get('page_id')).toBe('D');
    expect(new URLSearchParams(llamadas[0].cuerpo!).get('access_token')).toBe('tO');
    expect(llamadas[1].url).toBe(`https://graph.facebook.com/${V}/D/crosspost_whitelisted_pages`);
    expect(new URLSearchParams(llamadas[1].cuerpo!).get('page_id')).toBe('O');
    expect(new URLSearchParams(llamadas[1].cuerpo!).get('access_token')).toBe('tD');
  });
  it('handshake corta en el primer error (ruta supuesta, no verificada)', async () => {
    const { g, llamadas } = graph([{ status: 400, json: { error: { code: 190 } } }]);
    const r = await g.handshake({ id: 'O', token: 'tO' }, { id: 'D', token: 'tD' });
    expect(r).toEqual({ ok: false, error: { tipo: 'token', codigo: 190 } });
    expect(llamadas).toHaveLength(1);
  });
  it('permiteLive dice si el destino está en la lista (supuesto, no verificado)', async () => {
    const { g } = graph([{ json: { data: [{ id: 'D' }] } }, { json: { data: [{ id: 'Z' }] } }]);
    expect(await g.permiteLive({ id: 'O', token: 'tO' }, 'D')).toEqual({ ok: true, valor: true });
    expect(await g.permiteLive({ id: 'O', token: 'tO' }, 'D')).toEqual({ ok: true, valor: false });
  });
});

describe('estadoVivo', () => {
  const estados = { activo: ['X_ON'], terminado: ['X_OFF'] };
  it('mapea según las listas inyectadas', async () => {
    const { g, llamadas } = graph(
      [{ json: { status: 'X_ON' } }, { json: { status: 'X_OFF' } }, { json: { status: 'OTRO' } }],
      { estados },
    );
    expect(await g.estadoVivo('V1', TOKEN)).toEqual({ ok: true, valor: 'activo' });
    expect(await g.estadoVivo('V1', TOKEN)).toEqual({ ok: true, valor: 'terminado' });
    expect(await g.estadoVivo('V1', TOKEN)).toEqual({ ok: false, error: { tipo: 'otro' } });
    expect(new URL(llamadas[0].url).searchParams.get('fields')).toBe('status');
  });
  it('con los valores reales (vacíos) cualquier status da otro, nunca un estado adivinado', async () => {
    expect(ESTADOS_VIVO_GRAPH).toEqual({ activo: [], terminado: [] });
    const { g } = graph([{ json: { status: 'LIVE' } }, { json: { status: 'terminado' } }]);
    expect(await g.estadoVivo('V1', TOKEN)).toEqual({ ok: false, error: { tipo: 'otro' } });
    expect(await g.estadoVivo('V1', TOKEN)).toEqual({ ok: false, error: { tipo: 'otro' } });
  });
  it.todo('estadoVivo con los valores reales de Facebook (Tarea 0)');
});

describe('sin filtraciones', () => {
  it('ningún error ni console lleva un token', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const casos: Respuesta[] = [
      { status: 400, json: { error: { code: 190, message: `Token ${TOKEN} inválido` } } },
      { status: 400, json: { error: { code: 200, error_subcode: 1363144, message: TOKEN } } },
      { status: 500, json: { error: { code: 1, message: TOKEN } } },
      new Error(`boom ${TOKEN}`),
    ];
    for (const caso of casos) {
      const { g } = graph([caso]);
      const resultados = [
        await g.yo(TOKEN),
        await g.crearVivo('P', TOKEN, 't'),
        await g.alargar(TOKEN),
        await g.terminarVivo('V', TOKEN),
        await g.estadoVivo('V', TOKEN),
      ];
      for (const r of resultados) expect(JSON.stringify(r)).not.toContain('EAAB');
    }
    for (const e of espias) expect(e).not.toHaveBeenCalled();
  });
});
