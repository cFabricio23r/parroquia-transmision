import type { ClienteSupabase, Resultado, SesionSupabase } from '../supabase/cliente';
import { CONSULTA_PARROQUIAS, leerCuenta, leerParroquias, revisarAcceso } from './parroquias';
import type { SesionApp } from './sesion';
import type { ParroquiaApp } from './tipos';

const SESION: SesionSupabase = {
  accessToken: 'TOKEN-ACCESO-FALSO-1111',
  refreshToken: 'TOKEN-RENOVAR-FALSO-2222',
  expiraEn: 2_000_000_000,
  usuarioId: 'u-1',
  correo: 'ana@x.com',
};

/** Una sesión que corre fn con SESION y anota cuántas veces se usó conSesion. */
function sesionFalsa() {
  const conSesion = jest.fn(<T>(fn: (s: SesionSupabase) => Promise<Resultado<T>>) => fn(SESION));
  return { sesion: { conSesion } as unknown as SesionApp, conSesion };
}

function clienteFalso(responder: (tabla: string, consulta: Record<string, string>) => Resultado<unknown[]>) {
  const seleccionar = jest.fn(async (_s: SesionSupabase, tabla: string, consulta: Record<string, string>) =>
    responder(tabla, consulta),
  );
  return { cliente: { seleccionar } as unknown as ClienteSupabase, seleccionar };
}

const A: ParroquiaApp = { id: 'p-1', slug: 'ciudad-arce', nombre: 'Ciudad Arce' };
const B: ParroquiaApp = { id: 'p-2', slug: 'san-jose', nombre: 'San José' };

describe('CONSULTA_PARROQUIAS', () => {
  it('es la de la Decisión 8', () => {
    expect(CONSULTA_PARROQUIAS).toEqual({
      select: 'id,slug,nombre',
      visible: 'eq.true',
      desactivada_en: 'is.null',
      order: 'nombre.asc',
    });
  });
});

describe('leerParroquias', () => {
  it('pide la consulta exacta dentro de conSesion y descarta las filas malas', async () => {
    const { sesion, conSesion } = sesionFalsa();
    const { cliente, seleccionar } = clienteFalso(() => ({
      ok: true,
      valor: [A, { id: 'p-3', slug: 'Mala', nombre: 'X' }, { id: 4, slug: 'abc', nombre: 'Y' }, { id: 'p-5', slug: 'abc' }, B],
    }));
    expect(await leerParroquias(sesion, cliente)).toEqual({ ok: true, valor: [A, B] });
    expect(conSesion).toHaveBeenCalledTimes(1);
    expect(seleccionar).toHaveBeenCalledWith(SESION, 'parroquias', CONSULTA_PARROQUIAS);
  });

  it('pasa el error tal cual', async () => {
    const { sesion } = sesionFalsa();
    const { cliente } = clienteFalso(() => ({ ok: false, error: { tipo: 'sin-conexion' } }));
    expect(await leerParroquias(sesion, cliente)).toEqual({ ok: false, error: { tipo: 'sin-conexion' } });
  });
});

describe('leerCuenta', () => {
  it('pide el perfil y si es admin, con el id del usuario', async () => {
    const { sesion } = sesionFalsa();
    const { cliente, seleccionar } = clienteFalso((tabla) =>
      tabla === 'perfiles' ? { ok: true, valor: [{ nombre: 'Ana Pérez' }] } : { ok: true, valor: [{ usuario_id: 'u-1' }] },
    );
    expect(await leerCuenta(sesion, cliente)).toEqual({
      ok: true,
      valor: { usuarioId: 'u-1', correo: 'ana@x.com', nombre: 'Ana Pérez', esAdmin: true },
    });
    expect(seleccionar).toHaveBeenCalledWith(SESION, 'perfiles', { select: 'nombre', usuario_id: 'eq.u-1' });
    expect(seleccionar).toHaveBeenCalledWith(SESION, 'administradores', { select: 'usuario_id', usuario_id: 'eq.u-1' });
  });

  it('sin perfil el nombre es null; sin fila de admin no es admin', async () => {
    const { sesion } = sesionFalsa();
    const { cliente } = clienteFalso(() => ({ ok: true, valor: [] }));
    expect(await leerCuenta(sesion, cliente)).toEqual({
      ok: true,
      valor: { usuarioId: 'u-1', correo: 'ana@x.com', nombre: null, esAdmin: false },
    });
  });

  it('un nombre vacío o que no es texto queda null', async () => {
    const { sesion } = sesionFalsa();
    const { cliente } = clienteFalso((tabla) => (tabla === 'perfiles' ? { ok: true, valor: [{ nombre: '  ' }] } : { ok: true, valor: [] }));
    const r = await leerCuenta(sesion, cliente);
    expect(r.ok && r.valor.nombre).toBeNull();
  });

  it('si falla una consulta, da el error', async () => {
    const { sesion } = sesionFalsa();
    const { cliente } = clienteFalso((tabla) =>
      tabla === 'administradores' ? { ok: false, error: { tipo: 'permiso' } } : { ok: true, valor: [] },
    );
    expect(await leerCuenta(sesion, cliente)).toEqual({ ok: false, error: { tipo: 'permiso' } });
  });
});

describe('revisarAcceso', () => {
  it('si la parroquia está, da ok con lo de la lista (el nombre nuevo)', () => {
    expect(revisarAcceso([B, { ...A, nombre: 'Ciudad Arce (nuevo)' }], A)).toEqual({
      tipo: 'ok',
      parroquia: { ...A, nombre: 'Ciudad Arce (nuevo)' },
    });
  });

  it('si no está, da sin-acceso', () => {
    expect(revisarAcceso([B], A)).toEqual({ tipo: 'sin-acceso' });
    expect(revisarAcceso([], A)).toEqual({ tipo: 'sin-acceso' });
  });
});
