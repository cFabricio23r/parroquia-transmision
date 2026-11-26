// Tests de la API JS del transmisor con el módulo nativo simulado.
type Nativo = { conexion: string; motivo: string | null; kbps: number | null };
type Zonas = { top: number; bottom: number; left: number; right: number };

const CLAVE = 'FB-PRUEBA-MARCA-1111';

function cargar() {
  let alEvento: ((n: Nativo) => void) | null = null;
  let alServicio: ((n: { ok: boolean }) => void) | null = null;
  let alZonas: ((n: Zonas) => void) | null = null;
  const modulo = {
    medirAvisos: jest.fn(() => Promise.resolve({ termico: 2, temperatura: 40, fpsVideo: 30, bateria: { nivel: 70, escala: 100, estado: 3, enchufe: 0 } })),
    rangoZoom: jest.fn(() => Promise.resolve({ min: 1, max: 8 })),
    ponerZoom: jest.fn((_nivel: number) => Promise.resolve()),
    fijarBitrate: jest.fn((_kbps: number) => Promise.resolve()),
    fijarBrillo: jest.fn((_nivel: number) => Promise.resolve()),
    iniciar: jest.fn((_url: string, _clave: string) => Promise.resolve()),
    terminar: jest.fn(() => Promise.resolve()),
    prepararVista: jest.fn(() => Promise.resolve()),
    cambiarEscena: jest.fn((_escena: string) => Promise.resolve()),
    actualizarEstado: jest.fn((_json: string) => Promise.resolve()),
    limpiarTodo: jest.fn(() => Promise.resolve()),
    addListener: jest.fn((nombre: string, cb: (n: never) => void) => {
      if (nombre === 'onServicio') alServicio = cb as (n: { ok: boolean }) => void;
      else if (nombre === 'onZonas') alZonas = cb as (n: Zonas) => void;
      else alEvento = cb as (n: Nativo) => void;
      return { remove: jest.fn() };
    }),
  };
  jest.doMock('./src/TransmisorModule', () => ({ __esModule: true, default: modulo }));
  jest.doMock('./src/TransmisorView', () => ({ __esModule: true, default: () => null }));
  jest.doMock('./src/VistaPanel', () => ({ __esModule: true, default: () => null }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const api = require('./index') as typeof import('./index');
  const emitir = (n: Nativo) => alEvento?.(n);
  const emitirServicio = (n: { ok: boolean }) => alServicio?.(n);
  const emitirZonas = (n: Zonas) => alZonas?.(n);
  return { api, modulo, emitir, emitirServicio, emitirZonas };
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
    expect(cb).toHaveBeenCalledWith({ conexion: 'conectado', mbps: 3, mensaje: null, motivo: null, termico: null });
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

describe('limpiarTodo', () => {
  it('limpiarTodo llama al nativo y olvida el último estado', async () => {
    const { api, modulo } = cargar();
    api.actualizarEstado('{"a":1}');
    await api.limpiarTodo();
    api.actualizarEstado('{"a":1}');
    expect(modulo.limpiarTodo).toHaveBeenCalledTimes(1);
    expect(modulo.actualizarEstado).toHaveBeenCalledTimes(2);
  });

  it('después de limpiarTodo la misma escena se vuelve a pedir', async () => {
    const { api, modulo } = cargar();
    await api.cambiarEscena('inicio');
    await api.limpiarTodo();
    await api.cambiarEscena('inicio');
    expect(modulo.cambiarEscena).toHaveBeenCalledTimes(2);
  });

  it('limpiarTodo rechaza si el nativo rechaza y no olvida', async () => {
    const { api, modulo } = cargar();
    modulo.limpiarTodo.mockImplementationOnce(() => Promise.reject(new Error('EN_VIVO')));
    api.actualizarEstado('{"a":1}');
    await expect(api.limpiarTodo()).rejects.toThrow('EN_VIVO');
    api.actualizarEstado('{"a":1}');
    expect(modulo.actualizarEstado).toHaveBeenCalledTimes(1);
  });
});

describe('servicio en primer plano (review M4)', () => {
  it('si el servicio no arrancó, avisa con un mensaje en español', () => {
    const { api, emitirServicio } = cargar();
    const cb = jest.fn();
    api.addServicioListener(cb);
    emitirServicio({ ok: false });
    expect(cb).toHaveBeenCalledWith('No se pudo mantener la transmisión en segundo plano. No salga de la app.');
  });

  it('si arrancó bien no avisa nada', () => {
    const { api, emitirServicio } = cargar();
    const cb = jest.fn();
    api.addServicioListener(cb);
    emitirServicio({ ok: true });
    expect(cb).not.toHaveBeenCalled();
  });

  it('remove deja de avisar', () => {
    const { api, emitirServicio } = cargar();
    const cb = jest.fn();
    api.addServicioListener(cb).remove();
    emitirServicio({ ok: false });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('medirAvisos (review M5)', () => {
  it('usa la medición liviana del nativo, sin la memoria', async () => {
    const { api, modulo } = cargar();
    await expect(api.medirAvisos()).resolves.toEqual({ termico: 2, temperatura: 40, fpsVideo: 30, bateria: { nivel: 70, escala: 100, estado: 3, enchufe: 0 } });
    expect(modulo.medirAvisos).toHaveBeenCalledTimes(1);
  });
});

describe('zoom (Tarea 9g)', () => {
  it('rangoZoom y ponerZoom pasan directo al nativo', async () => {
    const { api, modulo } = cargar();
    await expect(api.rangoZoom()).resolves.toEqual({ min: 1, max: 8 });
    await api.ponerZoom(2.5);
    expect(modulo.ponerZoom).toHaveBeenCalledWith(2.5);
  });
});

describe('fijarBitrate (Tarea 2 del plan de rendimiento)', () => {
  it('pasa los kbps al nativo tal cual', async () => {
    const { api, modulo } = cargar();
    await api.fijarBitrate(1800);
    expect(modulo.fijarBitrate).toHaveBeenCalledWith(1800);
  });

  it('con un dev client viejo, sin la función nativa, rechaza en vez de tirar en el acto', async () => {
    const { api, modulo } = cargar();
    delete (modulo as Record<string, unknown>).fijarBitrate;
    let r: Promise<void> | undefined;
    expect(() => {
      r = api.fijarBitrate(1800);
    }).not.toThrow();
    await expect(r).rejects.toBeInstanceOf(TypeError);
  });
});

describe('fijarOrientacion (review m2 de la 9c)', () => {
  it('con un dev client viejo, sin la función nativa, rechaza en vez de tirar en el acto', async () => {
    const { api } = cargar();
    let r: Promise<void> | undefined;
    expect(() => {
      r = api.fijarOrientacion('vertical');
    }).not.toThrow();
    await expect(r).rejects.toBeInstanceOf(TypeError);
  });
});

describe('fijarEstiloFinal (Tarea 9d)', () => {
  it('pasa al nativo solo claro o azul', async () => {
    const { api, modulo } = cargar();
    const fijar = jest.fn((_e: string) => Promise.resolve());
    (modulo as Record<string, unknown>).fijarEstiloFinal = fijar;
    await api.fijarEstiloFinal('claro');
    await api.fijarEstiloFinal('rojo' as never);
    expect(fijar.mock.calls.map((c) => c[0])).toEqual(['claro', 'azul']);
  });

  it('con un dev client viejo rechaza en vez de tirar en el acto', async () => {
    const { api } = cargar();
    let r: Promise<void> | undefined;
    expect(() => {
      r = api.fijarEstiloFinal('azul');
    }).not.toThrow();
    await expect(r).rejects.toBeInstanceOf(TypeError);
  });
});

describe('parroquia y copia guardada (etapa 3a)', () => {
  // Pone funciones nativas nuevas en el módulo simulado.
  function conNativo<T extends Record<string, jest.Mock>>(modulo: object, fns: T): T {
    Object.assign(modulo, fns);
    return fns;
  }

  it('fijarParroquia pasa el origen y el slug al nativo', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { fijarParroquia: jest.fn((_o: string, _s: string) => Promise.resolve()) });
    await api.fijarParroquia('https://p.app', 'ciudad-arce');
    expect(n.fijarParroquia).toHaveBeenCalledWith('https://p.app', 'ciudad-arce');
  });

  it('fijarParroquia rechaza un origen sin normalizar o un slug inválido sin llamar al nativo', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { fijarParroquia: jest.fn(() => Promise.resolve()) });
    await expect(api.fijarParroquia('https://p.app/', 'ciudad-arce')).rejects.toThrow('Parroquia inválida.');
    await expect(api.fijarParroquia('https://p.app/', 'x')).rejects.toThrow('Parroquia inválida.');
    await expect(api.fijarParroquia('https://p.app', "a');x")).rejects.toThrow('Parroquia inválida.');
    await expect(api.fijarParroquia('http://p.app', 'ciudad-arce')).rejects.toThrow('Parroquia inválida.');
    expect(n.fijarParroquia).not.toHaveBeenCalled();
  });

  it('fijarEnVivo pasa el valor al nativo', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { fijarEnVivo: jest.fn((_b: boolean) => Promise.resolve()) });
    await api.fijarEnVivo(true);
    expect(n.fijarEnVivo).toHaveBeenCalledWith(true);
  });

  it('descargarCopia rechaza un medio fuera de medios/ o un slug inválido sin llamar al nativo', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { descargarCopia: jest.fn(() => Promise.resolve({})) });
    await expect(api.descargarCopia('ciudad-arce', '{}', ['medios/../x.png'])).rejects.toBeInstanceOf(Error);
    await expect(api.descargarCopia('../x', '{}', [])).rejects.toBeInstanceOf(Error);
    expect(n.descargarCopia).not.toHaveBeenCalled();
  });

  it('descargarCopia pasa el slug, el config y los medios, y devuelve lo del nativo', async () => {
    const { api, modulo } = cargar();
    const r = { version: 3, guardadaEn: '2026-11-14T18:42:00Z', paginasCambiaron: true };
    const n = conNativo(modulo, { descargarCopia: jest.fn(() => Promise.resolve(r)) });
    await expect(api.descargarCopia('ciudad-arce', '{"a":1}', ['medios/logo.png'])).resolves.toEqual(r);
    expect(n.descargarCopia).toHaveBeenCalledWith('ciudad-arce', '{"a":1}', ['medios/logo.png']);
  });

  it.each([[null], [{}], [{ version: '3' }], [{ version: 3 }], [{ version: 3, guardadaEn: 5 }]])(
    'estadoCopia normaliza %p a null',
    async (valor) => {
      const { api, modulo } = cargar();
      conNativo(modulo, { estadoCopia: jest.fn(() => Promise.resolve(valor)) });
      await expect(api.estadoCopia('ciudad-arce')).resolves.toBeNull();
    },
  );

  it('estadoCopia devuelve una copia válida tal cual', async () => {
    const { api, modulo } = cargar();
    const e = { version: 3, guardadaEn: '2026-11-14T18:42:00Z' };
    const n = conNativo(modulo, { estadoCopia: jest.fn(() => Promise.resolve({ ...e, otro: 1 })) });
    await expect(api.estadoCopia('ciudad-arce')).resolves.toEqual(e);
    expect(n.estadoCopia).toHaveBeenCalledWith('ciudad-arce');
  });

  it('borrarCopia rechaza un slug inválido; borrarCopias y recargarEscenas llaman al nativo', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, {
      borrarCopia: jest.fn(() => Promise.resolve()),
      borrarCopias: jest.fn(() => Promise.resolve()),
      recargarEscenas: jest.fn(() => Promise.resolve()),
    });
    await expect(api.borrarCopia('../x')).rejects.toBeInstanceOf(Error);
    expect(n.borrarCopia).not.toHaveBeenCalled();
    await api.borrarCopia('ciudad-arce');
    await api.borrarCopias();
    await api.recargarEscenas();
    expect(n.borrarCopia).toHaveBeenCalledWith('ciudad-arce');
    expect(n.borrarCopias).toHaveBeenCalled();
    expect(n.recargarEscenas).toHaveBeenCalled();
  });
});

