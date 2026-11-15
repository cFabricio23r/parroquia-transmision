// La descarga de la copia de la parroquia (Tarea 14 del plan 3a): Review Focus 2 y 4.
import * as fs from 'fs';
import * as path from 'path';

import type { ResultadoCopia } from '../../modules/transmisor';
import { crearLimpiezas, crearSincronizador, type ContextoSincronizar } from '../sincronizar/sincronizar';
import type { ParroquiaApp } from '../sesion/tipos';
import {
  alCambiarPaginas,
  avisarCambioDePaginas,
  crearTareaPaginas,
  registrarCopias,
  rutasDeMedios,
  textoCopia,
  validarConfigBajada,
  type DepsCopias,
} from './copias';

const TEXTO_CONFIG = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'vicaria', 'ciudad-arce', 'config.json'),
  'utf8',
);
const CONFIG = JSON.parse(TEXTO_CONFIG) as Record<string, unknown>;
const PARROQUIA: ParroquiaApp = { id: 'id-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const MEDIOS = ['medios/fachada.jpg', 'medios/logo-blanco.png', 'medios/logo-color.png', 'medios/patrono.png'];

describe('rutasDeMedios', () => {
  it('junta las imágenes del config real, ordenadas y sin repetir', () => {
    expect(rutasDeMedios(CONFIG)).toEqual(MEDIOS);
  });

  it('deja afuera lo que no es medios/<archivo>', () => {
    const c = {
      a: { src: 'https://x/y.png' },
      b: [{ src: 'medios/../a.png' }, { src: 'medios/b.png' }, { src: 'medios/b.png' }],
      c: { src: 5 },
    };
    expect(rutasDeMedios(c)).toEqual(['medios/b.png']);
    expect(rutasDeMedios(null)).toEqual([]);
  });
});

describe('validarConfigBajada', () => {
  it('acepta el config de la parroquia con su versión', () => {
    expect(validarConfigBajada(TEXTO_CONFIG, 'ciudad-arce')).toEqual({ ok: true, version: CONFIG.version });
  });

  it('rechaza el de otra parroquia, una página de error, otro esquema y una versión mala', () => {
    expect(validarConfigBajada(TEXTO_CONFIG, 'otra-parroquia')).toEqual({ ok: false, motivo: 'slug' });
    expect(validarConfigBajada('<!doctype html><html></html>', 'ciudad-arce')).toEqual({ ok: false, motivo: 'json' });
    expect(validarConfigBajada('[1]', 'ciudad-arce')).toEqual({ ok: false, motivo: 'json' });
    expect(validarConfigBajada(JSON.stringify({ ...CONFIG, esquema: 2 }), 'ciudad-arce')).toEqual({
      ok: false,
      motivo: 'esquema',
    });
    expect(validarConfigBajada(JSON.stringify({ ...CONFIG, version: 0 }), 'ciudad-arce')).toEqual({
      ok: false,
      motivo: 'version',
    });
    expect(validarConfigBajada(JSON.stringify({ ...CONFIG, version: '3' }), 'ciudad-arce')).toEqual({
      ok: false,
      motivo: 'version',
    });
  });
});

// Un fetch falso que responde siempre lo mismo.
function fetchFalso(estado: number, cuerpo: string) {
  return jest.fn(async (_url: string, _init?: RequestInit) => ({ status: estado, text: async () => cuerpo }));
}

function armar(o: { estado?: number; cuerpo?: string; resultado?: ResultadoCopia } = {}) {
  const f = fetchFalso(o.estado ?? 200, o.cuerpo ?? TEXTO_CONFIG);
  const resultado = o.resultado ?? { version: 1, guardadaEn: '2026-11-14T18:42:00Z', paginasCambiaron: false };
  const nativo = {
    descargarCopia: jest.fn(async (_s: string, _c: string, _m: readonly string[]) => resultado),
    borrarCopia: jest.fn(async (_s: string) => undefined),
    borrarCopias: jest.fn(async () => undefined),
  };
  const cambios: string[] = [];
  const d: DepsCopias = {
    origen: 'https://p.app',
    fetch: f as unknown as typeof fetch,
    nativo,
    alCambiarPaginas: (slug) => cambios.push(slug),
  };
  return { f, nativo, cambios, d };
}

function contexto(enVivo: () => boolean = () => false): ContextoSincronizar {
  return {
    momento: 'antes-de-iniciar',
    parroquia: PARROQUIA,
    sesion: {} as ContextoSincronizar['sesion'],
    cliente: {} as ContextoSincronizar['cliente'],
    enVivo,
    sigueElegida: () => true,
  };
}

function base(enVivo?: () => boolean): Omit<ContextoSincronizar, 'momento'> {
  const { momento: _m, ...resto } = contexto(enVivo);
  return resto;
}

describe('la tarea «paginas» (Review Focus 4)', () => {
  it('pide el config sin caché y se lo pasa a lo nativo con sus medios', async () => {
    const { f, nativo, d } = armar();
    await crearTareaPaginas(d)(contexto());
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe('https://p.app/ciudad-arce/config.json');
    expect(f.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'GET', cache: 'no-store' }));
    expect(nativo.descargarCopia).toHaveBeenCalledWith('ciudad-arce', TEXTO_CONFIG, MEDIOS);
  });

  it.each([
    ['un 404', 404, TEXTO_CONFIG],
    ['un 200 con una página de error', 200, '<!doctype html><p>Error</p>'],
    ['el config de otra parroquia', 200, JSON.stringify({ ...CONFIG, slug: 'otra-parroquia' })],
    ['version 0', 200, JSON.stringify({ ...CONFIG, version: 0 })],
  ])('con %s no llama a lo nativo y la tarea lanza', async (_n, estado, cuerpo) => {
    const { nativo, d } = armar({ estado, cuerpo });
    await expect(crearTareaPaginas(d)(contexto())).rejects.toBeInstanceOf(Error);
    expect(nativo.descargarCopia).not.toHaveBeenCalled();
  });

  it('sin respuesta (red caída) lanza y no llama a lo nativo', async () => {
    const { nativo, d } = armar();
    d.fetch = jest.fn(async () => {
      throw new Error('sin red');
    }) as unknown as typeof fetch;
    await expect(crearTareaPaginas(d)(contexto())).rejects.toBeInstanceOf(Error);
    expect(nativo.descargarCopia).not.toHaveBeenCalled();
  });

  it('queda «fallo» en el sincronizador', async () => {
    const { d } = armar({ estado: 404 });
    const s = crearSincronizador();
    registrarCopias(s, crearLimpiezas(), d);
    const aviso = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(s.sincronizar('antes-de-iniciar', base())).resolves.toEqual({ paginas: 'fallo' });
    aviso.mockRestore();
  });
});

