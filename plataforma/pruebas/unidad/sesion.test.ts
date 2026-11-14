import { describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MENSAJES_ACCESO } from '../../lib/mensajes-acceso';
import {
  cambiarClaveConActual,
  entrar,
  esLimiteDeIntentos,
  MENSAJE_CLAVE_ACTUAL,
  MENSAJE_RECUPERAR,
  pedirRecuperacionDiferida,
  resolverSitioUrl,
  type DepsRecuperacion,
} from '../../lib/sesion';

describe('pedirRecuperacionDiferida', () => {
  it('responde el mensaje sin esperar el envío', () => {
    let tarea: (() => Promise<unknown>) | undefined;
    const enviar = vi.fn();
    // Cliente que falla si se toca: la tarea está programada, no corrida.
    const servicio = new Proxy({}, { get: () => { throw new Error('no debía tocarse'); } });
    const deps = { servicio, enviar, sitioUrl: 'http://x' } as unknown as DepsRecuperacion;
    const r = pedirRecuperacionDiferida(deps, 'a@b.test', (t) => { tarea = t; });
    expect(r).toEqual({ mensaje: MENSAJE_RECUPERAR });
    expect(tarea).toBeTypeOf('function');
    expect(enviar).not.toHaveBeenCalled();
  });
});

