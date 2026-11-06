import {
  CADA_MS,
  accionRegistro,
  medidaDesde,
  ENCABEZADO_REGISTRO,
  crearRegistrador,
  lineaRegistro,
  nombreRegistro,
  type DepsRegistrador,
  type Medida,
} from './registro';

// Clave y servidor falsos: nunca datos reales en los tests.
const CLAVE = 'FB-PRUEBA-MARCA-0000-SECRETO';
const SERVIDOR = 'rtmps://live-api-s.facebook.com:443/rtmp/';

const MEDIDA: Medida = {
  hora: new Date(2026, 10, 6, 14, 3, 30),
  termico: 2,
  temperatura: 41.26,
  bateria: 0.734,
  cargando: true,
  fpsCapa: 29.96,
  fpsVideo: 30,
  memoriaMb: 612.4,
  conexion: 'conectado',
  mbps: 2.46,
  escena: 'camara',
};

describe('lineaRegistro', () => {
  it('el encabezado nombra cada campo, en orden', () => {
    expect(ENCABEZADO_REGISTRO).toBe(
      'hora,termico,temperatura_c,bateria_pct,cargando,fps_capa,fps_video,memoria_mb,conexion,mbps,escena',
    );
  });

  it('tiene todos los campos, en el orden del encabezado', () => {
    expect(lineaRegistro(MEDIDA)).toBe('2026-11-06 14:03:30,2,41.3,73,si,30.0,30.0,612,conectado,2.5,camara');
    expect(lineaRegistro(MEDIDA).split(',')).toHaveLength(ENCABEZADO_REGISTRO.split(',').length);
  });

  it('los datos que faltan quedan vacíos', () => {
    const vacia: Medida = {
      hora: new Date(2026, 0, 2, 3, 4, 5),
      termico: null,
      temperatura: null,
      bateria: null,
      cargando: null,
      fpsCapa: null,
      fpsVideo: null,
      memoriaMb: null,
      conexion: null,
      mbps: null,
      escena: null,
    };
    expect(lineaRegistro(vacia)).toBe('2026-01-02 03:04:05,,,,,,,,,,');
  });

  it('sin cargar dice «no»; reconectando y escena gracias pasan tal cual', () => {
    expect(lineaRegistro({ ...MEDIDA, cargando: false, conexion: 'reconectando', escena: 'gracias' })).toBe(
      '2026-11-06 14:03:30,2,41.3,73,no,30.0,30.0,612,reconectando,2.5,gracias',
    );
  });

  it('nunca contiene la clave ni el servidor, aunque se los pasen por error', () => {
    // Campos de más, y la clave metida donde va texto o números.
    const mala = {
      ...MEDIDA,
      clave: CLAVE,
      servidor: SERVIDOR,
      url: `${SERVIDOR}${CLAVE}`,
      escena: CLAVE,
      conexion: `${SERVIDOR}${CLAVE}`,
      termico: CLAVE,
      temperatura: CLAVE,
      bateria: CLAVE,
      cargando: CLAVE,
      fpsCapa: CLAVE,
      fpsVideo: CLAVE,
      memoriaMb: CLAVE,
      mbps: CLAVE,
    } as unknown as Medida;
    const linea = lineaRegistro(mala);
    expect(linea).not.toContain(CLAVE);
    expect(linea).not.toContain('FB-');
    expect(linea).not.toContain('rtmp');
    expect(linea).not.toContain('facebook');
    expect(linea).toBe('2026-11-06 14:03:30,,,,,,,,,,');
  });

  it('una hora inválida queda vacía y no rompe la línea', () => {
    const linea = lineaRegistro({ ...MEDIDA, hora: new Date(Number.NaN) });
    expect(linea.startsWith(',')).toBe(true);
    expect(linea.split(',')).toHaveLength(11);
  });

  it('es una sola línea, sin saltos ni comas de más', () => {
    const linea = lineaRegistro({ ...MEDIDA, escena: 'a,b\nc' as unknown as Medida['escena'] });
    expect(linea).not.toMatch(/[\r\n]/);
    expect(linea.split(',')).toHaveLength(11);
  });
});

