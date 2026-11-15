import { crearClienteSupabase, type SesionSupabase } from './cliente';

const URL_SB = 'https://ref.supabase.co';
const CLAVE = 'sb_publishable_FALSA_DE_PRUEBA';
const SECRETOS = ['clave-de-prueba-123', 'TOKEN-ACCESO-FALSO-1111', 'TOKEN-RENOVAR-FALSO-2222'];

type Llamada = { url: string; init: RequestInit };

function respuesta(estado: number, cuerpo?: unknown): Response {
  const texto = cuerpo === undefined ? '' : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return {
    ok: estado >= 200 && estado < 300,
    status: estado,
    text: async () => texto,
    json: async () => JSON.parse(texto),
  } as unknown as Response;
}

function fetchFalso(responder: (url: string, init: RequestInit) => Promise<Response> | Response) {
  const llamadas: Llamada[] = [];
  const mock = jest.fn(async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return responder(url, init);
  });
  return { f: mock as unknown as typeof fetch, llamadas, mock };
}

function cabeceras(init: RequestInit): Record<string, string> {
  const h = (init.headers ?? {}) as Record<string, string>;
  const fuera: Record<string, string> = {};
  for (const k of Object.keys(h)) fuera[k.toLowerCase()] = h[k];
  return fuera;
}

const TOKEN_OK = {
  access_token: 'TOKEN-ACCESO-FALSO-1111',
  refresh_token: 'TOKEN-RENOVAR-FALSO-2222',
  expires_in: 3600,
  user: { id: 'u-1', email: 'ana@x.com' },
};

const SESION: SesionSupabase = {
  accessToken: 'TOKEN-ACCESO-FALSO-1111',
  refreshToken: 'TOKEN-RENOVAR-FALSO-2222',
  expiraEn: 2_000_000_000,
  usuarioId: 'u-1',
  correo: 'ana@x.com',
};

