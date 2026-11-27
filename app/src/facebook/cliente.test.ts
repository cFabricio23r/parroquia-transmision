import { crearClienteFacebook, PLAZO_CREAR_MS, PLAZO_PEDIDO_CREAR_MS } from './cliente';
import type { SesionApp } from '../sesion/sesion';

const ORIGEN = 'https://plataforma.example.org';
const SLUG = 'ciudad-arce';
const TOKEN = 'token-secreto-123';
const CLAVE = 'FB-clave-secreta-456';

function sesionFalsa(): SesionApp {
  return {
    conSesion: async (fn: (s: unknown) => Promise<unknown>) =>
      fn({ accessToken: TOKEN, refreshToken: 'r', expiraEn: 9e9, usuarioId: 'u', correo: 'a@b.c' }),
  } as unknown as SesionApp;
}

function sesionSinSesion(): SesionApp {
  return { conSesion: async () => ({ ok: false, error: { tipo: 'sesion-invalida' } }) } as unknown as SesionApp;
}

function respuesta(estado: number, cuerpo: unknown): Response {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return { status: estado, text: async () => texto } as unknown as Response;
}

function cliente(f: jest.Mock, sesion: SesionApp = sesionFalsa()) {
  return crearClienteFacebook({ origen: ORIGEN, slug: SLUG, sesion, fetch: f as unknown as typeof fetch });
}

function cabecera(init: RequestInit, nombre: string): string | undefined {
  const h = init.headers as Record<string, string>;
  return h[nombre] ?? h[nombre.toLowerCase()];
}

const VIVO = {
  id: 'v1',
  servidor: 'rtmps://live-api-s.facebook.com:443/rtmp/',
  clave: CLAVE,
  principal: { id: 'p1', nombre: 'Parroquia' },
  extras: [{ id: 'p2', nombre: 'Extra' }],
  reusado: false,
};

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('crear', () => {
  it('manda Bearer y el cuerpo a /app/vivo y devuelve el vivo', async () => {
    const f = jest.fn(async () => respuesta(200, VIVO));
    const r = await cliente(f).crear(['p2'], { titulo: 'Misa', descripcion: '' });
    expect(r).toEqual({ ok: true, valor: VIVO });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ORIGEN + '/editor/api/' + SLUG + '/app/vivo');
    expect(init.method).toBe('POST');
    expect(cabecera(init, 'Authorization')).toBe('Bearer ' + TOKEN);
    expect(JSON.parse(init.body as string)).toEqual({ extras: ['p2'], titulo: 'Misa' });
  });

  it('con descripción, el cuerpo la trae', async () => {
    const f = jest.fn(async () => respuesta(200, VIVO));
    await cliente(f).crear([], { titulo: 'Misa', descripcion: 'Hola' });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ extras: [], titulo: 'Misa', descripcion: 'Hola' });
  });

  it('el pedido de crear dura más que el tope de 15 s de la app (Ruling 13): a los 45 s da sin-conexion', async () => {
    jest.useFakeTimers();
    const f = jest.fn(() => new Promise<Response>(() => {}));
    expect(PLAZO_CREAR_MS).toBe(15_000);
    expect(PLAZO_PEDIDO_CREAR_MS).toBe(45_000);
    const p = cliente(f).crear([], { titulo: 'Misa', descripcion: '' });
    let listo = false;
    void p.then(() => {
      listo = true;
    });
    await jest.advanceTimersByTimeAsync(PLAZO_PEDIDO_CREAR_MS - 1);
    expect(listo).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
  });

  it('una respuesta de crear que llega a los 20 s todavía se lee (para poder cerrar ese vivo)', async () => {
    jest.useFakeTimers();
    const f = jest.fn(() => new Promise<Response>((res) => setTimeout(() => res(respuesta(200, VIVO)), 20_000)));
    const p = cliente(f).crear([], { titulo: 'Misa', descripcion: '' });
    await jest.advanceTimersByTimeAsync(20_000);
    expect(await p).toEqual({ ok: true, valor: VIVO });
  });

  it('lee `reusado` (sin el campo, false)', async () => {
    expect(await cliente(jest.fn(async () => respuesta(200, { ...VIVO, reusado: true }))).crear([], { titulo: 'M', descripcion: '' })).toEqual({ ok: true, valor: { ...VIVO, reusado: true } });
    const { reusado: _r, ...sinCampo } = VIVO;
    expect(await cliente(jest.fn(async () => respuesta(200, sinCampo))).crear([], { titulo: 'M', descripcion: '' })).toEqual({ ok: true, valor: { ...VIVO, reusado: false } });
  });

  it('da sin-conexion a los 45 s totales si la renovacion de sesion nunca responde', async () => {
    jest.useFakeTimers();
    const f = jest.fn();
    const sesion = { conSesion: () => new Promise(() => {}) } as unknown as SesionApp;
    const p = cliente(f, sesion).crear([], { titulo: 'Misa', descripcion: '' });
    await jest.advanceTimersByTimeAsync(PLAZO_PEDIDO_CREAR_MS);
    expect(await p).toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
    expect(f).not.toHaveBeenCalled();
  });

  it('en el reintento por sesion-invalida el total no pasa de 45 s y el resultado tardio se ignora', async () => {
    jest.useFakeTimers();
    const espia = jest.spyOn(console, 'log').mockImplementation(() => {});
    const f = jest.fn(async () => respuesta(401, {}));
    const sesion = {
      conSesion: async (fn: (s: unknown) => Promise<{ ok: boolean }>) => {
        const s = { accessToken: TOKEN, refreshToken: 'r', expiraEn: 9e9, usuarioId: 'u', correo: 'a@b.c' };
        const r = await fn(s);
        if (r.ok) return r;
        await new Promise((res) => setTimeout(res, 6_000)); // renovar
        return fn(s); // segundo intento, con un fetch que no responde
      },
    } as unknown as SesionApp;
    f.mockImplementationOnce(async () => respuesta(401, {})).mockImplementation(() => new Promise<Response>(() => {}));
    const p = cliente(f, sesion).crear([], { titulo: 'Misa', descripcion: '' });
    let listo = false;
    void p.then(() => {
      listo = true;
    });
    await jest.advanceTimersByTimeAsync(PLAZO_PEDIDO_CREAR_MS - 1);
    expect(listo).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(espia).not.toHaveBeenCalled();
  });

  it.each(['sin-facebook', 'reconectar', 'requisitos', 'facebook', 'muchos'] as const)('mapea el codigo %s', async (codigo) => {
    const f = jest.fn(async () => respuesta(422, { codigo }));
    expect(await cliente(f).crear([], { titulo: 'Misa', descripcion: '' })).toEqual({ ok: false, error: { tipo: codigo } });
  });

  it('mapea 401 a sesion', async () => {
    const f = jest.fn(async () => respuesta(401, {}));
    expect(await cliente(f).crear([], { titulo: 'Misa', descripcion: '' })).toEqual({ ok: false, error: { tipo: 'sesion' } });
  });

  it('da sesion si no hay sesion', async () => {
    const f = jest.fn();
    expect(await cliente(f, sesionSinSesion()).crear([], { titulo: 'Misa', descripcion: '' })).toEqual({ ok: false, error: { tipo: 'sesion' } });
    expect(f).not.toHaveBeenCalled();
  });

  it('da otro para un codigo desconocido o un 404 sin codigo', async () => {
    expect(await cliente(jest.fn(async () => respuesta(400, { codigo: 'raro' }))).crear([], { titulo: 'M', descripcion: '' })).toEqual({ ok: false, error: { tipo: 'otro' } });
    expect(await cliente(jest.fn(async () => respuesta(404, 'x'))).crear([], { titulo: 'M', descripcion: '' })).toEqual({ ok: false, error: { tipo: 'otro' } });
  });

  it('da otro si el servidor no empieza con rtmps://', async () => {
    const f = jest.fn(async () => respuesta(200, { ...VIVO, servidor: 'rtmp://x/live' }));
    expect(await cliente(f).crear([], { titulo: 'Misa', descripcion: '' })).toEqual({ ok: false, error: { tipo: 'otro' } });
    const g = jest.fn(async () => respuesta(200, { id: 'v1', clave: CLAVE, principal: VIVO.principal, extras: [] }));
    expect(await cliente(g).crear([], { titulo: 'Misa', descripcion: '' })).toEqual({ ok: false, error: { tipo: 'otro' } });
  });
});