describe('archivos de datos de la app (etapa 3b)', () => {
  function conNativo<T extends Record<string, jest.Mock>>(modulo: object, fns: T): T {
    Object.assign(modulo, fns);
    return fns;
  }

  it('guardarDatosApp llama al nativo con un nombre válido', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { guardarDatosApp: jest.fn((_n: string, _t: string) => Promise.resolve()) });
    await api.guardarDatosApp('semana-ciudad-arce', '{}');
    expect(n.guardarDatosApp).toHaveBeenCalledWith('semana-ciudad-arce', '{}');
  });

  it('guardarDatosApp rechaza nombres malos sin llamar al nativo', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { guardarDatosApp: jest.fn(() => Promise.resolve()) });
    await expect(api.guardarDatosApp('../x', '')).rejects.toBeInstanceOf(Error);
    await expect(api.guardarDatosApp('A', '')).rejects.toBeInstanceOf(Error);
    await expect(api.guardarDatosApp('a'.repeat(81), '')).rejects.toBeInstanceOf(Error);
    expect(n.guardarDatosApp).not.toHaveBeenCalled();
  });

  it('leerDatosApp pasa el nombre y devuelve el texto', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { leerDatosApp: jest.fn((_n: string) => Promise.resolve('{"a":1}')) });
    await expect(api.leerDatosApp('semana-ciudad-arce')).resolves.toBe('{"a":1}');
    expect(n.leerDatosApp).toHaveBeenCalledWith('semana-ciudad-arce');
  });

  it('borrarDatosApp acepta un prefijo y rechaza el vacío', async () => {
    const { api, modulo } = cargar();
    const n = conNativo(modulo, { borrarDatosApp: jest.fn((_p: string) => Promise.resolve()) });
    await api.borrarDatosApp('semana-');
    expect(n.borrarDatosApp).toHaveBeenCalledWith('semana-');
    await expect(api.borrarDatosApp('')).rejects.toBeInstanceOf(Error);
    expect(n.borrarDatosApp).toHaveBeenCalledTimes(1);
  });
});

