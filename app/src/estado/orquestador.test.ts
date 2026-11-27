import { ErrorTransmisor, MENSAJES } from '../../modules/transmisor/src/eventos';
import type { Ajustes } from '../ajustes/ajustes';
import {
  ESPERA_TERMINAR_MS,
  MENSAJE_AJUSTES_ILEGIBLES,
  MENSAJE_FACEBOOK_RESPALDO,
  MENSAJE_TERMINAR_LENTO,
  crearOrquestador,
  type DepsOrquestador,
} from './orquestador';
import type { Escena } from './transmision';

// Clave falsa: nunca una clave real en los tests.
const AJUSTES: Ajustes = {
  servidor: 'rtmps://live-api-s.facebook.com:443/rtmp/',
  clave: 'FB-PRUEBA-MARCA-0000',
  calidad: '720p',
  microfono: 'celular',
  estiloFinal: 'azul',
};

type Pendiente = { resolver: () => void; rechazar: (e: unknown) => void };

function promesa(): { p: Promise<void> } & Pendiente {
  let resolver!: () => void;
  let rechazar!: (e: unknown) => void;
  const p = new Promise<void>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { p, resolver, rechazar };
}

const vaciar = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

// Dependencias falsas: cambiarEscena e iniciar quedan pendientes hasta que el test las resuelve.
function armar(extra: Partial<DepsOrquestador> = {}) {
  const escenas: Array<{ escena: Escena } & Pendiente> = [];
  const inicios: Pendiente[] = [];
  const d = {
    leerAjustes: jest.fn(async () => ({ ...AJUSTES })),
    cambiarEscena: jest.fn((escena: Escena) => {
      const x = promesa();
      escenas.push({ escena, resolver: x.resolver, rechazar: x.rechazar });
      return x.p;
    }),
    iniciar: jest.fn(() => {
      const x = promesa();
      inicios.push({ resolver: x.resolver, rechazar: x.rechazar });
      return x.p;
    }),
    terminar: jest.fn(async () => {}),
    alArrancar: jest.fn(),
    abrirAjustes: jest.fn(),
    avisar: jest.fn(),
    volverAPreparar: jest.fn(),
    ...extra,
  };
  const o = crearOrquestador(d);
  return { o, d, escenas, inicios };
}

