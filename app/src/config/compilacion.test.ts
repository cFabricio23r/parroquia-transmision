import { leerConfigCompilacion } from './compilacion';

const VALIDAS = {
  EXPO_PUBLIC_PLATAFORMA_ORIGEN: 'HTTPS://Plataforma.Vercel.App/',
  EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co/',
  EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA: 'sb_publishable_FALSA_DE_PRUEBA',
};

describe('leerConfigCompilacion', () => {
  it('con las tres variables válidas da la configuración con los orígenes normalizados', () => {
    expect(leerConfigCompilacion(VALIDAS)).toEqual({
      ok: true,
      config: {
        origenPlataforma: 'https://plataforma.vercel.app',
        supabaseUrl: 'https://abcdefgh.supabase.co',
        supabaseClavePublica: 'sb_publishable_FALSA_DE_PRUEBA',
      },
    });
  });

  it('dice qué variable falta', () => {
    const { EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA: _sin, ...resto } = VALIDAS;
    expect(leerConfigCompilacion(resto)).toEqual({ ok: false, falta: 'EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA' });
  });

  it('rechaza un origen que no es https', () => {
    expect(leerConfigCompilacion({ ...VALIDAS, EXPO_PUBLIC_PLATAFORMA_ORIGEN: 'http://x' })).toEqual({
      ok: false,
      falta: 'EXPO_PUBLIC_PLATAFORMA_ORIGEN',
    });
  });

  it('rechaza una URL de Supabase que no es un origen https', () => {
    expect(leerConfigCompilacion({ ...VALIDAS, EXPO_PUBLIC_SUPABASE_URL: 'http://x.supabase.co' })).toEqual({
      ok: false,
      falta: 'EXPO_PUBLIC_SUPABASE_URL',
    });
  });

  it('nunca acepta la clave secreta', () => {
    expect(
      leerConfigCompilacion({ ...VALIDAS, EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA: 'sb_secret_FALSA_DE_PRUEBA' }),
    ).toEqual({ ok: false, falta: 'EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA' });
  });

  it('rechaza una clave vacía', () => {
    expect(leerConfigCompilacion({ ...VALIDAS, EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA: '   ' })).toEqual({
      ok: false,
      falta: 'EXPO_PUBLIC_SUPABASE_CLAVE_PUBLICA',
    });
  });
});
