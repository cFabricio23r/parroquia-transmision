// Tests de la API JS del transmisor con el módulo nativo simulado.
type Nativo = { conexion: string; motivo: string | null; kbps: number | null };

const CLAVE = 'FB-PRUEBA-MARCA-1111';

function cargar() {
  let alEvento: ((n: Nativo) => void) | null = null;
  const modulo = {
    iniciar: jest.fn((_url: string, _clave: string) => Promise.resolve()),
    terminar: jest.fn(() => Promise.resolve()),
    prepararVista: jest.fn(() => Promise.resolve()),
    cambiarEscena: jest.fn((_escena: string) => Promise.resolve()),
    actualizarEstado: jest.fn((_json: string) => Promise.resolve()),
    addListener: jest.fn((_nombre: string, cb: (n: Nativo) => void) => {
      alEvento = cb;
      return { remove: jest.fn() };
    }),
  };
  jest.doMock('./src/TransmisorModule', () => ({ __esModule: true, default: modulo }));
  jest.doMock('./src/TransmisorView', () => ({ __esModule: true, default: () => null }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const api = require('./index') as typeof import('./index');
  const emitir = (n: Nativo) => alEvento?.(n);
  return { api, modulo, emitir };
}

// Deja correr las promesas ya resueltas (con temporizadores falsos).
async function vaciarMicrotareas() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('iniciar', () => {
  it('con datos inválidos rechaza la promesa (no lanza) y no llama al nativo', async () => {
    const { api, modulo } = cargar();
    let p: Promise<void> | undefined;
    expect(() => {
      p = api.iniciar('rtmps://x.com/rtmp/', '   ');
    }).not.toThrow();
    await expect(p).rejects.toBeInstanceOf(Error);
    expect(modulo.iniciar).not.toHaveBeenCalled();
  });

  it('pasa la URL armada y la clave recortada', async () => {
    const { api, modulo } = cargar();
    await api.iniciar(' rtmps://x.com/rtmp ', ' ' + CLAVE + '\n');
    expect(modulo.iniciar).toHaveBeenCalledWith('rtmps://x.com/rtmp/' + CLAVE, CLAVE);
  });

  it('el rechazo nativo se traduce a español y no lleva la clave', async () => {
    const { api, modulo } = cargar();
    modulo.iniciar.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('nativo ' + CLAVE), { code: 'ERR_REGISTRO_INSEGURO' })),
    );
    const e = await api.iniciar('rtmps://x.com/rtmp/', CLAVE).catch((x: Error) => x);
    expect((e as Error).message).toBe('No se puede transmitir de forma segura en este celular.');
    expect((e as Error).message).not.toContain(CLAVE);
  });
});

