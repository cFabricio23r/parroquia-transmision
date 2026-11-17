import { avisosActivos, conexionParaAvisos, type EntradaAvisos } from './avisos';

// Todo bien: conectado, batería llena, fresco y con red.
const BIEN: EntradaAvisos = { conexion: 'conectado', bateria: 0.8, temperatura: 30, termico: 0, hayRed: true };

const ids = (e: Partial<EntradaAvisos>) => avisosActivos({ ...BIEN, ...e }).map((a) => a.id);

describe('avisosActivos', () => {
  it('todo bien da []', () => {
    expect(avisosActivos(BIEN)).toEqual([]);
  });

  it('bateria, temperatura y termico en null no dan aviso', () => {
    expect(avisosActivos({ ...BIEN, bateria: null, temperatura: null, termico: null })).toEqual([]);
  });

  it('reconectando da senal ámbar con el texto del plan', () => {
    expect(avisosActivos({ ...BIEN, conexion: 'reconectando' })).toEqual([
      {
        id: 'senal',
        nivel: 'ambar',
        titulo: 'Señal débil: reconectando…',
        detalle: 'No cierre la app. La transmisión sigue en cuanto vuelva la señal.',
      },
    ]);
  });

  it('cortado no da senal (el corte lo muestra la pantalla)', () => {
    expect(ids({ conexion: 'cortado' })).toEqual([]);
  });

  it('bateria <= 0,15 da bateria ámbar con el porcentaje', () => {
    expect(avisosActivos({ ...BIEN, bateria: 0.15 })).toEqual([
      { id: 'bateria', nivel: 'ambar', titulo: 'Batería 15 %', detalle: 'Conecte el cargador.' },
    ]);
    expect(avisosActivos({ ...BIEN, bateria: 0.07 })[0].titulo).toBe('Batería 7 %');
  });

  it('bateria de 0,16 no da aviso', () => {
    expect(ids({ bateria: 0.16 })).toEqual([]);
  });

  it('termico 4 (crítico) da calor rojo', () => {
    expect(avisosActivos({ ...BIEN, termico: 4 })).toEqual([
      {
        id: 'calor',
        nivel: 'rojo',
        titulo: 'El celular está muy caliente',
        detalle: 'Póngalo a la sombra, sin funda y en un cargador de pared.',
      },
    ]);
  });

  it('termico mayor que 4 también da calor rojo', () => {
    expect(avisosActivos({ ...BIEN, termico: 5 })[0].nivel).toBe('rojo');
  });

  // Misa del 2026-11-15: el estado 3 («severo») duró 80 min con la batería a 35–37 °C y el video a 30 fps.
  it('termico 3 sin temperatura alta no da aviso', () => {
    expect(ids({ termico: 3, temperatura: 35.7 })).toEqual([]);
    expect(ids({ termico: 3, temperatura: null })).toEqual([]);
  });

  it('temperatura >= 45 da calor rojo aunque termico sea bajo o null', () => {
    expect(avisosActivos({ ...BIEN, temperatura: 45, termico: 0 })[0]).toMatchObject({ id: 'calor', nivel: 'rojo' });
    expect(avisosActivos({ ...BIEN, temperatura: 47, termico: null })[0]).toMatchObject({ id: 'calor', nivel: 'rojo' });
  });

  it('temperatura de 44,9 da calor ámbar, no rojo', () => {
    expect(avisosActivos({ ...BIEN, temperatura: 44.9, termico: 3 })[0]).toMatchObject({ id: 'calor', nivel: 'ambar' });
  });

  it('calor rojo en 1080p agrega «Pase a 720p en Ajustes.»', () => {
    expect(avisosActivos({ ...BIEN, termico: 4, calidad: '1080p' })[0].detalle).toBe(
      'Póngalo a la sombra, sin funda y en un cargador de pared. Pase a 720p en Ajustes.',
    );
    expect(avisosActivos({ ...BIEN, temperatura: 45, calidad: '1080p' })[0].detalle).toBe(
      'Póngalo a la sombra, sin funda y en un cargador de pared. Pase a 720p en Ajustes.',
    );
    expect(avisosActivos({ ...BIEN, termico: 4, calidad: '720p' })[0].detalle).toBe(
      'Póngalo a la sombra, sin funda y en un cargador de pared.',
    );
  });

  // Prueba del 2026-11-07: Android marcó «moderado» con la batería a 32–35 °C. Solo cuentan los grados.
  it('termico 2 sin temperatura alta no da aviso', () => {
    expect(ids({ termico: 2, temperatura: 35 })).toEqual([]);
    expect(ids({ termico: 2, temperatura: null })).toEqual([]);
  });

  it('termico 2 con temperatura >= 42 da calor ámbar', () => {
    expect(avisosActivos({ ...BIEN, termico: 2, temperatura: 42 })).toEqual([
      { id: 'calor', nivel: 'ambar', titulo: 'El celular está caliente', detalle: 'Sáquelo del sol o quítele la funda.' },
    ]);
  });

  it('temperatura >= 42 da calor ámbar aunque termico sea bajo o null', () => {
    expect(avisosActivos({ ...BIEN, temperatura: 42 })[0]).toMatchObject({ id: 'calor', nivel: 'ambar' });
    expect(avisosActivos({ ...BIEN, temperatura: 44, termico: null })[0]).toMatchObject({ id: 'calor', nivel: 'ambar' });
  });

  it('temperatura de 41,9 y termico 1 no dan aviso', () => {
    expect(ids({ temperatura: 41.9, termico: 1 })).toEqual([]);
  });

  it('termico 4 con temperatura alta da un solo calor, rojo', () => {
    const r = avisosActivos({ ...BIEN, termico: 4, temperatura: 46 });
    expect(r).toHaveLength(1);
    expect(r[0].nivel).toBe('rojo');
  });

  it('sin red da sin_red rojo', () => {
    expect(avisosActivos({ ...BIEN, hayRed: false })).toEqual([
      { id: 'sin_red', nivel: 'rojo', titulo: 'Sin internet', detalle: 'Revise el wifi o los datos.' },
    ]);
  });

  it('con varios a la vez salen en el orden sin_red, senal, bateria, calor', () => {
    expect(ids({ hayRed: false, conexion: 'reconectando', bateria: 0.1, temperatura: 42 })).toEqual([
      'sin_red',
      'senal',
      'bateria',
      'calor',
    ]);
    expect(ids({ termico: 4, bateria: 0.05, hayRed: false })).toEqual(['sin_red', 'bateria', 'calor']);
  });

  it('valores no numéricos (NaN) no dan aviso', () => {
    expect(ids({ bateria: Number.NaN, temperatura: Number.NaN, termico: Number.NaN })).toEqual([]);
  });

  it('bateria negativa (expo-battery da -1 si no la conoce) no da aviso', () => {
    expect(ids({ bateria: -1 })).toEqual([]);
  });
});

describe('conexionParaAvisos (review M10)', () => {
  it('solo reconectando da senal; el resto cuenta como conectado', () => {
    expect(conexionParaAvisos('reconectando')).toBe('reconectando');
    for (const f of ['preparando', 'iniciando', 'en_vivo', 'terminando', 'terminado'] as const) {
      expect(conexionParaAvisos(f)).toBe('conectado');
    }
  });
});
