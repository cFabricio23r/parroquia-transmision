// Pruebas de los ajustes efectivos por parroquia. Las claves son falsas, solo para pruebas.
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
import { ajustesParroquia as ap, leerAjustesDe } from './ajustesParroquia';
import { almacenAjustes, llavesDe } from './almacen';
import { AjustesDeParroquia, ClaveDeParroquia, resolverAjustes } from './origen';

const P: AjustesDeParroquia = { servidor: 'rtmps://p/', calidad: '1080p', estiloFinal: 'claro', actualizadoEn: '2026-11-14T10:00:00Z' };
const K: ClaveDeParroquia = { clave: 'FB-CLAVE-FALSA-1111', guardadaEn: '2026-11-14T10:00:00Z' };

beforeEach(async () => {
  for (const k of Object.keys(mapa)) delete mapa[k];
  await almacenAjustes.guardarDeParroquia('san-a', P, K);
  await almacenAjustes.guardarDeParroquia('san-b', P, K);
});

describe('ajustesParroquia', () => {
  it('la clave del celular queda en A y no toca B', async () => {
    const antesB = mapa[llavesDe('san-b').celular];
    const e = await ap.cambiarEnCelular('san-a', 'clave', 'FB-CLAVE-FALSA-2222');
    expect(e.origen.clave).toBe('celular');
    expect(mapa[llavesDe('san-b').celular]).toBe(antesB);
  });
  it('volver deja la de la parroquia', async () => {
    await ap.cambiarEnCelular('san-a', 'clave', 'FB-CLAVE-FALSA-2222');
    expect((await ap.volver('san-a', 'clave')).origen.clave).toBe('parroquia');
  });
  it('seguir con la del celular quita el aviso', async () => {
    await almacenAjustes.guardarCelular('san-a', { clave: 'FB-CLAVE-FALSA-2222', claveParroquiaVista: null });
    expect((await ap.leerEfectivos('san-a')).claveNueva).toBe(true);
    expect((await ap.seguirConLaDelCelular('san-a')).claveNueva).toBe(false);
  });
  it('el micrófono va a su llave', async () => {
    const e = await ap.cambiarMicrofono('san-a', 'externo');
    expect(mapa['pev_app_microfono_v1']).toBe('externo');
    expect(e.ajustes.microfono).toBe('externo');
  });
});

describe('leerAjustesDe', () => {
  it('sin parroquia rechaza', async () => {
    await expect(leerAjustesDe(null)).rejects.toThrow('Sin parroquia elegida.');
  });
  it('con parroquia da los ajustes efectivos', async () => {
    expect(await leerAjustesDe({ id: 'p-1', slug: 'san-a', nombre: 'A' })).toEqual(resolverAjustes(P, K, {}, 'celular').ajustes);
  });
  it('si el almacén falla, rechaza', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('fallo'));
    await expect(leerAjustesDe({ id: 'p-1', slug: 'san-a', nombre: 'A' })).rejects.toBeDefined();
  });
});