describe('iniciar', () => {
  it('camino feliz: escena Inicio primero, después iniciar con los Ajustes', async () => {
    const { o, d, escenas, inicios } = armar();
    const fin = o.iniciar();
    await vaciar();
    expect(o.tienda.obtener().fase).toBe('iniciando');
    expect(d.alArrancar).toHaveBeenCalledTimes(1);
    expect(escenas.map((x) => x.escena)).toEqual(['inicio']);
    expect(d.iniciar).not.toHaveBeenCalled();
    escenas[0].resolver();
    await vaciar();
    expect(d.iniciar).toHaveBeenCalledWith(AJUSTES.servidor, AJUSTES.clave);
    inicios[0].resolver();
    await fin;
    o.alEvento({ conexion: 'conectado', mbps: 2.5, mensaje: null, motivo: null });
    expect(o.tienda.obtener().fase).toBe('en_vivo');
  });

  it('con Ajustes que no validan abre Ajustes y no arranca', async () => {
    const { o, d } = armar({ leerAjustes: jest.fn(async () => ({ ...AJUSTES, clave: '' })) });
    await o.iniciar();
    expect(d.abrirAjustes).toHaveBeenCalledTimes(1);
    expect(o.tienda.obtener().fase).toBe('preparando');
    expect(d.cambiarEscena).not.toHaveBeenCalled();
  });

  it('si no se pueden leer los Ajustes avisa y no arranca', async () => {
    const { o, d } = armar({ leerAjustes: jest.fn(async () => Promise.reject(new Error('x'))) });
    await o.iniciar();
    expect(d.avisar).toHaveBeenLastCalledWith(MENSAJE_AJUSTES_ILEGIBLES);
    expect(o.tienda.obtener().fase).toBe('preparando');
  });

  it('doble toque: el segundo no hace nada', async () => {
    const { o, d, escenas } = armar();
    const a = o.iniciar();
    const b = o.iniciar();
    await vaciar();
    escenas.forEach((x) => x.resolver());
    await vaciar();
    expect(d.alArrancar).toHaveBeenCalledTimes(1);
    expect(d.iniciar).toHaveBeenCalledTimes(1);
    void a;
    void b;
  });

  it('si cambiarEscena falla igual arranca', async () => {
    const { o, d, escenas } = armar();
    void o.iniciar();
    await vaciar();
    escenas[0].rechazar(new Error('ERR_OCUPADO'));
    await vaciar();
    expect(d.iniciar).toHaveBeenCalledTimes(1);
  });

  it('Cancelar durante cambiarEscena: no llama a iniciar', async () => {
    const { o, d, escenas } = armar();
    const fin = o.iniciar();
    await vaciar();
    o.cancelar();
    expect(o.tienda.obtener().fase).toBe('preparando');
    escenas[0].resolver();
    await fin;
    expect(d.iniciar).not.toHaveBeenCalled();
  });

  it('I1: Iniciar → Cancelar → Iniciar dentro de la transición: el primero nunca arranca ni corta', async () => {
    const { o, d, escenas, inicios } = armar();
    const a = o.iniciar();
    await vaciar();
    o.cancelar();
    const b = o.iniciar();
    await vaciar();
    expect(o.tienda.obtener().fase).toBe('iniciando');
    // La transición del intento A termina primero: A no debe llamar a iniciar.
    escenas[0].resolver();
    await a;
    expect(d.iniciar).not.toHaveBeenCalled();
    // B sigue su camino normal.
    escenas[escenas.length - 1].resolver();
    await vaciar();
    expect(d.iniciar).toHaveBeenCalledTimes(1);
    inicios[0].resolver();
    await b;
    o.alEvento({ conexion: 'conectado', mbps: 2.5, mensaje: null, motivo: null });
    expect(o.tienda.obtener().fase).toBe('en_vivo');
    expect(o.tienda.obtener().error).toBeNull();
  });

  it('I1: el rechazo de un intento viejo no despacha cortado', async () => {
    const { o, d, escenas, inicios } = armar();
    const a = o.iniciar();
    await vaciar();
    escenas[0].resolver();
    await vaciar();
    expect(d.iniciar).toHaveBeenCalledTimes(1);
    // Cancelar mientras el nativo arranca, y arrancar de nuevo.
    o.cancelar();
    const b = o.iniciar();
    await vaciar();
    // El nativo rechaza el intento A (p. ej. ERR_OCUPADO): no debe cortar a B.
    inicios[0].rechazar(new ErrorTransmisor('ocupado', MENSAJES.ocupado));
    await a;
    expect(o.tienda.obtener().fase).toBe('iniciando');
    expect(o.tienda.obtener().error).toBeNull();
    escenas[escenas.length - 1].resolver();
    await vaciar();
    inicios[1].resolver();
    await b;
  });

  it('ERR_OCUPADO del intento vigente: cortado con el mensaje y vuelve a preparando', async () => {
    const { o, escenas, inicios } = armar();
    const fin = o.iniciar();
    await vaciar();
    escenas[0].resolver();
    await vaciar();
    inicios[0].rechazar(new ErrorTransmisor('ocupado', MENSAJES.ocupado));
    await fin;
    expect(o.tienda.obtener().fase).toBe('preparando');
    expect(o.tienda.obtener().error).toBe(MENSAJES.ocupado);
  });

  it('un error que no es ErrorTransmisor da el mensaje genérico', async () => {
    const { o, escenas, inicios } = armar();
    const fin = o.iniciar();
    await vaciar();
    escenas[0].resolver();
    await vaciar();
    inicios[0].rechazar(new Error('texto del nativo con datos'));
    await fin;
    expect(o.tienda.obtener().error).toBe(MENSAJES.noInicia);
  });

  it('ERR_SIN_PREPARAR: corta y vuelve a preparar la cámara', async () => {
    const { o, d, escenas, inicios } = armar();
    const fin = o.iniciar();
    await vaciar();
    escenas[0].resolver();
    await vaciar();
    inicios[0].rechazar(new ErrorTransmisor('preparar', MENSAJES.preparar));
    await fin;
    expect(d.volverAPreparar).toHaveBeenCalledTimes(1);
  });
});

