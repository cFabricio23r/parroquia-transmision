// Tests de la API JS del transmisor con el módulo nativo simulado.
type Nativo = { conexion: string; motivo: string | null; kbps: number | null };

const CLAVE = 'FB-PRUEBA-MARCA-1111';

function cargar() {
  let alEvento: ((n: Nativo) => void) | null = null;
  const modulo = {
    iniciar: jest.fn((_url: string, _clave: string) => Promise.resolve()),
    terminar: jest.fn(() => Promise.resolve()),
    prepararVista: jest.fn(() => Promise.resolve()),
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
    expect(cb).toHaveBeenCalledWith({ conexion: 'conectado', mbps: 3, mensaje: null });
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
    expect(cb).toHaveBeenCalledWith({
      conexion: 'cortado',
      mbps: null,
      mensaje: 'Facebook no respondió. Revise internet y vuelva a transmitir.',
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