describe('nombreRegistro', () => {
  it('un archivo por transmisión, con fecha y hora', () => {
    expect(nombreRegistro(new Date(2026, 10, 6, 9, 5, 7))).toBe('registro-20261106-090507.csv');
  });
});

describe('crearRegistrador', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function deps(extra: Partial<DepsRegistrador> = {}) {
    const llamadas: string[] = [];
    const d: DepsRegistrador = {
      medir: jest.fn(async () => MEDIDA),
      abrir: jest.fn(async (nombre: string, encabezado: string) => {
        llamadas.push(`abrir ${nombre} ${encabezado}`);
      }),
      anotar: jest.fn(async (linea: string) => {
        llamadas.push(`anotar ${linea}`);
      }),
      cerrar: jest.fn(async () => {
        llamadas.push('cerrar');
      }),
      ahora: () => new Date(2026, 10, 6, 14, 0, 0),
      ...extra,
    };
    return { d, llamadas };
  }

  const vaciar = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  it('cada 30 s', () => {
    expect(CADA_MS).toBe(30_000);
  });

  it('empezar abre el archivo con el encabezado y anota enseguida; después cada 30 s', async () => {
    const { d, llamadas } = deps();
    const r = crearRegistrador(d);
    r.empezar();
    await vaciar();
    expect(llamadas).toEqual([
      `abrir registro-20261106-140000.csv ${ENCABEZADO_REGISTRO}`,
      `anotar ${lineaRegistro(MEDIDA)}`,
    ]);
    jest.advanceTimersByTime(CADA_MS);
    await vaciar();
    jest.advanceTimersByTime(CADA_MS);
    await vaciar();
    expect(llamadas.filter((l) => l.startsWith('anotar'))).toHaveLength(3);
  });

  it('empezar dos veces no abre dos archivos', async () => {
    const { d } = deps();
    const r = crearRegistrador(d);
    r.empezar();
    r.empezar();
    await vaciar();
    expect(d.abrir).toHaveBeenCalledTimes(1);
  });

  it('parar deja de anotar y cierra, después de lo pendiente', async () => {
    const { d, llamadas } = deps();
    const r = crearRegistrador(d);
    r.empezar();
    await vaciar();
    r.parar();
    await vaciar();
    jest.advanceTimersByTime(CADA_MS * 3);
    await vaciar();
    expect(llamadas[llamadas.length - 1]).toBe('cerrar');
    expect(llamadas.filter((l) => l.startsWith('anotar'))).toHaveLength(1);
    expect(d.cerrar).toHaveBeenCalledTimes(1);
  });

  it('parar sin haber empezado no hace nada', async () => {
    const { d } = deps();
    crearRegistrador(d).parar();
    await vaciar();
    expect(d.cerrar).not.toHaveBeenCalled();
  });

  it('una medida que llega después de parar no se anota', async () => {
    let soltar!: (m: Medida) => void;
    const { d, llamadas } = deps({ medir: jest.fn(() => new Promise<Medida>((res) => (soltar = res))) });
    const r = crearRegistrador(d);
    r.empezar();
    await vaciar();
    r.parar();
    soltar(MEDIDA);
    await vaciar();
    expect(llamadas.filter((l) => l.startsWith('anotar'))).toHaveLength(0);
  });

  it('si medir o anotar fallan, sigue en la próxima vuelta (el registro nunca corta la transmisión)', async () => {
    let n = 0;
    const { d } = deps({
      medir: jest.fn(async () => {
        n++;
        if (n === 1) throw new Error('falla');
        return MEDIDA;
      }),
    });
    const r = crearRegistrador(d);
    r.empezar();
    await vaciar();
    expect(d.anotar).not.toHaveBeenCalled();
    jest.advanceTimersByTime(CADA_MS);
    await vaciar();
    expect(d.anotar).toHaveBeenCalledTimes(1);
  });

  it('si abrir falla no anota nada, y se puede volver a empezar', async () => {
    let n = 0;
    const { d } = deps({
      abrir: jest.fn(async () => {
        n++;
        if (n === 1) throw new Error('sin disco');
      }),
    });
    const r = crearRegistrador(d);
    r.empezar();
    await vaciar();
    jest.advanceTimersByTime(CADA_MS);
    await vaciar();
    expect(d.anotar).not.toHaveBeenCalled();
    r.parar();
    await vaciar();
    r.empezar();
    await vaciar();
    expect(d.abrir).toHaveBeenCalledTimes(2);
    expect(d.anotar).toHaveBeenCalledTimes(1);
  });

  it('empezar después de parar abre un archivo nuevo', async () => {
    let t = 0;
    const { d } = deps({ ahora: () => new Date(2026, 10, 6, 14, 0, t++) });
    const r = crearRegistrador(d);
    r.empezar();
    await vaciar();
    r.parar();
    await vaciar();
    r.empezar();
    await vaciar();
    expect((d.abrir as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
      'registro-20261106-140000.csv',
      'registro-20261106-140001.csv',
    ]);
  });
});