describe('eventos del nativo', () => {
  async function enVivo() {
    const x = armar();
    const fin = x.o.iniciar();
    await vaciar();
    x.escenas[0].resolver();
    await vaciar();
    x.inicios[0].resolver();
    await fin;
    x.o.alEvento({ conexion: 'conectado', mbps: 2.5, mensaje: null, motivo: null });
    return x;
  }

  it('corte con motivo preparar → volverAPreparar', async () => {
    const { o, d } = await enVivo();
    o.alEvento({ conexion: 'cortado', mbps: null, mensaje: MENSAJES.preparar, motivo: 'preparar' });
    expect(d.volverAPreparar).toHaveBeenCalledTimes(1);
    expect(o.tienda.obtener().fase).toBe('preparando');
  });

  it('corte con otro motivo no vuelve a preparar', async () => {
    const { o, d } = await enVivo();
    o.alEvento({ conexion: 'cortado', mbps: null, mensaje: MENSAJES.agotado, motivo: 'agotado' });
    expect(d.volverAPreparar).not.toHaveBeenCalled();
  });

  it('seguir con la señal todavía caída vuelve a reconectando', async () => {
    const { o } = await enVivo();
    o.alEvento({ conexion: 'reconectando', mbps: null, mensaje: MENSAJES.reconectando, motivo: 'red' });
    o.terminarConGracias();
    expect(o.tienda.obtener().fase).toBe('terminando');
    o.seguir();
    expect(o.tienda.obtener().fase).toBe('reconectando');
  });

  it('seguir con señal buena vuelve a en_vivo', async () => {
    const { o } = await enVivo();
    o.terminarConGracias();
    o.seguir();
    expect(o.tienda.obtener().fase).toBe('en_vivo');
  });
});

describe('terminar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  async function enVivo(extra: Partial<DepsOrquestador> = {}) {
    const x = armar(extra);
    const fin = x.o.iniciar();
    await vaciar();
    x.escenas[0].resolver();
    await vaciar();
    x.inicios[0].resolver();
    await fin;
    x.o.alEvento({ conexion: 'conectado', mbps: 2.5, mensaje: null, motivo: null });
    return x;
  }

  it('terminar ahora llama a terminar() una vez y pasa a terminado', async () => {
    const { o, d } = await enVivo();
    o.terminarAhora();
    o.terminarAhora();
    await vaciar();
    expect(d.terminar).toHaveBeenCalledTimes(1);
    expect(o.tienda.obtener().fase).toBe('terminado');
  });

  it('Gracias: corta a los 10 tics', async () => {
    const { o, d } = await enVivo();
    o.terminarConGracias();
    for (let i = 0; i < 9; i++) o.tienda.despachar({ tipo: 'tic' });
    expect(d.terminar).not.toHaveBeenCalled();
    o.tienda.despachar({ tipo: 'tic' });
    await vaciar();
    expect(d.terminar).toHaveBeenCalledTimes(1);
    expect(o.tienda.obtener().fase).toBe('terminado');
  });

  it('M7: si terminar() no resuelve, pasa a terminado igual a los ESPERA_TERMINAR_MS y avisa', async () => {
    const { o, d } = await enVivo({ terminar: jest.fn(() => new Promise<void>(() => {})) });
    o.terminarAhora();
    await vaciar();
    expect(o.tienda.obtener().fase).toBe('terminando');
    jest.advanceTimersByTime(ESPERA_TERMINAR_MS - 1);
    expect(o.tienda.obtener().fase).toBe('terminando');
    jest.advanceTimersByTime(1);
    expect(o.tienda.obtener().fase).toBe('terminado');
    expect(d.avisar).toHaveBeenLastCalledWith(MENSAJE_TERMINAR_LENTO);
  });

  it('M7: si terminar() resuelve a tiempo, no hay aviso ni doble terminado', async () => {
    const { o, d } = await enVivo();
    o.terminarAhora();
    await vaciar();
    jest.advanceTimersByTime(ESPERA_TERMINAR_MS * 2);
    expect(d.avisar).not.toHaveBeenCalledWith(MENSAJE_TERMINAR_LENTO);
    expect(o.tienda.obtener().fase).toBe('terminado');
  });

  it('m2: un terminar() que resuelve tarde, con un iniciar nuevo en el medio, no toca el arranque nuevo', async () => {
    let soltarTerminar!: () => void;
    const x = await enVivo({
      terminar: jest.fn(
        () =>
          new Promise<void>((res) => {
            soltarTerminar = res;
          }),
      ),
    });
    x.o.terminarAhora();
    await vaciar();
    jest.advanceTimersByTime(ESPERA_TERMINAR_MS);
    expect(x.o.tienda.obtener().fase).toBe('terminado');
    // Arranque nuevo mientras el terminar() viejo sigue colgado.
    const fin = x.o.iniciar();
    await vaciar();
    expect(x.o.tienda.obtener().fase).toBe('iniciando');
    const oyente = jest.fn();
    x.o.tienda.suscribir(oyente);
    soltarTerminar();
    await vaciar();
    expect(oyente).not.toHaveBeenCalled();
    expect(x.o.tienda.obtener().fase).toBe('iniciando');
    x.escenas[1].resolver();
    await vaciar();
    expect(x.d.iniciar).toHaveBeenCalledTimes(2);
    x.inicios[1].resolver();
    await fin;
    x.o.alEvento({ conexion: 'conectado', mbps: 2, mensaje: null, motivo: null });
    expect(x.o.tienda.obtener().fase).toBe('en_vivo');
    expect(x.d.terminar).toHaveBeenCalledTimes(1);
  });

  it('m3: si terminar() lanza de forma síncrona, el despacho no falla y pasa a terminado', async () => {
    const { o } = await enVivo({
      terminar: jest.fn(() => {
        throw new Error('síncrono');
      }),
    });
    const oyente = jest.fn();
    o.tienda.suscribir(oyente);
    expect(() => o.terminarAhora()).not.toThrow();
    expect(oyente).toHaveBeenCalled();
    await vaciar();
    expect(o.tienda.obtener().fase).toBe('terminado');
  });

  it('un corte que vuelve a preparando llama a terminar() pero no despacha terminado', async () => {
    const { o, d } = await enVivo();
    o.alEvento({ conexion: 'cortado', mbps: null, mensaje: MENSAJES.agotado, motivo: 'agotado' });
    await vaciar();
    jest.advanceTimersByTime(ESPERA_TERMINAR_MS);
    expect(d.terminar).toHaveBeenCalledTimes(1);
    expect(o.tienda.obtener().fase).toBe('preparando');
    expect(o.tienda.obtener().error).toBe(MENSAJES.agotado);
  });
});