describe('la descarga y el vivo (Review Focus 2)', () => {
  it('si termina después de salir al aire, no avisa que cambiaron las páginas', async () => {
    let vivo = false;
    const { nativo, cambios, d } = armar();
    nativo.descargarCopia.mockImplementation(async () => {
      vivo = true; // el voluntario tocó «Iniciar» mientras se bajaba
      return { version: 1, guardadaEn: '2026-11-14T18:42:00Z', paginasCambiaron: true };
    });
    await crearTareaPaginas(d)(contexto(() => vivo));
    expect(nativo.descargarCopia).toHaveBeenCalled();
    expect(cambios).toEqual([]);
  });

  it('fuera del vivo avisa con el slug solo si cambiaron las páginas', async () => {
    const a = armar({ resultado: { version: 1, guardadaEn: 'x', paginasCambiaron: true } });
    await crearTareaPaginas(a.d)(contexto());
    expect(a.cambios).toEqual(['ciudad-arce']);
    const b = armar({ resultado: { version: 1, guardadaEn: 'x', paginasCambiaron: false } });
    await crearTareaPaginas(b.d)(contexto());
    expect(b.cambios).toEqual([]);
  });

  it('si ya está en vivo antes de empezar, no pide nada', async () => {
    const { f, nativo, d } = armar();
    await crearTareaPaginas(d)(contexto(() => true));
    expect(f).not.toHaveBeenCalled();
    expect(nativo.descargarCopia).not.toHaveBeenCalled();
  });

  it('si pasa a en vivo mientras se baja el config, no llama a lo nativo', async () => {
    let vivo = false;
    const { nativo, d } = armar();
    d.fetch = jest.fn(async () => {
      vivo = true;
      return { status: 200, text: async () => TEXTO_CONFIG };
    }) as unknown as typeof fetch;
    await crearTareaPaginas(d)(contexto(() => vivo));
    expect(nativo.descargarCopia).not.toHaveBeenCalled();
  });
});