describe('resolverSitioUrl', () => {
  it('usa SITIO_URL sin barra final', () => {
    expect(resolverSitioUrl({ SITIO_URL: 'https://x.org/', NODE_ENV: 'production' })).toBe('https://x.org');
  });
  it('cae a localhost solo en desarrollo o pruebas', () => {
    expect(resolverSitioUrl({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
    expect(resolverSitioUrl({ NODE_ENV: 'test' })).toBe('http://localhost:3000');
  });
  it('en producción sin SITIO_URL falla', () => {
    expect(() => resolverSitioUrl({ NODE_ENV: 'production' })).toThrow(/SITIO_URL/);
    expect(() => resolverSitioUrl({})).toThrow(/SITIO_URL/);
  });
});

// ---- Plan 2, tarea 10: códigos de error y cambiar la contraseña con la actual ----

type ErrorFalso = { code?: string; status?: number; message?: string } | null;

function clienteFalso(opciones: { errorEntrar?: ErrorFalso; usuario?: { id: string; email: string } | null; errorActualizar?: ErrorFalso } = {}) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: opciones.errorEntrar ?? null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: opciones.usuario === undefined ? { id: 'u1', email: 'a@b.test' } : opciones.usuario } }),
    updateUser: vi.fn().mockResolvedValue({ data: {}, error: opciones.errorActualizar ?? null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  return { cliente: { auth } as unknown as SupabaseClient, auth };
}

describe('entrar devuelve códigos', () => {
  it('credenciales malas → incorrectos; límite → muchos-intentos', async () => {
    expect(await entrar(clienteFalso({ errorEntrar: { code: 'invalid_credentials', status: 400 } }).cliente, 'a@b.test', 'x')).toEqual({ error: 'incorrectos' });
    expect(await entrar(clienteFalso({ errorEntrar: { code: 'over_request_rate_limit', status: 429 } }).cliente, 'a@b.test', 'x')).toEqual({ error: 'muchos-intentos' });
    expect(await entrar(clienteFalso({ errorEntrar: { status: 429 } }).cliente, 'a@b.test', 'x')).toEqual({ error: 'muchos-intentos' });
    expect(await entrar(clienteFalso().cliente, 'a@b.test', 'x')).toEqual({});
  });
  it('esLimiteDeIntentos', () => {
    expect(esLimiteDeIntentos(null)).toBe(false);
    expect(esLimiteDeIntentos({ code: 'invalid_credentials', status: 400 })).toBe(false);
    expect(esLimiteDeIntentos({ code: 'over_request_rate_limit' })).toBe(true);
    expect(esLimiteDeIntentos({ status: 429 })).toBe(true);
  });
});

describe('cambiarClaveConActual', () => {
  it('con la actual mala no llama updateUser', async () => {
    const sesion = clienteFalso();
    const verificador = clienteFalso({ errorEntrar: { code: 'invalid_credentials', status: 400 } });
    const r = await cambiarClaveConActual({ sesion: sesion.cliente, verificador: () => verificador.cliente }, 'mala', 'nueva-clave-1', 'nueva-clave-1');
    expect(r).toEqual({ error: 'La contraseña actual no es correcta.', campo: 'actual' });
    expect(MENSAJE_CLAVE_ACTUAL).toBe('La contraseña actual no es correcta.');
    expect(sesion.auth.updateUser).not.toHaveBeenCalled();
  });
  it('con el verificador limitado → muchos-intentos', async () => {
    const sesion = clienteFalso();
    const verificador = clienteFalso({ errorEntrar: { code: 'over_request_rate_limit', status: 429 } });
    const r = await cambiarClaveConActual({ sesion: sesion.cliente, verificador: () => verificador.cliente }, 'mala', 'nueva-clave-1', 'nueva-clave-1');
    expect(r).toEqual({ codigo: 'muchos-intentos', error: MENSAJES_ACCESO['muchos-intentos'].texto });
    expect(sesion.auth.updateUser).not.toHaveBeenCalled();
  });
  it('con la actual buena: cierra solo el verificador (local) y cambia la clave en la sesión', async () => {
    const sesion = clienteFalso();
    const verificador = clienteFalso();
    const r = await cambiarClaveConActual({ sesion: sesion.cliente, verificador: () => verificador.cliente }, 'buena-1234', 'nueva-clave-1', 'nueva-clave-1');
    expect(r).toEqual({});
    expect(verificador.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.test', password: 'buena-1234' });
    expect(verificador.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(sesion.auth.updateUser).toHaveBeenCalledWith({ password: 'nueva-clave-1' });
    expect(sesion.auth.signOut).not.toHaveBeenCalled();
  });
  it('nueva corta o distinta → campo nueva, sin tocar ningún cliente', async () => {
    const sesion = clienteFalso();
    const verificador = clienteFalso();
    const crear = vi.fn(() => verificador.cliente);
    expect(await cambiarClaveConActual({ sesion: sesion.cliente, verificador: crear }, 'x', '1234567', '1234567')).toEqual({
      error: 'La contraseña necesita al menos 8 caracteres',
      campo: 'nueva',
    });
    expect(await cambiarClaveConActual({ sesion: sesion.cliente, verificador: crear }, 'x', '12345678', '12345679')).toEqual({
      error: 'Las contraseñas no coinciden',
      campo: 'nueva',
    });
    expect(crear).not.toHaveBeenCalled();
    expect(sesion.auth.getUser).not.toHaveBeenCalled();
  });
  it('sin sesión: el mensaje de sesión vencida; misma clave: elige otra', async () => {
    const sinSesion = clienteFalso({ usuario: null });
    expect(await cambiarClaveConActual({ sesion: sinSesion.cliente, verificador: () => clienteFalso().cliente }, 'x', 'nueva-clave-1', 'nueva-clave-1')).toEqual({
      error: 'Tu sesión venció. Entra de nuevo',
    });
    const igual = clienteFalso({ errorActualizar: { code: 'same_password', status: 422 } });
    expect(await cambiarClaveConActual({ sesion: igual.cliente, verificador: () => clienteFalso().cliente }, 'x', 'nueva-clave-1', 'nueva-clave-1')).toEqual({
      error: 'Elige una contraseña distinta de la anterior',
      campo: 'nueva',
    });
  });
});

// ---- Plan 2, ronda 2: sin conexión no es «contraseña incorrecta» ----

describe('sin conexión con Supabase', () => {
  const caido = () => new AuthRetryableFetchError('fetch failed', 0);
  function clienteCaido(opciones: { getUser?: boolean } = {}) {
    const auth = {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: caido() }),
      getUser: vi.fn().mockResolvedValue(
        opciones.getUser ? { data: { user: null }, error: caido() } : { data: { user: { id: 'u1', email: 'a@b.test' } }, error: null },
      ),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    };
    return { cliente: { auth } as unknown as SupabaseClient, auth };
  }

  it('entrar con la red caída → sin-conexion (no «incorrectos»)', async () => {
    expect(await entrar(clienteCaido().cliente, 'a@b.test', 'x')).toEqual({ error: 'sin-conexion' });
    // Un 503 del proyecto en pausa también llega como AuthRetryableFetchError.
    const pausa = clienteFalso();
    pausa.auth.signInWithPassword.mockResolvedValue({ data: {}, error: new AuthRetryableFetchError('Service Unavailable', 503) });
    expect(await entrar(pausa.cliente, 'a@b.test', 'x')).toEqual({ error: 'sin-conexion' });
  });
  it('un error de la API que no es de conexión sigue siendo «incorrectos»', async () => {
    const malo = clienteFalso();
    malo.auth.signInWithPassword.mockResolvedValue({ data: {}, error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') });
    expect(await entrar(malo.cliente, 'a@b.test', 'x')).toEqual({ error: 'incorrectos' });
  });
  it('cambiarClaveConActual: el verificador sin red → sin-conexion, no «la actual no es correcta»', async () => {
    const sesion = clienteFalso();
    const r = await cambiarClaveConActual({ sesion: sesion.cliente, verificador: () => clienteCaido().cliente }, 'buena', 'nueva-clave-1', 'nueva-clave-1');
    expect(r).toEqual({ codigo: 'sin-conexion', error: MENSAJES_ACCESO['sin-conexion'].texto });
    expect(sesion.auth.updateUser).not.toHaveBeenCalled();
  });
  it('cambiarClaveConActual: getUser sin red → sin-conexion, no «tu sesión venció»', async () => {
    const r = await cambiarClaveConActual({ sesion: clienteCaido({ getUser: true }).cliente, verificador: () => clienteFalso().cliente }, 'x', 'nueva-clave-1', 'nueva-clave-1');
    expect(r).toEqual({ codigo: 'sin-conexion', error: MENSAJES_ACCESO['sin-conexion'].texto });
  });
});
