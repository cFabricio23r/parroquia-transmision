// Pruebas del almacén de ajustes por parroquia. Las claves son falsas, solo para pruebas.
const mapa: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in mapa ? mapa[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    mapa[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete mapa[k];
  }),
}));

import * as SecureStore from 'expo-secure-store';
import { almacenAjustes as a, llavesDe } from './almacen';
import { AjustesDeParroquia, ClaveDeParroquia } from './origen';

const P: AjustesDeParroquia = { servidor: 'rtmps://p/', calidad: '1080p', estiloFinal: 'claro', actualizadoEn: '2026-11-14T10:00:00Z' };
const K: ClaveDeParroquia = { clave: 'FB-CLAVE-FALSA-1111', guardadaEn: '2026-11-14T10:00:00Z' };

beforeEach(() => {
  for (const k of Object.keys(mapa)) delete mapa[k];
});

describe('llaves', () => {
  it('una por cosa, con el slug adentro', () => {
    expect(llavesDe('ciudad-arce')).toEqual({
      parroquia: 'pev_app_ajustes_ciudad-arce_parroquia_v1',
      clave: 'pev_app_ajustes_ciudad-arce_clave_v1',
      celular: 'pev_app_ajustes_ciudad-arce_celular_v1',
    });
  });
  it('un slug inválido lanza', () => {
    expect(() => llavesDe("a');x")).toThrow('Parroquia inválida.');
  });
});

describe('guardar y leer', () => {
  it('devuelve lo mismo', async () => {
    await a.guardarDeParroquia('san-a', P, K);
    await a.guardarCelular('san-a', { servidor: 'rtmps://c/', clave: 'FB-CLAVE-FALSA-2222', calidad: '720p', claveParroquiaVista: null });
    await a.guardarMicrofono('externo');
    expect(await a.leer('san-a')).toEqual({
      parroquia: P,
      clave: K,
      celular: { servidor: 'rtmps://c/', clave: 'FB-CLAVE-FALSA-2222', calidad: '720p', claveParroquiaVista: null },
      microfono: 'externo',
    });
  });
  it('sin clave borra la llave de la clave', async () => {
    await a.guardarDeParroquia('san-a', P, K);
    await a.guardarDeParroquia('san-a', P, null);
    expect(mapa[llavesDe('san-a').clave]).toBeUndefined();
  });
  it('celular vacío borra la llave', async () => {
    await a.guardarCelular('san-a', { calidad: '720p' });
    await a.guardarCelular('san-a', {});
    expect(mapa[llavesDe('san-a').celular]).toBeUndefined();
  });
  it('guarda el servidor y la clave del celular recortados', async () => {
    await a.guardarCelular('san-a', { servidor: ' rtmps://x ', clave: 'FB-CLAVE-FALSA-2222\n' });
    expect(JSON.parse(mapa[llavesDe('san-a').celular])).toMatchObject({ servidor: 'rtmps://x', clave: 'FB-CLAVE-FALSA-2222' });
  });
});

describe('datos raros', () => {
  it('un JSON roto lee null o {}', async () => {
    const l = llavesDe('san-a');
    mapa[l.parroquia] = '{roto';
    mapa[l.clave] = '{roto';
    mapa[l.celular] = '{roto';
    expect(await a.leer('san-a')).toEqual({ parroquia: null, clave: null, celular: {}, microfono: 'celular' });
  });
  it('una calidad desconocida en el celular se ignora', async () => {
    mapa[llavesDe('san-a').celular] = JSON.stringify({ calidad: '4k', servidor: 'rtmps://c/' });
    expect((await a.leer('san-a')).celular).toEqual({ servidor: 'rtmps://c/' });
  });
  it('una clave guardada con espacios lee null', async () => {
    mapa[llavesDe('san-a').clave] = JSON.stringify({ clave: 'FB CLAVE', guardadaEn: K.guardadaEn });
    expect((await a.leer('san-a')).clave).toBeNull();
  });
  it('el micrófono sin guardar es el del celular', async () => {
    expect((await a.leer('san-a')).microfono).toBe('celular');
  });
  it('el almacén que falla al leer rechaza', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('fallo'));
    await expect(a.leer('san-a')).rejects.toBeDefined();
  });
});

describe('dos parroquias', () => {
  beforeEach(async () => {
    for (const s of ['san-a', 'san-b']) {
      await a.guardarDeParroquia(s, P, K);
      await a.guardarCelular(s, { calidad: '720p' });
    }
  });
  it('lo de A no aparece en B', async () => {
    await a.guardarCelular('san-a', { clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null });
    expect((await a.leer('san-b')).celular).toEqual({ calidad: '720p' });
  });
  it('borrarParroquia borra las tres de A y nada de B', async () => {
    await a.borrarParroquia('san-a');
    const la = llavesDe('san-a');
    const lb = llavesDe('san-b');
    expect([mapa[la.parroquia], mapa[la.clave], mapa[la.celular]]).toEqual([undefined, undefined, undefined]);
    expect([mapa[lb.parroquia], mapa[lb.clave], mapa[lb.celular]].every(Boolean)).toBe(true);
    expect(JSON.parse(mapa['pev_app_ajustes_slugs_v1'])).toEqual(['san-b']);
  });
  it('borrarTodo borra lo bajado, lo del celular, el micrófono y el índice', async () => {
    await a.guardarDeParroquia('san-a', P, K);
    await a.guardarCelular('san-a', { servidor: 'rtmps://c/', clave: 'FB-CLAVE-FALSA-2222', calidad: '720p', claveParroquiaVista: null });
    await a.guardarDeParroquia('san-b', P, K);
    await a.guardarCelular('san-b', { calidad: '720p' });
    await a.guardarMicrofono('externo');
    await a.borrarTodo();
    for (const s of ['san-a', 'san-b']) {
      expect(await a.leer(s)).toEqual({ parroquia: null, clave: null, celular: {}, microfono: 'celular' });
    }
    expect(mapa['pev_app_ajustes_slugs_v1']).toBeUndefined();
  });
});

describe('borrarViejos', () => {
  it('borra parroquia_ajustes_v1 y nada más', async () => {
    mapa['parroquia_ajustes_v1'] = '{}';
    mapa['pev_app_microfono_v1'] = 'externo';
    await a.borrarViejos();
    expect(Object.keys(mapa)).toEqual(['pev_app_microfono_v1']);
  });
});