describe('registrarCopias', () => {
  it('registra «paginas» para abrir y antes de iniciar, no al terminar', async () => {
    const { f, d } = armar();
    const s = crearSincronizador();
    registrarCopias(s, crearLimpiezas(), d);
    await expect(s.sincronizar('al-terminar', base())).resolves.toEqual({});
    expect(f).not.toHaveBeenCalled();
    await expect(s.sincronizar('abrir', base())).resolves.toEqual({ paginas: 'ok' });
  });

  it('la limpieza «copias» borra la de la parroquia o todas', async () => {
    const { nativo, d } = armar();
    const l = crearLimpiezas();
    registrarCopias(crearSincronizador(), l, d);
    await expect(l.limpiar({ tipo: 'parroquia', parroquia: PARROQUIA })).resolves.toEqual({ copias: 'ok' });
    expect(nativo.borrarCopia).toHaveBeenCalledWith('ciudad-arce');
    expect(nativo.borrarCopias).not.toHaveBeenCalled();
    await l.limpiar({ tipo: 'todo' });
    expect(nativo.borrarCopias).toHaveBeenCalledTimes(1);
  });
});

describe('alCambiarPaginas', () => {
  it('avisa a los suscritos hasta que se desuscriben', () => {
    const vistos: string[] = [];
    const quitar = alCambiarPaginas((s) => vistos.push(s));
    avisarCambioDePaginas('ciudad-arce');
    quitar();
    avisarCambioDePaginas('otra-parroquia');
    expect(vistos).toEqual(['ciudad-arce']);
  });
});

describe('textoCopia', () => {
  const ahora = new Date(2026, 10, 14, 21, 3);
  const en = (d: Date) => ({ version: 1, guardadaEn: d.toISOString() });

  it('hoy, ayer y otro día, con la hora local', () => {
    expect(textoCopia(en(new Date(2026, 10, 14, 18, 42)), ahora)).toBe('Pantallas guardadas hoy, 18:42');
    expect(textoCopia(en(new Date(2026, 10, 13, 20, 5)), ahora)).toBe('Pantallas guardadas ayer, 20:05');
    expect(textoCopia(en(new Date(2026, 10, 5, 10, 12)), ahora)).toBe('Pantallas guardadas el 5 nov, 10:12');
  });

  it('ayer también al cambiar de mes', () => {
    expect(textoCopia(en(new Date(2026, 9, 31, 9, 0)), new Date(2026, 10, 1, 8, 0))).toBe(
      'Pantallas guardadas ayer, 09:00',
    );
  });

  it('sin copia, o con una fecha que no se entiende', () => {
    expect(textoCopia(null, ahora)).toBe('Sin pantallas guardadas: se usan las de la app.');
    expect(textoCopia({ version: 1, guardadaEn: 'no-es-fecha' }, ahora)).toBe(
      'Sin pantallas guardadas: se usan las de la app.',
    );
  });
});
