// Pruebas de ajustes. Los valores de clave son falsos, solo para pruebas.
const almacen: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in almacen ? almacen[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    almacen[k] = v;
  }),
}));

import { AJUSTES_INICIALES, estiloFinalValido, limpiarClave, puedeGuardar, validar, Ajustes } from './ajustes';

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

describe('pantalla final (Tarea 9d)', () => {
  it('por defecto es Azul', () => {
    expect(AJUSTES_INICIALES.estiloFinal).toBe('azul');
  });
  it('estiloFinalValido solo deja pasar claro y azul', () => {
    expect(estiloFinalValido('claro')).toBe('claro');
    expect(estiloFinalValido('azul')).toBe('azul');
    for (const x of ['', 'Claro', "claro'); alert(1", null, undefined, 3]) expect(estiloFinalValido(x)).toBe('azul');
  });
});

describe('normalización', () => {
  it('validar acepta valores con espacios en las puntas', () => {
    expect(validar({ ...base, clave: 'abc\n', servidor: ' rtmps://x' })).toEqual({ ok: true });
  });
});

describe('carga segura', () => {
  it('solo se puede guardar cuando la carga terminó bien', () => {
    expect(puedeGuardar('cargando')).toBe(false);
    expect(puedeGuardar('error')).toBe(false);
    expect(puedeGuardar('listo')).toBe(true);
  });
});