describe('addEstadoListener', () => {
  it('traduce los eventos nativos', () => {
    const { api, emitir } = cargar();
    const cb = jest.fn();
    api.addEstadoListener(cb);
    emitir({ conexion: 'conectado', motivo: null, kbps: 3000 });
    expect(cb).toHaveBeenCalledWith({ conexion: 'conectado', mbps: 3, mensaje: null, motivo: null });
  });

  it('remove deja de avisar', () => {
    const { api, emitir } = cargar();
    const cb = jest.fn();
    api.addEstadoListener(cb).remove();
    emitir({ conexion: 'conectado', motivo: null, kbps: null });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('tiempo máximo de inicio', () => {
  it('sin respuesta en 20 s → terminar() y «cortado» con mensaje genérico', async () => {
    const { api, modulo } = cargar();
    const cb = jest.fn();
    api.addEstadoListener(cb);
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    jest.advanceTimersByTime(19_999);
    expect(cb).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(modulo.terminar).toHaveBeenCalled();
    await vaciarMicrotareas();
    expect(cb).toHaveBeenCalledWith({
      conexion: 'cortado',
      mbps: null,
      mensaje: 'Facebook no respondió. Revise internet y vuelva a transmitir.',
      motivo: 'sin_respuesta',
    });
  });

  it('un «conectado» antes de tiempo cancela la espera', async () => {
    const { api, modulo, emitir } = cargar();
    const cb = jest.fn();
    api.addEstadoListener(cb);
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    emitir({ conexion: 'conectado', motivo: null, kbps: null });
    jest.advanceTimersByTime(60_000);
    expect(modulo.terminar).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('un «conectado» que llega antes de que resuelva el nativo también cancela', async () => {
    const { api, modulo, emitir } = cargar();
    api.addEstadoListener(jest.fn());
    modulo.iniciar.mockImplementationOnce(() => {
      emitir({ conexion: 'conectado', motivo: null, kbps: null });
      return Promise.resolve();
    });
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    jest.advanceTimersByTime(60_000);
    expect(modulo.terminar).not.toHaveBeenCalled();
  });

  it('terminar() cancela la espera', async () => {
    const { api, modulo } = cargar();
    const cb = jest.fn();
    api.addEstadoListener(cb);
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    await api.terminar();
    jest.advanceTimersByTime(60_000);
    expect(modulo.terminar).toHaveBeenCalledTimes(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('si el nativo rechaza no queda espera pendiente', async () => {
    const { api, modulo } = cargar();
    modulo.iniciar.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('x'), { code: 'ERR_OCUPADO' })),
    );
    const cb = jest.fn();
    api.addEstadoListener(cb);
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE).catch(() => undefined);
    jest.advanceTimersByTime(60_000);
    expect(modulo.terminar).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('tiempo máximo de inicio: «conectado» tardío (review N1)', () => {
  it('un «conectado» que llega mientras se termina queda antes del «cortado»: gana el corte', async () => {
    const { api, modulo, emitir } = cargar();
    let soltar: () => void = () => undefined;
    modulo.terminar.mockImplementationOnce(() => new Promise<void>((r) => (soltar = r)));
    const vistos: string[] = [];
    api.addEstadoListener((e) => vistos.push(e.conexion));
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    jest.advanceTimersByTime(20_000);
    // El nativo emitió «conectado» justo antes de procesar terminar().
    emitir({ conexion: 'conectado', motivo: null, kbps: null });
    soltar();
    await vaciarMicrotareas();
    expect(vistos).toEqual(['conectado', 'cortado']);
  });

  it('un iniciar() nuevo durante el terminar() del timeout no recibe el «cortado» viejo (review M8)', async () => {
    const { api, modulo } = cargar();
    let soltar: () => void = () => undefined;
    modulo.terminar.mockImplementationOnce(() => new Promise<void>((r) => (soltar = r)));
    const cb = jest.fn();
    api.addEstadoListener(cb);
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    jest.advanceTimersByTime(20_000);
    // Antes de que termine el terminar() del timeout, el operador vuelve a iniciar.
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    soltar();
    await vaciarMicrotareas();
    expect(cb).not.toHaveBeenCalled();
  });

  it('si terminar() falla al vencer la espera, igual se avisa el corte', async () => {
    const { api, modulo } = cargar();
    modulo.terminar.mockImplementationOnce(() => Promise.reject(new Error('x')));
    const cb = jest.fn();
    api.addEstadoListener(cb);
    await api.iniciar('rtmps://x.com/rtmp/', CLAVE);
    jest.advanceTimersByTime(20_000);
    await vaciarMicrotareas();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ conexion: 'cortado' }));
  });
});

describe('cambiarEscena', () => {
  it('llama al nativo y resuelve cuando termina la transición', async () => {
    const { api, modulo } = cargar();
    await api.cambiarEscena('inicio');
    expect(modulo.cambiarEscena).toHaveBeenCalledWith('inicio');
  });

  it('tres pedidos seguidos: el nativo recibe el primero y el último', async () => {
    const { api, modulo } = cargar();
    const fines: Array<() => void> = [];
    modulo.cambiarEscena.mockImplementation(() => new Promise<void>((r) => fines.push(r)));
    const todos = Promise.all([api.cambiarEscena('inicio'), api.cambiarEscena('portada'), api.cambiarEscena('gracias')]);
    await vaciarMicrotareas();
    fines[0]();
    await vaciarMicrotareas();
    fines[1]();
    await todos;
    expect(modulo.cambiarEscena.mock.calls.map((c) => c[0])).toEqual(['inicio', 'gracias']);
  });

  it('el primer pedido va siempre al nativo (tras recargar el JS el nativo manda)', async () => {
    const { api, modulo } = cargar();
    await api.cambiarEscena('camara');
    expect(modulo.cambiarEscena).toHaveBeenCalledWith('camara');
  });

  it('pedir otra vez la escena que ya se ve no llama al nativo', async () => {
    const { api, modulo } = cargar();
    await api.cambiarEscena('inicio');
    await api.cambiarEscena('inicio');
    expect(modulo.cambiarEscena).toHaveBeenCalledTimes(1);
  });
});

describe('actualizarEstado', () => {
  it('pasa el JSON tal cual al nativo (el escape lo hace el nativo con JSONObject.quote)', () => {
    const { api, modulo } = cargar();
    const json = JSON.stringify({ tipo: 'horasanta', texto: "comillas ' \" y </script>" });
    api.actualizarEstado(json);
    expect(modulo.actualizarEstado).toHaveBeenCalledWith(json);
  });

  it('el mismo estado dos veces seguidas no vuelve a llamar al nativo', () => {
    const { api, modulo } = cargar();
    api.actualizarEstado('{"a":1}');
    api.actualizarEstado('{"a":1}');
    api.actualizarEstado('{"a":2}');
    api.actualizarEstado('{"a":1}');
    expect(modulo.actualizarEstado.mock.calls.map((c) => c[0])).toEqual(['{"a":1}', '{"a":2}', '{"a":1}']);
  });
});
