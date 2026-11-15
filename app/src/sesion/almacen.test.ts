// Pruebas del almacén de la sesión. Los tokens son falsos, solo para pruebas.
const almacen: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => (k in almacen ? almacen[k] : null)),
  setItemAsync: jest.fn(async (k: string, v: string) => {
    almacen[k] = v;
  }),
  deleteItemAsync: jest.fn(async (k: string) => {
    delete almacen[k];
  }),
}));

import * as SecureStore from 'expo-secure-store';
import type { SesionSupabase } from '../supabase/cliente';
import { LLAVES, almacenSesion, crearAlmacen } from './almacen';
import type { Cuenta, ParroquiaApp } from './tipos';

const SESION: SesionSupabase = {
  accessToken: 'TOKEN-ACCESO-FALSO-1111',
  refreshToken: 'TOKEN-RENOVAR-FALSO-2222',
  expiraEn: 1_800_000_000,
  usuarioId: 'u-1',
  correo: 'ana@x.com',
};
const PARROQUIA: ParroquiaApp = { id: 'p-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const CUENTA: Cuenta = { usuarioId: 'u-1', correo: 'ana@x.com', nombre: 'Ana', esAdmin: false };

beforeEach(() => {
  for (const k of Object.keys(almacen)) delete almacen[k];
  jest.clearAllMocks();
});

describe('LLAVES', () => {
  it('son las seis de 3a', () => {
    expect(Object.values(LLAVES).sort()).toEqual(
      [
        'pev_app_acceso_v1',
        'pev_app_renovar_v1',
        'pev_app_sesion_v1',
        'pev_app_parroquia_v1',
        'pev_app_parroquias_v1',
        'pev_app_cuenta_v1',
      ].sort(),
    );
  });
});

describe('sesión', () => {
  it('guardar y leer devuelve lo mismo', async () => {
    await almacenSesion.guardarSesion(SESION);
    expect(await almacenSesion.leerSesion()).toEqual(SESION);
  });

  it('se guarda en tres llaves y ninguna lleva los dos tokens', async () => {
    await almacenSesion.guardarSesion(SESION);
    expect(almacen.pev_app_acceso_v1).toBe('TOKEN-ACCESO-FALSO-1111');
    expect(almacen.pev_app_renovar_v1).toBe('TOKEN-RENOVAR-FALSO-2222');
    expect(JSON.parse(almacen.pev_app_sesion_v1)).toEqual({ expiraEn: 1_800_000_000, usuarioId: 'u-1', correo: 'ana@x.com' });
    for (const v of Object.values(almacen)) {
      expect(v.includes('TOKEN-ACCESO-FALSO-1111') && v.includes('TOKEN-RENOVAR-FALSO-2222')).toBe(false);
    }
    expect(almacen.pev_app_sesion_v1).not.toContain('TOKEN');
  });

  it.each(['pev_app_acceso_v1', 'pev_app_renovar_v1', 'pev_app_sesion_v1'])('sin %s da null', async (llave) => {
    await almacenSesion.guardarSesion(SESION);
    delete almacen[llave];
    expect(await almacenSesion.leerSesion()).toBeNull();
  });

  it('con el JSON roto o con otra forma da null', async () => {
    await almacenSesion.guardarSesion(SESION);
    almacen.pev_app_sesion_v1 = '{roto';
    expect(await almacenSesion.leerSesion()).toBeNull();
    almacen.pev_app_sesion_v1 = JSON.stringify({ expiraEn: 'mañana', usuarioId: 'u-1', correo: 'a' });
    expect(await almacenSesion.leerSesion()).toBeNull();
  });

  it('si el almacén falla al leer, rechaza', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    await expect(almacenSesion.leerSesion()).rejects.toThrow();
  });

  it('borrarSesion quita las tres llaves', async () => {
    await almacenSesion.guardarSesion(SESION);
    await almacenSesion.borrarSesion();
    expect(await almacenSesion.leerSesion()).toBeNull();
    expect(Object.keys(almacen)).toEqual([]);
  });
});

describe('parroquia', () => {
  it('guardar y leer devuelve lo mismo', async () => {
    await almacenSesion.guardarParroquia(PARROQUIA);
    expect(await almacenSesion.leerParroquia()).toEqual(PARROQUIA);
    await almacenSesion.borrarParroquia();
    expect(await almacenSesion.leerParroquia()).toBeNull();
  });

  it('con un slug inválido da null', async () => {
    almacen.pev_app_parroquia_v1 = JSON.stringify({ ...PARROQUIA, slug: '../otra' });
    expect(await almacenSesion.leerParroquia()).toBeNull();
    almacen.pev_app_parroquia_v1 = '{roto';
    expect(await almacenSesion.leerParroquia()).toBeNull();
  });

  it('la lista descarta la fila mala y conserva las otras', async () => {
    const otra: ParroquiaApp = { id: 'p-2', slug: 'san-jose', nombre: 'San José' };
    almacen.pev_app_parroquias_v1 = JSON.stringify([PARROQUIA, { id: 'p-3', slug: 'Mala', nombre: 'X' }, 5, otra]);
    expect(await almacenSesion.leerParroquias()).toEqual([PARROQUIA, otra]);
  });

  it('guardar y leer la lista devuelve lo mismo; sin lista da []', async () => {
    expect(await almacenSesion.leerParroquias()).toEqual([]);
    await almacenSesion.guardarParroquias([PARROQUIA]);
    expect(await almacenSesion.leerParroquias()).toEqual([PARROQUIA]);
    almacen.pev_app_parroquias_v1 = '{"no":"lista"}';
    expect(await almacenSesion.leerParroquias()).toEqual([]);
  });
});

describe('cuenta', () => {
  it('guardar y leer devuelve lo mismo', async () => {
    await almacenSesion.guardarCuenta(CUENTA);
    expect(await almacenSesion.leerCuenta()).toEqual(CUENTA);
    await almacenSesion.guardarCuenta({ ...CUENTA, nombre: null, esAdmin: true });
    expect(await almacenSesion.leerCuenta()).toEqual({ ...CUENTA, nombre: null, esAdmin: true });
  });

  it('con otra forma da null', async () => {
    almacen.pev_app_cuenta_v1 = JSON.stringify({ usuarioId: 'u-1', correo: 'a', nombre: 3, esAdmin: false });
    expect(await almacenSesion.leerCuenta()).toBeNull();
  });
});

describe('borrarTodo', () => {
  it('borra las seis llaves y no toca parroquia_ajustes_v1', async () => {
    almacen.parroquia_ajustes_v1 = '{"clave":"FB-123-abc"}';
    await almacenSesion.guardarSesion(SESION);
    await almacenSesion.guardarParroquia(PARROQUIA);
    await almacenSesion.guardarParroquias([PARROQUIA]);
    await almacenSesion.guardarCuenta(CUENTA);
    await almacenSesion.borrarTodo();
    expect(Object.keys(almacen)).toEqual(['parroquia_ajustes_v1']);
  });
});

describe('crearAlmacen', () => {
  it('usa el store que se le pasa', async () => {
    const mem: Record<string, string> = {};
    const a = crearAlmacen({
      getItemAsync: async (k) => (k in mem ? mem[k] : null),
      setItemAsync: async (k, v) => {
        mem[k] = v;
      },
      deleteItemAsync: async (k) => {
        delete mem[k];
      },
    });
    await a.guardarParroquia(PARROQUIA);
    expect(JSON.parse(mem.pev_app_parroquia_v1)).toEqual(PARROQUIA);
    expect(almacen.pev_app_parroquia_v1).toBeUndefined();
  });
});