describe('addZonasListener (Tarea 9i)', () => {
  it('pasa cada aviso nativo de zonas a los oyentes', () => {
    const { api, emitirZonas } = cargar();
    const cb = jest.fn();
    api.addZonasListener(cb);
    emitirZonas({ top: 0, bottom: 0, left: 0, right: 48 });
    expect(cb).toHaveBeenCalledWith({ top: 0, bottom: 0, left: 0, right: 48 });
  });

  it('después de remove() no avisa más', () => {
    const { api, emitirZonas } = cargar();
    const cb = jest.fn();
    api.addZonasListener(cb).remove();
    emitirZonas({ top: 24, bottom: 48, left: 0, right: 0 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('un aviso con valores que no son números se ignora', () => {
    const { api, emitirZonas } = cargar();
    const cb = jest.fn();
    api.addZonasListener(cb);
    emitirZonas({ top: Number.NaN, bottom: 0, left: 0, right: 0 });
    emitirZonas({ bottom: 0, left: 0, right: 0 } as unknown as Zonas);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('fijarBrillo (Tarea 3 del plan de rendimiento)', () => {
  it('pasa el nivel al nativo tal cual', async () => {
    const { api, modulo } = cargar();
    await api.fijarBrillo(0.1);
    expect(modulo.fijarBrillo).toHaveBeenCalledWith(0.1);
  });

  it('con un dev client viejo, sin la función nativa, rechaza en vez de tirar en el acto', async () => {
    const { api, modulo } = cargar();
    delete (modulo as Record<string, unknown>).fijarBrillo;
    let r: Promise<void> | undefined;
    expect(() => {
      r = api.fijarBrillo(0.1);
    }).not.toThrow();
    await expect(r).rejects.toBeInstanceOf(TypeError);
  });
});