describe('destinos, estado y terminar', () => {
  it('destinos hace GET y valida', async () => {
    const d = { conectado: true, principal: { id: 'p1', nombre: 'P' }, extras: [{ id: 'p2', nombre: 'E', porDefecto: true }] };
    const f = jest.fn(async () => respuesta(200, d));
    expect(await cliente(f).destinos()).toEqual({ ok: true, valor: d });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ORIGEN + '/editor/api/' + SLUG + '/app/facebook');
    expect(init.method).toBe('GET');
    expect(cabecera(init, 'Authorization')).toBe('Bearer ' + TOKEN);
  });

  it('destinos con cuerpo malformado da otro', async () => {
    expect(await cliente(jest.fn(async () => respuesta(200, { x: 1 }))).destinos()).toEqual({ ok: false, error: { tipo: 'otro' } });
  });

  it('estado hace GET a /app/vivo/<id>', async () => {
    const e = { estado: 'activo', extras: [{ id: 'p2', nombre: 'E', salio: true }] };
    const f = jest.fn(async () => respuesta(200, e));
    expect(await cliente(f).estado('v 1')).toEqual({ ok: true, valor: e });
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(ORIGEN + '/editor/api/' + SLUG + '/app/vivo/v%201');
  });

  it('terminar hace DELETE', async () => {
    const f = jest.fn(async () => respuesta(200, { ok: true }));
    expect(await cliente(f).terminar('v1')).toEqual({ ok: true, valor: undefined });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ORIGEN + '/editor/api/' + SLUG + '/app/vivo/v1');
    expect(init.method).toBe('DELETE');
  });

  it('terminar acepta 204 y mapea errores', async () => {
    expect(await cliente(jest.fn(async () => respuesta(204, ''))).terminar('v1')).toEqual({ ok: true, valor: undefined });
    expect(await cliente(jest.fn(async () => respuesta(502, { codigo: 'facebook' }))).terminar('v1')).toEqual({ ok: false, error: { tipo: 'facebook' } });
  });
});

describe('secretos', () => {
  it('no escribe en console ni deja la clave o el token en un error', async () => {
    const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    const resultados = [
      await cliente(jest.fn(async () => respuesta(200, VIVO))).crear([], { titulo: 'M', descripcion: '' }),
      await cliente(jest.fn(async () => respuesta(422, { codigo: 'requisitos', clave: CLAVE }))).crear([], { titulo: 'M', descripcion: '' }),
      await cliente(jest.fn(async () => respuesta(401, {}))).crear([], { titulo: 'M', descripcion: '' }),
      await cliente(
        jest.fn(async () => {
          throw new Error(TOKEN + CLAVE);
        }),
      ).crear([], { titulo: 'M', descripcion: '' }),
    ];
    for (const e of espias) expect(e).not.toHaveBeenCalled();
    for (const r of resultados.slice(1)) {
      expect(JSON.stringify(r)).not.toContain(TOKEN);
      expect(JSON.stringify(r)).not.toContain(CLAVE);
    }
  });
});