describe('medidaDesde (review M10)', () => {
  const NATIVA = { termico: 1, temperatura: 38.4, memoriaMb: 500, fpsVideo: 30, fpsCapa: 29.5 };
  const ULTIMO = { bateria: 0.6, cargando: true, mbps: 2.4 };
  const AHORA = new Date(2026, 10, 6, 12, 0, 0);

  it('en_vivo: conectado, con los Mbps y la escena', () => {
    expect(medidaDesde({ fase: 'en_vivo', escena: 'camara' }, NATIVA, ULTIMO, AHORA)).toEqual({
      hora: AHORA,
      termico: 1,
      temperatura: 38.4,
      bateria: 0.6,
      cargando: true,
      fpsCapa: 29.5,
      fpsVideo: 30,
      memoriaMb: 500,
      conexion: 'conectado',
      mbps: 2.4,
      escena: 'camara',
    });
  });

  it('iniciando: la conexión y los Mbps quedan vacíos', () => {
    const m = medidaDesde({ fase: 'iniciando', escena: 'inicio' }, NATIVA, ULTIMO, AHORA);
    expect(m.conexion).toBeNull();
    expect(m.mbps).toBeNull();
  });

  it('reconectando: reconectando y sin Mbps', () => {
    const m = medidaDesde({ fase: 'reconectando', escena: 'inicio' }, NATIVA, ULTIMO, AHORA);
    expect(m.conexion).toBe('reconectando');
    expect(m.mbps).toBeNull();
  });

  it('terminando: conexión vacía y sin Mbps', () => {
    const m = medidaDesde({ fase: 'terminando', escena: 'gracias' }, NATIVA, ULTIMO, AHORA);
    expect(m.conexion).toBeNull();
    expect(m.mbps).toBeNull();
    expect(m.escena).toBe('gracias');
  });

  it('sin memoria del nativo queda null', () => {
    expect(medidaDesde({ fase: 'en_vivo', escena: 'camara' }, { ...NATIVA, memoriaMb: null }, ULTIMO, AHORA).memoriaMb).toBeNull();
  });
});

describe('accionRegistro (review M2)', () => {
  it('el archivo se abre recién en en_vivo: un arranque que falla no deja archivo', () => {
    expect(accionRegistro('en_vivo')).toBe('empezar');
    expect(accionRegistro('iniciando')).toBeNull();
  });

  it('reconectando y terminando siguen con lo que haya', () => {
    expect(accionRegistro('reconectando')).toBeNull();
    expect(accionRegistro('terminando')).toBeNull();
  });

  it('fuera del aire se para', () => {
    expect(accionRegistro('preparando')).toBe('parar');
    expect(accionRegistro('terminado')).toBe('parar');
  });
});
