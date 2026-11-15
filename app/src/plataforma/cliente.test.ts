import { crearClientePlataforma } from './cliente';

function respuesta(estado: number, cuerpo?: unknown): Response {
  const texto = cuerpo === undefined ? '' : typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  return { ok: estado >= 200 && estado < 300, status: estado, text: async () => texto } as unknown as Response;
}

let espias: jest.SpyInstance[] = [];
beforeEach(() => {
  espias = (['log', 'warn', 'error'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => {
  for (const e of espias) expect(e).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('pedirEnlaceContrasena', () => {
  it('pide el enlace a la ruta pública de la plataforma', async () => {
    const llamadas: Array<{ url: string; init: RequestInit }> = [];
    const f = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      return respuesta(200, { mensaje: 'M' });
    }) as unknown as typeof fetch;
    const r = await crearClientePlataforma({ origen: 'https://p.app', fetch: f }).pedirEnlaceContrasena('ana@x.com');
    expect(r).toEqual({ ok: true, valor: { mensaje: 'M' } });
    expect(llamadas[0].url).toBe('https://p.app/editor/olvide/pedir');
    expect(llamadas[0].init.method).toBe('POST');
    expect(llamadas[0].init.body).toBe('{"correo":"ana@x.com"}');
    expect((llamadas[0].init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('un rechazo da sin-conexion', async () => {
    const f = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const r = await crearClientePlataforma({ origen: 'https://p.app', fetch: f }).pedirEnlaceContrasena('ana@x.com');
    expect(r).toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
  });

  it('un 500 da sin-conexion y un 200 sin mensaje da servidor', async () => {
    const f500 = (async () => respuesta(500)) as unknown as typeof fetch;
    expect(await crearClientePlataforma({ origen: 'https://p.app', fetch: f500 }).pedirEnlaceContrasena('a@x.com')).toEqual({
      ok: false,
      error: { tipo: 'sin-conexion' },
    });
    const fRaro = (async () => respuesta(200, '<html>')) as unknown as typeof fetch;
    expect(await crearClientePlataforma({ origen: 'https://p.app', fetch: fRaro }).pedirEnlaceContrasena('a@x.com')).toEqual({
      ok: false,
      error: { tipo: 'servidor', estado: 200 },
    });
  });

  it('sin respuesta antes del plazo da sin-conexion', async () => {
    jest.useFakeTimers();
    const f = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    const p = crearClientePlataforma({ origen: 'https://p.app', fetch: f, plazoMs: 1000 }).pedirEnlaceContrasena('a@x.com');
    await jest.advanceTimersByTimeAsync(1001);
    await expect(p).resolves.toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
  });

  it('un origen inválido lanza al crear el cliente', () => {
    expect(() => crearClientePlataforma({ origen: 'http://p.app' })).toThrow();
  });
});
