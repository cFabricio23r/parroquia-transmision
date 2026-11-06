// Pruebas de ajustes. Los valores de clave son falsos, solo para pruebas.
const almacen: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in almacen ? almacen[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    almacen[k] = v;
  }),
}));

import * as SecureStore from 'expo-secure-store';
import { AJUSTES_INICIALES, guardarAjustes, leerAjustes, limpiarClave, puedeGuardar, validar, Ajustes } from './ajustes';

const base: Ajustes = { ...AJUSTES_INICIALES, servidor: 'rtmps://ejemplo.invalido:443/rtmp/', clave: 'FB-123-abc' };

beforeEach(() => {
  for (const k of Object.keys(almacen)) delete almacen[k];
});

describe('limpiarClave', () => {
  it('recorta espacios y saltos de línea de las puntas', () => {
    expect(limpiarClave('  FB-123-abc\n')).toBe('FB-123-abc');
    expect(limpiarClave('\r\n\tFB-123-abc \t')).toBe('FB-123-abc');
  });
  it('no toca el medio', () => {
    expect(limpiarClave(' FB 123 ')).toBe('FB 123');
  });
});

describe('validar', () => {
  it('acepta ajustes completos', () => {
    expect(validar(base)).toEqual({ ok: true });
  });
  it('pide la clave si está vacía', () => {
    expect(validar({ ...base, clave: '' })).toEqual({
      ok: false,
      campo: 'clave',
      mensaje: 'Pegue la clave de transmisión de Facebook.',
    });
  });
  it('rechaza espacios en el medio de la clave', () => {
    expect(validar({ ...base, clave: 'FB 123' })).toEqual({
      ok: false,
      campo: 'clave',
      mensaje: 'La clave no puede tener espacios.',
    });
  });
  it('rechaza un servidor que no empieza con rtmps://', () => {
    expect(validar({ ...base, servidor: 'rtmp://x' })).toEqual({
      ok: false,
      campo: 'servidor',
      mensaje: 'El servidor debe empezar con rtmps://',
    });
  });
  it('valida la clave antes que el servidor', () => {
    const r = validar({ ...base, clave: '', servidor: '' });
    expect(r).toMatchObject({ ok: false, campo: 'clave' });
  });
});

describe('guardar y leer', () => {
  it('devuelve lo mismo que se guardó', async () => {
    const a: Ajustes = { ...base, calidad: '1080p', microfono: 'externo' };
    await guardarAjustes(a);
    expect(await leerAjustes()).toEqual(a);
  });
  it('sin nada guardado devuelve los iniciales', async () => {
    expect(await leerAjustes()).toEqual(AJUSTES_INICIALES);
  });
  it('guarda un solo JSON bajo parroquia_ajustes_v1', async () => {
    await guardarAjustes(base);
    expect(Object.keys(almacen)).toEqual(['parroquia_ajustes_v1']);
  });
  it('con datos dañados devuelve los iniciales', async () => {
    almacen['parroquia_ajustes_v1'] = '{no es json';
    expect(await leerAjustes()).toEqual(AJUSTES_INICIALES);
  });
  it('completa campos que falten o tengan valores inválidos', async () => {
    almacen['parroquia_ajustes_v1'] = JSON.stringify({ clave: 'FB-123-abc', calidad: '4k' });
    expect(await leerAjustes()).toEqual({ ...AJUSTES_INICIALES, clave: 'FB-123-abc' });
  });
});

describe('normalización', () => {
  it('guarda la clave y el servidor sin espacios en las puntas', async () => {
    await guardarAjustes({ ...base, clave: 'abc\n', servidor: ' rtmps://x ' });
    expect(JSON.parse(almacen['parroquia_ajustes_v1'])).toMatchObject({ clave: 'abc', servidor: 'rtmps://x' });
    expect(await leerAjustes()).toMatchObject({ clave: 'abc', servidor: 'rtmps://x' });
  });
  it('validar acepta valores con espacios en las puntas', () => {
    expect(validar({ ...base, clave: 'abc\n', servidor: ' rtmps://x' })).toEqual({ ok: true });
  });
  it('leerAjustes normaliza lo que ya estaba guardado sin recortar', async () => {
    almacen['parroquia_ajustes_v1'] = JSON.stringify({ ...base, clave: 'abc\n', servidor: ' rtmps://x ' });
    expect(await leerAjustes()).toMatchObject({ clave: 'abc', servidor: 'rtmps://x' });
  });
});

describe('carga segura', () => {
  it('solo se puede guardar cuando la carga terminó bien', () => {
    expect(puedeGuardar('cargando')).toBe(false);
    expect(puedeGuardar('error')).toBe(false);
    expect(puedeGuardar('listo')).toBe(true);
  });
  it('si el almacén falla al leer, leerAjustes rechaza (no devuelve iniciales)', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('fallo'));
    await expect(leerAjustes()).rejects.toBeDefined();
  });
});