let espias: jest.SpyInstance[] = [];
beforeEach(() => {
  espias = (['log', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  for (const e of espias) expect(e).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function sinSecretos(r: unknown) {
  const t = JSON.stringify(r);
  for (const s of SECRETOS) expect(t).not.toContain(s);
}

function cliente(f: typeof fetch, plazoMs?: number) {
  return crearClienteSupabase({ url: URL_SB, clavePublica: CLAVE, fetch: f, plazoMs });
}

describe('entrar', () => {
  it('pide el token con correo y contraseña, con apikey y sin authorization', async () => {
    const { f, llamadas } = fetchFalso(() => respuesta(200, TOKEN_OK));
    await cliente(f).entrar('  Ana@X.com ', 'clave-de-prueba-123');
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('https://ref.supabase.co/auth/v1/token?grant_type=password');
    expect(llamadas[0].init.method).toBe('POST');
    expect(llamadas[0].init.body).toBe('{"email":"ana@x.com","password":"clave-de-prueba-123"}');
    const h = cabeceras(llamadas[0].init);
    expect(h.apikey).toBe(CLAVE);
    expect(h['content-type']).toBe('application/json');
    expect(h.authorization).toBeUndefined();
  });

  it('una respuesta buena da la sesión, con expiraEn desde expires_in', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_500);
    const { f } = fetchFalso(() => respuesta(200, TOKEN_OK));
    const r = await cliente(f).entrar('ana@x.com', 'clave-de-prueba-123');
    expect(r).toEqual({
      ok: true,
      valor: {
        accessToken: 'TOKEN-ACCESO-FALSO-1111',
        refreshToken: 'TOKEN-RENOVAR-FALSO-2222',
        expiraEn: 1_700_000_000 + 3600,
        usuarioId: 'u-1',
        correo: 'ana@x.com',
      },
    });
  });

  it('usa expires_at si viene', async () => {
    const { f } = fetchFalso(() => respuesta(200, { ...TOKEN_OK, expires_at: 1_800_000_000 }));
    const r = await cliente(f).entrar('ana@x.com', 'clave-de-prueba-123');
    expect(r.ok && r.valor.expiraEn).toBe(1_800_000_000);
  });

  const casos: Array<[string, () => Promise<Response> | Response, object]> = [
    ['400', () => respuesta(400, { error: 'invalid_grant' }), { tipo: 'incorrectos' }],
    ['429', () => respuesta(429, {}), { tipo: 'muchos-intentos' }],
    ['400 por límite', () => respuesta(400, { code: 'over_request_rate_limit' }), { tipo: 'muchos-intentos' }],
    ['503', () => respuesta(503, 'caído'), { tipo: 'sin-conexion' }],
    ['rechazo', () => Promise.reject(new Error('Network request failed clave-de-prueba-123')), { tipo: 'sin-conexion' }],
    ['200 sin refresh_token', () => respuesta(200, { ...TOKEN_OK, refresh_token: undefined }), { tipo: 'servidor', estado: 200 }],
    ['200 con JSON roto', () => respuesta(200, '{roto'), { tipo: 'servidor', estado: 200 }],
  ];
  it.each(casos)('%s', async (_n, responder, error) => {
    const { f } = fetchFalso(responder);
    const r = await cliente(f).entrar('ana@x.com', 'clave-de-prueba-123');
    expect(r).toEqual({ ok: false, error });
    sinSecretos(r);
  });

  it('un fetch que no responde antes del plazo da sin-conexion', async () => {
    jest.useFakeTimers();
    const { f } = fetchFalso(() => new Promise<Response>(() => {}));
    const p = cliente(f, 5000).entrar('ana@x.com', 'clave-de-prueba-123');
    await jest.advanceTimersByTimeAsync(5001);
    await expect(p).resolves.toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
  });
});

describe('renovar', () => {
  it('pide el token con el refresh_token', async () => {
    const { f, llamadas } = fetchFalso(() => respuesta(200, TOKEN_OK));
    const r = await cliente(f).renovar('TOKEN-RENOVAR-FALSO-2222');
    expect(r.ok).toBe(true);
    expect(llamadas[0].url).toBe('https://ref.supabase.co/auth/v1/token?grant_type=refresh_token');
    expect(llamadas[0].init.body).toBe('{"refresh_token":"TOKEN-RENOVAR-FALSO-2222"}');
    expect(cabeceras(llamadas[0].init).authorization).toBeUndefined();
  });

  const casos: Array<[number, object]> = [
    [400, { tipo: 'sesion-invalida' }],
    [401, { tipo: 'sesion-invalida' }],
    [502, { tipo: 'sin-conexion' }],
  ];
  it.each(casos)('%i', async (estado, error) => {
    const { f } = fetchFalso(() => respuesta(estado, { error: 'x' }));
    const r = await cliente(f).renovar('TOKEN-RENOVAR-FALSO-2222');
    expect(r).toEqual({ ok: false, error });
    sinSecretos(r);
  });
});

describe('seleccionar', () => {
  const CONSULTA = { select: 'id,slug,nombre', visible: 'eq.true', desactivada_en: 'is.null', order: 'nombre.asc' };

  it('pide la tabla con la consulta codificada y el token del usuario', async () => {
    const filas = [{ id: '1', slug: 'abc', nombre: 'A' }];
    const { f, llamadas } = fetchFalso(() => respuesta(200, filas));
    const r = await cliente(f).seleccionar(SESION, 'parroquias', CONSULTA);
    expect(r).toEqual({ ok: true, valor: filas });
    expect(llamadas[0].url).toBe(
      'https://ref.supabase.co/rest/v1/parroquias?select=id%2Cslug%2Cnombre&visible=eq.true&desactivada_en=is.null&order=nombre.asc',
    );
    expect(llamadas[0].init.method ?? 'GET').toBe('GET');
    const h = cabeceras(llamadas[0].init);
    expect(h.apikey).toBe(CLAVE);
    expect(h.authorization).toBe('Bearer TOKEN-ACCESO-FALSO-1111');
  });

  const casos: Array<[string, () => Response, object]> = [
    ['401', () => respuesta(401, { message: 'JWT expired' }), { tipo: 'sesion-invalida' }],
    ['403', () => respuesta(403, {}), { tipo: 'permiso' }],
    ['200 que no es arreglo', () => respuesta(200, { a: 1 }), { tipo: 'servidor', estado: 200 }],
    ['500', () => respuesta(500, {}), { tipo: 'sin-conexion' }],
  ];
  it.each(casos)('%s', async (_n, responder, error) => {
    const { f } = fetchFalso(responder);
    const r = await cliente(f).seleccionar(SESION, 'parroquias', CONSULTA);
    expect(r).toEqual({ ok: false, error });
    sinSecretos(r);
  });
});

describe('upsert', () => {
  it('manda las filas con merge-duplicates y on_conflict', async () => {
    const { f, llamadas } = fetchFalso(() => respuesta(201, [{ id: 'x' }]));
    const r = await cliente(f).upsert(SESION, 'transmisiones', [{ id: 'x' }], 'id');
    expect(r).toEqual({ ok: true, valor: [{ id: 'x' }] });
    expect(llamadas[0].url).toBe('https://ref.supabase.co/rest/v1/transmisiones?on_conflict=id');
    expect(llamadas[0].init.method).toBe('POST');
    expect(llamadas[0].init.body).toBe('[{"id":"x"}]');
    const h = cabeceras(llamadas[0].init);
    expect(h.prefer).toBe('resolution=merge-duplicates,return=representation');
    expect(h.authorization).toBe('Bearer TOKEN-ACCESO-FALSO-1111');
    expect(h['content-type']).toBe('application/json');
  });
});

describe('nombres inválidos', () => {
  it('una tabla con caracteres raros lanza sin llamar a fetch', async () => {
    const { f, mock } = fetchFalso(() => respuesta(200, []));
    const c = cliente(f);
    await expect(c.seleccionar(SESION, 'a;b', {})).rejects.toThrow('Consulta inválida.');
    await expect(c.upsert(SESION, 'a;b', [], 'id')).rejects.toThrow('Consulta inválida.');
    expect(mock).not.toHaveBeenCalled();
  });

  it('una clave de consulta con espacio, o un conflicto raro, lanza sin llamar a fetch', async () => {
    const { f, mock } = fetchFalso(() => respuesta(200, []));
    const c = cliente(f);
    await expect(c.seleccionar(SESION, 'parroquias', { 'x y': '1' })).rejects.toThrow('Consulta inválida.');
    await expect(c.upsert(SESION, 'parroquias', [], 'id;x')).rejects.toThrow('Consulta inválida.');
    expect(mock).not.toHaveBeenCalled();
  });
});