describe('Facebook en vivo (pedirVivo / terminarVivo)', () => {
  type Vivo = { servidor: string; clave: string; id: string } | { error: true } | null;
  const VIVO = { servidor: 'rtmps://vivo.example:443/rtmp/', clave: 'VIVO-PRUEBA-0000', id: 'vivo-1' };

  // Lleva el arranque hasta pedirVivo (escena resuelta) y devuelve lo pendiente.
  async function conVivo(vivo: () => Promise<Vivo>, extra: Partial<DepsOrquestador> = {}) {
    const terminarVivo = jest.fn(async (_id: string) => {});
    const x = armar({ pedirVivo: jest.fn(vivo), terminarVivo, ...extra });
    const fin = x.o.iniciar();
    await vaciar();
    x.escenas[0].resolver();
    await vaciar();
    return { ...x, fin, terminarVivo };
  }

  it('con un vivo, iniciar recibe el servidor y la clave del vivo, no los de Ajustes', async () => {
    const { d, fin, inicios } = await conVivo(async () => VIVO);
    expect(d.iniciar).toHaveBeenCalledWith(VIVO.servidor, VIVO.clave);
    expect(d.iniciar).not.toHaveBeenCalledWith(AJUSTES.servidor, AJUSTES.clave);
    inicios[0].resolver();
    await fin;
  });

  it('con {error:true} y clave válida: usa la clave de Ajustes y avisa', async () => {
    const { d, fin, inicios } = await conVivo(async () => ({ error: true }));
    expect(d.avisar).toHaveBeenLastCalledWith(MENSAJE_FACEBOOK_RESPALDO);
    expect(MENSAJE_FACEBOOK_RESPALDO).toBe('Facebook no respondió: se usa la clave de transmisión de la parroquia.');
    expect(d.iniciar).toHaveBeenCalledWith(AJUSTES.servidor, AJUSTES.clave);
    inicios[0].resolver();
    await fin;
  });

  it('si pedirVivo rechaza, se trata como {error:true}', async () => {
    const { d, fin, inicios } = await conVivo(() => Promise.reject(new Error('x')));
    expect(d.avisar).toHaveBeenLastCalledWith(MENSAJE_FACEBOOK_RESPALDO);
    expect(d.iniciar).toHaveBeenCalledWith(AJUSTES.servidor, AJUSTES.clave);
    inicios[0].resolver();
    await fin;
  });

  it('con {error:true} y sin clave: abre Ajustes, no arranca y vuelve a preparando', async () => {
    const { o, d, fin } = await conVivo(async () => ({ error: true }), {
      leerAjustes: jest.fn(async () => ({ ...AJUSTES, clave: '' })),
    });
    await fin;
    expect(d.abrirAjustes).toHaveBeenCalledTimes(1);
    expect(d.iniciar).not.toHaveBeenCalled();
    expect(d.avisar).not.toHaveBeenCalledWith(MENSAJE_FACEBOOK_RESPALDO);
    expect(o.tienda.obtener().fase).toBe('preparando');
  });

  it('con null y sin clave: abre Ajustes como hoy', async () => {
    const { o, d, fin } = await conVivo(async () => null, {
      leerAjustes: jest.fn(async () => ({ ...AJUSTES, clave: '' })),
    });
    await fin;
    expect(d.abrirAjustes).toHaveBeenCalledTimes(1);
    expect(d.iniciar).not.toHaveBeenCalled();
    expect(o.tienda.obtener().fase).toBe('preparando');
  });

  it('con un vivo y sin clave en Ajustes arranca igual (la clave fija no hace falta)', async () => {
    const { d, fin, inicios } = await conVivo(async () => VIVO, {
      leerAjustes: jest.fn(async () => ({ ...AJUSTES, clave: '' })),
    });
    expect(d.abrirAjustes).not.toHaveBeenCalled();
    expect(d.iniciar).toHaveBeenCalledWith(VIVO.servidor, VIVO.clave);
    inicios[0].resolver();
    await fin;
  });

  it('con null usa los Ajustes como hoy, sin aviso', async () => {
    const { d, fin, inicios } = await conVivo(async () => null);
    expect(d.iniciar).toHaveBeenCalledWith(AJUSTES.servidor, AJUSTES.clave);
    expect(d.avisar).not.toHaveBeenCalledWith(MENSAJE_FACEBOOK_RESPALDO);
    inicios[0].resolver();
    await fin;
  });

  it('Cancelar mientras pedirVivo está pendiente: no llama a iniciar y cierra el vivo que llegue tarde', async () => {
    let soltar!: (v: Vivo) => void;
    const { o, d, fin, terminarVivo } = await conVivo(() => new Promise<Vivo>((res) => (soltar = res)));
    expect(d.iniciar).not.toHaveBeenCalled();
    o.cancelar();
    soltar(VIVO);
    await fin;
    await vaciar();
    expect(d.iniciar).not.toHaveBeenCalled();
    expect(terminarVivo).toHaveBeenCalledWith(VIVO.id);
    expect(o.tienda.obtener().fase).toBe('preparando');
  });

  it('pedirVivo va después de la escena Inicio: nada se pide antes', async () => {
    const pedirVivo = jest.fn(async (): Promise<Vivo> => null);
    const { o, escenas } = armar({ pedirVivo });
    void o.iniciar();
    await vaciar();
    expect(pedirVivo).not.toHaveBeenCalled();
    escenas[0].resolver();
    await vaciar();
    expect(pedirVivo).toHaveBeenCalledTimes(1);
  });

  describe('terminar', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    async function enVivoConId(terminarVivo: (id: string) => Promise<void>) {
      const x = await conVivo(async () => VIVO, { terminarVivo: jest.fn(terminarVivo) });
      x.inicios[0].resolver();
      await x.fin;
      x.o.alEvento({ conexion: 'conectado', mbps: 2.5, mensaje: null, motivo: null });
      return x;
    }

    it('llama a terminarVivo(id) una vez', async () => {
      const x = await enVivoConId(async () => {});
      x.o.terminarAhora();
      await vaciar();
      expect(x.d.terminarVivo).toHaveBeenCalledTimes(1);
      expect(x.d.terminarVivo).toHaveBeenCalledWith(VIVO.id);
      expect(x.o.tienda.obtener().fase).toBe('terminado');
    });

    it('si el primer intento rechaza, hace uno más y nunca tres', async () => {
      const x = await enVivoConId(() => Promise.reject(new Error('x')));
      x.o.terminarAhora();
      await vaciar();
      await vaciar();
      expect(x.d.terminarVivo).toHaveBeenCalledTimes(2);
      expect(x.o.tienda.obtener().fase).toBe('terminado');
    });

    it('no bloquea el pase a terminado si terminarVivo nunca responde', async () => {
      const x = await enVivoConId(() => new Promise<void>(() => {}));
      x.o.terminarAhora();
      await vaciar();
      expect(x.o.tienda.obtener().fase).toBe('terminado');
    });

    it('un segundo corte no vuelve a cerrar el mismo vivo', async () => {
      const x = await enVivoConId(async () => {});
      x.o.terminarAhora();
      await vaciar();
      x.o.terminarAhora();
      await vaciar();
      expect(x.d.terminarVivo).toHaveBeenCalledTimes(1);
    });

    it('sin vivo (clave fija), terminarVivo no se llama', async () => {
      const x = await conVivo(async () => null);
      x.inicios[0].resolver();
      await x.fin;
      x.o.alEvento({ conexion: 'conectado', mbps: 2.5, mensaje: null, motivo: null });
      x.o.terminarAhora();
      await vaciar();
      expect(x.terminarVivo).not.toHaveBeenCalled();
    });
  });
});
