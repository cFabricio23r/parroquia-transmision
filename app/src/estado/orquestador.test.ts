import { ErrorTransmisor, MENSAJES } from '../../modules/transmisor/src/eventos';
import type { Ajustes } from '../ajustes/ajustes';
import {
  ESPERA_TERMINAR_MS,
  MENSAJE_AJUSTES_ILEGIBLES,
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
